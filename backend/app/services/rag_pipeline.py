"""RAG pipeline orchestrator. answer() for non-streaming, stream_answer() for SSE."""
import logging
import re
from dataclasses import dataclass
from typing import AsyncIterable, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.orm import Document
from app.services.ai import get_provider_with_fallback
from app.services.retrieval import hybrid_retrieve, RetrievedChunk
from app.services.reranker import rerank, top1_score
from app.services.intent_classifier import classify_intent
from app.services.query_expander import expand_query, decompose_query

logger = logging.getLogger(__name__)

CITE_INSTRUCTION = (
    "Cite every factual claim with the page number in brackets, e.g. [p.42]. "
    "If no source supports a claim, say so explicitly."
)
REFUSE_TEMPLATE = (
    "I could not find a well-grounded answer for this question in the provided source. "
    "Try rephrasing, or check if the relevant section is in the document."
)


@dataclass
class _DocStub:
    summary: str = ""
    section_summaries: list = None
    parsed_md: str = ""
    content: str = ""
    token_count: int = 0

    def __post_init__(self):
        if self.section_summaries is None:
            self.section_summaries = []


def _empty_doc():
    return _DocStub()


def _render_chunks(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for c in chunks:
        page = f"p.{c.page_start}" if c.page_start else "?"
        parts.append(f'<chunk page="{page}">\n{c.raw_text}\n</chunk>')
    return "\n\n".join(parts)


def _build_system(doc, chunk_context: str = "") -> str:
    parts = []
    if getattr(doc, "summary", None):
        parts.append(f"## Document Summary\n{doc.summary}")
    if chunk_context:
        parts.append(f"## Relevant Sections\n{chunk_context}")
    parts.append(f"## Instructions\n{CITE_INSTRUCTION}")
    return "\n\n".join(parts)


async def _multi_retrieve(queries, db, user_id, document_id, query_for_rerank):
    seen = set()
    all_chunks = []
    for q in queries:
        for c in await hybrid_retrieve(q, db, user_id, document_id):
            if c.chunk_id not in seen:
                seen.add(c.chunk_id)
                all_chunks.append(c)
    return rerank(query_for_rerank, all_chunks)


def _resolve_structural(query: str, doc) -> str:
    sums = getattr(doc, "section_summaries", None) or []
    m = re.search(r"(chapter|section|ch|sec)\.?\s*(\d+)", query, re.IGNORECASE)
    if not m or not sums:
        return ""
    target = int(m.group(2))
    if 0 < target <= len(sums):
        s = sums[target - 1]
        return f"**{s.get('section_title', '')}**\n{s.get('summary', '')}"
    return ""


def _should_stuff(doc) -> bool:
    tc = getattr(doc, "token_count", 0) or 0
    return 0 < tc < settings.stuff_threshold


def _load_doc(db, document_id, user_id):
    if not document_id:
        return None
    return db.query(Document).filter(
        Document.id == document_id, Document.user_id == user_id
    ).first()


_GENERAL_SYSTEM = (
    "You are DocMind, a helpful AI study assistant. Answer clearly and concisely. "
    "When the user has not attached a document, draw on general knowledge."
)


async def answer(query, messages, db: Session, user_id: int, document_id: Optional[int] = None) -> str:
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    doc = _load_doc(db, document_id, user_id)

    # No document selected → general assistant, no RAG grounding.
    if doc is None:
        return await provider.chat_completion(messages=messages, system_prompt=_GENERAL_SYSTEM)

    if doc and _should_stuff(doc):
        system = f"{doc.summary or ''}\n\n<document>\n{doc.parsed_md or doc.content or ''}\n</document>\n\n{CITE_INSTRUCTION}"
        return await provider.chat_completion(messages=messages, system_prompt=system)

    intent = await classify_intent(query)
    if intent == "structural":
        system = _build_system(doc or _empty_doc(), _resolve_structural(query, doc or _empty_doc()))
        return await provider.chat_completion(messages=messages, system_prompt=system)

    if intent == "compositional":
        ranked = await _multi_retrieve(await decompose_query(query), db, user_id, document_id, query)
    else:
        ranked = await _multi_retrieve(await expand_query(query), db, user_id, document_id, query)

    if top1_score(ranked) < settings.grounding_threshold:
        # No reliable grounding. If we have any chunks, answer from them; else refuse.
        if not ranked:
            return REFUSE_TEMPLATE
    top_chunks = [c for c, _ in ranked[: settings.rerank_topk]]
    system = _build_system(doc or _empty_doc(), _render_chunks(top_chunks))
    return await provider.chat_completion(messages=messages, system_prompt=system)


async def stream_answer(query, messages, db: Session, user_id: int, document_id: Optional[int] = None) -> AsyncIterable[str]:
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    doc = _load_doc(db, document_id, user_id)

    # No document selected → general assistant, no RAG grounding.
    if doc is None:
        async for chunk in provider.stream_completion(messages=messages, system_prompt=_GENERAL_SYSTEM):
            yield chunk
        return

    if doc and _should_stuff(doc):
        system = f"{doc.summary or ''}\n\n<document>\n{doc.parsed_md or doc.content or ''}\n</document>\n\n{CITE_INSTRUCTION}"
        async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
            yield chunk
        return

    intent = await classify_intent(query)
    if intent == "structural":
        system = _build_system(doc or _empty_doc(), _resolve_structural(query, doc or _empty_doc()))
    elif intent == "compositional":
        ranked = await _multi_retrieve(await decompose_query(query), db, user_id, document_id, query)
        if not ranked:
            yield REFUSE_TEMPLATE
            return
        system = _build_system(doc or _empty_doc(), _render_chunks([c for c, _ in ranked[: settings.rerank_topk]]))
    else:
        ranked = await _multi_retrieve(await expand_query(query), db, user_id, document_id, query)
        if not ranked:
            yield REFUSE_TEMPLATE
            return
        system = _build_system(doc or _empty_doc(), _render_chunks([c for c, _ in ranked[: settings.rerank_topk]]))

    async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
        yield chunk
