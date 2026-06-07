"""Voice router: WebSocket voice endpoint + health check. FastRTC mount is optional."""
import logging
import os

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.orm import User

logger = logging.getLogger(__name__)
router = APIRouter()


def _resolve_stt_device() -> None:
    """Default STT to CPU unless a GPU is explicitly requested via env.

    The hard-coded settings default is ``cuda``, which crashes faster-whisper on
    hosts without an NVIDIA GPU/CUDA runtime. We only keep a GPU device when the
    operator explicitly set ``STT_DEVICE`` (e.g. ``cuda``); otherwise we force CPU
    and a CPU-safe compute type. Runs at import time — before the model is ever
    constructed in app.voice.stt — so the override always takes effect.
    """
    explicit = os.getenv("STT_DEVICE")
    if explicit:
        # Operator made a deliberate choice — honour it verbatim.
        return
    if settings.stt_device != "cpu":
        logger.info("STT_DEVICE not set; defaulting STT to CPU (was %r).", settings.stt_device)
        settings.stt_device = "cpu"
        # float16 is GPU-only in faster-whisper; pick a CPU-safe type unless the
        # operator explicitly chose one.
        if not os.getenv("STT_COMPUTE_TYPE") and settings.stt_compute_type == "float16":
            settings.stt_compute_type = "int8"


_resolve_stt_device()


@router.get("/health")
async def voice_health():
    """Report STT/TTS readiness without crashing if optional deps are missing."""
    # STT: report importability + the resolved device so the UI/operator can see
    # whether voice is usable and on what hardware. Catch ANY load error (missing
    # package, broken native lib) and degrade to a clear status.
    try:
        import faster_whisper  # noqa: F401
        stt_status = "available"
    except ImportError:
        stt_status = "not_installed"
    except Exception as e:  # corrupt/partial install, missing native lib, etc.
        logger.warning("STT availability check failed: %s", e)
        stt_status = "error"

    # TTS: is_available() probes VibeVoice (network) then local Coqui (import).
    # Never let a probe failure bubble up and 500 the health endpoint.
    try:
        from app.voice.tts_client import is_available
        tts_ok = await is_available()
        tts_status = "available" if tts_ok else "vibevoice_server_unreachable"
    except Exception as e:
        logger.warning("TTS availability check failed: %s", e)
        tts_status = "error"

    return {
        "stt": stt_status,
        "stt_device": settings.stt_device,
        "tts": tts_status,
    }


@router.websocket("/ws")
async def voice_websocket(websocket: WebSocket, token: str = Query(None)):
    # Auth via query token
    user_id = decode_token(token) if token else None
    if user_id is None:
        await websocket.close(code=4401)
        return
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if user is None:
            await websocket.close(code=4401)
            return
    finally:
        db.close()

    await websocket.accept()
    audio_buffer = bytearray()
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] != "websocket.receive":
                continue
            if msg.get("bytes"):
                audio_buffer.extend(msg["bytes"])
            elif msg.get("text") == "END":
                if not audio_buffer:
                    continue
                await websocket.send_text("PROCESSING")
                snapshot = bytes(audio_buffer)
                audio_buffer.clear()
                try:
                    import asyncio
                    # Fail loudly + clearly if STT isn't installed, instead of
                    # silently transcribing to "" (which the UI reads as SILENCE).
                    try:
                        import faster_whisper  # noqa: F401
                    except ImportError:
                        await websocket.send_text(
                            "ERROR:Speech-to-text is not available on the server "
                            "(faster-whisper not installed). See /voice/health."
                        )
                        continue
                    from app.voice.stt import transcribe_audio
                    text = await asyncio.to_thread(transcribe_audio, snapshot)
                    if not text:
                        await websocket.send_text("SILENCE")
                        continue
                    await websocket.send_text(f"TRANSCRIPT:{text}")
                    from app.services.generators import chat_complete
                    reply = await chat_complete(messages=[{"role": "user", "content": text}], context="")
                    await websocket.send_text(f"REPLY:{reply}")
                    from app.voice.tts_client import text_to_speech, is_available
                    if await is_available():
                        wav = await text_to_speech(reply)
                        await websocket.send_bytes(wav)
                except Exception as e:
                    logger.exception(f"Voice WS error: {e}")
                    await websocket.send_text(f"ERROR:{str(e)[:200]}")
    except WebSocketDisconnect:
        logger.info("Voice WebSocket disconnected")


def get_fastrtc_app():
    """Optional FastRTC stream mount. Returns None if fastrtc not installed."""
    try:
        from fastrtc import Stream, ReplyOnPause
        from app.voice.handler import handle_audio
        return Stream(ReplyOnPause(handle_audio), modality="audio", mode="send-receive")
    except Exception:
        return None
