# Phase 7 — FastRTC Voice-to-Voice

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The "Voice" screen connects through WebRTC to a FastRTC server that streams microphone audio in, runs faster-whisper STT, sends the transcript to the LLM router, streams the LLM reply to Kokoro TTS, and streams the synthesised audio back to the browser — full duplex with voice-activity detection (VAD) and pause/resume.

**Architecture:** FastRTC `ReplyOnPause` handler. Audio in → VAD turn detection → faster-whisper transcript → LLM chat (using same `chat_stream_with_rag`) → Kokoro stream → audio out. The FastRTC app mounts on its own port (`FASTRTC_PORT=7860`) and exposes JWT-checked WebRTC offer/answer endpoints. Frontend opens RTCPeerConnection to `wss://docmind/api/v1/voice/offer`.

**Tech Stack:** `fastrtc>=0.0.20`, `faster-whisper>=1.0`, plus existing Kokoro and LLM router.

**Depends on:** P1, P3, P6. **Independent of:** P9. **Blocks:** Voice screen wiring in P10.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | modify | `fastrtc[vad]>=0.0.20`, `faster-whisper>=1.0`, `numpy>=1.26` (already), `webrtcvad>=2.0` |
| `backend/app/services/stt.py` | create | Lazy faster-whisper singleton + `transcribe(np.float32) -> str` |
| `backend/app/services/voice_pipeline.py` | create | The FastRTC handler function |
| `backend/app/routers/voice.py` | create | Mounts FastRTC `Stream` under FastAPI, JWT-protected |
| `backend/main.py` | modify | Wire FastRTC stream |
| `backend/Dockerfile` | modify | Add `ffmpeg`, `libsndfile1`, drop in faster-whisper deps |
| `backend/Dockerfile.worker` | modify | (already has ffmpeg) |
| `docker-compose.yml` | modify | Expose `FASTRTC_PORT` 7860 if running FastRTC separately (we keep in same backend container for v1) |
| `backend/tests/test_stt.py` | create | Stub model returns text |
| `backend/tests/test_voice_pipeline.py` | create | Run handler over synthetic numpy buffer |

---

## Task 1: STT service

**Files:**
- Create: `backend/app/services/stt.py`
- Create: `backend/tests/test_stt.py`

- [ ] **Step 1: Tests**

```python
import numpy as np
import pytest


def test_transcribe_returns_str(monkeypatch):
    from app.services import stt

    class StubModel:
        def transcribe(self, audio, beam_size=5, vad_filter=True):
            return [type("Seg", (), {"text": "hello world", "start": 0, "end": 1.0})()], type("Info", (), {"language": "en"})

    monkeypatch.setattr(stt, "_get_model", lambda: StubModel())
    out = stt.transcribe_pcm16k(np.zeros(16000, dtype="float32"))
    assert out.strip() == "hello world"


def test_transcribe_empty_returns_empty(monkeypatch):
    from app.services import stt

    class StubModel:
        def transcribe(self, audio, beam_size=5, vad_filter=True):
            return [], type("Info", (), {"language": "en"})

    monkeypatch.setattr(stt, "_get_model", lambda: StubModel())
    out = stt.transcribe_pcm16k(np.zeros(8000, dtype="float32"))
    assert out == ""
```

- [ ] **Step 2: Implement**

`backend/app/services/stt.py`:

