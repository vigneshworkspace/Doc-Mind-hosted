# P1: Boot Fixes & Provider Migration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the backend boot, pass all existing tests, and replace the broken Anthropic-only AI service with Lexi's multi-provider router (Gemini → Groq → NVIDIA → Ollama fallback chain).

**Architecture:** Fix the NameError crash in `schemas.py`, copy Lexi's `shared/ai/` package to `app/services/ai/`, write a new `app/services/generators.py` that exposes the same function signatures as the old `app/services/ai.py` but uses the new async multi-provider router, update all 6 routers to `await` the now-async calls, copy Lexi's `youtube_transcript/` module, and wire it into `main.py`.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic v2, google-genai SDK, httpx, Alembic, pytest

---

## File Map

### Created
| File | Purpose |
|---|---|
| `backend/app/services/ai/__init__.py` | Package — exports `LLMProvider`, `get_llm_provider`, `get_provider_with_fallback` |
| `backend/app/services/ai/provider.py` | ABC `LLMProvider` + `get_llm_provider()` + `get_provider_with_fallback()` |
| `backend/app/services/ai/gemini_provider.py` | Gemini async provider with key rotation |
| `backend/app/services/ai/gemini_key_manager.py` | Multi-key Gemini quota rotation + persistence |
| `backend/app/services/ai/groq_provider.py` | Groq async provider via httpx |
| `backend/app/services/ai/nvidia_nim_provider.py` | NVIDIA NIM async provider via httpx |
| `backend/app/services/ai/ollama_provider.py` | Ollama local async provider via httpx |
| `backend/app/services/ai/openai_provider.py` | OpenAI async provider |
| `backend/app/services/ai/storage.py` | Path helpers for AI data files (key store, override file) |
| `backend/app/services/ai/tracing.py` | Optional LangSmith tracing wrapper |
| `backend/app/services/generators.py` | DocMind generation functions using `get_provider_with_fallback` |
| `backend/app/youtube_transcript/__init__.py` | Package exports for YT service + router |
| `backend/app/youtube_transcript/service.py` | YouTubeService class |
| `backend/app/youtube_transcript/main.py` | FastAPI router at `/api/v1/youtube` |
| `backend/app/youtube_transcript/cookie_generator.py` | Playwright cookie fallback |

### Modified
| File | Change |
|---|---|
| `backend/app/schemas/schemas.py` | Fix `import datetime` → `from datetime import date, datetime` |
| `backend/app/core/config.py` | Add `llm_model`, `groq_api_key`, `nvidia_api_key`, `ollama_base_url`, `gemini_api_keys`, `langsmith_api_key` |
| `backend/requirements.txt` | Remove `anthropic`, add `google-genai`, `groq` (optional), `langsmith` (optional) |
| `backend/.env.example` | Document all new env vars |
| `backend/main.py` | Import + register youtube router at `/api/v1/youtube` |
| `backend/app/routers/quizzes.py` | `from app.services import generators` + `await` calls |
| `backend/app/routers/flashcards.py` | Same |
| `backend/app/routers/chat.py` | Same + streaming path |
| `backend/app/routers/mindmaps.py` | Same |
| `backend/app/routers/audio_recaps.py` | Same |
| `backend/app/routers/quick_revise.py` | Same |

### Deleted
| File | Reason |
|---|---|
| `backend/app/services/ai.py` | Replaced by `app/services/ai/` package + `generators.py` |

---

## Task 1: Fix schemas.py date import

**Files:**
- Modify: `backend/app/schemas/schemas.py:1-3`

The file does `import datetime` then uses bare `date` in type hints — Python resolves this at class-body parse time and raises `NameError: name 'date' is not defined`, crashing uvicorn on startup.

- [ ] **Step 1: Open the file and verify the bug**

```bash
head -5 backend/app/schemas/schemas.py
```

Expected output:
```
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
import datetime
```

- [ ] **Step 2: Fix the import**

Change line 3 from:
```python
import datetime
```
to:
```python
from datetime import date, datetime
```

Full replacement — the first 3 lines of the file should now read:
```python
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import date, datetime
```

- [ ] **Step 3: Verify no bare `datetime.` usage remains** (the old import allowed `datetime.date`; new import makes `date` direct)

```bash
grep -n "datetime\.date\|datetime\.datetime" backend/app/schemas/schemas.py
```

Expected: no output. If you see hits, replace `datetime.date` with `date` and `datetime.datetime` with `datetime`.

