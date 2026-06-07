"""
Multi-step Audio Recap pipeline — NotebookLM-style critique loop.
6 LLM calls: outline -> critique -> revised outline -> script -> critique -> final script.
"""
import logging
from typing import List
from pydantic import BaseModel

from app.services.ai import get_provider_with_fallback
from app.services.generators import get_doc_context
from app.models.orm import Document

logger = logging.getLogger(__name__)


class _OutlineSection(BaseModel):
    title: str
    key_points: List[str]


class _Outline(BaseModel):
    episode_title: str
    sections: List[_OutlineSection]
    closing_note: str


class _Critique(BaseModel):
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]


class _ScriptTurn(BaseModel):
    speaker: str
    dialogue: str


class _Script(BaseModel):
    summary: str
    script: List[_ScriptTurn]


async def generate_audio_recap_pipeline(doc: Document) -> tuple[str, list[dict]]:
    """6-step Audio Recap (outline → critique → revise → draft → critique → final).

    Each step is guarded individually: if a late step fails, the best script produced
    so far (draft, else any) is returned with real document content — never a generic
    content-free stub — and a partial result raises only when no script was produced.
    """
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    ctx = get_doc_context(doc)
    # Keep the source pinned across stages so critiques/edits stay grounded.
    source = ctx[:8000]

    best: _Script | None = None

    try:
        outline = await provider.structured_output(
            messages=[{"role": "user", "content": f"Create a 5-min podcast outline (4-6 sections, speakers Alex & Jamie).\n\n{source}"}],
            schema=_Outline,
            system_prompt="Podcast producer. Return JSON only.",
        )
        try:
            critique1 = await provider.structured_output(
                messages=[{"role": "user", "content": f"Critique this outline against the source.\nSource:{source[:4000]}\nOutline:{outline.model_dump_json()}"}],
                schema=_Critique,
                system_prompt="Critical editor. Return JSON only.",
            )
            outline = await provider.structured_output(
                messages=[{"role": "user", "content": f"Revise outline using critique.\nOutline:{outline.model_dump_json()}\nCritique:{critique1.model_dump_json()}"}],
                schema=_Outline,
                system_prompt="Podcast producer. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Audio recap critique/revise step failed, using unrevised outline: {e}")

        best = await provider.structured_output(
            messages=[{"role": "user", "content": f"Write full script (20-30 turns, conversational) from this outline.\nOutline:{outline.model_dump_json()}\nSource:{source[:6000]}"}],
            schema=_Script,
            system_prompt="Podcast scriptwriter. Return JSON only.",
        )

        try:
            critique2 = await provider.structured_output(
                messages=[{"role": "user", "content": f"Critique this script for accuracy against the source, flow, pacing.\nSource:{source[:3000]}\nScript:{best.model_dump_json()[:4000]}"}],
                schema=_Critique,
                system_prompt="Critical editor. Return JSON only.",
            )
            best = await provider.structured_output(
                messages=[{"role": "user", "content": f"Final revised script (do not introduce facts absent from the source).\nSource:{source[:3000]}\nScript:{best.model_dump_json()[:4000]}\nCritique:{critique2.model_dump_json()}"}],
                schema=_Script,
                system_prompt="Podcast scriptwriter. Return JSON only.",
            )
        except Exception as e:
            logger.warning(f"Audio recap final-critique step failed, using draft script: {e}")

        return best.summary, [t.model_dump() for t in best.script]
    except Exception as e:
        if best is not None:
            logger.warning(f"Audio pipeline degraded, returning best available script: {e}")
            return best.summary, [t.model_dump() for t in best.script]
        # No script produced at all — surface the failure so the recap is marked failed
        # rather than silently storing a content-free stub.
        logger.error(f"Audio pipeline produced no script: {e}")
        raise
