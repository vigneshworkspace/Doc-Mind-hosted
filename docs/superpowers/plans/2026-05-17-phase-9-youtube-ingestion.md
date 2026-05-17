# Phase 9 — YouTube Ingestion (transcript + summary)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** YouTube screen accepts a URL, backend fetches the transcript using the user's existing `youtube_transcript` service (copied from the Lexi project), summarises via the LLM router (P1), generates chapter markers, persists the result, and exposes endpoints to list/fetch.

**Architecture:** Copy the `youtube_transcript/` module wholesale into `backend/app/`. Re-use its `YouTubeService.get_transcript()` and `list_available_transcripts()`. New `youtube_videos` table holds the result. The router mounts under `/api/v1/youtube` (matching the Lexi prefix). Add a synthesise endpoint that wraps `get_transcript` + LLM summarisation + LLM chapter extraction.

**Tech Stack:** `youtube-transcript-api`, `playwright` (for cookie generator), existing LLM router. **No yt-dlp/whisper transcription** v1 — only captioned videos. Wide enough coverage for most academic content.

**Depends on:** P1. **Independent of:** other phases. **Blocks:** Frontend wiring in P10.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | modify | `youtube-transcript-api>=0.6.1`, `playwright>=1.40.0` |
| `backend/Dockerfile` | modify | Install Playwright deps + chromium |
| `backend/app/youtube_transcript/__init__.py` | create (copy) | Re-exports |
| `backend/app/youtube_transcript/service.py` | create (copy) | `YouTubeService` |
| `backend/app/youtube_transcript/main.py` | create (copy, adapted) | FastAPI router moved into the rest of the app |
| `backend/app/youtube_transcript/cookie_generator.py` | create (copy) | Playwright cookie generator (writes `/data/youtube_cookies.json`) |
| `backend/app/youtube_transcript/requirements.txt` | DELETE in DocMind (already merged into backend/requirements.txt) | |
| `backend/app/models/orm.py` | modify | Add `YouTubeVideo` model |
| `backend/alembic/versions/0006_youtube_videos.py` | create | Migration |
| `backend/app/schemas/schemas.py` | modify | `YouTubeIngestRequest`, `YouTubeChapter`, `YouTubeVideoOut` |
| `backend/app/services/ai_tasks.py` | modify | `summarize_youtube(transcript) -> YouTubeSummary` |
| `backend/app/routers/youtube_app.py` | create | DocMind-side wrapper: ingest, list, get, chapters |
| `backend/main.py` | modify | Mount both copied transcript router AND DocMind wrapper |
| `backend/tests/test_youtube_router.py` | create | mocks service + LLM |

---

## Task 1: Copy the module

**Source:** `C:\Users\vicky\Desktop\samsung-lap-19-4\samsung-lap-19-4\projects\ai-native-learning\lexi-ai-backend\backend\youtube_transcript\`

- [ ] **Step 1: Copy four files**

Copy bytes 1:1 into `backend/app/youtube_transcript/`:
- `__init__.py`
- `service.py`
- `main.py`
- `cookie_generator.py`

- [ ] **Step 2: Adapt imports in the copies**

The copied files use `from youtube_transcript.service import ...`. Change them to `from app.youtube_transcript.service import ...`. In `app/youtube_transcript/__init__.py`:

```python
from app.youtube_transcript.service import YouTubeService, youtube_service
from app.youtube_transcript.main import router

