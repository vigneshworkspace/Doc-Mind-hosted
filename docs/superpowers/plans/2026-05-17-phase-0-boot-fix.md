# Phase 0 — Boot Fix & Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the backend booting cleanly under `docker-compose up`, with a committed initial Alembic migration, the schema-import bug fixed, file storage on a real volume, and tests green.

**Architecture:** Surgical bug-fix phase. No new features. Touches `app/schemas/schemas.py`, `alembic/versions/`, `docker-compose.yml`, `backend/Dockerfile`, `backend/.env.example`, and adds `backend/app/core/storage.py` for filesystem helpers.

**Tech Stack:** No new deps. Uses existing FastAPI, SQLAlchemy 2, Alembic, Postgres 16-alpine, bcrypt, jose.

**Depends on:** none. **Blocks:** every other phase.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/app/schemas/schemas.py` | modify | Fix undefined `date` import |
| `backend/alembic/versions/0001_initial.py` | create | Initial migration generating all 12 tables |
| `backend/app/core/storage.py` | create | `get_upload_dir()`, `get_audio_dir()`, `ensure_dir()` helpers |
| `backend/.env.example` | modify | Add `UPLOAD_DIR`, `AUDIO_DIR`, bump JWT to 7 days |
| `backend/.env` | create (local) | Working dev .env (gitignored) |
| `docker-compose.yml` | modify | Add `./data:/data` volume to backend, healthcheck for backend, `redis` service stub (used in later phases) |
| `backend/Dockerfile` | modify | Pre-create `/data/uploads` and `/data/audio` dirs |
| `backend/tests/test_health.py` | create | Boot smoke test |
| `backend/tests/test_storage.py` | create | Unit test for storage helpers |
| `.gitignore` (root) | modify | Add `backend/.env`, `backend/data/`, `data/` |

---

## Task 1: Fix schemas.py date NameError

**Files:**
- Modify: `backend/app/schemas/schemas.py:1`

- [ ] **Step 1: Read current header**

```bash
head -n 5 backend/app/schemas/schemas.py
```
Expected: `from pydantic import BaseModel, ConfigDict` then `from typing import Optional, List, Any` then `import datetime`.

- [ ] **Step 2: Write failing test**

Create `backend/tests/test_schemas_import.py`:

```python
def test_schemas_module_imports():
    """schemas.py must import without NameError at class definition."""
    from app.schemas import schemas as s
    # If we get here, all Pydantic class bodies evaluated successfully.
    assert hasattr(s, "DocumentOut")
    assert hasattr(s, "QuizOut")
    assert hasattr(s, "FlashcardSetOut")


def test_documentout_accepts_date():
    import datetime as _dt
    from app.schemas.schemas import DocumentOut
    d = DocumentOut(id=1, name="x.pdf", upload_date=_dt.date(2026, 5, 17))
    assert d.upload_date.year == 2026
```

- [ ] **Step 3: Run test, expect failure**

```bash
cd backend && pytest tests/test_schemas_import.py -v
```
Expected: `NameError: name 'date' is not defined` during collection.

- [ ] **Step 4: Apply fix**

Replace line 1–3 of `backend/app/schemas/schemas.py`:

```python
from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import date, datetime
```

- [ ] **Step 5: Rerun test, expect pass**

```bash
cd backend && pytest tests/test_schemas_import.py -v
```
Expected: 2 passed.

- [ ] **Step 6: Run full existing suite to ensure no regression**

```bash
cd backend && pytest -q
```
Expected: all green (auth, documents, notes, quizzes).

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/schemas.py backend/tests/test_schemas_import.py
git commit -m "fix(schemas): import date so DocumentOut etc evaluate at class body"
```

---

## Task 2: Storage helpers

**Files:**
- Create: `backend/app/core/storage.py`
- Create: `backend/tests/test_storage.py`

- [ ] **Step 1: Write failing test**

`backend/tests/test_storage.py`:

