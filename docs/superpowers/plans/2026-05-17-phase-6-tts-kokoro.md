# Phase 6 — TTS with Kokoro (Audio Recap audio)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an `AudioRecap` row gets a `script`, an ARQ job stitches the script into one MP3 with two voices (Alex + Jamie), writes to `AUDIO_DIR/<user_id>/<recap_id>.mp3`, sets `audio_path` on the row, and serves it via `GET /api/v1/audio-recaps/{id}/audio`.

**Architecture:** Kokoro-82M ONNX runtime, GPU when available else CPU. Two distinct voices map to two speakers (defaults `af_bella` for Alex, `am_michael` for Jamie). Per line, we synthesize 24kHz WAV, then ffmpeg-concat + transcode to MP3 (128kbps). Generation goes through ARQ to keep request latency low.

**Tech Stack:** `kokoro-onnx` (small wrapper around `onnxruntime`), `soundfile`, `numpy`, `ffmpeg-python` (subprocess wrapper). `onnxruntime-gpu` optional.

**Depends on:** P0, P2, P4. **Independent of:** P5. **Blocks:** P7 (FastRTC reuses Kokoro for outbound speech).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | modify | `kokoro-onnx>=0.4.0`, `soundfile>=0.12`, `numpy>=1.26`, `onnxruntime>=1.17`. Optional: `onnxruntime-gpu>=1.17` (worker only if GPU) |
| `backend/Dockerfile.worker` | modify | Add `ffmpeg` to apt-get; pre-download Kokoro model |
| `backend/app/models/orm.py` | modify | Add `audio_path`, `tts_status`, `tts_error` to `AudioRecap` |
| `backend/alembic/versions/0004_audio_recap_audio.py` | create | Add columns |
| `backend/app/services/tts.py` | create | `synth_lines(script, voice_map)` returns paths and ffmpeg-concat to mp3 |
| `backend/app/services/kokoro_loader.py` | create | Lazy `Kokoro` singleton |
| `backend/app/workers/tts.py` | create | ARQ job `synth_recap(recap_id)` |
| `backend/worker_main.py` | modify | Register `synth_recap` |
| `backend/app/routers/audio_recaps.py` | modify | After save, enqueue `synth_recap`; add `GET /{id}/audio`, `GET /{id}/status` |
| `backend/app/schemas/schemas.py` | modify | `AudioRecapOut` adds `tts_status`, `tts_error`, `audio_url` (computed property) |
| `backend/tests/test_tts_service.py` | create | unit test for line synth with stub onnx |
| `backend/tests/test_tts_worker.py` | create | worker job updates row |

---

## Task 1: Deps + ORM + migration

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/models/orm.py`, `backend/Dockerfile.worker`
- Create: `backend/alembic/versions/0004_audio_recap_audio.py`

- [ ] **Step 1: Append to requirements**

```
kokoro-onnx>=0.4.0
soundfile>=0.12.1
onnxruntime>=1.17.0
ffmpeg-python>=0.2.0
```

(GPU variant via separate optional install; v1 sticks to CPU runtime to keep base image small.)

- [ ] **Step 2: Add columns to AudioRecap**

In `backend/app/models/orm.py`, modify `AudioRecap`:

```python
class AudioRecap(Base):
    __tablename__ = "audio_recaps"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    date = Column(Date, server_default=func.current_date())
    source_document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    summary = Column(Text)
    script = Column(JSON, default=list)
    audio_path = Column(String(1000))
    tts_status = Column(String(20), default="pending", index=True)  # pending|running|ready|failed
    tts_error = Column(Text)

    owner = relationship("User", back_populates="audio_recaps")
```

- [ ] **Step 3: Add ffmpeg + Kokoro to worker image**

Edit `backend/Dockerfile.worker` — add `ffmpeg` to apt list:

```
ffmpeg
```

And, at the end (before USER):

```
RUN python -c "from kokoro_onnx import Kokoro; print('kokoro pkg ok')"
# Optional: pre-download Kokoro model
ENV KOKORO_MODEL_PATH=/data/models/kokoro-v0_19.onnx
ENV KOKORO_VOICES_PATH=/data/models/voices.bin
```

(The model + voices files are downloaded on first run; pre-cache via the worker's startup or doc.)

- [ ] **Step 4: Generate migration**

```bash
docker run -d --name dm-pg-tmp -e POSTGRES_DB=docmind -e POSTGRES_USER=docmind -e POSTGRES_PASSWORD=docmind -p 55432:5432 pgvector/pgvector:pg16
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic revision --autogenerate -m "audio_recap audio cols" --rev-id 0004
```

Verify columns added: `audio_path`, `tts_status`, `tts_error`. Apply + downgrade + reapply.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/Dockerfile.worker backend/app/models/orm.py backend/alembic/versions/0004_audio_recap_audio.py
git commit -m "feat(tts): audio_path/tts_status/tts_error on AudioRecap; worker ffmpeg"
```