- [ ] **Step 4: Run existing tests to confirm schemas load**

```bash
cd backend && python -c "from app.schemas.schemas import DocumentOut, QuizOut, FlashcardSetOut; print('OK')"
```

Expected: `OK`

---

## Task 2: Copy Lexi's AI provider package

**Files:**
- Create: `backend/app/services/ai/` (entire directory)

The source directory is at:
`C:\Users\vicky\Desktop\samsung-lap-19-4\samsung-lap-19-4\projects\ai-native-learning\lexi-ai-backend\backend\shared\ai\`

- [ ] **Step 1: Create the destination directory**

```bash
mkdir -p backend/app/services/ai
```

- [ ] **Step 2: Copy all 10 files from Lexi**

```bash
LEXI="C:/Users/vicky/Desktop/samsung-lap-19-4/samsung-lap-19-4/projects/ai-native-learning/lexi-ai-backend/backend/shared/ai"
DEST="backend/app/services/ai"
for f in __init__.py provider.py gemini_provider.py gemini_key_manager.py groq_provider.py nvidia_nim_provider.py ollama_provider.py openai_provider.py storage.py tracing.py; do
  cp "$LEXI/$f" "$DEST/$f"
done
```

- [ ] **Step 3: Verify all 10 files copied**

```bash
ls backend/app/services/ai/
```

Expected:
```
__init__.py  gemini_key_manager.py  gemini_provider.py  groq_provider.py  
nvidia_nim_provider.py  ollama_provider.py  openai_provider.py  provider.py  
storage.py  tracing.py
```

- [ ] **Step 4: Patch `gemini_provider.py` — fix default model**

The Lexi file defaults `gemini-3-flash-preview`; we lock `gemini-2.5-flash`.

In `backend/app/services/ai/gemini_provider.py`, find line:
```python
self.model_name = os.getenv("LLM_MODEL", "gemini-3-flash-preview")
```
Replace with:
```python
self.model_name = os.getenv("LLM_MODEL", "gemini-2.5-flash")
```

- [ ] **Step 5: Verify the package imports cleanly**

```bash
cd backend && python -c "from app.services.ai import get_provider_with_fallback, LLMProvider; print('OK')"
```

Expected: `OK` (will succeed even without API keys since the import doesn't instantiate providers)

---

## Task 3: Copy Lexi's YouTube Transcript module

**Files:**
- Create: `backend/app/youtube_transcript/` (entire directory)

Source: `C:\Users\vicky\Desktop\samsung-lap-19-4\samsung-lap-19-4\projects\ai-native-learning\lexi-ai-backend\backend\youtube_transcript\`

- [ ] **Step 1: Create destination directory**

```bash
mkdir -p backend/app/youtube_transcript
```

- [ ] **Step 2: Copy 4 files**

```bash
LEXI_YT="C:/Users/vicky/Desktop/samsung-lap-19-4/samsung-lap-19-4/projects/ai-native-learning/lexi-ai-backend/backend/youtube_transcript"
DEST_YT="backend/app/youtube_transcript"
for f in __init__.py service.py main.py cookie_generator.py; do
  cp "$LEXI_YT/$f" "$DEST_YT/$f"
done
```

- [ ] **Step 3: Patch `__init__.py` — fix relative imports**

The Lexi `__init__.py` uses:
```python
from youtube_transcript.service import YouTubeService, youtube_service
from youtube_transcript.main import router
```

Replace with:
```python
from app.youtube_transcript.service import YouTubeService, youtube_service
from app.youtube_transcript.main import router
```

- [ ] **Step 4: Patch `main.py` — fix import and prefix**

Replace the import line:
```python
from youtube_transcript.service import youtube_service
```
with:
```python
from app.youtube_transcript.service import youtube_service
```

Also change the router prefix from `/api/youtube` to match DocMind convention:
```python
router = APIRouter(prefix="/api/v1/youtube", tags=["youtube"])
```
(The `app = FastAPI(...)` line and `app.include_router(router)` at the bottom — delete both, DocMind uses `main.py` to mount routers.)

- [ ] **Step 5: Patch `service.py` — fix cookie path**

The `COOKIE_FILE` in `service.py` points to `/app/youtube_cookies.json` (Docker-only). Make it env-configurable:
```python
COOKIE_FILE = Path(os.getenv("YOUTUBE_COOKIE_FILE", "/app/youtube_cookies.json"))
```

- [ ] **Step 6: Verify import**

```bash
cd backend && python -c "from app.youtube_transcript import router; print('OK')"
```

Expected: `OK`

---

## Task 4: Write `generators.py`

**Files:**
- Create: `backend/app/services/generators.py`
- Delete: `backend/app/services/ai.py`

`generators.py` exposes the same function names as the old `ai.py` but uses `get_provider_with_fallback` and is fully async.

- [ ] **Step 1: Write `backend/app/services/generators.py`**

```python
"""
DocMind AI generation functions.
All functions are async. Routers must await them.
Uses get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"]).
"""
import json
from typing import AsyncIterable

