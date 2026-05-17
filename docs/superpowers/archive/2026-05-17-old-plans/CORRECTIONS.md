# Plan Corrections — read before executing

Verified all 6 plans on 2026-05-17 after writing. These corrections supersede the original plan code where they conflict. The executor must apply these patches inline when running tasks.

---

## All plans — Windows / PowerShell shell

**Environment:** user runs on Windows 11 with PowerShell as default shell. Bash works through WSL or the Bash tool but `mkdir -p`, `for f in ...; do cp; done`, `LEXI=...`, `rm`, `touch`, `cp`, `grep -n`, `ls` produce different output or fail in PS.

**Action:** Replace each shell command block per the mapping below. PowerShell equivalents:

| Plan command (bash) | PowerShell equivalent |
|---|---|
| `mkdir -p path/to/dir` | `New-Item -ItemType Directory -Force -Path path/to/dir` |
| `cp src dest` | `Copy-Item src dest` |
| `for f in a b c; do cp "$SRC/$f" "$DST/$f"; done` | `@('a','b','c') \| ForEach-Object { Copy-Item "$SRC/$_" "$DST/$_" }` |
| `LEXI="C:/..."` (env var) | `$LEXI = "C:/..."` |
| `rm file` | `Remove-Item file` |
| `touch file` | `if (-not (Test-Path file)) { New-Item -ItemType File file }` |
| `grep -n "X" file` | `Select-String -Path file -Pattern "X"` |
| `ls dir` | `Get-ChildItem dir` |
| `git commit -m "$(cat <<'EOF' ... EOF)"` | `git commit -m @'`<br>multiline message<br>`'@` |

Or just use the Bash tool if WSL is available. P1/P2 prerequisites (`docker-compose`, `alembic`, `pytest`) are available either way.

---

## P1 — boot-and-provider

**Issue 1 (Task 12 — commit):** Stage path uses `git add -u app/services/` which is fine for the deleted `ai.py`, but `git add app/services/ai/` after that will re-stage the package directory which can be confusing. Fine as long as the commit message is right.

**Issue 2 (Task 11 — Alembic):** Plan says generated migration should contain `CREATE TABLE` for all 12 tables. Verify with `psql` after `alembic upgrade head`:

```powershell
docker-compose exec db psql -U docmind -d docmind -c "\dt"
```

Expected: lists `users, documents, quizzes, flashcard_sets, mind_maps, audio_recaps, quick_revise_sessions, notes, study_groups, user_settings, activity_logs, chat_history, alembic_version`.

---

## P2 — ingestion

**Issue 1 (Task 6 — chunker.py): dead code + missed page metadata.**

`_find_section()` is defined but never called. `current_tokens` declared but never used. `section_id`, `page_start`, `page_end` always None on chunks because Docling's markdown export does not preserve per-paragraph page numbers.

**Fix:**
- Delete `current_tokens: list[str] = []` line.
- Delete `_find_section` function entirely.
- Set `section_id=None, page_start=None, page_end=None` explicitly on Chunk (already None — just remove the dead `_find_section`).
- Add a TODO comment: `# TODO: extract page boundaries from Docling's iterate_items() with prov metadata to populate page_start/page_end.`

**Issue 2 (Task 6 — chunker.py): overlap bug.**

Lines 391-403, when paragraph would exceed `chunk_size`:
```python
flush()
if current_text_parts:
    overlap_text = current_text_parts[-1] if current_text_parts else ""
```

`current_text_parts` was just flushed but `flush()` doesn't clear `current_text_parts` — review the function: `flush()` only resets `position`. The list is reset by the next assignment `current_text_parts = [overlap_text] if overlap_text else []`. Trace shows the list keeps growing across flushes — bug.

**Fix:** Add at the start of `flush()`:
```python
def flush(extra_text: str = ""):
    nonlocal position, current_text_parts
    if not current_text_parts and not extra_text:
        return
    text = "\n\n".join(current_text_parts)
    if extra_text:
        text = (text + "\n\n" + extra_text).strip()
    chunks.append(Chunk(
        raw_text=text,
        section_id=None,
        page_start=None,
        page_end=None,
        position=position,
    ))
    position += 1
    current_text_parts = []  # NEW: clear after flush
```

