"""Hybrid retrieval: pgvector cosine + Postgres FTS, merged via RRF."""
import logging
from dataclasses import dataclass
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.embedder import embed_query, EmbeddingError
from app.core.config import settings

logger = logging.getLogger(__name__)


class RetrievalError(RuntimeError):
    """Raised when retrieval cannot run at all (both vector and FTS failed). Lets
    the caller surface 'retrieval unavailable' instead of an empty result that
    looks identical to 'no matching documents' and triggers a false refusal."""


# Citation snippets are trimmed so the chat response stays compact — the panel
# shows enough to recognise the source, not the entire chunk.
_SNIPPET_MAX_CHARS = 320


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    page_start: Optional[int]
    page_end: Optional[int]
    section_id: Optional[str]
    raw_text: str
    contextualized_text: str
    rrf_score: float

    def to_citation(self) -> dict:
        """Shape a retrieved chunk into the citation contract the chat surface
        renders: {document_id, page_start, page_end, snippet}. The snippet is the
        chunk's own source text (never the contextualized prefix), trimmed."""
        snippet = (self.raw_text or "").strip()
        if len(snippet) > _SNIPPET_MAX_CHARS:
            snippet = snippet[:_SNIPPET_MAX_CHARS].rstrip() + "…"
        return {
            "document_id": self.document_id,
            "page_start": self.page_start,
            "page_end": self.page_end,
            "snippet": snippet,
        }


async def hybrid_retrieve(
    query: str,
    db: Session,
    user_id: int,
    document_id: Optional[int] = None,
    top_k: int = None,
) -> list[RetrievedChunk]:
    top_k = top_k or settings.retrieve_topk
    rrf_k = settings.rrf_k
    rrf_topk = settings.rrf_topk

    doc_filter = "AND c.document_id = :doc_id" if document_id else ""

    scores: dict[int, float] = {}
    chunk_data: dict[int, dict] = {}
    vec_ok = False
    fts_ok = False

    # Embed the query for the vector half. If embedding is down, skip the vector
    # branch explicitly (FTS-only degraded mode) rather than feeding a bad vector.
    query_vec = None
    try:
        query_vec = await embed_query(query)
    except EmbeddingError as e:
        logger.error(f"Query embedding unavailable, vector search skipped: {e}")

    # Vector search (guarded — pgvector may be unavailable in tests)
    if query_vec is not None:
        try:
            vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"
            vec_sql = text(f"""
                SELECT c.id, c.document_id, c.page_start, c.page_end,
                       c.section_id, c.raw_text, c.contextualized_text,
                       ROW_NUMBER() OVER (ORDER BY c.embedding <=> CAST(:vec AS vector)) AS rank
                FROM chunks c
                WHERE c.user_id = :user_id
                  {doc_filter}
                  AND c.embedding IS NOT NULL
                ORDER BY c.embedding <=> CAST(:vec AS vector)
                LIMIT :topk
            """)
            params = {"vec": vec_str, "user_id": user_id, "topk": top_k}
            if document_id:
                params["doc_id"] = document_id
            for row in db.execute(vec_sql, params).fetchall():
                scores[row.id] = scores.get(row.id, 0.0) + 1.0 / (rrf_k + row.rank)
                chunk_data[row.id] = dict(row._mapping)
            vec_ok = True
        except Exception as e:
            logger.error(f"Vector search failed: {e}")

    # BM25 / FTS search
    try:
        fts_sql = text(f"""
            SELECT c.id, c.document_id, c.page_start, c.page_end,
                   c.section_id, c.raw_text, c.contextualized_text,
                   ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.fts, q) DESC) AS rank
            FROM chunks c, websearch_to_tsquery('english', :query) q
            WHERE c.user_id = :user_id
              {doc_filter}
              AND c.fts @@ q
            ORDER BY ts_rank_cd(c.fts, q) DESC
            LIMIT :topk
        """)
        fts_params = {"query": query, "user_id": user_id, "topk": top_k}
        if document_id:
            fts_params["doc_id"] = document_id
        for row in db.execute(fts_sql, fts_params).fetchall():
            scores[row.id] = scores.get(row.id, 0.0) + 1.0 / (rrf_k + row.rank)
            chunk_data.setdefault(row.id, dict(row._mapping))
        fts_ok = True
    except Exception as e:
        logger.error(f"FTS search failed: {e}")

    # Neither half ran successfully → retrieval is down, not "no matches". Raise so
    # the caller surfaces an error instead of a false "no grounded answer" refusal.
    if not vec_ok and not fts_ok:
        raise RetrievalError("both vector and FTS retrieval failed")

    sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)[:rrf_topk]
    return [
        RetrievedChunk(
            chunk_id=cid,
            document_id=chunk_data[cid]["document_id"],
            page_start=chunk_data[cid]["page_start"],
            page_end=chunk_data[cid]["page_end"],
            section_id=chunk_data[cid]["section_id"],
            raw_text=chunk_data[cid]["raw_text"],
            contextualized_text=chunk_data[cid]["contextualized_text"],
            rrf_score=scores[cid],
        )
        for cid in sorted_ids
    ]
