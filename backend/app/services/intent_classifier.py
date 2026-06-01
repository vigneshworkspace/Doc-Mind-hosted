"""Classify query intent: structural | compositional | single. Regex first, LLM fallback."""
import re
from typing import Literal
from pydantic import BaseModel
from app.services.ai import get_provider_with_fallback

Intent = Literal["structural", "compositional", "single"]

_STRUCTURAL = re.compile(
    r"(summarize|summary of|outline|overview of)\s*(chapter|section|ch\.?|sec\.?)\s*\d+|"
    r"(page|p\.?)\s*\d+|"
    r"(chapter|section|ch\.?|sec\.?)\s*\d+",
    re.IGNORECASE,
)
_COMPOSITIONAL = re.compile(
    r"\b(compare|contrast|vs\.?|versus|both|relate|differ|difference between|connection between)\b",
    re.IGNORECASE,
)


class _IntentResult(BaseModel):
    intent: Intent


async def classify_intent(query: str) -> Intent:
    s = bool(_STRUCTURAL.search(query))
    c = bool(_COMPOSITIONAL.search(query))
    if s and not c:
        return "structural"
    if c and not s:
        return "compositional"
    if not s and not c:
        return "single"
    # Ambiguous -> LLM
    try:
        provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
        result = await provider.structured_output(
            messages=[{"role": "user", "content": (
                "Classify as: structural (asks for a specific section/page/chapter), "
                "compositional (combine multiple parts), or single (one focused question).\n\n"
                f"Question: {query}"
            )}],
            schema=_IntentResult,
            system_prompt="Return JSON only.",
        )
        return result.intent
    except Exception:
        return "single"