Then in the loop, remove the manual reset and capture overlap correctly:
```python
for para in paragraphs:
    para_tokens = _enc.encode(para)
    current_size = _token_len("\n\n".join(current_text_parts))
    if current_size + len(para_tokens) > chunk_size and current_text_parts:
        # Capture last paragraph for overlap BEFORE flush
        last_para = current_text_parts[-1]
        flush()
        # Restore overlap (truncated to overlap_tokens)
        last_para_tokens = _enc.encode(last_para)
        if len(last_para_tokens) > overlap_tokens:
            last_para = _enc.decode(last_para_tokens[-overlap_tokens:])
        if last_para:
            current_text_parts = [last_para]

    if len(para_tokens) > chunk_size:
        sentences = re.split(r"(?<=[.!?])\s+", para)
        for sent in sentences:
            if _token_len("\n\n".join(current_text_parts)) + len(_enc.encode(sent)) > chunk_size:
                flush()
            current_text_parts.append(sent)
    else:
        current_text_parts.append(para)
```

**Issue 3 (Task 6 — chunker.py): dataclass `Chunk` name collision with ORM `Chunk`.**

Plan's self-review noted this but didn't fix it. Rename the dataclass:

```python
@dataclass
class ChunkData:   # was: Chunk
    raw_text: str
    section_id: Optional[str]
    page_start: Optional[int]
    page_end: Optional[int]
    position: int

def chunk_markdown(...) -> list[ChunkData]:   # was: list[Chunk]
    ...
    chunks: list[ChunkData] = []
    chunks.append(ChunkData(...))
```

Then in `ingest.py` Task 9, the import `from app.services.chunker import chunk_markdown` stays the same. The `raw_chunks` iteration works regardless of class name.

**Issue 4 (Task 9 — ingest.py): private `generators._provider()` use.**

Calling `_provider()` is private. Either:
- Add `provider = _provider` alias at module bottom of `generators.py`:
  ```python
  provider = _provider  # public alias for cross-module use
  ```
- OR import directly: `from app.services.ai import get_provider_with_fallback` in `ingest.py` and call `get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])` directly.

Pick the second — cleaner, no coupling to `generators.py` internals.

**Issue 5 (Task 11 — documents.py): UploadFile content double-decode.**

Plan keeps `content=content.decode("utf-8", errors="ignore")` on the Document. This was the original bug for non-text uploads (garbled PDFs). With Docling now handling parsing, `content` becomes a fallback only — we should still store the raw bytes path or skip storing raw `content` entirely. Recommendation: store empty `content` and rely on `parsed_md` populated by the ARQ worker reading the file from disk.