```python
import os
import tempfile
from pathlib import Path
import pytest


def test_upload_dir_defaults(monkeypatch):
    monkeypatch.delenv("UPLOAD_DIR", raising=False)
    from importlib import reload
    from app.core import storage
    reload(storage)
    p = storage.get_upload_dir()
    assert p.endswith("uploads")
    assert Path(p).exists()


def test_upload_dir_env_override(monkeypatch, tmp_path):
    target = tmp_path / "uploads-override"
    monkeypatch.setenv("UPLOAD_DIR", str(target))
    from importlib import reload
    from app.core import storage
    reload(storage)
    p = storage.get_upload_dir()
    assert Path(p) == target
    assert target.exists()


def test_audio_dir_env_override(monkeypatch, tmp_path):
    target = tmp_path / "audio-override"
    monkeypatch.setenv("AUDIO_DIR", str(target))
    from importlib import reload
    from app.core import storage
    reload(storage)
    p = storage.get_audio_dir()
    assert Path(p) == target


def test_ensure_dir_creates_nested(tmp_path):
    from app.core.storage import ensure_dir
    nested = tmp_path / "a" / "b" / "c"
    out = ensure_dir(str(nested))
    assert Path(out).is_dir()


def test_user_subdir_helper(tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    from importlib import reload
    from app.core import storage
    reload(storage)
    p = storage.user_upload_dir(user_id=42)
    assert Path(p).name == "42"
    assert Path(p).parent == tmp_path
    assert Path(p).exists()
```

- [ ] **Step 2: Run test, expect ImportError**

```bash
cd backend && pytest tests/test_storage.py -v
```
Expected: `ImportError: cannot import name 'storage' from 'app.core'`.

- [ ] **Step 3: Implement storage helpers**

`backend/app/core/storage.py`:

```python
import os
from pathlib import Path


def _resolve(env_name: str, default_subdir: str) -> str:
    override = os.getenv(env_name, "").strip()
    if override:
        path = Path(override).expanduser().resolve()
    else:
        base = Path(__file__).resolve().parents[2]  # backend/
        path = base / default_subdir
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def get_upload_dir() -> str:
    return _resolve("UPLOAD_DIR", "uploads")


def get_audio_dir() -> str:
    return _resolve("AUDIO_DIR", "audio")


def get_models_dir() -> str:
    return _resolve("MODELS_DIR", "models")


def ensure_dir(path: str) -> str:
    Path(path).mkdir(parents=True, exist_ok=True)
    return path


def user_upload_dir(user_id: int) -> str:
    return ensure_dir(os.path.join(get_upload_dir(), str(user_id)))


def user_audio_dir(user_id: int) -> str:
    return ensure_dir(os.path.join(get_audio_dir(), str(user_id)))
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && pytest tests/test_storage.py -v
```
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/storage.py backend/tests/test_storage.py
git commit -m "feat(storage): add upload/audio/models dir helpers with env overrides"
```

---

## Task 3: Initial Alembic migration

**Files:**
- Create: `backend/alembic/versions/0001_initial.py`

- [ ] **Step 1: Verify alembic config and env wire to Base.metadata**

```bash
grep -n "target_metadata" backend/alembic/env.py
```
Expected: `target_metadata = Base.metadata` plus `import app.models.orm` for side-effect registration. Already present.

- [ ] **Step 2: Start a throwaway Postgres for autogenerate**

```bash
docker run -d --name dm-pg-tmp -e POSTGRES_DB=docmind -e POSTGRES_USER=docmind -e POSTGRES_PASSWORD=docmind -p 55432:5432 postgres:16-alpine
```

Wait for ready:

```bash
docker exec dm-pg-tmp pg_isready -U docmind
```

- [ ] **Step 3: Generate migration**

```bash
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic revision --autogenerate -m "initial" --rev-id 0001
```
Expected: writes `backend/alembic/versions/0001_initial.py`. Inspect it — should contain all 12 tables: `users, documents, quizzes, flashcard_sets, mind_maps, audio_recaps, quick_revise_sessions, notes, study_groups, user_settings, activity_logs, chat_history`.

- [ ] **Step 4: Apply and rollback to verify**

```bash
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic downgrade base
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
```
Expected: each command exits 0.

- [ ] **Step 5: Stop throwaway**

```bash
docker rm -f dm-pg-tmp
```

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/0001_initial.py
git commit -m "feat(alembic): initial migration for 12 tables"
```

### Edge cases (Task 3)

