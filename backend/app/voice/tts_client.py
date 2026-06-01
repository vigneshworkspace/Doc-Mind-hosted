"""TTS client. Prefers VibeVoice server; falls back to local Coqui TTS when unreachable."""
import asyncio
import logging

import httpx

from app.core.config import settings
from app.voice import coqui_tts

logger = logging.getLogger(__name__)


async def _vibevoice_up() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.vibevoice_url}/v1/models")
            return resp.status_code == 200
    except Exception:
        return False


async def text_to_speech(text: str) -> bytes:
    """Convert text to speech. VibeVoice if up, else local Coqui. Returns WAV bytes."""
    if await _vibevoice_up():
        url = f"{settings.vibevoice_url}/v1/audio/speech"
        payload = {
            "model": "VibeVoice-Realtime-0.5B",
            "input": text,
            "voice": "alloy",
            "response_format": "wav",
            "speed": 1.0,
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                return resp.content
        except Exception as e:
            logger.warning(f"VibeVoice synth failed, falling back to Coqui: {e}")

    # Local fallback — blocking, run off the event loop
    return await asyncio.to_thread(coqui_tts.synthesize, text)


async def is_available() -> bool:
    """TTS usable if VibeVoice reachable OR local Coqui installed."""
    if await _vibevoice_up():
        return True
    return coqui_tts.is_available()