Quick fix without changing schema: keep `content` decode for now (it's used by Docling as input via `parse_bytes((doc.content or "").encode("utf-8"))`), but acknowledge Docling parsing PDFs from a UTF-8-decoded string of binary is **broken** for actual binary formats. The worker should read raw bytes from disk via a stored file path, not re-encode the decoded text.

**Real fix:** Add a `documents.file_path` column. Save the raw upload to `data/uploads/{doc_id}.{ext}`. The ARQ worker reads from that path with `parse_bytes(open(path, 'rb').read(), filename)`.

```python
# In Document model:
file_path = Column(String(500), nullable=True)

# In documents.py upload_document:
import os
upload_dir = "data/uploads"
os.makedirs(upload_dir, exist_ok=True)
ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else "bin"
content = await file.read()
size_str = f"{len(content) / (1024 * 1024):.1f} MB"

doc = Document(
    user_id=current_user.id,
    name=file.filename or "unknown",
    size=size_str,
    type=ext,
    tags=[],
    content="",            # no longer store decoded text
    processing_status="queued",
)
db.add(doc)
db.commit()
db.refresh(doc)

# Write file to disk
file_path = os.path.join(upload_dir, f"{doc.id}.{ext}")
with open(file_path, "wb") as f:
    f.write(content)
doc.file_path = file_path
db.commit()

# Enqueue
arq_pool = getattr(request.app.state, "arq_pool", None)
if arq_pool:
    await arq_pool.enqueue_job("ingest_document", doc.id)
```

And in `ingest.py`:
```python
# Replace:
raw_bytes = (doc.content or "").encode("utf-8", errors="ignore")
# With:
with open(doc.file_path, "rb") as f:
    raw_bytes = f.read()
```

Add Alembic migration for `file_path` column.

---

## P3 — rag-query

**Issue 1 (Task 3 — retrieval.py): SQLAlchemy 2.0 deprecation.**

`row._asdict()` is deprecated. Use `dict(row._mapping)`.

**Fix:** Replace both occurrences:
```python
# Old
chunk_data[row.id] = row._asdict()
chunk_data.setdefault(row.id, row._asdict())

# New
chunk_data[row.id] = dict(row._mapping)
chunk_data.setdefault(row.id, dict(row._mapping))
```

**Issue 2 (Task 3 — retrieval.py): pgvector parameter binding.**

Passing `vec_str = "[0.1,0.2,...]"` as a regular text parameter only works if pgvector accepts a string cast. Cleaner approach uses the `pgvector` Python package's `Vector` type:

**Fix (optional but more robust):**
```python
from pgvector.sqlalchemy import Vector  # at top
# ... in hybrid_retrieve:
params = {"vec": query_vec, "user_id": user_id, "topk": top_k}
# Use type_=Vector(768) on the bindparam, or stick with string cast:
vec_sql = text("""
    ... WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> CAST(:vec AS vector)
    LIMIT :topk
""")
```

Add `pgvector>=0.2.0` to `requirements.txt`.

**Issue 3 (Task 7 — rag_pipeline.py): `_empty_doc()` returns transient SQLAlchemy instance.**

Works but unusual — calling `Document()` outside a session and setting attributes. Replace with a dataclass:

**Fix:**
```python
from dataclasses import dataclass

@dataclass
class _DocStub:
    summary: str = ""
    section_summaries: list = None
    parsed_md: str = ""
    content: str = ""
    token_count: int = 0

    def __post_init__(self):
        if self.section_summaries is None:
            self.section_summaries = []


def _empty_doc():
    return _DocStub()
```

Then update `_build_system(doc, ...)` to read `.summary` etc. — same attribute names so no further changes.

**Issue 4 (Task 7 — `_resolve_structural`):** Uses 1-indexed `target` against 0-indexed `section_summaries[target - 1]`. If outline has front matter (e.g. preface, table of contents), "chapter 3" may not align. Acceptable for v1. Add a TODO.

**Issue 5 (Task 7 — `_multi_retrieve` dedup):** Currently dedups by `chunk_id` keeping first occurrence. RRF would be more correct (a chunk found by multiple queries should rank higher). Acceptable for v1, but note as a known suboptimality.

---

## P4 — generators

**CRITICAL — Issue 1 (Task 3 Step 1): Invalid Python in audio_pipeline.py.**

Lines 220-231 of the plan contain:
```python
doc_title = doc.name.replace(/\.[a-z]+$/i, "")  # noqa — placeholder, use below
```

This is JS regex syntax. Python will SyntaxError at parse time. Step 2 provides a clean rewrite but the implementer might write Step 1 first.

**Fix:** **Skip Step 1 entirely. Use only Step 2's clean version.** Treat Task 3 as a single step: write the file using the code block from Step 2.

The clean version (from Task 3 Step 2):

```python
"""
Multi-step Audio Recap pipeline — NotebookLM-style critique loop.
6 LLM calls: outline → critique → revised outline → script → critique → final script.
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
    """6-step Audio Recap. Returns (summary, script_list)."""
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    ctx = get_doc_context(doc)

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
```

**Issue 2 (Task 5 — worker.py): import order.**

Plan updates `worker.py` import line by hand. Verify the existing import in P2 is `from app.workers.ingest import ingest_document`. After P4, it becomes `from app.workers.ingest import ingest_document, generate_audio_recap_task`. Same for `functions = [...]`. Ensure both `ingest_document` AND `generate_audio_recap_task` are exported from `ingest.py`.

---

## P5 — voice

**Issue 1 (Task 6 — handler.py): FastRTC API may differ.**

Plan uses `Stream(_RTCHandler(), mode="send-receive")` and `RealtimeHandler` ABC. Actual FastRTC (as of late 2025/early 2026) uses:

- `from fastrtc import Stream, ReplyOnPause, AsyncStreamHandler` (not `RealtimeHandler`)
- `Stream(handler=ReplyOnPause(handle_audio_fn), modality="audio", mode="send-receive")`

**Fix:** Verify against current FastRTC version before implementing. Likely simpler pattern:

```python
# backend/app/voice/handler.py
import numpy as np
from fastrtc import ReplyOnPause

async def handle_audio(audio: tuple[int, np.ndarray]):
    """Called by FastRTC's ReplyOnPause when user pauses speaking."""
    sample_rate, audio_array = audio

    from app.voice.stt import transcribe_audio
    audio_bytes = audio_array.astype(np.int16).tobytes()
    text = transcribe_audio(audio_bytes, sample_rate)
    if not text:
        return

    from app.services.generators import chat_complete
    reply = await chat_complete(messages=[{"role": "user", "content": text}], context="")

    from app.voice.tts_client import text_to_speech, is_available
    if not await is_available():
        return
    wav_bytes = await text_to_speech(reply)

    import soundfile as sf
    import io
    audio_np, sr = sf.read(io.BytesIO(wav_bytes), dtype="int16")
    yield (sr, audio_np)
```

And in `router.py`:
```python
def get_fastrtc_app():
    try:
        from fastrtc import Stream, ReplyOnPause
        from app.voice.handler import handle_audio
        return Stream(ReplyOnPause(handle_audio), modality="audio", mode="send-receive")
    except ImportError:
        return None
```

Confirm against `https://fastrtc.org/userguide/` before implementing.

**Issue 2 (Task 7 — router.py): WebSocket lacks auth.**

Endpoint accepts any connection. P6's frontend tries `?token=` query, plan doesn't read it.

**Fix:**
```python
from fastapi import Query
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.orm import User

@router.websocket("/ws")
async def voice_websocket(websocket: WebSocket, token: str = Query(...)):
    user_id = decode_token(token)
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
    # ... rest of handler unchanged
```

**Issue 3 (Task 5 — tts_client.py): VibeVoice endpoint path.**

Plan calls `POST /v1/audio/speech` and `GET /health`. VibeVoice's `vibevoice_api.server` uses the OpenAI-compatible `/v1/audio/speech` path which is correct. The `/health` may not exist — VibeVoice typically exposes `/v1/models` for liveness.

**Fix:**
```python
async def is_available() -> bool:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.vibevoice_url}/v1/models")
            return resp.status_code == 200
    except Exception:
        return False
```

**Issue 4 (Task 3 — docker-compose vibevoice service):** Pulling vibevoice from a fresh `python:3.11-slim` image on every container restart is slow. Build a custom Dockerfile:

**Fix:** Add `backend/vibevoice/Dockerfile`:
```dockerfile
FROM python:3.11-slim
RUN pip install --no-cache-dir vibevoice
CMD ["python", "-m", "vibevoice_api.server", \
     "--model_path", "microsoft/VibeVoice-Realtime-0.5B", \
     "--port", "8001", "--host", "0.0.0.0"]
```

And in docker-compose:
```yaml
vibevoice:
  build: ./backend/vibevoice
  ports: ["8001:8001"]
  volumes:
    - vibevoice_cache:/root/.cache/huggingface
```

---

## P6 — frontend

**Issue 1 (Task 6 — Library status polling): field name + endpoint mismatch.**

Plan uses `docsApi.get(docId)` and checks `res.status === 'ready'`. But:
- Backend `GET /documents/{id}` returns `DocumentOut` with `processing_status` (not `status`).
- Backend has separate `GET /documents/{id}/status` returning `{id, status}`.

**Fix:** Add to `api/index.js`:
```js
// In documents object:
status: (id) => api.get(`/documents/${id}/status`),
```

Then in Library.jsx polling loop:
```js
const res = await docsApi.status(docId);
if (res.status !== 'ready') {
  remaining.push(docId);
} else {
  // ...
}
```

**Issue 2 (Task 11 — AudioRecap status field):** Same pattern. AudioRecapOut has `processing_status`, not `status`.

**Fix:**
```js
const recap = await audioRecapsApi.get(pollId);
if (recap.processing_status === 'ready') {   // was: recap.status
```

**Issue 3 (Task 17 — History): shape mismatch.**

Backend `GET /history` returns `list[ActivityLogOut]` (objects `{id, date}`). Frontend's `set-history` action puts the response into `state.activityLog` which the dashboard treats as `string[]` (date strings).

**Fix:** Either reshape in reducer or in API call:
```js
// In History.jsx:
historyApi.list()
  .then(events => dispatch({ type: 'set-history', history: events.map(e => e.date) }))
```

**Issue 4 (Task 19 — VoiceChat): protocol mismatch with P5 backend.**

P5 backend sends plain-text prefixed messages: `PROCESSING`, `SILENCE`, `TRANSCRIPT:<text>`, `REPLY:<text>`, `ERROR:<msg>`, plus raw binary WAV bytes. Frontend tries `JSON.parse(event.data)` and looks for `msg.type`.

**Fix:** Replace the `ws.onmessage` handler:
```js
ws.onmessage = async (event) => {
  if (typeof event.data === 'string') {
    if (event.data.startsWith('TRANSCRIPT:')) {
      setTranscript(event.data.slice(11));
      setStatus('thinking');
    } else if (event.data.startsWith('REPLY:')) {
      setReply(event.data.slice(6));
      setStatus('speaking');
    } else if (event.data === 'PROCESSING') {
      setStatus('thinking');
    } else if (event.data === 'SILENCE') {
      setStatus('idle');
    } else if (event.data.startsWith('ERROR:')) {
      setError(event.data.slice(6));
      setStatus('idle');
    }
  } else if (event.data instanceof Blob) {
    // Binary WAV — play it
    const audio = new Audio(URL.createObjectURL(event.data));
    audio.onended = () => setStatus('idle');
    audio.play();
  }
};
```

Also: the frontend needs to send `END` as text after each utterance. Use VAD-on-client or a manual stop button. Simplest: detect 1s of silence and emit `END`. For v1, add a stop button:

```js
function stopUtterance() {
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send('END');
  }
}
```

**Issue 5 (Task 19 — VoiceChat): token in query.**

Frontend sends `?token=${token}`. P5 fix above adds matching `token: str = Query(...)` reader. With both fixes applied this works.

**Issue 6 (Task 7 — AIChat): thinking state dropped too early.**

```jsx
setMessages(m => [...m, { id: aiMsgId, sender: 'ai', text: '', ts: Date.now() }]);
setThinking(false); // hide "thinking" indicator once streaming starts
```

But the stream hasn't started yet — `setThinking(false)` fires before first token. UX: spinner disappears, then empty AI bubble shows for ~500ms before tokens flow.

**Fix:**
```jsx
let firstChunk = true;
try {
  for await (const token of streamSSE('/chat/stream', body)) {
    if (firstChunk) {
      setMessages(m => [...m, { id: aiMsgId, sender: 'ai', text: token, ts: Date.now() }]);
      setThinking(false);
      firstChunk = false;
    } else {
      streamed = true;
      setMessages(m =>
        m.map(msg => msg.id === aiMsgId ? { ...msg, text: msg.text + token } : msg)
      );
    }
  }
} catch (e) {
  // ... (handle fallback as before)
}
if (firstChunk) {
  // No tokens at all — fallback path
  setThinking(false);
  const fallback = synthesizeFallback(t, ctxDoc, state.documents);
  setMessages(m => [...m, { id: aiMsgId, sender: 'ai', text: fallback, ts: Date.now() }]);
}
```

**Issue 7 (Task 1 — client.js): JWT expiry handling missing.**

Plan acknowledges in "Notes for Agentic Workers" but doesn't implement. Add in `client.js` `request()`:

```js
if (!res.ok) {
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }
  const err = await res.json().catch(() => ({ detail: res.statusText }));
  throw new Error(err.detail || `HTTP ${res.status}`);
}
```

**Issue 8 (Task 8 — Quiz generate): null docId.**

```js
const result = await quizzesApi.generate(config.docId || null, config.count, config.difficulty);
```

`api/index.js` has `quizzes.generate(docId, count, difficulty)` → `api.post('/quizzes/generate', { document_id: docId, count, difficulty })`. With `docId=null`, body `document_id` is null. P2's backend handles `if req.document_id:` — null → empty content branch. OK.

But if user picks "General knowledge" (empty string value `""` in select), `config.docId = ""`, then `"" || null = null`. Coerces correctly.

---

## Summary

| Plan | Issues fixed |
|---|---|
| All | Windows PowerShell shell commands |
| P1 | Migration verification (`\dt`) |
| P2 | Chunker overlap bug (CRITICAL); dead code; namespace; private API; raw file storage |
| P3 | SQLAlchemy 2.0 `_asdict()` → `_mapping`; pgvector cast; `_empty_doc()` dataclass |
| P4 | **CRITICAL: skip broken Task 3 Step 1**; use Step 2 only |
| P5 | FastRTC `ReplyOnPause` API; WebSocket auth; VibeVoice `/v1/models` health; Dockerfile |
| P6 | Status endpoint + `processing_status` field naming; history shape; voice WS protocol; thinking-state UX; 401 auto-logout |

Apply these as you execute each plan task. Original plans are still authoritative for structure, file paths, schemas, and ordering — only the code patches above override.
