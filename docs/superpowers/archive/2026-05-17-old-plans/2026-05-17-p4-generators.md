# P4: Generators Upgrade

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** P1 (boot), P2 (ingestion), P3 (RAG) complete. Documents must have `parsed_md`, `summary`, `section_summaries` populated by the ingestion worker.

**Goal:** Upgrade all 5 generator endpoints (quiz, flashcards, mindmap, audio recap, quick revise) to use the document's parsed markdown and cached summaries instead of raw `doc.content`. Upgrade Audio Recap to NotebookLM-style multi-step critique pipeline (6 LLM calls). All generators bypass RAG retrieval entirely — they read the whole document.

**Architecture:** `generators.py` adds a `get_doc_text()` helper that returns `doc.parsed_md` for documents already processed, or falls back to `doc.content`. Audio Recap moves to a 6-call pipeline (outline → critique → revised outline → script → critique → final script) using ARQ background task. A new `audio_pipeline.py` implements the multi-step chain. Other generators are updated to use `doc.summary + doc.parsed_md` as context.

**Tech Stack:** Pydantic v2, FastAPI, ARQ, existing LLM provider chain

---

## File Map

### Created
| File | Purpose |
|---|---|
| `backend/app/services/audio_pipeline.py` | 6-step NotebookLM-style Audio Recap generation |
| `backend/tests/test_generators.py` | Generator unit tests (mocked provider) |

### Modified
| File | Change |
|---|---|
| `backend/app/services/generators.py` | Add `get_doc_text()`, update all functions to use parsed_md + summary |
| `backend/app/routers/audio_recaps.py` | Route generate to ARQ instead of inline; add poll status |
| `backend/app/models/orm.py` | Add `processing_status` to `AudioRecap` |
| `backend/app/schemas/schemas.py` | Add `processing_status` to `AudioRecapOut` |
| `backend/app/workers/ingest.py` | Expose `generate_audio_recap_task` ARQ task |

---

## Task 1: Add `get_doc_text()` to `generators.py`

**Files:**
- Modify: `backend/app/services/generators.py`

- [ ] **Step 1: Add import and helper at top of file**

After the existing imports, add:

```python
from app.models.orm import Document as _Document
```

After the `_truncate()` function, add:

```python
def get_doc_text(doc: "_Document", max_tokens: int = 30_000) -> str:
    """
    Return the best available text for a document.
    Priority: parsed_md (Docling output) > content (raw upload).
    Truncates to max_tokens * 4 chars (~max_tokens tokens).
    """
    text = doc.parsed_md or doc.content or ""
    limit = max_tokens * 4
    return text[:limit] if len(text) > limit else text


def get_doc_context(doc: "_Document") -> str:
    """
    Return summary + parsed_md for generator context.
    Summary is prepended so model always has doc-level orientation.
    """
    parts = []
    if doc.summary:
        parts.append(f"## Document Summary\n{doc.summary}")
    text = get_doc_text(doc, max_tokens=25_000)
    if text:
        parts.append(f"## Full Document\n{text}")
    return "\n\n".join(parts)
```

- [ ] **Step 2: Update `generate_quiz()` to use `get_doc_context`**

The function signature stays the same (`content: str`) so routers don't change. But routers will pass `get_doc_context(doc)` instead of `doc.content`. No change needed to `generators.py` — the routers pass context in.

Actually, to keep backwards compatibility and avoid changing all routers, change the docstring only and note that callers should pass `get_doc_context(doc)` as content.

- [ ] **Step 3: Verify import**

```bash
cd backend && python -c "from app.services.generators import get_doc_text, get_doc_context; print('OK')"
```

Expected: `OK`

---

## Task 2: Update all generator routers to use `get_doc_context`

**Files:**
- Modify: `backend/app/routers/quizzes.py`
- Modify: `backend/app/routers/flashcards.py`
- Modify: `backend/app/routers/mindmaps.py`
- Modify: `backend/app/routers/quick_revise.py`

Each router currently calls `ai.generate_*(doc.content or "")`. Change to `generators.get_doc_context(doc)`.

### quizzes.py

- [ ] **Step 1: Update generate_quiz endpoint**

Find in `quizzes.py`:
```python
content = doc.content or ""
```

Replace with:
```python
from app.services.generators import get_doc_context
content = get_doc_context(doc) if doc else ""
```

(Add the import at the top of the file alongside `from app.services import generators`.)

### flashcards.py

- [ ] **Step 2: Update generate_flashcard_set endpoint**

