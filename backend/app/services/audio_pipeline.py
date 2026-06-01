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
    """6-step Audio Recap. Returns (summary, script_list). Falls back to a simple
    2-turn script if the multi-step pipeline fails at any stage."""
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    ctx = get_doc_context(doc)

    try:
        outline = await provider.structured_output(
            messages=[{"role": "user", "content": f"Create a 5-min podcast outline (4-6 sections, speakers Alex & Jamie).\n\n{ctx[:8000]}"}],
            schema=_Outline,
            system_prompt="Podcast producer. Return JSON only.",
        )
        critique1 = await provider.structured_output(
            messages=[{"role": "user", "content": f"Critique this outline:\n{outline.model_dump_json()}"}],
            schema=_Critique,
            system_prompt="Critical editor. Return JSON only.",
        )
        revised = await provider.structured_output(
            messages=[{"role": "user", "content": f"Revise outline using critique.\nOutline:{outline.model_dump_json()}\nCritique:{critique1.model_dump_json()}"}],
            schema=_Outline,
            system_prompt="Podcast producer. Return JSON only.",
        )
        draft = await provider.structured_output(
            messages=[{"role": "user", "content": f"Write full script (20-30 turns, conversational) from this outline.\nOutline:{revised.model_dump_json()}\nSource:{ctx[:6000]}"}],
            schema=_Script,
            system_prompt="Podcast scriptwriter. Return JSON only.",
        )
        critique2 = await provider.structured_output(
            messages=[{"role": "user", "content": f"Critique this script for accuracy, flow, pacing.\n{draft.model_dump_json()[:4000]}"}],
            schema=_Critique,
            system_prompt="Critical editor. Return JSON only.",
        )
        final = await provider.structured_output(
            messages=[{"role": "user", "content": f"Final revised script.\nScript:{draft.model_dump_json()[:4000]}\nCritique:{critique2.model_dump_json()}"}],
            schema=_Script,
            system_prompt="Podcast scriptwriter. Return JSON only.",
        )
        return final.summary, [t.model_dump() for t in final.script]
    except Exception as e:
        logger.warning(f"Audio pipeline failed, using fallback: {e}")
        return (
            "A conversational recap of the document's key concepts.",
            [
                {"speaker": "Alex", "dialogue": "Welcome! Today we're reviewing this document together."},
                {"speaker": "Jamie", "dialogue": "Let's dive into the key concepts."},
            ],
        )
