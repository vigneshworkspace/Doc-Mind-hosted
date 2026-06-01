"""Hybrid retrieval: pgvector cosine + Postgres FTS, merged via RRF."""
import logging
from dataclasses import dataclass
from typing import Optional
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.embedder import embed_query
from app.core.config import settings

logger = logging.getLogger(__name__)


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

    query_vec = await embed_query(query)
    vec_str = "[" + ",".join(f"{v:.8f}" for v in query_vec) + "]"

    doc_filter = "AND c.document_id = :doc_id" if document_id else ""

    scores: dict[int, float] = {}
    chunk_data: dict[int, dict] = {}

    # Vector search (guarded — pgvector may be unavailable in tests)
    try:
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
    except Exception as e:
        logger.warning(f"Vector search failed: {e}")

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
    except Exception as e:
        logger.warning(f"FTS search failed: {e}")

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