from pydantic import BaseModel
from typing import List, Optional

from app.services.ai import get_provider_with_fallback


# ── Internal structured output schemas ──────────────────────────────────────

class _QuizQuestion(BaseModel):
    question_text: str
    options: List[str]
    correct_answer: str
    explanation: str


class _QuizList(BaseModel):
    questions: List[_QuizQuestion]


class _FlashCard(BaseModel):
    question: str
    answer: str


class _FlashCardList(BaseModel):
    cards: List[_FlashCard]


class _MindMapNode(BaseModel):
    id: str
    text: str
    children: List["_MindMapNode"] = []

_MindMapNode.model_rebuild()


class _ScriptLine(BaseModel):
    speaker: str
    dialogue: str


class _AudioScript(BaseModel):
    summary: str
    script: List[_ScriptLine]


class _RevisePoint(BaseModel):
    key_point: str
    simplified_explanation: str
    detailed_explanation: str


class _ReviseList(BaseModel):
    points: List[_RevisePoint]


# ── Generation helpers ───────────────────────────────────────────────────────

def _provider():
    return get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])


def _truncate(text: str, tokens: int = 4000) -> str:
    """Rough token truncation — 4 chars ≈ 1 token."""
    limit = tokens * 4
    return text[:limit] if len(text) > limit else text


# ── Public API (same signatures as old ai.py, now async) ─────────────────────

async def generate_quiz(content: str, count: int = 5, difficulty: str = "medium") -> list[dict]:
    provider = _provider()
    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": (
                f"Generate exactly {count} {difficulty}-difficulty multiple-choice quiz questions "
                f"from this content. Each question must have exactly 4 options.\n\n"
                f"Content:\n{_truncate(content)}"
            ),
        }],
        schema=_QuizList,
        system_prompt="You are an expert educator. Generate quiz questions as instructed. Return valid JSON only.",
    )
    return [q.model_dump() for q in result.questions]


async def generate_flashcards(content: str) -> list[dict]:
    provider = _provider()
    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": f"Generate flashcards from this content.\n\nContent:\n{_truncate(content)}",
        }],
        schema=_FlashCardList,
        system_prompt="You are an expert educator. Generate concise flashcard pairs. Return valid JSON only.",
    )
    return [c.model_dump() for c in result.cards]


async def chat_complete(messages: list[dict], context: str = "") -> str:
    provider = _provider()
    system = "You are DocMind, a helpful AI study assistant. Be concise and pedagogically precise."
    if context:
        system += f"\n\nDocument context:\n{_truncate(context, tokens=3000)}"
    return await provider.chat_completion(messages=messages, system_prompt=system)


async def stream_chat_complete(messages: list[dict], context: str = "") -> AsyncIterable[str]:
    """Yields token chunks for SSE streaming."""
    provider = _provider()
    system = "You are DocMind, a helpful AI study assistant. Be concise and pedagogically precise."
    if context:
        system += f"\n\nDocument context:\n{_truncate(context, tokens=3000)}"
    async for chunk in provider.stream_completion(messages=messages, system_prompt=system):
        yield chunk


async def generate_mindmap(content: str) -> dict:
    provider = _provider()
    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": (
                "Create a mind map from the text below. Maximum 3 levels deep. "
                "Root node is the document title.\n\n"
                f"TEXT:\n{_truncate(content)}"
            ),
        }],
        schema=_MindMapNode,
        system_prompt="You are a knowledge mapper. Return a valid JSON mind map tree.",
    )
    return result.model_dump()


async def generate_audio_recap(content: str) -> tuple[str, list[dict]]:
    provider = _provider()
    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": (
                "Write a short podcast script between two speakers (Alex and Jamie) "
                "that summarises the key points. Include a brief summary and a multi-turn "
                "conversational script.\n\n"
                f"TEXT:\n{_truncate(content)}"
            ),
        }],
        schema=_AudioScript,
        system_prompt="You are a podcast scriptwriter. Return valid JSON only.",
    )
    return result.summary, [s.model_dump() for s in result.script]


