"""
Embedding service using Ollama's nomic-embed-text-v1.5.
Nomic requires task-type prefixes on input text.
"""
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmbeddingError(RuntimeError):
    """Raised when the embedding service fails. Never substitute zero vectors:
    a zero embedding silently poisons ingest (stored as a real chunk vector) and
    query (degenerate cosine ranking), so callers must handle the failure."""


async def embed_texts(texts: list[str], task: str = "search_document") -> list[list[float]]:
    """
    Embed a list of texts.
    task: "search_document" for chunks at ingest time.
          "search_query" for query vectors at retrieval time.
    Returns list of 768-dim vectors. Raises EmbeddingError on failure.
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
        logger.error(f"Embedding failed: {e}")
        raise EmbeddingError(str(e)) from e


async def embed_query(query: str) -> list[float]:
    """Single-query embedding for retrieval. Raises EmbeddingError on failure."""
    vecs = await embed_texts([query], task="search_query")
    return vecs[0]
