"""
ARQ worker tasks: ingest_document, generate_audio_recap_task.
Full ingestion pipeline: parse → summary → chunk → contextualise → embed → store.
"""
import logging

import tiktoken
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.orm import Document, Chunk
from app.services.docling_parser import parse_bytes
from app.services.chunker import chunk_markdown
from app.services.contextual_retrieval import add_context_to_chunks
from app.services.embedder import embed_texts
from app.services.ai import get_provider_with_fallback

_enc = tiktoken.get_encoding("cl100k_base")
logger = logging.getLogger(__name__)


def _count_tokens(text_str: str) -> int:
    return len(_enc.encode(text_str))


def _set_status(db: Session, doc: Document, status: str) -> None:
    doc.processing_status = status
    db.commit()
    logger.info(f"doc {doc.id}: {status}")


async def _generate_summaries(markdown: str) -> tuple[str, list]:
    """Generate doc summary + per-section summaries in one LLM call."""
    from pydantic import BaseModel
    from typing import List

    class _SectionSummary(BaseModel):
        section_title: str
        summary: str

    class _DocSummaryResult(BaseModel):
        doc_summary: str
        section_summaries: List[_SectionSummary]

    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    truncated = markdown[:12_000]

    try:
        result = await provider.structured_output(
            messages=[{
                "role": "user",
                "content": (
                    "Summarise this document. Return:\n"
                    "1. doc_summary: 300-500 word overview of key concepts, methodology, conclusions.\n"
                    "2. section_summaries: list of {section_title, summary} — one 2-3 sentence summary per major section.\n\n"
                    f"Document:\n{truncated}"
                ),
            }],
            schema=_DocSummaryResult,
            system_prompt="You are a precise summariser. Return valid JSON only.",
        )
        sums = [s.model_dump() for s in result.section_summaries]
        return result.doc_summary, sums
    except Exception as e:
        logger.warning(f"Summary generation failed: {e}")
        return "", []


def _write_embeddings_to_pgvector(db: Session, document_id: int, embeddings: list[list[float]]) -> None:
    """Write float-list embeddings to the pgvector column via raw SQL."""
    chunks = db.query(Chunk).filter(
        Chunk.document_id == document_id
    ).order_by(Chunk.position).all()

    for chunk, vec in zip(chunks, embeddings):
        vec_str = "[" + ",".join(f"{v:.8f}" for v in vec) + "]"
        try:
            db.execute(
                text("UPDATE chunks SET embedding = :vec WHERE id = :id"),
                {"vec": vec_str, "id": chunk.id},
            )
        except Exception as e:
            logger.warning(f"pgvector write failed for chunk {chunk.id}: {e}")
            break
    db.commit()


async def ingest_document(ctx, document_id: int):
    """ARQ task: run full ingestion pipeline for a single document."""
    db: Session = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if not doc:
            logger.warning(f"ingest_document: doc {document_id} not found")
            return

        _set_status(db, doc, "parsing")

        # 1. Read raw bytes (from disk if file_path set, else decode content)
        if doc.file_path:
            try:
                with open(doc.file_path, "rb") as f:
                    raw_bytes = f.read()
            except Exception:
                raw_bytes = (doc.content or "").encode("utf-8", errors="ignore")
        else:
            raw_bytes = (doc.content or "").encode("utf-8", errors="ignore")

        parsed = parse_bytes(raw_bytes, doc.name)
        doc.parsed_md = parsed.markdown
        doc.outline = parsed.outline
        doc.page_count = parsed.page_count
        doc.token_count = _count_tokens(parsed.markdown)
        db.commit()

        _set_status(db, doc, "summarising")

        # 2. Doc + section summaries
        doc.summary, doc.section_summaries = await _generate_summaries(parsed.markdown)
        db.commit()

        _set_status(db, doc, "chunking")

        # 3. Chunk
        raw_chunks = chunk_markdown(parsed.markdown, parsed.outline)
        if not raw_chunks:
            _set_status(db, doc, "ready")
            return

        _set_status(db, doc, "embedding")

        # 4. Contextual retrieval
        chunk_texts = [c.raw_text for c in raw_chunks]
        contexts = await add_context_to_chunks(parsed.markdown, chunk_texts)

        # 5. Contextualized texts
        contextualized = [
            f"{ctx_text}\n\n{raw}" if ctx_text else raw
            for ctx_text, raw in zip(contexts, chunk_texts)
        ]

        # 6. Embed in batches
        all_embeddings: list[list[float]] = []
        batch_size = 32
        for i in range(0, len(contextualized), batch_size):
            batch = contextualized[i:i + batch_size]
            vecs = await embed_texts(batch, task="search_document")
            all_embeddings.extend(vecs)

        # 7. Wipe existing chunks (idempotency)
        db.query(Chunk).filter(Chunk.document_id == document_id).delete()
        db.commit()

        # 8. Insert new chunks
        for raw_chunk, ctx_text, ctx_full, embedding in zip(
            raw_chunks, contexts, contextualized, all_embeddings
        ):
            db.add(Chunk(
                document_id=document_id,
                user_id=doc.user_id,
                section_id=raw_chunk.section_id,
                page_start=raw_chunk.page_start,
                page_end=raw_chunk.page_end,
                position=raw_chunk.position,
                raw_text=raw_chunk.raw_text,
                context=ctx_text,
                contextualized_text=ctx_full,
                embedding_json=embedding,
            ))
        db.commit()

        # 9. Write embeddings to pgvector column
        _write_embeddings_to_pgvector(db, document_id, all_embeddings)

        _set_status(db, doc, "ready")
        logger.info(f"ingest_document: doc {document_id} done — {len(raw_chunks)} chunks")

    except Exception as e:
        logger.exception(f"ingest_document: doc {document_id} failed: {e}")
        doc = db.get(Document, document_id)
        if doc:
            doc.processing_status = "failed"
            db.commit()
    finally:
        db.close()


async def generate_audio_recap_task(ctx, recap_id: int):
    """ARQ task for multi-step Audio Recap generation (P4)."""
    from app.models.orm import AudioRecap
    db: Session = SessionLocal()
    try:
        recap = db.get(AudioRecap, recap_id)
        if not recap:
            return
        recap.processing_status = "generating"
        db.commit()

        doc = db.get(Document, recap.source_document_id)
        if not doc:
            recap.processing_status = "failed"
            db.commit()
            return

        from app.services.audio_pipeline import generate_audio_recap_pipeline
        summary, script = await generate_audio_recap_pipeline(doc)
        recap.summary = summary
        recap.script = script
        recap.processing_status = "ready"
        db.commit()
    except Exception as e:
        logger.exception(f"Audio recap {recap_id} failed: {e}")
        recap = db.get(AudioRecap, recap_id)
        if recap:
            recap.processing_status = "failed"
            db.commit()
    finally:
        db.close()