async def generate_quick_revise(content: str) -> list[dict]:
    provider = _provider()
    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": (
                "Extract exactly 5 key learning points from the text. "
                "For each: a key_point headline, a simplified_explanation (2 sentences), "
                "and a detailed_explanation (4-6 sentences).\n\n"
                f"TEXT:\n{_truncate(content)}"
            ),
        }],
        schema=_ReviseList,
        system_prompt="You are a study assistant. Return valid JSON only.",
    )
    return [p.model_dump() for p in result.points]
```

- [ ] **Step 2: Delete the old `ai.py`**

```bash
rm backend/app/services/ai.py
```

- [ ] **Step 3: Verify generators import**

```bash
cd backend && python -c "from app.services.generators import generate_quiz; print('OK')"
```

Expected: `OK`

---

## Task 5: Update `config.py`

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Replace `config.py` contents**

```python
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://docmind:docmind@localhost:5432/docmind"

    # Auth
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days (locked in grill)

    # CORS
    cors_origins: List[str] = ["http://localhost:5173"]

    # LLM providers — copies from Lexi .env convention
    llm_provider: str = "gemini"                         # default provider
    llm_model: str = "gemini-2.5-flash"                  # Gemini model name
    gemini_api_keys: str = ""                            # comma-separated, managed by gemini_key_manager
    gemini_api_key: str = ""                             # single-key fallback
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    nvidia_api_key: str = ""
    nvidia_model: str = "moonshotai/kimi-k2-instruct"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:7b-instruct"
    openai_api_key: str = ""

    # Optional LangSmith tracing
    langsmith_api_key: str = ""
    langchain_tracing_v2: bool = False

    # AI data dir (for Gemini key rotation persistence)
    ai_data_dir: str = ""

    # Embedding
    embed_model: str = "nomic-embed-text-v1.5"

    # YouTube cookie file path (Docker default, override in dev)
    youtube_cookie_file: str = "/app/youtube_cookies.json"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python -c "from app.core.config import settings; print(settings.llm_provider)"
```

Expected: `gemini`

---

## Task 6: Update `requirements.txt`

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Replace contents**

```
fastapi>=0.111.0
uvicorn[standard]>=0.30.0
python-multipart>=0.0.9
pydantic>=2.7.0
pydantic-settings>=2.2.0
python-jose[cryptography]>=3.3.0
bcrypt>=4.0.0
sqlalchemy>=2.0.0
alembic>=1.13.0
psycopg2-binary>=2.9.0
httpx>=0.27.0

# LLM providers (Lexi router)
google-genai>=0.7.0
openai>=1.40.0

# YouTube transcript
youtube-transcript-api>=0.6.0
playwright>=1.45.0

# Optional tracing (install only if LANGSMITH_API_KEY set)
langsmith>=0.1.0

# Testing
pytest>=8.2.0
pytest-asyncio>=0.23.0
anyio>=4.0.0
```

Note: `groq` SDK not needed — `groq_provider.py` uses raw `httpx`. `anthropic` removed.

- [ ] **Step 2: Rebuild venv in WSL (if running locally)**

```bash
cd backend && pip install -r requirements.txt
```

---

## Task 7: Update `.env.example`

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Replace contents**

```bash
# Database
DATABASE_URL=postgresql://docmind:docmind@localhost:5432/docmind

# Auth
SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
ALGORITHM=HS256

# CORS
CORS_ORIGINS=["http://localhost:5173"]

# LLM Provider (gemini | groq | nvidia | ollama | openai)
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash

# Gemini (comma-separated for multi-key rotation)
GEMINI_API_KEYS=your-key-1,your-key-2
# or single key:
GEMINI_API_KEY=your-key-here

# Groq
GROQ_API_KEY=your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile

# NVIDIA NIM
NVIDIA_API_KEY=your-nvidia-key
NVIDIA_MODEL=moonshotai/kimi-k2-instruct

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b-instruct

# OpenAI (optional)
OPENAI_API_KEY=your-openai-key

# Optional LangSmith tracing
LANGSMITH_API_KEY=
LANGCHAIN_TRACING_V2=false

# YouTube cookies (populated by /api/v1/youtube/generate-cookies)
YOUTUBE_COOKIE_FILE=/app/youtube_cookies.json
```

---

## Task 8: Update all 6 routers

**Files:**
- Modify: `backend/app/routers/quizzes.py`
- Modify: `backend/app/routers/flashcards.py`
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/app/routers/mindmaps.py`
- Modify: `backend/app/routers/audio_recaps.py`
- Modify: `backend/app/routers/quick_revise.py`