- **Generated migration includes server defaults**: `func.current_date()` and `func.now()` should render as PG `CURRENT_DATE` / `now()`. If autogen drops these, hand-edit the migration to include `server_default=sa.text("CURRENT_DATE")` and `server_default=sa.text("now()")`.
- **JSON column nullability**: SQLAlchemy `Column(JSON, default=list)` may autogen as `nullable=True` with no server default. That's fine — Python-side default handles it on `INSERT`. Do not add `server_default='[]'::jsonb` since columns are `JSON` not `JSONB`. (Convert to JSONB later if perf matters.)
- **Unique on `users.email`**: must be in the migration. Verify the autogenerated `CREATE INDEX` / `UNIQUE` clause is present.
- **`user_settings.user_id` UNIQUE**: SQLAlchemy `Column(..., unique=True)` must produce a unique constraint. If missing, add manually.

---

## Task 4: Boot smoke test against TestClient

**Files:**
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write test**

```python
def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_openapi_route_count(client):
    r = client.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json()["paths"]
    # Sanity floor — auth(4) + documents(4) + quizzes(4) + flashcards(4) + chat(2)
    #               + mindmaps(4) + audio-recaps(4) + quick-revise(4) + notes(5)
    #               + groups(6) + history(2) + settings(2) + health(1) = 46
    assert len(paths) >= 40, f"too few routes: {len(paths)}"
```

- [ ] **Step 2: Run, expect pass (asserting current scaffold mounts)**

```bash
cd backend && pytest tests/test_health.py -v
```
Expected: 2 passed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_health.py
git commit -m "test(boot): health endpoint + minimum-route-count smoke"
```

---

## Task 5: Lock .env.example + add new vars

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Replace contents**

```
# Database
DATABASE_URL=postgresql://docmind:docmind@db:5432/docmind

# Security
SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# CORS
CORS_ORIGINS=["http://localhost:5173","http://localhost"]

# Filesystem volumes
UPLOAD_DIR=/data/uploads
AUDIO_DIR=/data/audio
MODELS_DIR=/data/models

# LLM router (filled in P1)
LLM_PROVIDER=gemini
LLM_MODEL=gemini-2.5-flash
GEMINI_API_KEYS=
OPENAI_API_KEY=
GROQ_API_KEY=
NVIDIA_API_KEY=
OLLAMA_BASE_URL=http://host.docker.internal:11434
AI_DATA_DIR=/data/ai

# Redis / ARQ (filled in P2)
REDIS_URL=redis://redis:6379/0

# Embeddings (filled in P3)
EMBED_TEXT_MODEL=nomic-ai/nomic-embed-text-v1.5
EMBED_VISION_MODEL=nomic-ai/nomic-embed-vision-v1.5
EMBED_DIM=768

# STT (filled in P7)
WHISPER_MODEL=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE=float16

# TTS (filled in P6)
KOKORO_MODEL_PATH=/data/models/kokoro-v0_19.onnx
KOKORO_VOICES_PATH=/data/models/voices.bin
KOKORO_DEFAULT_VOICE=af_bella

# FastRTC (filled in P7)
FASTRTC_PORT=7860
```

- [ ] **Step 2: Verify settings class still loads (no new required fields without defaults yet)**

```bash
cd backend && python -c "from app.core.config import settings; print(settings.access_token_expire_minutes)"
```
Expected: `10080` (overriding via .env happens at deploy; default in code stays 60).

- [ ] **Step 3: Bump default in `app/core/config.py`**

In `backend/app/core/config.py` change:

```python
access_token_expire_minutes: int = 10080  # 7 days
```

(Old: `60`.)

- [ ] **Step 4: Commit**

```bash
git add backend/.env.example backend/app/core/config.py
git commit -m "feat(env): document all v1 env vars; bump JWT to 7 days"
```

### Edge cases (Task 5)

- **CORS_ORIGINS parse error**: `pydantic-settings` parses JSON-like lists. If user writes `CORS_ORIGINS=http://localhost:5173` (no brackets/quotes), `pydantic` will raise. Document the bracket+quote requirement in the comment above the line.
- **Empty `GEMINI_API_KEYS`**: legal in P0; LLM router only loads on first call. Keep no validation at boot.

---

## Task 6: docker-compose volume + redis stub + healthchecks

**Files:**
- Modify: `docker-compose.yml`
- Modify: `backend/Dockerfile`

