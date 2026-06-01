"""
Embedding service using Ollama's nomic-embed-text-v1.5.
Nomic requires task-type prefixes on input text.
"""
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


async def embed_texts(texts: list[str], task: str = "search_document") -> list[list[float]]:
    """
    Embed a list of texts.
    task: "search_document" for chunks at ingest time.
          "search_query" for query vectors at retrieval time.
    Returns list of 768-dim vectors.
    Falls back to zero vectors if Ollama unavailable.
    """
    prefixed = [f"{task}: {t}" for t in texts]
    url = f"{settings.ollama_base_url}/api/embed"

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, json={
                "model": settings.embed_model,
                "input": prefixed,
            })
            response.raise_for_status()
            data = response.json()
            return data["embeddings"]
    except Exception as e:
        logger.warning(f"Embedding failed, using zero vectors: {e}")
        # Return zero vectors as fallback so pipeline doesn't crash
        dim = 768
        return [[0.0] * dim for _ in texts]


async def embed_query(query: str) -> list[float]:
    """Single-query embedding for retrieval."""
    vecs = await embed_texts([query], task="search_query")
    return vecs[0]
