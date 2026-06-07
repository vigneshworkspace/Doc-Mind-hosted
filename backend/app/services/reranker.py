"""Cross-encoder reranker: jina-reranker-v3 via sentence-transformers (lazy load)."""
import logging
import math
from app.core.config import settings
from app.services.retrieval import RetrievedChunk

logger = logging.getLogger(__name__)
_model = None


def _sigmoid(x: float) -> float:
    # Map raw cross-encoder logits to a calibrated [0,1] relevance probability so a
    # fixed grounding_threshold is meaningful.
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    z = math.exp(x)
    return z / (1.0 + z)


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
        # Rerank the same text the answer prompt renders (raw_text), so scores reflect
        # what the LLM will actually see.
        texts = [c.raw_text for c in chunks]
        scores = model.predict([(query, t) for t in texts])
        calibrated = [(c, _sigmoid(float(s))) for c, s in zip(chunks, scores.tolist())]
        ranked = sorted(calibrated, key=lambda x: x[1], reverse=True)
        return ranked[:top_k]
    except Exception as e:
        logger.error(f"Rerank failed, falling back to RRF order: {e}")
        # Degraded fallback: RRF scores (~0.01-0.05) are NOT on the calibrated scale
        # the grounding threshold expects. Min-max normalise within the candidate set
        # so the top chunk maps to ~1.0 — i.e. don't let an unavailable reranker make
        # the grounding gate refuse everything; answer in degraded mode instead.
        ordered = sorted(chunks, key=lambda c: c.rrf_score, reverse=True)[:top_k]
        if not ordered:
            return []
        hi = ordered[0].rrf_score
        lo = ordered[-1].rrf_score
        span = (hi - lo) or hi or 1.0
        return [(c, (c.rrf_score - lo) / span if hi != lo else 1.0) for c in ordered]


def top1_score(ranked: list[tuple[RetrievedChunk, float]]) -> float:
    return ranked[0][1] if ranked else 0.0