---

## Task 2: Kokoro loader + TTS service

**Files:**
- Create: `backend/app/services/kokoro_loader.py`
- Create: `backend/app/services/tts.py`
- Create: `backend/tests/test_tts_service.py`

- [ ] **Step 1: Loader**

`backend/app/services/kokoro_loader.py`:

```python
import os
import logging
from pathlib import Path

_kokoro = None
_logger = logging.getLogger(__name__)


def _ensure_model_files():
    """Best-effort: download model files if KOKORO_AUTO_DOWNLOAD=1 and missing."""
    model = Path(os.getenv("KOKORO_MODEL_PATH", "/data/models/kokoro-v0_19.onnx"))
    voices = Path(os.getenv("KOKORO_VOICES_PATH", "/data/models/voices.bin"))
    if model.exists() and voices.exists():
        return str(model), str(voices)

    if os.getenv("KOKORO_AUTO_DOWNLOAD", "1") == "1":
        import urllib.request
        model.parent.mkdir(parents=True, exist_ok=True)
        if not model.exists():
            urllib.request.urlretrieve(
                "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/kokoro-v0_19.onnx",
                model,
            )
        if not voices.exists():
            urllib.request.urlretrieve(
                "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files/voices.bin",
                voices,
            )
    return str(model), str(voices)


def get_kokoro():
    global _kokoro
    if _kokoro is not None:
        return _kokoro
    model_path, voices_path = _ensure_model_files()
    from kokoro_onnx import Kokoro
    _kokoro = Kokoro(model_path, voices_path)
    _logger.info("Kokoro ONNX loaded from %s", model_path)
    return _kokoro
```

- [ ] **Step 2: TTS service**

`backend/app/services/tts.py`:

```python
"""Stitch a 2-speaker script to a single MP3 via Kokoro + ffmpeg.

Voice map:
  Alex  -> af_bella  (female warm)
  Jamie -> am_michael (male warm)

Override per recap by setting env KOKORO_VOICE_ALEX / KOKORO_VOICE_JAMIE.
"""
import os
import subprocess
import tempfile
from pathlib import Path
from typing import Iterable, List, Dict, Tuple

import numpy as np
import soundfile as sf

from app.core.storage import user_audio_dir
from app.services.kokoro_loader import get_kokoro


SAMPLE_RATE = 24000


def voice_for_speaker(speaker: str) -> str:
    s = speaker.strip().lower()
    if s == "alex":
        return os.getenv("KOKORO_VOICE_ALEX", "af_bella")
    if s == "jamie":
        return os.getenv("KOKORO_VOICE_JAMIE", "am_michael")
    return os.getenv("KOKORO_DEFAULT_VOICE", "af_bella")


def synth_line(text: str, voice: str) -> np.ndarray:
    if not text.strip():
        return np.zeros(int(SAMPLE_RATE * 0.2), dtype="float32")
    kokoro = get_kokoro()
    samples, sr = kokoro.create(text, voice=voice, speed=1.0, lang="en-us")
    if sr != SAMPLE_RATE:
        raise RuntimeError(f"unexpected SR from Kokoro: {sr}")
    return samples.astype("float32")


def synth_script_to_mp3(script: List[Dict[str, str]], user_id: int, recap_id: int) -> str:
    """Return absolute path to the produced MP3."""
    out_dir = user_audio_dir(user_id)
    out_path = Path(out_dir) / f"{recap_id}.mp3"

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        # Write each line as a WAV
        wavs: List[Path] = []
        gap = np.zeros(int(SAMPLE_RATE * 0.35), dtype="float32")  # 350ms gap between turns

        for i, line in enumerate(script):
            voice = voice_for_speaker(line.get("speaker", "Alex"))
            audio = synth_line(line.get("dialogue", ""), voice)
            audio = np.concatenate([audio, gap])
            wav = tmp / f"line_{i:03d}.wav"
            sf.write(str(wav), audio, SAMPLE_RATE)
            wavs.append(wav)

        if not wavs:
            raise ValueError("empty script")

        # ffmpeg concat list
        concat_file = tmp / "list.txt"
        concat_file.write_text("".join(f"file '{w.as_posix()}'\n" for w in wavs))

        # Encode to MP3 128kbps
        cmd = [
            "ffmpeg", "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_file),
            "-c:a", "libmp3lame", "-b:a", "128k",
            str(out_path),
        ]
        subprocess.run(cmd, check=True, capture_output=True)

    return str(out_path)
```