- [ ] **Step 1: Replace `docker-compose.yml`**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_DB: docmind
      POSTGRES_USER: docmind
      POSTGRES_PASSWORD: docmind
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U docmind"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgresql://docmind:docmind@db:5432/docmind
      REDIS_URL: redis://redis:6379/0
      UPLOAD_DIR: /data/uploads
      AUDIO_DIR: /data/audio
      MODELS_DIR: /data/models
      AI_DATA_DIR: /data/ai
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - appdata:/data
    command: >
      sh -c "alembic upgrade head && uvicorn main:app --host 0.0.0.0 --port 8000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=3).status==200 else 1)\""]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  pgdata:
  appdata:
```

Note: image swapped to `pgvector/pgvector:pg16` so Phase 3 doesn't need a second rebuild.

- [ ] **Step 2: Modify `backend/Dockerfile`**

Replace contents:

```Dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /data/uploads /data/audio /data/models /data/ai

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: Build and run**

```bash
docker compose build backend
docker compose up -d db redis backend
```

- [ ] **Step 4: Verify health**

```bash
docker compose ps
curl -fsS http://localhost:8000/health
```
Expected: status `healthy` after ~30s, curl returns `{"status":"ok"}`.

- [ ] **Step 5: Verify pgvector ext available**

```bash
docker compose exec db psql -U docmind -d docmind -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname='vector';"
```
Expected: row `vector`.

- [ ] **Step 6: Tear down clean**

```bash
docker compose down
```

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml backend/Dockerfile
git commit -m "feat(infra): pgvector base image, redis service, appdata volume, healthchecks"
```

### Edge cases (Task 6)

- **Existing pgdata volume incompatible** — if the developer had previously brought up the old `postgres:16-alpine` image, the pgdata volume already has data without pgvector. To switch cleanly: `docker compose down -v` once (destroys old data — warn the user). For production migrations, run `ALTER EXTENSION` separately.
- **Windows path issue with `./data:/data`** — we use a named volume `appdata` instead of a bind mount to avoid Windows path translation problems and permission issues. Files survive `down`, are wiped with `down -v`.
- **Healthcheck Python missing tools**: the inline Python avoids needing `curl` in the running container; it works with stock Python image.
- **Backend healthcheck flaps during alembic upgrade**: `start_period: 30s` gives migrations time before health is required.

---

## Task 7: Update .gitignore

**Files:**
- Modify: `.gitignore` (root)

- [ ] **Step 1: Append**

```
# Local secrets and data
backend/.env
backend/uploads/
backend/audio/
backend/models/
backend/data/
data/

# Python
__pycache__/
*.pyc
.pytest_cache/
.venv/
.coverage
```

- [ ] **Step 2: Verify already-tracked files untouched**

```bash
git status
```
Expected: nothing untracked previously committed shows up as deleted.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore(gitignore): exclude env, uploads, audio, models, data"
```

---

## Phase 0 verification checklist

- [ ] `pytest -q` from `backend/` runs and all existing tests pass.
- [ ] `tests/test_schemas_import.py` passes.
- [ ] `tests/test_storage.py` passes (5 tests).
- [ ] `tests/test_health.py` passes.
- [ ] `alembic upgrade head` runs cleanly against a fresh Postgres.
- [ ] `alembic downgrade base` works without error.
- [ ] `docker compose up -d` brings db + redis + backend to healthy.
- [ ] `curl http://localhost:8000/health` returns `{"status":"ok"}`.
- [ ] `psql … "CREATE EXTENSION vector;"` succeeds.

## Edge cases summary

1. **schemas.py fix must NOT shadow `datetime`** — `from datetime import date, datetime` keeps both names; do not write `from datetime import date` only and leave `import datetime` above (creates dual names with subtle bugs).
2. **Alembic autogen + JSON defaults** — verify lists default Python-side, not via SQL default.
3. **pgvector image swap** — first compose-up after this change requires `docker compose down -v` for users with the old volume; document in README.
4. **Volume permissions** — `appdata` volume created as root inside container; tasks that drop privileges in later phases must `chown` or run as root. ARQ worker will run as root in v1.
5. **CORS env parse** — `["a","b"]` JSON form required.
6. **`backend/.env` ordering** — Pydantic loads `.env` then OS env wins. Docker compose passes env explicitly, overriding `.env`. Document so users debugging "why is DATABASE_URL not what I set in .env" don't waste time.