Each router currently imports `from app.services import ai` and calls sync functions. Change each to `from app.services import generators` and `await` all calls. Also convert endpoint functions to `async def` if not already.

### quizzes.py

- [ ] **Step 1: Update import and generate_quiz endpoint**

Change:
```python
from app.services import ai
```
to:
```python
from app.services import generators
```

In `generate_quiz` endpoint, change `def generate_quiz(` → `async def generate_quiz(` and change:
```python
questions = ai.generate_quiz(content, count=req.count, difficulty=req.difficulty)
```
to:
```python
questions = await generators.generate_quiz(content, count=req.count, difficulty=req.difficulty)
```

### flashcards.py

- [ ] **Step 2: Update import and generate_flashcard_set endpoint**

Change import same as above. In `generate_flashcard_set`, change to `async def` and:
```python
cards = await generators.generate_flashcards(doc.content or "")
```

### chat.py

- [ ] **Step 3: Update chat router to use generators + streaming**

Replace the entire `chat.py` contents:

```python
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory, Document
from app.schemas.schemas import ChatCompleteRequest, ChatCompleteResponse, ChatHistoryOut
from app.services import generators

router = APIRouter()


@router.post("/complete", response_model=ChatCompleteResponse)
async def complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    context = ""
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc and doc.content:
            context = doc.content

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    reply = await generators.chat_complete(messages, context=context)

    history_messages = messages + [{"role": "assistant", "content": reply}]
    chat_record = ChatHistory(
        user_id=current_user.id,
        document_id=req.document_id,
        messages=history_messages,
    )
    db.add(chat_record)
    db.commit()

    return ChatCompleteResponse(content=reply, model="docmind")


@router.post("/stream")
async def stream_complete(
    req: ChatCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """SSE streaming endpoint. Returns text/event-stream."""
    context = ""
    if req.document_id:
        doc = db.query(Document).filter(
            Document.id == req.document_id, Document.user_id == current_user.id
        ).first()
        if doc and doc.content:
            context = doc.content

    messages = [{"role": m.role, "content": m.content} for m in req.messages]

    async def event_stream():
        async for chunk in generators.stream_chat_complete(messages, context=context):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/history", response_model=List[ChatHistoryOut])
async def get_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )
```

### mindmaps.py

- [ ] **Step 4: Update mindmaps router**

Change import. In `generate_mindmap` endpoint, change to `async def` and:
```python
root = await generators.generate_mindmap(doc.content or "")
```

### audio_recaps.py

- [ ] **Step 5: Update audio_recaps router**

Change import. In `generate_audio_recap`, change to `async def` and:
```python
summary, script = await generators.generate_audio_recap(doc.content or "")
```

### quick_revise.py

- [ ] **Step 6: Update quick_revise router**

Change import. In `generate_quick_revise`, change to `async def` and:
```python
points = await generators.generate_quick_revise(doc.content or "")
```

---

## Task 9: Register YouTube router in `main.py`

**Files:**
- Modify: `backend/main.py`

- [ ] **Step 1: Add import and router registration**

Add to imports section:
```python
from app.youtube_transcript import router as youtube_router
```

Add after all existing `app.include_router(...)` lines:
```python
app.include_router(youtube_router, tags=["youtube"])
```

(The router already has `prefix="/api/v1/youtube"` from Task 3.)

---

## Task 10: Run existing tests

**Files:** (no changes — just validation)

- [ ] **Step 1: Set up test environment**

```bash
cd backend
export DATABASE_URL="sqlite:///file::memory:?cache=shared&uri=true"
```

- [ ] **Step 2: Run full test suite**

```bash
pytest tests/ -v
```

Expected output (all 4 files should pass):
```
tests/test_auth.py::test_signup PASSED
tests/test_auth.py::test_login PASSED
tests/test_auth.py::test_login_wrong_password PASSED
tests/test_auth.py::test_me PASSED
tests/test_auth.py::test_duplicate_signup PASSED
tests/test_auth.py::test_unauthenticated_me PASSED
tests/test_documents.py::test_document_upload_and_list PASSED
tests/test_documents.py::test_document_delete PASSED
tests/test_documents.py::test_documents_isolation PASSED
tests/test_notes.py::test_notes_empty_initially PASSED
tests/test_notes.py::test_notes_crud PASSED
tests/test_notes.py::test_notes_isolation PASSED
tests/test_quizzes.py::test_quizzes_empty_initially PASSED
tests/test_quizzes.py::test_quiz_generate PASSED
tests/test_quizzes.py::test_quiz_save PASSED
tests/test_quizzes.py::test_quiz_unauthenticated PASSED
============ 16 passed in X.XXs ============
```

