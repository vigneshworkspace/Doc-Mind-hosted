"""FastRTC ReplyOnPause handler — used only if fastrtc is installed."""
import io
import logging
import numpy as np

logger = logging.getLogger(__name__)


async def handle_audio(audio):
    """Called by FastRTC ReplyOnPause when user pauses. Yields (sr, np.ndarray)."""
    sample_rate, audio_array = audio
    # Degrade gracefully if STT isn't installed — yield nothing rather than crash
    # the FastRTC stream worker.
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        logger.warning("STT unavailable (faster-whisper not installed); skipping turn.")
        return
    from app.voice.stt import transcribe_audio
    text = transcribe_audio(audio_array.astype(np.int16).tobytes(), sample_rate)
    if not text:
        return
    from app.services.generators import chat_complete
    reply = await chat_complete(messages=[{"role": "user", "content": text}], context="")
    from app.voice.tts_client import text_to_speech, is_available
    if not await is_available():
        return
    wav = await text_to_speech(reply)
    import soundfile as sf
    audio_np, sr = sf.read(io.BytesIO(wav), dtype="int16")
    yield (sr, audio_np)