Find:
```python
cards = await generators.generate_flashcards(doc.content or "")
```

Replace with:
```python
from app.services.generators import get_doc_context
cards = await generators.generate_flashcards(get_doc_context(doc))
```

### mindmaps.py

- [ ] **Step 3: Update generate_mindmap endpoint**

Find:
```python
root = await generators.generate_mindmap(doc.content or "")
```

Replace with:
```python
from app.services.generators import get_doc_context
root = await generators.generate_mindmap(get_doc_context(doc))
```

### quick_revise.py

- [ ] **Step 4: Update generate_quick_revise endpoint**

Find:
```python
points = await generators.generate_quick_revise(doc.content or "")
```

Replace with:
```python
from app.services.generators import get_doc_context
points = await generators.generate_quick_revise(get_doc_context(doc))
```

---

## Task 3: Write `audio_pipeline.py`

**Files:**
- Create: `backend/app/services/audio_pipeline.py`

> **NOTE:** The original Step 1 contained invalid Python (JS regex). It has been removed. Use Step 2's clean version below — that is the only step for this task.

- [ ] **Step 1 (REMOVED — invalid Python in original; use Step 2 below)**

```python
# (this step intentionally left blank — see Step 2)
```

- [ ] **Step 2 (effective Step 1): Write `audio_pipeline.py`**

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

---

## Task 4: Add `processing_status` to `AudioRecap` model

**Files:**
- Modify: `backend/app/models/orm.py`
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: Add column to `AudioRecap`**

In `orm.py`, find `AudioRecap` class and add:
```python
processing_status = Column(String(20), default="queued")
```

- [ ] **Step 2: Add field to `AudioRecapOut` schema**

In `schemas.py`, find `AudioRecapOut` and add:
```python
processing_status: str = "queued"
```

- [ ] **Step 3: Generate migration**

```bash
cd backend && alembic revision --autogenerate -m "audio_recap_status"
alembic upgrade head
```

---

## Task 5: Add ARQ task for Audio Recap and update router

**Files:**
- Modify: `backend/app/routers/audio_recaps.py`
- Modify: `backend/app/workers/ingest.py`

### Add ARQ task to ingest.py

- [ ] **Step 1: Add task at bottom of `ingest.py`**

```python
async def generate_audio_recap_task(ctx, recap_id: int):
    """ARQ task for multi-step Audio Recap generation."""
    from app.services.audio_pipeline import generate_audio_recap_pipeline
    from app.models.orm import AudioRecap
    db = SessionLocal()
    try:
        recap = db.get(AudioRecap, recap_id)
        if not recap:
            return
        recap.processing_status = "generating"
        db.commit()

        doc = db.get(Document, recap.source_document_id)
        if not doc:
            recap.processing_status = "failed"
            db.commit()
            return

        summary, script = await generate_audio_recap_pipeline(doc)
        recap.summary = summary
        recap.script = script
        recap.processing_status = "ready"
        db.commit()
    except Exception as e:
        logger.exception(f"Audio recap {recap_id} failed: {e}")
        recap = db.get(AudioRecap, recap_id)
        if recap:
            recap.processing_status = "failed"
            db.commit()
    finally:
        db.close()
```

### Add task to WorkerSettings

- [ ] **Step 2: Update `worker.py` to register the new task**

In `backend/app/workers/worker.py`, change:
```python
from app.workers.ingest import ingest_document
```
to:
```python
from app.workers.ingest import ingest_document, generate_audio_recap_task
```

And update:
```python
class WorkerSettings:
    functions = [ingest_document, generate_audio_recap_task]
```

### Update audio_recaps.py router

- [ ] **Step 3: Replace `audio_recaps.py` contents**

```python
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, AudioRecap, Document
from app.schemas.schemas import AudioRecapGenerateRequest, AudioRecapOut

router = APIRouter()


@router.get("", response_model=List[AudioRecapOut])
def list_audio_recaps(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(AudioRecap).filter(AudioRecap.user_id == current_user.id).all()


@router.get("/{recap_id}", response_model=AudioRecapOut)
def get_audio_recap(
    recap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="Audio recap not found")
    return recap


@router.post("/generate", response_model=AudioRecapOut)
async def generate_audio_recap(
    req: AudioRecapGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    recap = AudioRecap(
        user_id=current_user.id,
        title=f"Audio Recap: {doc.name}",
        source_document_id=doc.id,
        summary="",
        script=[],
        processing_status="queued",
    )
    db.add(recap)
    db.commit()
    db.refresh(recap)

    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool:
        await arq_pool.enqueue_job("generate_audio_recap_task", recap.id)

    return recap


@router.delete("/{recap_id}")
def delete_audio_recap(
    recap_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    recap = db.query(AudioRecap).filter(
        AudioRecap.id == recap_id, AudioRecap.user_id == current_user.id
    ).first()
    if not recap:
        raise HTTPException(status_code=404, detail="Audio recap not found")
    db.delete(recap)
    db.commit()
    return {"ok": True}
```

