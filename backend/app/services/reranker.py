"""Cross-encoder reranker: jina-reranker-v3 via sentence-transformers (lazy load)."""
import logging
from app.core.config import settings
from app.services.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder
        logger.info(f"Loading reranker: {settings.rerank_model}")
        _model = CrossEncoder(settings.rerank_model, max_length=512)
    return _model


def rerank(query: str, chunks: list[RetrievedChunk], top_k: int = None) -> list[tuple[RetrievedChunk, float]]:
    top_k = top_k or settings.rerank_topk
    if not chunks:
        return []
    try:
        model = _get_model()
        texts = [c.contextualized_text.replace("search_document: ", "", 1) for c in chunks]
        scores = model.predict([(query, t) for t in texts])
        ranked = sorted(zip(chunks, scores.tolist()), key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
    except Exception as e:
        logger.warning(f"Rerank failed, falling back to RRF order: {e}")
        # Fallback: use RRF score as proxy, normalize to ~0-1
        ranked = sorted(chunks, key=lambda c: c.rrf_score, reverse=True)
        return [(c, c.rrf_score) for c in ranked[:top_k]]


def top1_score(ranked: list[tuple[RetrievedChunk, float]]) -> float:
    return ranked[0][1] if ranked else 0.0
