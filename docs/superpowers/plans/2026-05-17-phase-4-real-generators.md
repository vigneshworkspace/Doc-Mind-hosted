# Phase 4 — Real Generators on Parsed Content

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quiz / flashcards / mind-map / audio-recap / quick-revise generators read from real `parsed_md` (Phase 2) and call the LLM router (Phase 1). Generators 400 if the doc isn't ready. Per-doc generator endpoints also accept an optional `page_range` to scope content.

**Architecture:** No new infra. Routers prefer `parsed_md` over `content`; if `parse_status != 'ready'`, return 400 with a hint. Optional `page_range = [from, to]` filters `parsed_pages`. The LLM-output models from Phase 1 are reused.

**Tech Stack:** No new deps.

**Depends on:** P1, P2. **Blocks:** P10 (frontend wires generators end-to-end).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/app/schemas/schemas.py` | modify | Add optional `page_range` to `QuizGenerateRequest`, `FlashcardSetGenerateRequest`, `MindMapGenerateRequest`, `AudioRecapGenerateRequest`, `QuickReviseGenerateRequest` |
| `backend/app/services/generation.py` | create | `resolve_doc_text(doc, page_range)` — single source of truth for text selection + parse-status gate |
| `backend/app/routers/quizzes.py` | modify | Call `resolve_doc_text` |
| `backend/app/routers/flashcards.py` | modify | Same |
| `backend/app/routers/mindmaps.py` | modify | Same |
| `backend/app/routers/audio_recaps.py` | modify | Same |
| `backend/app/routers/quick_revise.py` | modify | Same |
| `backend/tests/test_generation.py` | create | resolve_doc_text behaviour |
| `backend/tests/test_generators_use_parsed.py` | create | router tests confirm parsed_md path |

---

## Task 1: `resolve_doc_text` helper

**Files:**
- Create: `backend/app/services/generation.py`
- Create: `backend/tests/test_generation.py`

- [ ] **Step 1: Write tests**

```python
import pytest
from fastapi import HTTPException


class FakeDoc:
    def __init__(self, **kw):
        self.id = kw.get("id", 1)
        self.parse_status = kw.get("parse_status", "ready")
        self.parsed_md = kw.get("parsed_md", "# T\nbody")
        self.content = kw.get("content", None)
        self.parsed_pages = kw.get("parsed_pages", None)


def test_returns_parsed_md_when_ready():
    from app.services.generation import resolve_doc_text
    doc = FakeDoc(parsed_md="hello world", parse_status="ready")
    assert resolve_doc_text(doc) == "hello world"


def test_falls_back_to_content_when_md_missing():
    from app.services.generation import resolve_doc_text
    doc = FakeDoc(parsed_md=None, content="legacy text", parse_status="ready")
    assert resolve_doc_text(doc) == "legacy text"


def test_raises_400_when_pending():
    from app.services.generation import resolve_doc_text
    doc = FakeDoc(parsed_md=None, content=None, parse_status="pending")
    with pytest.raises(HTTPException) as exc:
        resolve_doc_text(doc)
    assert exc.value.status_code == 400
    assert "pending" in exc.value.detail.lower()


def test_raises_400_when_failed_with_error():
    from app.services.generation import resolve_doc_text
    doc = FakeDoc(parsed_md=None, content=None, parse_status="failed")
    doc.parse_error = "encrypted pdf"
    with pytest.raises(HTTPException) as exc:
        resolve_doc_text(doc)
    assert exc.value.status_code == 400
    assert "encrypted pdf" in exc.value.detail


def test_page_range_filters_to_those_pages():
    from app.services.generation import resolve_doc_text
    pages = [
        {"page": 1, "text": "alpha"},
        {"page": 2, "text": "beta"},
        {"page": 3, "text": "gamma"},
        {"page": 4, "text": "delta"},
    ]
    doc = FakeDoc(parsed_md="full md", parsed_pages=pages, parse_status="ready")
    out = resolve_doc_text(doc, page_range=[2, 3])
    assert "beta" in out and "gamma" in out
    assert "alpha" not in out and "delta" not in out


def test_page_range_out_of_bounds_clamps():
    from app.services.generation import resolve_doc_text
    pages = [{"page": 1, "text": "alpha"}]
    doc = FakeDoc(parsed_md="full", parsed_pages=pages, parse_status="ready")
    out = resolve_doc_text(doc, page_range=[5, 99])
    assert out == ""  # no pages in range


def test_no_text_at_all_raises():
    from app.services.generation import resolve_doc_text
    doc = FakeDoc(parsed_md=None, content=None, parse_status="ready", parsed_pages=None)
    with pytest.raises(HTTPException) as exc:
        resolve_doc_text(doc)
    assert exc.value.status_code == 400
