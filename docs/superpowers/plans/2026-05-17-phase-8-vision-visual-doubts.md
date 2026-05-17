# Phase 8 — Vision (Visual Doubts) via Docling OCR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Visual Doubts" screen: user uploads a photo of a math/physics/whatever problem (handwritten or printed). Backend runs Docling's OCR over the image, then passes the extracted text to the LLM router with a step-by-step solver prompt, returns `problem`, `steps`, `result`.

**Architecture:** New endpoint `POST /api/v1/vision/solve` (multipart image). Pipeline runs synchronously (no ARQ — sub-10s typical) but with a 60s timeout. Same Docling instance from Phase 2 used. Image bytes stored under `UPLOAD_DIR/<user_id>/visual/<id>.<ext>` for audit; row inserted into new `vision_doubts` table.

**Tech Stack:** Docling (reused from P2), LLM router (P1). Same Nomic vision embedder (P3) optionally indexes images for later search.

**Depends on:** P1, P2. **Independent of:** P7. **Blocks:** Frontend wiring in P10.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/app/models/orm.py` | modify | New `VisionDoubt` model |
| `backend/alembic/versions/0005_vision_doubts.py` | create | New table |
| `backend/app/schemas/schemas.py` | modify | `VisionSolveResponse`, `VisionStep`, `VisionDoubtOut` |
| `backend/app/services/vision_solver.py` | create | Docling OCR → LLM solve |
| `backend/app/services/ai_tasks.py` | modify | Add `solve_visual_doubt(ocr_text) -> VisionSolveResponse` |
| `backend/app/routers/vision.py` | create | Upload + return solution |
| `backend/main.py` | modify | Mount router |
| `backend/app/models/orm.py` | modify | Add relationship from User |
| `backend/tests/test_vision_solver.py` | create | Stubbed Docling+LLM produce expected JSON |

---

## Task 1: ORM + migration + schemas

**Files:**
- Modify: `backend/app/models/orm.py`
- Create: `backend/alembic/versions/0005_vision_doubts.py`
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: ORM**

```python
class VisionDoubt(Base):
    __tablename__ = "vision_doubts"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    image_path = Column(String(1000))
    ocr_text = Column(Text)
    problem = Column(Text)
    steps = Column(JSON, default=list)   # [{order, text}]
    result = Column(Text)
    status = Column(String(20), default="ready", index=True)
    error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())

    owner = relationship("User")