- [ ] **Step 3: Tests**

`backend/tests/test_tts_service.py`:

```python
import numpy as np
import pytest


def test_voice_for_speaker_defaults():
    from app.services.tts import voice_for_speaker
    assert voice_for_speaker("Alex").startswith("af_")
    assert voice_for_speaker("Jamie").startswith("am_")
    assert voice_for_speaker("Unknown") == "af_bella" or voice_for_speaker("Unknown").startswith("af_")


def test_synth_line_returns_array(monkeypatch):
    from app.services import tts

    class StubKokoro:
        def create(self, text, voice, speed, lang):
            return np.zeros(int(24000 * 0.5), dtype="float32"), 24000

    monkeypatch.setattr(tts, "get_kokoro", lambda: StubKokoro())
    out = tts.synth_line("hello world", "af_bella")
    assert isinstance(out, np.ndarray) and out.dtype == np.float32
    assert out.shape[0] == int(24000 * 0.5)


def test_synth_line_empty_returns_silence(monkeypatch):
    from app.services import tts

    class StubKokoro:
        def create(self, text, voice, speed, lang):
            raise AssertionError("should not be called for empty text")

    monkeypatch.setattr(tts, "get_kokoro", lambda: StubKokoro())
    out = tts.synth_line("   ", "af_bella")
    assert out.shape[0] > 0  # silence pad


def test_synth_script_writes_mp3(monkeypatch, tmp_path):
    from app.services import tts
    monkeypatch.setenv("AUDIO_DIR", str(tmp_path))
    from importlib import reload
    from app.core import storage; reload(storage)
    reload(tts)

    class StubKokoro:
        def create(self, text, voice, speed, lang):
            return np.zeros(int(24000 * 0.3), dtype="float32"), 24000

    monkeypatch.setattr(tts, "get_kokoro", lambda: StubKokoro())

    script = [
        {"speaker": "Alex", "dialogue": "Hello"},
        {"speaker": "Jamie", "dialogue": "Hi back"},
    ]
    path = tts.synth_script_to_mp3(script, user_id=42, recap_id=7)
    from pathlib import Path
    assert Path(path).exists()
    assert path.endswith("7.mp3")
```

- [ ] **Step 4: Run, expect pass**

```bash
cd backend && pytest tests/test_tts_service.py -v
```

Note: the last test requires `ffmpeg` binary; locally install (`brew install ffmpeg` / `apt install ffmpeg`). Worker image already has it.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/tts.py backend/app/services/kokoro_loader.py backend/tests/test_tts_service.py
git commit -m "feat(tts): Kokoro 2-voice script synth + ffmpeg mp3 concat"
```

### Edge cases (Task 2)

- **Kokoro first call downloads ~330MB model + voices**: pre-cache in `MODELS_DIR`; the loader has `KOKORO_AUTO_DOWNLOAD=1`.
- **Voice doesn't exist** in `voices.bin`: Kokoro raises; surfaced to ARQ failure handler.
- **Script has 0 lines**: `synth_script_to_mp3` raises `ValueError("empty script")`.
- **Single line `> 500 chars`**: Kokoro chunks internally; fine.
- **Non-English text**: `lang="en-us"`; with mixed-language input the prosody degrades but no crash.
- **GPU**: `onnxruntime` autodetects CUDA. To force GPU, install `onnxruntime-gpu` in image and set `KOKORO_PROVIDERS=CUDAExecutionProvider`. v1 stays CPU.

---

## Task 3: ARQ job + router wiring

**Files:**
- Create: `backend/app/workers/tts.py`
- Modify: `backend/worker_main.py`
- Modify: `backend/app/routers/audio_recaps.py`
- Modify: `backend/app/schemas/schemas.py`
- Create: `backend/tests/test_tts_worker.py`

- [ ] **Step 1: Worker job**

`backend/app/workers/tts.py`:

```python
import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.orm import AudioRecap
from app.services.tts import synth_script_to_mp3