__all__ = ["YouTubeService", "youtube_service", "router"]
```

In `app/youtube_transcript/main.py`, change the import line to:

```python
from app.youtube_transcript.service import youtube_service
```

Also remove the `app = FastAPI(...)` line and the `app.include_router(...)` at the bottom — DocMind only needs the `router` object.

- [ ] **Step 3: Change COOKIE_FILE path**

In `service.py` and `cookie_generator.py`:

```python
COOKIE_FILE = Path(os.getenv("YOUTUBE_COOKIES_PATH", "/data/youtube_cookies.json"))
```

(Wrap with `os.getenv` so docker mounts work and so non-docker dev uses a local path.)

- [ ] **Step 4: Add deps to backend/requirements.txt**

```
youtube-transcript-api>=0.6.1
playwright>=1.40.0
```

- [ ] **Step 5: Install Playwright chromium in backend Dockerfile**

In `backend/Dockerfile`:

```Dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc curl \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# After pip install:
RUN python -m playwright install chromium
```

- [ ] **Step 6: Mount router under DocMind prefix**

In `backend/main.py`:

```python
from app.youtube_transcript import router as ytt_router
app.include_router(ytt_router, prefix="/api/v1")
```

Now `/api/v1/youtube/transcript`, `/api/v1/youtube/list/{id}`, `/api/v1/youtube/info/{id}`, `/api/v1/youtube/health`, `/api/v1/youtube/generate-cookies` are live.

- [ ] **Step 7: Commit**

```bash
git add backend/app/youtube_transcript/ backend/requirements.txt backend/Dockerfile backend/main.py
git commit -m "feat(youtube): copy Lexi yt-transcript module, mount under /api/v1/youtube"
```

### Edge cases (Task 1)

- **Playwright chromium adds ~300MB to image**: acceptable; cookie generation is rare.
- **Cookie file location**: defaults to `/data/youtube_cookies.json`. Volume mount keeps it across restarts. Don't bake into image.
- **IP blocks from cloud providers**: documented in the original service; users hit `/api/v1/youtube/generate-cookies` to refresh cookies via Playwright. Frontend can show a "Refresh cookies" button if a 403 surfaces.

---

## Task 2: ORM + schema + migration

**Files:**
- Modify: `backend/app/models/orm.py`
- Create: `backend/alembic/versions/0006_youtube_videos.py`
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: ORM**

```python
class YouTubeVideo(Base):
    __tablename__ = "youtube_videos"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    video_id = Column(String(20), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    title = Column(String(500))
    channel = Column(String(200))
    duration_sec = Column(Integer)
    language = Column(String(10))
    transcript = Column(Text)
    summary = Column(Text)
    chapters = Column(JSON, default=list)
    status = Column(String(20), default="pending", index=True)
    error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    owner = relationship("User")
```

- [ ] **Step 2: Migration**

```python
"""youtube_videos"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"


def upgrade():
    op.create_table(
        "youtube_videos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("video_id", sa.String(20), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("title", sa.String(500)),
        sa.Column("channel", sa.String(200)),
        sa.Column("duration_sec", sa.Integer()),
        sa.Column("language", sa.String(10)),
        sa.Column("transcript", sa.Text()),
        sa.Column("summary", sa.Text()),
        sa.Column("chapters", sa.JSON(), server_default="[]"),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_youtube_videos_user", "youtube_videos", ["user_id"])
    op.create_index("ix_youtube_videos_video_id", "youtube_videos", ["video_id"])


def downgrade():
    op.drop_index("ix_youtube_videos_video_id", table_name="youtube_videos")
    op.drop_index("ix_youtube_videos_user", table_name="youtube_videos")
    op.drop_table("youtube_videos")
```

- [ ] **Step 3: Schemas**

```python
class YouTubeIngestRequest(BaseModel):
    url: str
    languages: Optional[List[str]] = ["en"]


class YouTubeChapter(BaseModel):
    timestamp: str   # "HH:MM:SS" or "MM:SS"
    title: str


class YouTubeVideoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    video_id: str
    url: str
    title: Optional[str] = None
    channel: Optional[str] = None
    duration_sec: Optional[int] = None
    language: Optional[str] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    chapters: List[YouTubeChapter] = []
    status: str
    error: Optional[str] = None
```

- [ ] **Step 4: LLM task: summarize_youtube**

In `ai_tasks.py`:

```python
class _YouTubeSummary(BaseModel):
    summary: str
    chapters: List["YouTubeChapter"]


YOUTUBE_SYSTEM = (
    "You are DocMind's video study assistant. Given a transcript with rough timestamps, produce "
    "a 4–6 sentence summary and 5–10 chapter markers (timestamp + short title)."
)


async def summarize_youtube(transcript: str) -> "_YouTubeSummary":
    from app.schemas.schemas import YouTubeChapter
    content = _truncate(transcript, cap=40_000)  # YT-specific cap
    user = (
        "Summarise this YouTube transcript and propose chapter markers.\n\n"
        f"---\n{content}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=_YouTubeSummary,
        system_prompt=YOUTUBE_SYSTEM,
    )
```

Note: `_YouTubeSummary` is defined as a forward-ref because `YouTubeChapter` is in `schemas.schemas`. To avoid circulars, instead define `_YouTubeSummary` inside `ai_tasks` referencing the imported `YouTubeChapter`:

```python
from app.schemas.schemas import YouTubeChapter

class _YouTubeSummary(BaseModel):
    summary: str
    chapters: List[YouTubeChapter]
```

- [ ] **Step 5: Migration test + commit**

```bash
docker run -d --name dm-pg-tmp -e POSTGRES_DB=docmind -e POSTGRES_USER=docmind -e POSTGRES_PASSWORD=docmind -p 55432:5432 pgvector/pgvector:pg16
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
docker rm -f dm-pg-tmp
git add backend/app/models/orm.py backend/alembic/versions/0006_youtube_videos.py backend/app/schemas/schemas.py backend/app/services/ai_tasks.py
git commit -m "feat(youtube): ORM + migration + summarize_youtube task"
```

---

## Task 3: DocMind wrapper router

**Files:**
- Create: `backend/app/routers/youtube_app.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_youtube_router.py`

- [ ] **Step 1: Router**

```python
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.orm import User, YouTubeVideo
from app.schemas.schemas import YouTubeIngestRequest, YouTubeVideoOut, YouTubeChapter
from app.youtube_transcript.service import youtube_service
from app.services import ai_tasks

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/ingest", response_model=YouTubeVideoOut)
async def ingest(
    req: YouTubeIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 1) Fetch transcript via Lexi service
    result = await youtube_service.get_transcript(
        video_url=req.url, languages=req.languages or ["en"], format_type="text"
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "transcript fetch failed"))

    video_id = result["video_id"]

    # 2) Get basic info
    info = await youtube_service.get_video_info(req.url)
    transcript = result["transcript"]
    language = result.get("language_code") or req.languages[0] if req.languages else None

    # 3) Insert pending row
    row = YouTubeVideo(
        user_id=current_user.id,
        video_id=video_id, url=info.get("url", req.url),
        title=None, channel=None, duration_sec=None,
        language=language, transcript=transcript, status="running",
    )
    db.add(row); db.commit(); db.refresh(row)

    # 4) Summarise + chapters
    try:
        summary_out = await ai_tasks.summarize_youtube(transcript)
        row.summary = summary_out.summary
        row.chapters = [c.model_dump() for c in summary_out.chapters]
        row.status = "ready"
        row.error = None
    except Exception as e:
        logger.exception("youtube summarise failed")
        row.status = "failed"; row.error = str(e)[:2000]
        db.commit(); db.refresh(row)
        raise HTTPException(status_code=500, detail=str(e))

    db.commit(); db.refresh(row)
    return row


@router.get("", response_model=list[YouTubeVideoOut])
def list_videos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(YouTubeVideo)
        .filter(YouTubeVideo.user_id == current_user.id)
        .order_by(YouTubeVideo.id.desc())
        .all()
    )


@router.get("/{vid_id}", response_model=YouTubeVideoOut)
def get_video(vid_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = db.query(YouTubeVideo).filter(YouTubeVideo.id == vid_id, YouTubeVideo.user_id == current_user.id).first()
    if not v:
        raise HTTPException(status_code=404, detail="not found")
    return v


@router.delete("/{vid_id}")
def delete_video(vid_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = db.query(YouTubeVideo).filter(YouTubeVideo.id == vid_id, YouTubeVideo.user_id == current_user.id).first()
    if not v:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(v); db.commit()
    return {"ok": True}
```

- [ ] **Step 2: Mount under `/api/v1/yt`** (avoid colliding with the `/youtube` prefix the Lexi router uses)

In `backend/main.py`:

```python
from app.routers import youtube_app
app.include_router(youtube_app.router, prefix="/api/v1/yt", tags=["youtube-app"])
```

So Lexi's transcript endpoints live at `/api/v1/youtube/*` and DocMind's ingest/list live at `/api/v1/yt/*`.

- [ ] **Step 3: Tests**

```python
import pytest


def _auth(client, email="y@y.com"):
    client.post("/api/v1/auth/signup", json={"name":"y","email":email,"password":"pw"})
    r = client.post("/api/v1/auth/login", json={"email":email,"password":"pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.mark.asyncio
async def test_ingest_creates_video(client, monkeypatch):
    from app.youtube_transcript import service as yts
    from app.services import ai_tasks
    from app.schemas.schemas import YouTubeChapter

    async def fake_get_transcript(video_url, languages, format_type):
        return {"success": True, "video_id": "abc123", "language_code": "en",
                "transcript": "alpha beta gamma" * 50, "format": "text"}

    async def fake_get_info(url):
        return {"success": True, "video_id": "abc123", "url": url, "embed_url": url}

    monkeypatch.setattr(yts.youtube_service, "get_transcript", fake_get_transcript)
    monkeypatch.setattr(yts.youtube_service, "get_video_info", fake_get_info)

    class _S:
        summary = "It is about Greek letters."
        chapters = [YouTubeChapter(timestamp="00:00", title="Intro"),
                    YouTubeChapter(timestamp="01:30", title="Mid")]

    async def fake_sum(text): return _S()
    monkeypatch.setattr(ai_tasks, "summarize_youtube", fake_sum)

    h = _auth(client)
    r = client.post("/api/v1/yt/ingest", json={"url":"https://youtu.be/abc123","languages":["en"]}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["video_id"] == "abc123"
    assert body["summary"].startswith("It is")
    assert len(body["chapters"]) == 2


def test_ingest_transcript_failure(client, monkeypatch):
    from app.youtube_transcript import service as yts

    async def fail_get(video_url, languages, format_type):
        return {"success": False, "error": "Subtitles disabled", "video_id": "x"}
    monkeypatch.setattr(yts.youtube_service, "get_transcript", fail_get)

    h = _auth(client, "f@f.com")
    r = client.post("/api/v1/yt/ingest", json={"url":"https://youtu.be/x"}, headers=h)
    assert r.status_code == 400
    assert "Subtitles disabled" in r.text
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/youtube_app.py backend/main.py backend/tests/test_youtube_router.py
git commit -m "feat(youtube): /yt/ingest endpoint summarises captioned videos via LLM"
```

### Edge cases (Task 3)

- **No captions on video**: 400 with detail "No transcript found" (passthrough from Lexi service).
- **IP-block error**: surfaced as 400 "YouTube is blocking requests from your IP …"; frontend prompts user to run cookie regeneration.
- **Very long videos (>3h)**: transcript can exceed 40k cap; truncated before summarising.
- **Multiple languages**: client picks `languages=["en","es"]`; first available used.
- **Network timeout**: bubble up to 500.
- **Duplicate ingestion of same `video_id`**: each call creates a new row. Dedup in v2.

---

## Phase 9 verification checklist

- [ ] Lexi module copied & adapted; imports resolve.
- [ ] Migration 0006 up/down/up.
- [ ] `pytest -q` green.
- [ ] `POST /api/v1/yt/ingest` returns summary + chapters for a real captioned video.
- [ ] `POST /api/v1/youtube/generate-cookies` succeeds (Playwright chromium installed).
- [ ] `GET /api/v1/yt` lists user's videos.

## Edge cases summary

1. **No yt-dlp/whisper fallback v1**: captioned videos only. Document in YT screen tooltip.
2. **Cookie volume persistence**: `/data/youtube_cookies.json` survives container restarts via `appdata` volume.
3. **Race between transcript fetch and LLM call**: row inserted as `running` first; on LLM failure, status set to `failed` and 500 returned. The row stays so the user can retry without re-fetching the transcript.
4. **Playwright chromium installed at image build**: long build, smallish runtime. Document.
5. **Per-language transcript quality**: auto-generated transcripts are messier than manual captions; LLM cleans up in summary phase.
