"""Render an audio-recap script (list of {speaker, dialogue}) to a single WAV file
using local Coqui TTS. Single-speaker VITS model — the non-primary speaker is
pitch-shifted down for contrast so the two voices are distinguishable."""
import io
import logging
import os

import numpy as np
import soundfile as sf

from app.voice import coqui_tts

logger = logging.getLogger(__name__)

_SR = 22050  # Coqui VITS LJSpeech output rate


class RecapSynthError(RuntimeError):
    """Raised when the recap could not be synthesized to a real audio file.

    The caller is responsible for surfacing this as a failed recap — it must
    never be swallowed into a fake-success / silent empty file.
    """


def synthesize_recap(script: list[dict], out_path: str, primary_speaker: str = "Alex") -> str:
    """Synthesize every turn, concat with short gaps, write WAV to out_path.

    Returns out_path on success. Raises RecapSynthError if no audio could be
    produced (empty script, or every TTS turn failed) — failures are NOT
    swallowed and never yield a silent/empty file.
    """
    turns = [t for t in script if (t.get("dialogue") or "").strip()]
    if not turns:
        raise RecapSynthError("Recap script is empty — nothing to synthesize.")

    segments: list[np.ndarray] = []
    gap = np.zeros(int(0.35 * _SR), dtype=np.float32)
    failures: list[str] = []

    for turn in turns:
        text = (turn.get("dialogue") or "").strip()
        try:
            audio, sr = sf.read(io.BytesIO(coqui_tts.synthesize(text)), dtype="float32")
        except Exception as e:
            # Record the failure instead of silently skipping; a turn that fails
            # to synthesize is a real problem we surface if it leaves us empty.
            logger.warning(f"recap turn synth failed: {e}")
            failures.append(str(e))
            continue
        # Contrast the second voice by lowering pitch. Use a cheap resample-based
        # shift (polyphase) — librosa.effects.pitch_shift is a phase vocoder and far
        # too slow per turn on CPU. Resample to a higher rate then reinterpret at the
        # original rate → slightly slower + lower pitch. Fast.
        if turn.get("speaker") and turn["speaker"] != primary_speaker:
            try:
                import librosa
                audio = librosa.resample(audio, orig_sr=sr, target_sr=int(sr * 1.12))
            except Exception:
                pass
        segments.append(audio)
        segments.append(gap)

    if not segments:
        detail = failures[0] if failures else "no audio produced"
        raise RecapSynthError(f"Text-to-speech synthesis failed: {detail}")

    full = np.concatenate(segments).astype(np.float32)
    peak = float(np.max(np.abs(full))) or 1.0
    full = full / peak * 0.97  # normalize
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    sf.write(out_path, full, _SR, format="WAV")
    logger.info(f"recap audio written: {out_path} ({len(full)/_SR:.1f}s)")
    return out_path