```

(Note: we won't add a back-populates relationship on `User` to avoid migration risk; one-way is fine.)

- [ ] **Step 2: Migration**

`backend/alembic/versions/0005_vision_doubts.py`:

```python
"""vision_doubts table"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "vision_doubts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("image_path", sa.String(1000)),
        sa.Column("ocr_text", sa.Text()),
        sa.Column("problem", sa.Text()),
        sa.Column("steps", sa.JSON(), server_default="[]"),
        sa.Column("result", sa.Text()),
        sa.Column("status", sa.String(20), server_default="ready"),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_vision_doubts_user", "vision_doubts", ["user_id"])


def downgrade():
    op.drop_index("ix_vision_doubts_user", table_name="vision_doubts")
    op.drop_table("vision_doubts")
```

Apply + down + up against throwaway PG.

- [ ] **Step 3: Schemas**

```python
class VisionStep(BaseModel):
    order: int
    text: str


class VisionDoubtOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    problem: Optional[str] = None
    steps: List[VisionStep] = []
    result: Optional[str] = None
    status: str = "ready"
    error: Optional[str] = None
    ocr_text: Optional[str] = None


class VisionSolveResponse(BaseModel):
    problem: str
    steps: List[VisionStep]
    result: str
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/orm.py backend/alembic/versions/0005_vision_doubts.py backend/app/schemas/schemas.py
git commit -m "feat(vision): vision_doubts table + Pydantic outputs"
```

---

## Task 2: OCR + LLM solver

**Files:**
- Create: `backend/app/services/vision_solver.py`
- Modify: `backend/app/services/ai_tasks.py`
- Create: `backend/tests/test_vision_solver.py`

- [ ] **Step 1: Add `ai_tasks.solve_visual_doubt`**

In `app/services/ai_tasks.py`:

```python
SOLVER_SYSTEM = (
    "You are DocMind, a step-by-step problem solver for students. "
    "Given OCR'd text of a problem (may be math, physics, chemistry, biology, or a written prompt), "
    "reconstruct the cleanest plain statement of the problem, lay out solution steps numbered from 1, "
    "and give a final result. Stay concise."
)


async def solve_visual_doubt(ocr_text: str) -> "VisionSolveResponse":
    from app.schemas.schemas import VisionSolveResponse
    user = (
        "Solve the problem below. The text was OCR'd from an image — fix obvious recognition errors "
        "before solving. Return JSON: problem (one short paragraph), steps (array of {order, text}), result (string).\n\n"
        f"---\n{ocr_text.strip() or '(no text recognised)'}\n---"
    )
    return await _structured_with_retry(
        messages=[{"role": "user", "content": user}],
        schema=VisionSolveResponse,
        system_prompt=SOLVER_SYSTEM,
    )
```

- [ ] **Step 2: Vision solver service**

`backend/app/services/vision_solver.py`:

```python
"""OCR an image via Docling, then ask the LLM to produce solution steps."""
import os
import logging
from pathlib import Path

from app.workers.docling_loader import get_converter
from app.services.ai_tasks import solve_visual_doubt
from app.schemas.schemas import VisionSolveResponse

logger = logging.getLogger(__name__)


def ocr_image(path: str) -> str:
    """Docling supports image inputs and runs OCR through the configured backend."""
    converter = get_converter()
    result = converter.convert(path)
    return result.document.export_to_markdown()


async def solve(image_path: str) -> tuple[str, VisionSolveResponse]:
    """Return (ocr_text, solution)."""
    if not os.path.exists(image_path):
        raise FileNotFoundError(image_path)
    text = ocr_image(image_path)
    sol = await solve_visual_doubt(text)
    return text, sol
```

- [ ] **Step 3: Tests**

`backend/tests/test_vision_solver.py`:

```python
import pytest


@pytest.mark.asyncio
async def test_solve_calls_ocr_then_llm(monkeypatch, tmp_path):
    from app.services import vision_solver
    from app.schemas.schemas import VisionSolveResponse, VisionStep

    img = tmp_path / "p.png"
    img.write_bytes(b"\x89PNG\r\n\x1a\nfake")
    monkeypatch.setattr(vision_solver, "ocr_image", lambda p: "3x + 7 = 22")

    async def fake_solve(text):
        assert "3x" in text
        return VisionSolveResponse(
            problem="Solve for x: 3x + 7 = 22",
            steps=[VisionStep(order=1, text="3x = 15"), VisionStep(order=2, text="x = 5")],
            result="x = 5",
        )

    monkeypatch.setattr(vision_solver, "solve_visual_doubt", fake_solve)
    text, sol = await vision_solver.solve(str(img))
    assert text == "3x + 7 = 22"
    assert sol.result == "x = 5"
    assert len(sol.steps) == 2
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/ai_tasks.py backend/app/services/vision_solver.py backend/tests/test_vision_solver.py
git commit -m "feat(vision): Docling OCR + LLM solver returning steps"
```

### Edge cases (Task 2)

- **Docling OCR low-confidence**: returns garbled text; the LLM is prompted to fix OCR errors before solving. Good enough for printed math; handwritten variable.
- **No text recognised**: OCR returns `""`; we pass `"(no text recognised)"` to the LLM, which replies with "I cannot read the image". Acceptable.
- **Non-English text**: Docling EasyOCR is configured for `en` in P2. For multi-language, env-toggle via `OCR_LANGS=en,fr` and pass into `EasyOcrOptions`. Out of v1 scope.
- **Handwritten math accuracy**: poor for cursive. v1 acceptable; a separate Mathpix/Claude-vision swap is a future option.

---

## Task 3: Router

**Files:**
- Create: `backend/app/routers/vision.py`
- Modify: `backend/main.py`
- Create: `backend/tests/test_vision_router.py`

- [ ] **Step 1: Router**

```python
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.core.files import is_allowed, get_ext
from app.core.storage import user_upload_dir
from app.models.orm import User, VisionDoubt
from app.schemas.schemas import VisionDoubtOut, VisionStep
from app.services.vision_solver import solve

router = APIRouter()
logger = logging.getLogger(__name__)
ALLOWED_IMAGE = {"png", "jpg", "jpeg", "heic"}


@router.post("/solve", response_model=VisionDoubtOut)
async def solve_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not file.filename or not is_allowed(file.filename) or get_ext(file.filename) not in ALLOWED_IMAGE:
        raise HTTPException(status_code=400, detail="image type not allowed; use png/jpg/jpeg/heic")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="image too large (>20 MB)")

    # Insert pending row
    row = VisionDoubt(user_id=current_user.id, status="running")
    db.add(row); db.commit(); db.refresh(row)

    # Save image
    upload_root = user_upload_dir(current_user.id)
    visual_dir = os.path.join(upload_root, "visual")
    os.makedirs(visual_dir, exist_ok=True)
    image_path = os.path.join(visual_dir, f"{row.id}.{get_ext(file.filename)}")
    with open(image_path, "wb") as f:
        f.write(content)
    row.image_path = image_path
    db.commit()

    try:
        ocr, sol = await solve(image_path)
        row.ocr_text = ocr
        row.problem = sol.problem
        row.steps = [s.model_dump() for s in sol.steps]
        row.result = sol.result
        row.status = "ready"
        row.error = None
        db.commit(); db.refresh(row)
    except Exception as e:
        logger.exception("vision solve failed")
        row.status = "failed"
        row.error = str(e)[:2000]
        db.commit(); db.refresh(row)
        raise HTTPException(status_code=500, detail=str(e))

    return row


@router.get("/{doubt_id}", response_model=VisionDoubtOut)
def get_doubt(doubt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.query(VisionDoubt).filter(VisionDoubt.id == doubt_id, VisionDoubt.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return row


@router.get("", response_model=list[VisionDoubtOut])
def list_doubts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(VisionDoubt).filter(VisionDoubt.user_id == current_user.id).order_by(VisionDoubt.id.desc()).all()


@router.get("/{doubt_id}/image")
def get_image(doubt_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    row = db.query(VisionDoubt).filter(VisionDoubt.id == doubt_id, VisionDoubt.user_id == current_user.id).first()
    if not row or not row.image_path or not os.path.exists(row.image_path):
        raise HTTPException(status_code=404, detail="image not found")
    return FileResponse(row.image_path)
```

- [ ] **Step 2: Mount**

In `backend/main.py`:

```python
from app.routers import vision
app.include_router(vision.router, prefix="/api/v1/vision", tags=["vision"])
```

- [ ] **Step 3: Tests**

```python
import io
import pytest


def _auth(client, email="v@v.com"):
    client.post("/api/v1/auth/signup", json={"name":"v","email":email,"password":"pw"})
    r = client.post("/api/v1/auth/login", json={"email":email,"password":"pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_solve_image_success(client, monkeypatch, tmp_path):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    from importlib import reload
    from app.core import storage; reload(storage)
    from app.routers import vision as vrouter; reload(vrouter)

    from app.schemas.schemas import VisionSolveResponse, VisionStep
    from app.services import vision_solver

    async def fake_solve(path):
        return "3x+7=22", VisionSolveResponse(
            problem="solve", steps=[VisionStep(order=1, text="x=5")], result="x=5"
        )

    monkeypatch.setattr(vision_solver, "solve", fake_solve)
    monkeypatch.setattr(vrouter, "solve", fake_solve)

    h = _auth(client)
    r = client.post(
        "/api/v1/vision/solve",
        files={"file": ("p.png", io.BytesIO(b"\x89PNG"), "image/png")},
        headers=h,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["result"] == "x=5"
    assert body["status"] == "ready"


def test_solve_rejects_bad_ext(client):
    h = _auth(client, "x@x.com")
    r = client.post(
        "/api/v1/vision/solve",
        files={"file": ("doc.pdf", io.BytesIO(b"%PDF"), "application/pdf")},
        headers=h,
    )
    assert r.status_code == 400


def test_solve_failure_marks_row(client, monkeypatch, tmp_path):
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path))
    from importlib import reload
    from app.core import storage; reload(storage)
    from app.routers import vision as vrouter; reload(vrouter)

    async def boom(path):
        raise RuntimeError("ocr failed")
    monkeypatch.setattr(vrouter, "solve", boom)

    h = _auth(client, "f@f.com")
    r = client.post(
        "/api/v1/vision/solve",
        files={"file": ("p.png", io.BytesIO(b"\x89PNG"), "image/png")},
        headers=h,
    )
    assert r.status_code == 500
    # Row exists with status=failed
    listed = client.get("/api/v1/vision", headers=h).json()
    assert len(listed) == 1
    assert listed[0]["status"] == "failed"
    assert "ocr failed" in (listed[0]["error"] or "")
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/routers/vision.py backend/main.py backend/tests/test_vision_router.py
git commit -m "feat(vision): /vision/solve endpoint, list, get image"
```

### Edge cases (Task 3)

- **Synchronous handler with 60s timeout** — Docling can take that long on a complex image. Add `uvicorn` timeout via `--timeout-keep-alive=120` or, better, async ARQ. For v1, accept synchronous since the UI loads "Reading the image…" spinner.
- **HEIC support** — depends on Pillow + `pillow-heif`. v1 accepts the extension but Docling may fail; allowed in `ALLOWED_IMAGE` for future. Test asserts only png path.
- **Image size > 20MB**: 400.
- **Disk full while saving**: 500; row stuck with no image_path. Acceptable v1.

---

## Phase 8 verification checklist

- [ ] Migration 0005 up/down/up.
- [ ] `pytest -q` green.
- [ ] Upload a printed-math PNG → 200 with steps + result.
- [ ] `GET /api/v1/vision` lists the doubt.
- [ ] `GET /api/v1/vision/{id}/image` returns the original.

## Edge cases summary

1. **Docling first-call slow**: shares the parser singleton with P2.
2. **Handwriting accuracy**: poor; document in tooltip on Visual Doubts screen.
3. **Math typesetting**: LLM steps render as plain text; UI can render LaTeX via MathJax if `$$...$$` markers in `text`.
4. **Cross-tenant safety**: all queries filter `user_id`.
5. **Storage growth**: per-user `visual/` folder accumulates images. Future cron to prune > 30 days.
6. **Privacy**: image stays on disk; URL requires JWT.