```python
import os
import logging
import numpy as np

_logger = logging.getLogger(__name__)
_model = None


def _device_pair() -> tuple[str, str]:
    """Return (device, compute_type) honoring WHISPER_DEVICE/WHISPER_COMPUTE env."""
    device = os.getenv("WHISPER_DEVICE", "auto").lower()
    if device == "auto":
        try:
            import torch  # noqa
            device = "cuda" if __import__("torch").cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
    compute = os.getenv("WHISPER_COMPUTE", "")
    if not compute:
        compute = "float16" if device == "cuda" else "int8"
    return device, compute


def _get_model():
    global _model
    if _model is not None:
        return _model
    from faster_whisper import WhisperModel
    name = os.getenv("WHISPER_MODEL", "large-v3")
    device, compute = _device_pair()
    _model = WhisperModel(name, device=device, compute_type=compute)
    _logger.info("faster-whisper loaded %s on %s/%s", name, device, compute)
    return _model


def transcribe_pcm16k(audio: np.ndarray, language: str | None = None) -> str:
    """Audio is float32 PCM mono at 16 kHz."""
    model = _get_model()
    segments, _info = model.transcribe(audio, beam_size=5, vad_filter=True, language=language)
    return "".join(seg.text for seg in segments).strip()
```

- [ ] **Step 3: Run, commit**

```bash
cd backend && pytest tests/test_stt.py -v
git add backend/app/services/stt.py backend/tests/test_stt.py backend/requirements.txt
git commit -m "feat(stt): faster-whisper transcribe_pcm16k with GPU/CPU autodetect"
```

### Edge cases (Task 1)

- **GPU build on Windows**: CUDA + cuDNN required outside container. In docker we use CPU + `int8` (small + fast). To run GPU, build `Dockerfile.gpu` separately with `nvidia/cuda:12.x` base + `onnxruntime-gpu` + faster-whisper GPU wheel. Out of scope v1.
- **Empty audio buffer**: `model.transcribe` returns no segments; we return `""`.
- **Non-English audio**: pass `language="es"` etc.; defaults to autodetect.
- **Long buffer (>30s)**: faster-whisper handles internally via VAD-driven segmentation.

---

## Task 2: Voice pipeline handler

**Files:**
- Create: `backend/app/services/voice_pipeline.py`
- Create: `backend/tests/test_voice_pipeline.py`

- [ ] **Step 1: Implement handler**

`backend/app/services/voice_pipeline.py`:

```python
"""FastRTC handler: full STT → LLM → TTS loop.

Conforms to FastRTC's `ReplyOnPause` callback shape:

    def handler(audio: tuple[int, np.ndarray]) -> Generator[tuple[int, np.ndarray], None, None]:
        ...

It receives 1 audio chunk per user-turn (after VAD signals end-of-speech)
and yields 1+ audio chunks for the reply.
"""
from __future__ import annotations

import logging
from typing import Generator, List, Tuple, Dict

import numpy as np

from app.services.stt import transcribe_pcm16k
from app.services.tts import synth_line, SAMPLE_RATE as TTS_SR, voice_for_speaker
from app.services.ai_tasks import chat_stream_with_rag

logger = logging.getLogger(__name__)


def _to_16k_mono(sample_rate: int, audio: np.ndarray) -> np.ndarray:
    """Convert FastRTC audio (int16 stereo or mono) to float32 mono @ 16kHz."""
    if audio.ndim > 1:
        audio = audio.mean(axis=0)
    audio = audio.astype("float32") / 32768.0
    if sample_rate != 16000:
        # Cheap polyphase resample
        from scipy.signal import resample_poly
        gcd = np.gcd(sample_rate, 16000)
        up = 16000 // gcd
        down = sample_rate // gcd
        audio = resample_poly(audio, up, down).astype("float32")
    return audio


def _split_sentences(text: str) -> List[str]:
    import re
    parts = re.split(r"(?<=[\.\?\!])\s+", text.strip())
    return [p for p in parts if p]


async def voice_turn_handler(audio_in: Tuple[int, np.ndarray], history: List[Dict]):
    """Single-turn handler. Async because LLM stream is async.

    `history` is a per-session list of {role, content}. Caller maintains it.
    Yields (sample_rate, np.int16) audio chunks.
    """
    sr, audio = audio_in
    pcm = _to_16k_mono(sr, audio)

    user_text = transcribe_pcm16k(pcm).strip()
    if not user_text:
        return
    history.append({"role": "user", "content": user_text})
    logger.info("voice user: %s", user_text[:80])

    voice = voice_for_speaker("Alex")
    buffer = ""
    full = ""
    async for delta in chat_stream_with_rag(history, retrieval_block=""):
        full += delta
        buffer += delta
        # Speak each sentence as it arrives
        while True:
            parts = _split_sentences(buffer)
            if len(parts) < 2:
                break
            sentence, buffer = parts[0], " ".join(parts[1:])
            audio = synth_line(sentence, voice)
            yield (TTS_SR, (audio * 32768).astype("int16"))

    if buffer.strip():
        audio = synth_line(buffer, voice)
        yield (TTS_SR, (audio * 32768).astype("int16"))

    history.append({"role": "assistant", "content": full})
```

