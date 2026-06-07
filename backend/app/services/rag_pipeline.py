"""RAG pipeline orchestrator. answer() for non-streaming, stream_answer() for SSE."""
import logging
import re
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
CITE_SECTION = (
    "Cite the section title for each claim. "
    "If no provided section supports a claim, say so explicitly."
)
REFUSE_TEMPLATE = (
    "I could not find a well-grounded answer for this question in the provided source. "
    "Try rephrasing, or check if the relevant section is in the document."
)

# Bound how much prior conversation is replayed to the model each turn — the full
# client-supplied history is otherwise re-sent on top of the (large) grounding context.
_MAX_HISTORY_MESSAGES = 12


def _trim_history(messages: list) -> list:
    if not messages or len(messages) <= _MAX_HISTORY_MESSAGES:
        return messages
    return messages[-_MAX_HISTORY_MESSAGES:]


def _render_chunks(chunks: list[RetrievedChunk]) -> str:
    parts = []
    for c in chunks:
        page = f"p.{c.page_start}" if c.page_start else "?"
        parts.append(f'<chunk page="{page}">\n{c.raw_text}\n</chunk>')
    return "\n\n".join(parts)


def _build_citations(chunks: list[RetrievedChunk]) -> list[dict]:
    """Map the chunks that grounded an answer to the citation contract the chat
    surface renders. Only the chunks actually fed to the model are cited, so a
    click jumps to text the answer was built from."""
    return [c.to_citation() for c in chunks]


# Sentinel key the SSE router recognises on the terminal frame to carry the
# citations array alongside the streamed tokens (tokens are plain strings).
CITATIONS_KEY = "__citations__"


def _build_system(context: str, cite: str) -> str:
    """Build a grounded system prompt from a single context channel + a citation rule.

    One channel only (chunks OR a structural section) — never stack summary + chunks
    of the same document, which re-delivers the same content as competing 'facts'.
    """
    parts = []
    if context:
        parts.append(f"## Relevant Sections\n{context}")
    parts.append(f"## Instructions\n{cite}")
    return "\n\n".join(parts)


async def _multi_retrieve(queries, db, user_id, document_id, query_for_rerank):
    # Dedupe by chunk_id but ACCUMULATE rrf_score across query variants, so a chunk
    # surfaced by several expanded queries keeps its aggregated cross-query evidence.
    seen: dict[int, RetrievedChunk] = {}
    order = []
    for q in queries:
        for c in await hybrid_retrieve(q, db, user_id, document_id):
            if c.chunk_id in seen:
                seen[c.chunk_id].rrf_score += c.rrf_score
            else:
                seen[c.chunk_id] = c
                order.append(c)
    return rerank(query_for_rerank, order)


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


async def answer(query, messages, db: Session, user_id: int, document_id: Optional[int] = None) -> tuple[str, list[dict]]:
    """Return the grounded reply plus the citations that backed it. Citations are
    empty for ungrounded paths (no document, structural section, refusal)."""
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    doc = _load_doc(db, document_id, user_id)
    messages = _trim_history(messages)

    # No document selected → general assistant, no RAG grounding.
    if doc is None:
        reply = await provider.chat_completion(messages=messages, system_prompt=_GENERAL_SYSTEM)
        return reply, []

    # Small doc → stuff the whole text (single grounding channel; no separate summary).
    if _should_stuff(doc):
        system = f"<document>\n{doc.parsed_md or doc.content or ''}\n</document>\n\n{CITE_INSTRUCTION}"
        reply = await provider.chat_completion(messages=messages, system_prompt=system)
        return reply, []

    intent = await classify_intent(query)
    if intent == "structural":
        system = _build_system(_resolve_structural(query, doc), CITE_SECTION)
        reply = await provider.chat_completion(messages=messages, system_prompt=system)
        return reply, []

    if intent == "compositional":
        ranked = await _multi_retrieve(await decompose_query(query), db, user_id, document_id, query)
    else:
        ranked = await _multi_retrieve(await expand_query(query), db, user_id, document_id, query)

    # Grounding gate: refuse when there is nothing, OR when the best chunk's calibrated
    # relevance is below threshold. (The threshold previously gated nothing.)
    if not ranked or top1_score(ranked) < settings.grounding_threshold:
        return REFUSE_TEMPLATE, []

    top_chunks = [c for c, _ in ranked[: settings.rerank_topk]]
    system = _build_system(_render_chunks(top_chunks), CITE_INSTRUCTION)
    reply = await provider.chat_completion(messages=messages, system_prompt=system)
    return reply, _build_citations(top_chunks)


async def stream_answer(query, messages, db: Session, user_id: int, document_id: Optional[int] = None) -> AsyncIterable[str | dict]:
    """Yield reply tokens (str), then a terminal {CITATIONS_KEY: [...]} dict so the
    SSE router can forward the grounding references on the final frame. Tokens are
    always plain strings; the citations dict is the only non-string item emitted."""
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    doc = _load_doc(db, document_id, user_id)
    messages = _trim_history(messages)

    # No document selected → general assistant, no RAG grounding.
    if doc is None:
        async for chunk in provider.stream_completion(messages=messages, system_prompt=_GENERAL_SYSTEM):
            yield chunk
        yield {CITATIONS_KEY: []}
        return

    if _should_stuff(doc):
        system = f"<document>\n{doc.parsed_md or doc.content or ''}\n</document>\n\n{CITE_INSTRUCTION}"
        async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
            yield chunk
        yield {CITATIONS_KEY: []}
        return

    citations: list[dict] = []
    intent = await classify_intent(query)
    if intent == "structural":
        system = _build_system(_resolve_structural(query, doc), CITE_SECTION)
    else:
        if intent == "compositional":
            ranked = await _multi_retrieve(await decompose_query(query), db, user_id, document_id, query)
        else:
            ranked = await _multi_retrieve(await expand_query(query), db, user_id, document_id, query)
        # Same grounding gate as answer(): refuse on empty OR below-threshold grounding.
        if not ranked or top1_score(ranked) < settings.grounding_threshold:
            yield REFUSE_TEMPLATE
            yield {CITATIONS_KEY: []}
            return
        top_chunks = [c for c, _ in ranked[: settings.rerank_topk]]
        citations = _build_citations(top_chunks)
        system = _build_system(_render_chunks(top_chunks), CITE_INSTRUCTION)

    async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
        yield chunk
    yield {CITATIONS_KEY: citations}
