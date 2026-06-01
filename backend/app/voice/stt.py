"""Speech-to-text using faster-whisper. Model lazy-loaded + cached."""
import logging
import numpy as np
from app.core.config import settings

logger = logging.getLogger(__name__)
_model = None


def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info(f"Loading faster-whisper {settings.stt_model} on {settings.stt_device}")
        _model = WhisperModel(settings.stt_model, device=settings.stt_device, compute_type=settings.stt_compute_type)
    return _model


def transcribe_audio(audio_bytes: bytes, sample_rate: int = 16000) -> str:
    """Transcribe 16-bit PCM mono audio to text. Empty string on failure/silence."""
    try:
        model = _get_model()
        audio_np = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        segments, info = model.transcribe(
            audio_np, language="en", beam_size=5, vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 500},
        )
        return " ".join(seg.text.strip() for seg in segments).strip()
    except Exception as e:
        logger.warning(f"STT failed: {e}")
        return ""