logger = logging.getLogger(__name__)


async def synth_recap(ctx, recap_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        recap = db.get(AudioRecap, recap_id)
        if recap is None:
            return {"ok": False, "error": "recap not found"}

        recap.tts_status = "running"
        db.commit()
        try:
            path = synth_script_to_mp3(recap.script or [], recap.user_id, recap.id)
            recap.audio_path = path
            recap.tts_status = "ready"
            recap.tts_error = None
            db.commit()
            return {"ok": True, "recap_id": recap.id, "path": path}
        except Exception as e:
            logger.exception("tts failed for recap %d", recap.id)
            recap.tts_status = "failed"
            recap.tts_error = str(e)[:2000]
            db.commit()
            return {"ok": False, "recap_id": recap.id, "error": str(e)}
    finally:
        db.close()
```

- [ ] **Step 2: Register worker function**

`backend/worker_main.py`:

```python
from app.workers.tts import synth_recap


class WorkerSettings:
    functions = [parse_document, embed_document, synth_recap]
    # … rest unchanged
```

- [ ] **Step 3: Schemas**

In `backend/app/schemas/schemas.py`, modify `AudioRecapOut`:

```python
class AudioRecapOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    date: Optional[date] = None
    source_document_id: Optional[int] = None
    summary: Optional[str] = None
    script: List[ScriptLine] = []
    tts_status: str = "pending"
    tts_error: Optional[str] = None
```

- [ ] **Step 4: Router**

Modify `backend/app/routers/audio_recaps.py` `generate_audio_recap` to enqueue after save:

```python
from app.workers.queue import get_pool
from fastapi.responses import FileResponse
import os


# … existing handler …
@router.post("/generate", response_model=AudioRecapOut)
async def generate_audio_recap(
    req: AudioRecapGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    from app.services.generation import resolve_doc_text
    content = resolve_doc_text(doc, page_range=req.page_range)

    try:
        result = await ai_tasks.generate_audio_recap(content)
    except ai_tasks.LLMTaskError as e:
        raise HTTPException(status_code=500, detail=str(e))

    recap = AudioRecap(
        user_id=current_user.id,
        title=f"Audio Recap: {doc.name}",
        source_document_id=doc.id,
        summary=result.summary,
        script=[s.model_dump() for s in result.script],
        tts_status="pending",
    )
    db.add(recap); db.commit(); db.refresh(recap)

    # Enqueue TTS
    try:
        pool = await get_pool()
        await pool.enqueue_job("synth_recap", recap.id)
    except Exception as e:
        recap.tts_status = "failed"
        recap.tts_error = f"enqueue failed: {e}"
        db.commit()

    return recap


@router.get("/{recap_id}/audio")
def get_recap_audio(recap_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="recap not found")
    if recap.tts_status != "ready" or not recap.audio_path or not os.path.exists(recap.audio_path):
        raise HTTPException(status_code=400, detail=f"tts {recap.tts_status}")
    return FileResponse(recap.audio_path, media_type="audio/mpeg", filename=f"recap-{recap.id}.mp3")


@router.get("/{recap_id}/status")
def get_recap_status(recap_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="recap not found")
    return {"id": recap.id, "tts_status": recap.tts_status, "tts_error": recap.tts_error}
```

- [ ] **Step 5: Tests**

`backend/tests/test_tts_worker.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_synth_worker_success(db, monkeypatch, tmp_path):
    from app.models.orm import User, AudioRecap
    from app.workers import tts as worker_mod

    u = User(name="u", email="t@t.com", password_hash="x")
    db.add(u); db.commit(); db.refresh(u)
    recap = AudioRecap(user_id=u.id, title="r", script=[{"speaker":"Alex","dialogue":"hi"}])
    db.add(recap); db.commit(); db.refresh(recap)

    fake_path = str(tmp_path / "out.mp3"); (tmp_path / "out.mp3").write_bytes(b"x")
    monkeypatch.setattr(worker_mod, "synth_script_to_mp3", lambda script, user_id, recap_id: fake_path)
    monkeypatch.setattr(worker_mod, "SessionLocal", lambda: db)

    out = await worker_mod.synth_recap(ctx={}, recap_id=recap.id)
    assert out["ok"] is True
    db.refresh(recap)
    assert recap.tts_status == "ready"
    assert recap.audio_path == fake_path


@pytest.mark.asyncio
async def test_synth_worker_failure(db, monkeypatch):
    from app.models.orm import User, AudioRecap
    from app.workers import tts as worker_mod

    u = User(name="u", email="t2@t.com", password_hash="x")
    db.add(u); db.commit(); db.refresh(u)
    recap = AudioRecap(user_id=u.id, title="r", script=[])
    db.add(recap); db.commit(); db.refresh(recap)

    def boom(*a, **kw): raise RuntimeError("no script")
    monkeypatch.setattr(worker_mod, "synth_script_to_mp3", boom)
    monkeypatch.setattr(worker_mod, "SessionLocal", lambda: db)

    out = await worker_mod.synth_recap(ctx={}, recap_id=recap.id)
    assert out["ok"] is False
    db.refresh(recap)
    assert recap.tts_status == "failed"
    assert "no script" in recap.tts_error
```

- [ ] **Step 6: Run + commit**

```bash
cd backend && pytest tests/test_tts_worker.py tests/test_tts_service.py -v
git add backend/app/workers/tts.py backend/worker_main.py backend/app/routers/audio_recaps.py backend/app/schemas/schemas.py backend/tests/test_tts_worker.py
git commit -m "feat(tts): synth_recap job + /audio + /status endpoints"
```

### Edge cases (Task 3)

- **Polling**: frontend polls `/status` every 2s until `ready` or `failed`; the audio screen disables Play until ready.
- **Re-generate the audio**: a POST `/{id}/retry-tts` endpoint would re-enqueue. Out of scope v1; users can delete + regenerate.
- **Massive recaps (>5 minutes)**: Kokoro takes ~real-time on CPU; ARQ `job_timeout=600` covers up to 10 minutes. For longer, raise per-job timeout.
- **`AUDIO_DIR` not in worker `/data` mount**: covered by compose volume.
- **MP3 quota**: no eviction; document a future cron job to prune `audio/*.mp3` older than 30 days.

---

## Task 4: End-to-end smoke

- [ ] **Step 1: Stack up**

```bash
docker compose up -d
```

- [ ] **Step 2: Generate recap**

```bash
TOKEN=...
DOC_ID=...
curl -s -X POST http://localhost:8000/api/v1/audio-recaps/generate \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"document_id\":$DOC_ID}" | jq
```

- [ ] **Step 3: Poll status**

```bash
RECAP_ID=...
watch -n 2 "curl -s http://localhost:8000/api/v1/audio-recaps/$RECAP_ID/status -H 'Authorization: Bearer $TOKEN'"
```
Expected: `running → ready`.

- [ ] **Step 4: Fetch audio**

```bash
curl -s -o recap.mp3 http://localhost:8000/api/v1/audio-recaps/$RECAP_ID/audio -H "Authorization: Bearer $TOKEN"
ffprobe recap.mp3
```

---

## Phase 6 verification checklist

- [ ] `pytest -q` green.
- [ ] Migration 0004 up/down/up clean.
- [ ] `tts_status` column on AudioRecap.
- [ ] `/audio-recaps/{id}/audio` returns MP3 once ready.
- [ ] Real smoke: 4-line recap → ~10s MP3 file produced.

## Edge cases summary

1. **Worker startup downloads Kokoro on first job**: latency for the first user. Pre-download in image build (`Dockerfile.worker`): `RUN python -c "from app.services.kokoro_loader import get_kokoro; get_kokoro()"`. Adds image size + build time.
2. **Voice quality**: `af_bella`, `am_michael` are stable; other voices in `voices.bin` (full list shipped). Users can later select voice via `KOKORO_VOICE_ALEX/JAMIE` env.
3. **Loud level mismatch between voices**: Kokoro output is normalised in-model. ffmpeg concat preserves levels — no extra step.
4. **ffmpeg missing on local dev**: `test_synth_script_writes_mp3` will fail. Document install or skip via env flag.
5. **Concurrent recap generation**: ARQ `max_jobs=4` runs up to 4 parallel; each loads Kokoro once per worker process. Memory ~300MB per process.
6. **Streaming the MP3**: `FileResponse` is range-friendly; the `<audio>` element streams it.