- [ ] **Step 2: Tests**

```python
import numpy as np
import pytest


@pytest.mark.asyncio
async def test_voice_turn_handler_yields_audio(monkeypatch):
    from app.services import voice_pipeline as vp

    async def fake_stream(history, retrieval_block=""):
        yield "Hello."
        yield " World!"

    monkeypatch.setattr(vp, "transcribe_pcm16k", lambda pcm, language=None: "what's up?")
    monkeypatch.setattr(vp, "chat_stream_with_rag", fake_stream)
    monkeypatch.setattr(vp, "synth_line", lambda text, voice: np.ones(int(24000 * 0.2), dtype="float32"))

    history = []
    chunks = []
    async for sr, audio in vp.voice_turn_handler((16000, np.zeros(16000, dtype="int16")), history):
        chunks.append((sr, audio))

    assert len(chunks) >= 1
    sr, audio = chunks[0]
    assert sr == 24000 and audio.dtype == np.int16
    assert history[0]["role"] == "user"
    assert history[-1]["role"] == "assistant"
    assert "Hello." in history[-1]["content"]
    assert "World!" in history[-1]["content"]


@pytest.mark.asyncio
async def test_voice_turn_handler_skips_empty_transcript(monkeypatch):
    from app.services import voice_pipeline as vp

    monkeypatch.setattr(vp, "transcribe_pcm16k", lambda pcm, language=None: "")
    async def fake_stream(history, retrieval_block=""):
        yield "should not appear"
    monkeypatch.setattr(vp, "chat_stream_with_rag", fake_stream)

    history = []
    chunks = []
    async for s, a in vp.voice_turn_handler((16000, np.zeros(800, dtype="int16")), history):
        chunks.append(s)
    assert chunks == []
    assert history == []
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/voice_pipeline.py backend/tests/test_voice_pipeline.py
git commit -m "feat(voice): single-turn handler — STT → chat_stream → Kokoro per sentence"
```

### Edge cases (Task 2)

- **VAD detected too aggressive cutoff**: user pauses mid-sentence → STT returns partial. Acceptable: the model will respond. Tune `ReplyOnPause` silence threshold in router (Task 3).
- **`scipy` heavy**: imported lazily inside `_to_16k_mono`. If unavailable, fallback to a `numpy` `interp`-based resampler (acceptable for 48k→16k). Add `scipy>=1.10` to requirements.
- **Long LLM response**: TTS is sentence-streamed so latency to first audio chunk is fast.
- **Sentence-split heuristic**: regex on `.?!` followed by whitespace; doesn't handle "Mr. Smith" perfectly. Acceptable v1.

---

## Task 3: FastRTC mount under FastAPI

**Files:**
- Create: `backend/app/routers/voice.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Router**

`backend/app/routers/voice.py`:

```python
"""Mount FastRTC's audio stream onto the FastAPI app.

We follow FastRTC's `Stream(...).mount(app, path="/api/v1/voice")` pattern.
Each connection has its own per-session history list (closure capture).
"""
import asyncio
import logging
from typing import Generator, Tuple

import numpy as np
from fastapi import APIRouter

from app.services.voice_pipeline import voice_turn_handler

logger = logging.getLogger(__name__)


