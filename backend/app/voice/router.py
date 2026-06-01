"""Voice router: WebSocket voice endpoint + health check. FastRTC mount is optional."""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.orm import User

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def voice_health():
    from app.voice.tts_client import is_available
    tts_ok = await is_available()
    try:
        import faster_whisper  # noqa: F401
        stt_available = True
    except ImportError:
        stt_available = False
    return {
        "stt": "available" if stt_available else "not_installed",
        "tts": "available" if tts_ok else "vibevoice_server_unreachable",
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
