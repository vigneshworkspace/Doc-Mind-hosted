"""Coqui TTS fallback — local, offline. Lazy-loaded single-speaker VITS model (CPU)."""
import io
import logging
import os
import shutil

import numpy as np

from app.core.config import settings

logger = logging.getLogger(__name__)
_tts = None

# VITS phonemizes via espeak-ng. The MSI installs to Program Files and is not on
# PATH for a service process, so add the default dir and point phonemizer at the DLL.
_ESPEAK_DIRS = [
    r"C:\Program Files\eSpeak NG",
    r"C:\Program Files (x86)\eSpeak NG",
]


def _ensure_espeak():
    if shutil.which("espeak-ng") or shutil.which("espeak"):
        return
    for d in _ESPEAK_DIRS:
        dll = os.path.join(d, "libespeak-ng.dll")
        if os.path.exists(dll):
            os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
            os.environ.setdefault("PHONEMIZER_ESPEAK_LIBRARY", dll)
            try:
                from phonemizer.backend.espeak.wrapper import EspeakWrapper
                EspeakWrapper.set_library(dll)
            except Exception:
                pass
            return


def _get_tts():
    global _tts
    if _tts is None:
        _ensure_espeak()
        from TTS.api import TTS  # heavy import — only when first used
        logger.info(f"Loading Coqui TTS {settings.coqui_tts_model} (cpu)")
        _tts = TTS(settings.coqui_tts_model, progress_bar=False)
    return _tts


def is_available() -> bool:
    """True if the Coqui TTS package is importable. Model loads lazily on first synth."""
    try:
        import TTS  # noqa: F401
        return True
    except ImportError:
        return False


def synthesize(text: str) -> bytes:
    """Blocking synth → WAV bytes. Call via asyncio.to_thread from async code."""
    import soundfile as sf
    tts = _get_tts()
    wav = tts.tts(text=text)
    sr = getattr(tts.synthesizer, "output_sample_rate", 22050)
    buf = io.BytesIO()
    sf.write(buf, np.asarray(wav, dtype="float32"), sr, format="WAV")
    return buf.getvalue()