---

## Task 6: Write tests

**Files:**
- Create: `backend/tests/test_generators.py`

- [ ] **Step 1: Write tests**

```python
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.generators import get_doc_text, get_doc_context, generate_quiz


def _make_doc(parsed_md="parsed content", content="raw content", summary="A summary."):
    doc = MagicMock()
    doc.parsed_md = parsed_md
    doc.content = content
    doc.summary = summary
    return doc


def test_get_doc_text_prefers_parsed_md():
    doc = _make_doc(parsed_md="parsed content", content="raw content")
    assert get_doc_text(doc) == "parsed content"


def test_get_doc_text_falls_back_to_content():
    doc = _make_doc(parsed_md=None, content="raw content")
    assert get_doc_text(doc) == "raw content"


def test_get_doc_text_truncates():
    doc = _make_doc(parsed_md="x" * 200_000)
    result = get_doc_text(doc, max_tokens=100)
    assert len(result) <= 400 + 10  # 100 tokens * 4 chars + small margin


def test_get_doc_context_includes_summary():
    doc = _make_doc(summary="A great doc.")
    result = get_doc_context(doc)
    assert "A great doc." in result
    assert "Document Summary" in result


@pytest.mark.asyncio
async def test_generate_quiz_returns_list():
    with patch("app.services.generators.get_provider_with_fallback") as mock_factory:
        mock_provider = AsyncMock()
        from app.services.generators import _QuizList, _QuizQuestion
        mock_provider.structured_output = AsyncMock(return_value=_QuizList(questions=[
            _QuizQuestion(question_text="Q1?", options=["A","B","C","D"], correct_answer="A", explanation="E")
        ]))
        mock_factory.return_value = mock_provider
        result = await generate_quiz("some content", count=1)
    assert isinstance(result, list)
    assert result[0]["question_text"] == "Q1?"
```

- [ ] **Step 2: Run tests**

```bash
pytest backend/tests/test_generators.py -v
```

Expected: 5 PASSED

---

## Task 7: Run full test suite

- [ ] **Step 1:**

```bash
cd backend && pytest tests/ -v
```

Expected: all passing.

---

## Task 8: Commit

- [ ] **Step 1: Commit**

```bash
git add \
  backend/app/services/generators.py \
  backend/app/services/audio_pipeline.py \
  backend/app/routers/audio_recaps.py \
  backend/app/routers/quizzes.py \
  backend/app/routers/flashcards.py \
  backend/app/routers/mindmaps.py \
  backend/app/routers/quick_revise.py \
  backend/app/models/orm.py \
  backend/app/schemas/schemas.py \
  backend/app/workers/ingest.py \
  backend/app/workers/worker.py \
  backend/tests/test_generators.py \
  backend/alembic/versions/

git commit -m "feat: generator upgrade — parsed_md context + 6-step Audio Recap pipeline

- All generators use doc.parsed_md + doc.summary via get_doc_context()
- Audio Recap moves to ARQ background task with 6-step critique loop
- AudioRecap.processing_status field added; poll GET /audio-recaps/:id
- get_doc_text() / get_doc_context() helpers in generators.py"
```

---

## Self-Review

**Spec coverage:**
- [x] Generators use `parsed_md` + summary, not raw `content` → `get_doc_context()`
- [x] Generators bypass retrieval → they call `get_doc_context(doc)` directly
- [x] Audio Recap: 6-step LLM chain → `audio_pipeline.py`
- [x] Audio Recap: async ARQ task → `generate_audio_recap_task`
- [x] Audio Recap: `processing_status` polling → `GET /audio-recaps/:id`
- [x] Worker registers new task → `WorkerSettings.functions`

**Type consistency:**
- `generate_audio_recap_pipeline()` returns `tuple[str, list[dict]]` — `generate_audio_recap_task` unpacks as `summary, script`. ✓
- `_Script.script` is `List[_ScriptTurn]`; `t.model_dump()` produces `{speaker, dialogue}` dict. ✓
- `get_doc_context()` returns `str` — all generators accept `str` for content. ✓