If `test_quiz_generate` fails because `generate_quiz` is now async: check that `conftest.py` uses `pytest-asyncio` correctly. The test calls `client.post("/api/v1/quizzes/generate", ...)` via TestClient which handles async endpoints automatically in FastAPI's TestClient.

- [ ] **Step 3: Verify server starts**

```bash
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8000 &
sleep 2
curl http://localhost:8000/health
kill %1
```

Expected: `{"status":"ok"}`

---

## Task 11: Generate Alembic initial migration

**Files:**
- Create: `backend/alembic/versions/001_initial_schema.py` (auto-generated)
- Modify: `backend/alembic.ini` — set real `sqlalchemy.url`

- [ ] **Step 1: Fix `alembic.ini` — point to real DB URL**

In `backend/alembic.ini`, `alembic/env.py` already overrides the URL from `settings.database_url` — the `alembic.ini` placeholder is never used. Confirm `env.py` line:
```python
config.set_main_option("sqlalchemy.url", settings.database_url)
```
This is already present. Nothing to change.

- [ ] **Step 2: Generate the migration** (requires running Postgres via docker-compose or local)

```bash
cd backend
docker-compose up -d db   # start Postgres
sleep 3
alembic revision --autogenerate -m "initial schema"
```

Expected: `Generating .../alembic/versions/xxxx_initial_schema.py ... done`

- [ ] **Step 3: Review the generated migration**

```bash
cat backend/alembic/versions/*initial_schema*.py | head -60
```

Verify it contains `CREATE TABLE` statements for: `users`, `documents`, `quizzes`, `flashcard_sets`, `mind_maps`, `audio_recaps`, `quick_revise_sessions`, `notes`, `study_groups`, `user_settings`, `activity_logs`, `chat_history`.

- [ ] **Step 4: Apply migration**

```bash
alembic upgrade head
```

Expected: no errors. All tables created.

---

## Task 12: Commit

- [ ] **Step 1: Stage all changes**

```bash
cd backend
git add app/schemas/schemas.py \
        app/services/ai/ \
        app/services/generators.py \
        app/youtube_transcript/ \
        app/core/config.py \
        app/routers/quizzes.py \
        app/routers/flashcards.py \
        app/routers/chat.py \
        app/routers/mindmaps.py \
        app/routers/audio_recaps.py \
        app/routers/quick_revise.py \
        requirements.txt \
        .env.example \
        main.py \
        alembic/versions/
git add -u app/services/  # picks up the deleted ai.py
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: fix boot crash, migrate to multi-provider LLM router

- Fix NameError in schemas.py (date import)
- Copy Lexi shared/ai/ as app/services/ai/ (Gemini/Groq/NVIDIA/Ollama)
- Replace Anthropic-only ai.py with async generators.py
- Wire YouTube transcript router at /api/v1/youtube
- All 6 AI routers now async with provider fallback chain
- Add initial Alembic migration (all 12 tables)"
```

---

## Self-Review

**Spec coverage:**
- [x] schemas.py date NameError → Task 1
- [x] Copy Lexi AI router → Task 2
- [x] Copy Lexi YouTube module → Task 3
- [x] generators.py with same function signatures → Task 4
- [x] config.py new settings → Task 5
- [x] requirements.txt remove anthropic, add new → Task 6
- [x] .env.example updated → Task 7
- [x] All 6 routers async → Task 8
- [x] YouTube router wired → Task 9
- [x] Existing tests pass → Task 10
- [x] Alembic migration generated → Task 11

**Type consistency check:**
- `generators.generate_quiz()` returns `list[dict]` — quizzes router passes this to `Quiz(questions=[...])` which expects JSON-serializable list. ✓
- `generators.generate_audio_recap()` returns `tuple[str, list[dict]]` — audio_recaps router does `summary, script = await generators.generate_audio_recap(...)`. ✓
- `generators.stream_chat_complete()` is `AsyncIterable[str]` — `StreamingResponse` iterates it. ✓
- `_MindMapNode.model_rebuild()` called after self-referential definition. ✓

**Placeholder scan:** No TBDs or TODOs found.