def install(app):
    """Attach FastRTC stream to the FastAPI app."""
    from fastrtc import Stream, ReplyOnPause

    def make_handler():
        history: list[dict] = []

        async def _async_handler(audio_in: Tuple[int, np.ndarray]):
            async for sr, audio in voice_turn_handler(audio_in, history):
                yield sr, audio

        def _sync_handler(audio_in):
            """ReplyOnPause expects a sync generator; bridge to async."""
            loop = asyncio.new_event_loop()
            try:
                gen = _async_handler(audio_in).__aiter__()
                while True:
                    try:
                        result = loop.run_until_complete(gen.__anext__())
                    except StopAsyncIteration:
                        break
                    yield result
            finally:
                loop.close()

        return ReplyOnPause(
            _sync_handler,
            input_sample_rate=16000,
            output_sample_rate=24000,
        )

    stream = Stream(
        handler=make_handler(),
        modality="audio",
        mode="send-receive",
    )
    stream.mount(app, path="/api/v1/voice")
    logger.info("FastRTC voice stream mounted at /api/v1/voice")
```

- [ ] **Step 2: Wire into `main.py`**

In `backend/main.py`, after `app = FastAPI(...)`:

```python
from app.routers.voice import install as install_voice
install_voice(app)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/voice.py backend/main.py
git commit -m "feat(voice): mount FastRTC stream at /api/v1/voice"
```

### Edge cases (Task 3)

- **JWT for WebRTC offer/answer**: FastRTC's `mount` exposes `POST /offer` (or similar). v1 leaves this **unauthenticated** for the LAN/local-dev case. Production hardening: add a `before_route` callback that reads `Authorization` from query string (browsers can't set headers on RTCPeerConnection). Document as TODO.
- **Per-session state**: `make_handler()` returns a fresh handler per connection; closure-scoped `history` keeps turns isolated.
- **Concurrent voice sessions**: faster-whisper + Kokoro are model-singletons, so concurrent loads share weights. Throughput limited by GPU/CPU.
- **Memory leak risk**: history grows unbounded per session; cap at 20 turns by trimming `history` after each turn.
- **Browser frame size variance**: FastRTC chunks audio to `input_sample_rate` regardless of browser.

---

## Task 4: End-to-end manual

- [ ] **Step 1: Bring up**

```bash
docker compose up -d
```

- [ ] **Step 2: Visit voice screen**

Open `http://localhost/voice-chat`, click mic. (Phase 10 wires the UI to FastRTC client SDK.)

- [ ] **Step 3: Verify**

Speak. After ~1s pause, you hear synth back. Logs show user text + assistant text.

---

## Phase 7 verification checklist

- [ ] `pytest -q` green.
- [ ] FastRTC mounts at `/api/v1/voice` — backend starts without error.
- [ ] Real browser → WebRTC → assistant audio round-trip works locally.
- [ ] History grows per session; new RTC connection resets.

## Edge cases summary

1. **Cold start**: first turn loads whisper + kokoro models (~10s on CPU). Pre-warm at FastAPI startup:
   ```python
   @app.on_event("startup")
   async def warm():
       try:
           from app.services.stt import _get_model
           from app.services.kokoro_loader import get_kokoro
           _get_model(); get_kokoro()
       except Exception: pass
   ```
2. **TLS for WebRTC**: many browsers block insecure WebRTC. For LAN testing, Chrome allows `http://localhost`. For LAN IP, use a reverse proxy with self-signed TLS.
3. **Echo cancellation**: rely on browser AEC. Disable headphone speakers leaking into mic.
4. **Concurrency cap**: single-process FastAPI handles ~4 concurrent voice sessions before whisper saturates CPU. Document.
5. **JWT TBD**: production deploy: add a session-token query param checked in a FastRTC `before_route`. v1 doc note suffices.
6. **Mobile**: Safari iOS supports WebRTC after user gesture; FastRTC `Stream` supports it.
7. **Disconnect cleanup**: `history` is GC'd when the stream object is collected. No leak.
