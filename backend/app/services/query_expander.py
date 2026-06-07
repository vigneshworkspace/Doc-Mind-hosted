"""Query expansion (single) and decomposition (compositional)."""
import logging
from typing import List
from pydantic import BaseModel
from app.services.ai import get_provider_with_fallback

logger = logging.getLogger(__name__)


class _Rewrites(BaseModel):
    rewrites: List[str]


class _SubQueries(BaseModel):
    sub_queries: List[str]


async def expand_query(query: str) -> list[str]:
    try:
        provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
        result = await provider.structured_output(
            messages=[{"role": "user", "content": (
                f"Rewrite this question 3 different ways for retrieval. Vary wording and focus.\n\nQuestion: {query}"
            )}],
            schema=_Rewrites,
            system_prompt="Return JSON only.",
        )
        return [query] + result.rewrites[:3]
    except Exception as e:
        logger.warning(f"Query expansion failed, using original query only: {e}")
        return [query]


async def decompose_query(query: str) -> list[str]:
    try:
        provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
        result = await provider.structured_output(
            messages=[{"role": "user", "content": (
                f"Break this question into independent sub-questions.\n\nQuestion: {query}"
            )}],
            schema=_SubQueries,
            system_prompt="Return JSON only.",
        )
        return result.sub_queries if result.sub_queries else [query]
    except Exception as e:
        logger.warning(f"Query decomposition failed, using original query only: {e}")
        return [query]