```

- [ ] **Step 2: Implement**

`backend/app/services/generation.py`:

```python
from typing import List, Optional, Sequence
from fastapi import HTTPException


def resolve_doc_text(doc, page_range: Optional[Sequence[int]] = None) -> str:
    """Return the best-available study text for a Document.

    Precedence: page-filtered parsed_pages > full parsed_md > legacy content.
    Raises 400 if the doc isn't ready, or if no text exists.
    """
    if doc.parse_status == "pending" or doc.parse_status == "running":
        raise HTTPException(status_code=400, detail=f"document parse {doc.parse_status}; try again shortly")
    if doc.parse_status == "failed":
        err = getattr(doc, "parse_error", None) or "parse failed"
        raise HTTPException(status_code=400, detail=f"document parse failed: {err}")

    if page_range and getattr(doc, "parsed_pages", None):
        lo, hi = page_range[0], page_range[1] if len(page_range) > 1 else page_range[0]
        if lo > hi:
            lo, hi = hi, lo
        wanted = [p for p in doc.parsed_pages if lo <= int(p.get("page", 0)) <= hi]
        text = "\n\n".join(p.get("text", "") for p in wanted).strip()
        return text  # may be ""; caller treats empty as "no content"

    if getattr(doc, "parsed_md", None):
        return doc.parsed_md
    if getattr(doc, "content", None):
        return doc.content

    raise HTTPException(status_code=400, detail="document has no parsed text")
```

- [ ] **Step 3: Run, expect pass**

```bash
cd backend && pytest tests/test_generation.py -v
```
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/generation.py backend/tests/test_generation.py
git commit -m "feat(gen): resolve_doc_text helper with parse-status gating and page filter"
```

### Edge cases (Task 1)

- **`page_range = [3, 1]`**: silently swapped low/high.
- **`page_range = [10, 20]` but doc has pages 1–5**: returns `""`. Callers can detect and raise their own 400 ("page range out of bounds") if they want — v1 just runs the generator on empty input and the LLM will produce a generic answer. Acceptable.
- **`parsed_pages` is a JSON list of dicts**: SQLAlchemy returns it as Python list. If serialised oddly (e.g. `[]` string), fallback chain still runs.
- **`parse_status` unexpected value**: any value other than `ready/pending/running/failed` is treated as "ready" implicitly (falls through). Defensive but won't crash.

---

## Task 2: Add `page_range` to generate-request schemas

**Files:** `backend/app/schemas/schemas.py`

- [ ] **Step 1: Modify five request models**

Replace these:

```python
class QuizGenerateRequest(BaseModel):
    document_id: Optional[int] = None
    count: int = 5
    difficulty: str = "medium"
    page_range: Optional[List[int]] = None


class FlashcardSetGenerateRequest(BaseModel):
    document_id: int
    count: int = 12
    page_range: Optional[List[int]] = None


class MindMapGenerateRequest(BaseModel):
    document_id: int
    page_range: Optional[List[int]] = None


class AudioRecapGenerateRequest(BaseModel):
    document_id: int
    page_range: Optional[List[int]] = None


class QuickReviseGenerateRequest(BaseModel):
    document_id: int
    page_range: Optional[List[int]] = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/schemas.py
git commit -m "feat(schemas): add optional page_range to generator request models"
```

---

## Task 3: Wire each generator to `resolve_doc_text`

**Files:** modify the five generator routers.

### 3a — `quizzes.py`

- [ ] **Step 1: Replace content-selection block in `generate_quiz` handler**

Old:

```python
content = ""
title = "Practice Quiz"
if req.document_id:
    doc = db.query(Document).filter(...).first()
    if doc:
        content = doc.content or ""
        title = f"Quiz: {doc.name}"
```

New:

```python
from app.services.generation import resolve_doc_text
content = ""
title = "Practice Quiz"
if req.document_id:
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    content = resolve_doc_text(doc, page_range=req.page_range)
    title = f"Quiz: {doc.name}"
```

- [ ] **Step 2: Update tests**

`backend/tests/test_generators_use_parsed.py`:

```python
import pytest
from app.schemas.schemas import QuizGenerationResult, QuizQuestion


def _auth(client, email="q@q.com"):
    client.post("/api/v1/auth/signup", json={"name":"q","email":email,"password":"pw"})
    r = client.post("/api/v1/auth/login", json={"email":email,"password":"pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_quiz_uses_parsed_md(client, db, monkeypatch):
    from app.models.orm import User, Document
    from app.services import ai_tasks

    headers = _auth(client)
    user = db.query(User).filter_by(email="q@q.com").one()
    doc = Document(user_id=user.id, name="t.pdf", parsed_md="MARKDOWN CONTENT",
                   content=None, parse_status="ready")
    db.add(doc); db.commit(); db.refresh(doc)

    seen_content = {}

    async def fake_gen(content, count=5, difficulty="medium"):
        seen_content["content"] = content
        return QuizGenerationResult(questions=[QuizQuestion(
            question_text=f"Q{i}", options=["a","b","c","d"], correct_answer="a", explanation="e"
        ) for i in range(count)])

    monkeypatch.setattr(ai_tasks, "generate_quiz", fake_gen)
    r = client.post("/api/v1/quizzes/generate",
                    json={"document_id": doc.id, "count": 2},
                    headers=headers)
    assert r.status_code == 200, r.text
    assert seen_content["content"] == "MARKDOWN CONTENT"


def test_quiz_rejects_pending_doc(client, db):
    from app.models.orm import User, Document
    headers = _auth(client, "pen@pen.com")
    u = db.query(User).filter_by(email="pen@pen.com").one()
    doc = Document(user_id=u.id, name="t.pdf", parsed_md=None,
                   parse_status="pending", content=None)
    db.add(doc); db.commit(); db.refresh(doc)
    r = client.post("/api/v1/quizzes/generate",
                    json={"document_id": doc.id, "count": 1}, headers=headers)
    assert r.status_code == 400
    assert "pending" in r.json()["detail"].lower()


def test_quiz_with_page_range_filters_text(client, db, monkeypatch):
    from app.models.orm import User, Document
    from app.services import ai_tasks
    headers = _auth(client, "pg@pg.com")
    u = db.query(User).filter_by(email="pg@pg.com").one()
    doc = Document(user_id=u.id, name="t.pdf", parsed_md="full",
                   parsed_pages=[
                       {"page":1,"text":"alpha"},
                       {"page":2,"text":"beta"},
                       {"page":3,"text":"gamma"},
                   ],
                   parse_status="ready")
    db.add(doc); db.commit(); db.refresh(doc)

    seen = {}
    async def fake_gen(content, count=5, difficulty="medium"):
        seen["content"] = content
        return QuizGenerationResult(questions=[QuizQuestion(
            question_text="Q", options=["a","b","c","d"], correct_answer="a", explanation="e"
        )])

    monkeypatch.setattr(ai_tasks, "generate_quiz", fake_gen)
    r = client.post("/api/v1/quizzes/generate",
                    json={"document_id": doc.id, "count":1, "page_range":[2,3]},
                    headers=headers)
    assert r.status_code == 200
    assert "beta" in seen["content"] and "gamma" in seen["content"]
    assert "alpha" not in seen["content"]
```

- [ ] **Step 3: Run, expect pass**

```bash
cd backend && pytest tests/test_generators_use_parsed.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/quizzes.py backend/tests/test_generators_use_parsed.py
git commit -m "feat(quizzes): use parsed_md and gate on parse_status"
```

### 3b-3e: Repeat same recipe for `flashcards`, `mindmaps`, `audio_recaps`, `quick_revise`

Each handler:

1. Take `req.document_id` and `req.page_range`.
2. Fetch doc with user-scope filter.
3. `content = resolve_doc_text(doc, page_range=req.page_range)`.
4. Call corresponding `ai_tasks.generate_*` with `content`.
5. Persist + return.

Add per-router test similar to `test_quiz_uses_parsed_md` (one happy + one pending-rejection per router) and commit per-router.

### 3f — `chat.py` (Chat with doc context)

`POST /api/v1/chat/complete` already takes `document_id`. Change inside the handler:

```python
doc_text = ""
if req.document_id:
    doc = db.query(Document).filter(
        Document.id == req.document_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.parse_status != "ready":
        raise HTTPException(status_code=400, detail=f"document parse {doc.parse_status}")
    doc_text = doc.parsed_md or doc.content or ""
```

This keeps chat off pending docs; the actual streaming RAG variant arrives in P5.

---

## Phase 4 verification checklist

- [ ] `pytest -q` green.
- [ ] All 5 generator endpoints accept `page_range`.
- [ ] All 5 generator endpoints 400 when `parse_status != ready` with helpful detail.
- [ ] `chat/complete` 400 when doc pending.
- [ ] Quiz, flashcards, mindmap, audio-recap, quick-revise all populated by real LLM call against `parsed_md` (verified by integration smoke against `gemini` provider).

## Edge cases summary

1. **Doc has `content` legacy but no `parsed_md`**: served fine (fallback). Old uploads pre-P2 keep working.
2. **`page_range = [1]`**: treated as `[1, 1]` (single page).
3. **`page_range` with single page that's empty**: empty `content` passed to LLM; LLM produces generic output. Document edge for users.
4. **Mindmap on a 50-page parsed PDF**: 24k char cap (from `ai_tasks._truncate`) means later pages are dropped silently. Page_range lets users target specific chapters.
5. **Race against parse**: client uploads, immediately calls `/generate`. Returns 400 `parse_status pending`. Frontend should poll `/status` before allowing Generate buttons.
