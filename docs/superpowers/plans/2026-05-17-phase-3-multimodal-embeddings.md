# Phase 3 — Multimodal Embeddings + pgvector

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Docling parses a doc, an ARQ job chunks the Markdown, embeds chunks with Nomic Embed Text v1.5, embeds any image pages with Nomic Embed Vision v1.5 (sharing the same 768-d space), writes vectors to a pgvector table, and exposes a similarity-search endpoint. Image queries (P8) and text queries (P5) hit the same vector store.

**Architecture:** Two embedders share the Nomic v1.5 shared retrieval space. Text → `nomic-ai/nomic-embed-text-v1.5`. Image → `nomic-ai/nomic-embed-vision-v1.5`. Both produce 768-d L2-normalised vectors. pgvector table `document_chunks` stores `(doc_id, user_id, page, kind, text, image_path, embedding)`. Search is cosine via `<=>` operator with HNSW index. Chunking: ~600-token windows, ~80-token overlap; for images, one row per page-image (Docling exports page images optionally; for PDF we use `parsed_pages.text` only in v1, vision row created only when `kind='image'` upload).

**Tech Stack:** pgvector (already in base image after P0), sentence-transformers (loads Nomic via HuggingFace), `tiktoken` for tokenisation, optional `nomic` python package (we use sentence-transformers wrapper for both to keep stack consistent).

**Depends on:** P0, P2. **Independent of:** P1. **Blocks:** P5 (RAG), P8 (vision search).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | modify | `sentence-transformers>=3.0`, `tiktoken>=0.7`, `pgvector>=0.3`, `Pillow>=10` |
| `backend/app/models/orm.py` | modify | Add `DocumentChunk` model with `Vector(768)` column |
| `backend/alembic/versions/0003_pgvector_chunks.py` | create | `CREATE EXTENSION vector`, create table + HNSW index |
| `backend/app/services/embedding.py` | create | `embed_texts(list[str]) -> list[Vector]`, `embed_images(list[bytes]) -> list[Vector]` lazy singletons |
| `backend/app/services/chunking.py` | create | `chunk_markdown(md, page_map) -> list[Chunk]` |
| `backend/app/workers/embed.py` | create | ARQ job: chunk → embed → upsert |
| `backend/app/workers/parse.py` | modify | After successful parse, chain enqueue `embed_document` |
| `backend/worker_main.py` | modify | Register `embed_document` |
| `backend/app/routers/search.py` | create | `POST /search/text`, `POST /search/image` |
| `backend/main.py` | modify | Mount `/api/v1/search` |
| `backend/app/schemas/schemas.py` | modify | `SearchRequest`, `SearchHit`, `SearchResponse` |
| `backend/tests/test_chunking.py` | create | chunk windows + overlap |
| `backend/tests/test_embedding.py` | create | stubbed embedder shape |
| `backend/tests/test_embed_worker.py` | create | end-to-end with stub embedder + sqlite-vec polyfill OR skip on sqlite |
| `backend/tests/test_search.py` | create | search endpoint with seeded chunks (skipped on sqlite) |

---

## Task 1: Deps + pgvector extension + DocumentChunk model

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/models/orm.py`
- Create: `backend/alembic/versions/0003_pgvector_chunks.py`

- [ ] **Step 1: Append deps**

```
sentence-transformers>=3.0.0
tiktoken>=0.7.0
pgvector>=0.3.0
Pillow>=10.0.0
einops>=0.8.0
```

(`einops` is a Nomic Vision dependency through transformers.)

- [ ] **Step 2: Add `DocumentChunk` to ORM**

In `backend/app/models/orm.py` append (after `ChatHistory`):

```python
from sqlalchemy import Index
# pgvector import is optional at import time so SQLite tests still load the module
try:
    from pgvector.sqlalchemy import Vector  # type: ignore
except ImportError:  # SQLite test env without pgvector
    Vector = None  # noqa: N816


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    page = Column(Integer, default=0)
    kind = Column(String(10), nullable=False, default="text")  # "text" | "image"
    text = Column(Text)            # text chunk or image OCR caption
    image_path = Column(String(1000))
    token_count = Column(Integer, default=0)
    # 768-d vector matching Nomic v1.5 shared space
    embedding = Column(Vector(768) if Vector is not None else JSON, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("ix_chunks_doc_user", "document_id", "user_id"),
    )
```

- [ ] **Step 3: Write migration**

`backend/alembic/versions/0003_pgvector_chunks.py`:

```python
"""pgvector + document_chunks table"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("page", sa.Integer(), server_default="0"),
        sa.Column("kind", sa.String(10), nullable=False, server_default="text"),
        sa.Column("text", sa.Text()),
        sa.Column("image_path", sa.String(1000)),
        sa.Column("token_count", sa.Integer(), server_default="0"),
        sa.Column("embedding", Vector(768), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()")),
    )
    op.create_index("ix_document_chunks_doc_user", "document_chunks", ["document_id", "user_id"])
    op.create_index("ix_document_chunks_user", "document_chunks", ["user_id"])

    # HNSW index for cosine distance
    op.execute(
        "CREATE INDEX ix_document_chunks_embed_hnsw "
        "ON document_chunks USING hnsw (embedding vector_cosine_ops) "
        "WITH (m=16, ef_construction=64)"
    )


def downgrade():
    op.drop_index("ix_document_chunks_embed_hnsw", table_name="document_chunks")
    op.drop_index("ix_document_chunks_user", table_name="document_chunks")
    op.drop_index("ix_document_chunks_doc_user", table_name="document_chunks")
    op.drop_table("document_chunks")
```

- [ ] **Step 4: Apply migration in throwaway PG**

```bash
docker run -d --name dm-pg-tmp -e POSTGRES_DB=docmind -e POSTGRES_USER=docmind -e POSTGRES_PASSWORD=docmind -p 55432:5432 pgvector/pgvector:pg16
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic downgrade -1
cd backend && DATABASE_URL=postgresql://docmind:docmind@localhost:55432/docmind alembic upgrade head
docker rm -f dm-pg-tmp
```
Expected: each command exits 0.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/models/orm.py backend/alembic/versions/0003_pgvector_chunks.py
git commit -m "feat(rag): pgvector ext + document_chunks table with HNSW(cosine,768)"
```

### Edge cases (Task 1)

- **SQLite test DB has no `vector` type**: `Vector` import wrapped in try/except; the ORM column falls back to JSON for tests. Vector ops are unavailable on SQLite — search-related tests skip if `db.bind.dialect.name == "sqlite"`.
- **Existing pgvector ext different version**: `CREATE EXTENSION IF NOT EXISTS vector` is idempotent.
- **HNSW build time on huge corpora**: 64k vectors load in ~30s; we use `m=16, ef_construction=64` (defaults). Tune later if recall is low.
- **pgvector default `vector_cosine_ops`**: we use cosine; normalise embeddings inside `embed_texts`/`embed_images` so dot product == cosine.

---

## Task 2: Chunking

**Files:**
- Create: `backend/app/services/chunking.py`
- Create: `backend/tests/test_chunking.py`

- [ ] **Step 1: Write tests**

```python
import pytest


def test_chunk_short_markdown_single_chunk():
    from app.services.chunking import chunk_markdown
    chunks = chunk_markdown("# hello\n\nshort text")
    assert len(chunks) == 1
    assert chunks[0].page == 0
    assert "hello" in chunks[0].text


def test_chunk_long_markdown_multiple_with_overlap():
    from app.services.chunking import chunk_markdown
    md = "para. " * 2000  # ~2000 short paragraphs
    chunks = chunk_markdown(md, target_tokens=200, overlap_tokens=20)
    assert len(chunks) > 5
    # Overlap: last 20 tokens of chunk N appear in chunk N+1's first 20 tokens
    for a, b in zip(chunks, chunks[1:]):
        tail = a.text.split()[-10:]
        head = b.text.split()[:30]
        assert any(t in head for t in tail), f"no overlap between chunk {a.idx} and {b.idx}"


def test_chunk_attaches_page_when_pages_supplied():
    from app.services.chunking import chunk_markdown
    pages = [
        {"page": 1, "text": "alpha beta gamma"},
        {"page": 2, "text": "delta epsilon zeta"},
        {"page": 3, "text": "eta theta iota"},
    ]
    chunks = chunk_markdown(md="ignored", pages=pages, target_tokens=4, overlap_tokens=0)
    # Each page becomes its own chunk; pages preserved
    pages_seen = {c.page for c in chunks}
    assert pages_seen == {1, 2, 3}


def test_chunk_tokens_under_target():
    from app.services.chunking import chunk_markdown, _count_tokens
    md = "lorem ipsum dolor sit amet " * 500
    chunks = chunk_markdown(md, target_tokens=128, overlap_tokens=16)
    for c in chunks:
        assert _count_tokens(c.text) <= 160  # target + slack
```

- [ ] **Step 2: Implement `app/services/chunking.py`**

```python
"""Markdown chunker with token-budget windows and overlap.

Token counting uses tiktoken cl100k_base as a generic approximation —
it doesn't need to match the embedding model's tokenizer exactly; we just
need stable budgets.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

import tiktoken

_ENC = tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_ENC.encode(text or "", disallowed_special=()))


@dataclass
class Chunk:
    idx: int
    text: str
    page: int = 0
    token_count: int = 0


def _split_with_overlap(text: str, target_tokens: int, overlap_tokens: int) -> List[str]:
    """Greedy sliding-window over tokens."""
    if not text.strip():
        return []
    tokens = _ENC.encode(text, disallowed_special=())
    if not tokens:
        return []
    out: List[str] = []
    step = max(1, target_tokens - overlap_tokens)
    i = 0
    while i < len(tokens):
        window = tokens[i : i + target_tokens]
        out.append(_ENC.decode(window))
        if i + target_tokens >= len(tokens):
            break
        i += step
    return out


def chunk_markdown(
    md: Optional[str] = None,
    pages: Optional[List[Dict[str, Any]]] = None,
    target_tokens: int = 600,
    overlap_tokens: int = 80,
) -> List[Chunk]:
    """Chunk a parsed document.

    If `pages` is supplied (Docling per-page text), each page is chunked
    separately and the page number is attached to every chunk. Otherwise the
    full markdown is chunked end-to-end with `page=0`.
    """
    chunks: List[Chunk] = []

    if pages:
        idx = 0
        for p in pages:
            page_no = int(p.get("page", 0))
            for piece in _split_with_overlap(p.get("text", ""), target_tokens, overlap_tokens):
                chunks.append(Chunk(idx=idx, text=piece, page=page_no, token_count=_count_tokens(piece)))
                idx += 1
    else:
        for i, piece in enumerate(_split_with_overlap(md or "", target_tokens, overlap_tokens)):
            chunks.append(Chunk(idx=i, text=piece, page=0, token_count=_count_tokens(piece)))

    return chunks
```

- [ ] **Step 3: Run, expect pass**

```bash
cd backend && pytest tests/test_chunking.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/chunking.py backend/tests/test_chunking.py
git commit -m "feat(rag): markdown chunker with token-budget windows + overlap"
```

### Edge cases (Task 2)

- **Empty markdown**: returns `[]`. Worker skips embedding for empty docs.
- **Single very long line**: tiktoken decodes mid-word inside the window. Acceptable: embeddings are robust to slight prefix/suffix cuts; semantic search still works.
- **Pages with empty text**: skipped (no chunks).
- **`disallowed_special=()`** prevents tiktoken from raising on `<|endoftext|>` strings appearing in source documents.
- **target_tokens too small (<32)**: each chunk loses meaning. Document recommended range 200–1000.

---

## Task 3: Embedding service (lazy singletons)

**Files:**
- Create: `backend/app/services/embedding.py`
- Create: `backend/tests/test_embedding.py`

- [ ] **Step 1: Write tests**

```python
import numpy as np
import pytest


def test_embed_texts_shape_and_norm(monkeypatch):
    """When the model isn't installed in test env, fall back to a deterministic stub."""
    from app.services import embedding

    class StubModel:
        def encode(self, items, normalize_embeddings=True):
            return np.array([[1.0, 0.0] + [0.0] * 766 for _ in items], dtype="float32")

    monkeypatch.setattr(embedding, "_get_text_model", lambda: StubModel())
    vecs = embedding.embed_texts(["a", "b"])
    assert vecs.shape == (2, 768)
    norms = np.linalg.norm(vecs, axis=1)
    np.testing.assert_allclose(norms, [1.0, 1.0], atol=1e-3)


def test_embed_images_shape(monkeypatch):
    from app.services import embedding

    class StubVision:
        def encode(self, images, normalize_embeddings=True):
            return np.array([[0.5] * 768 for _ in images], dtype="float32")

    monkeypatch.setattr(embedding, "_get_vision_model", lambda: StubVision())
    out = embedding.embed_images([b"\x89PNG..."])
    assert out.shape == (1, 768)


def test_search_prefix_added_for_query(monkeypatch):
    from app.services import embedding

    captured = []

    class StubModel:
        def encode(self, items, normalize_embeddings=True):
            captured.extend(items)
            import numpy as _np
            return _np.array([[1.0] + [0.0] * 767 for _ in items], dtype="float32")

    monkeypatch.setattr(embedding, "_get_text_model", lambda: StubModel())
    embedding.embed_query("photosynthesis")
    assert any(s.startswith("search_query:") for s in captured)
    embedding.embed_passages(["The mitochondrion is the powerhouse of the cell."])
    assert any(s.startswith("search_document:") for s in captured)
```

- [ ] **Step 2: Implement `app/services/embedding.py`**

Nomic Embed Text v1.5 uses task prefixes: `search_query:` for queries and `search_document:` for passages. Vision uses no prefix; outputs share the text space.

```python
"""Lazy multimodal embedders.

Text: nomic-ai/nomic-embed-text-v1.5 via sentence-transformers
Vision: nomic-ai/nomic-embed-vision-v1.5 via sentence-transformers
Both 768-d; same retrieval space.
"""
from __future__ import annotations

import io
import os
from typing import List

import numpy as np


_text_model = None
_vision_model = None


def _model_kwargs() -> dict:
    """Allow forcing CPU or specifying cache."""
    kwargs = {}
    if os.getenv("EMBED_DEVICE", "").strip():
        kwargs["device"] = os.environ["EMBED_DEVICE"]
    return kwargs


def _get_text_model():
    global _text_model
    if _text_model is None:
        from sentence_transformers import SentenceTransformer
        name = os.getenv("EMBED_TEXT_MODEL", "nomic-ai/nomic-embed-text-v1.5")
        _text_model = SentenceTransformer(name, trust_remote_code=True, **_model_kwargs())
    return _text_model


def _get_vision_model():
    global _vision_model
    if _vision_model is None:
        from sentence_transformers import SentenceTransformer
        name = os.getenv("EMBED_VISION_MODEL", "nomic-ai/nomic-embed-vision-v1.5")
        _vision_model = SentenceTransformer(name, trust_remote_code=True, **_model_kwargs())
    return _vision_model


def embed_texts(texts: List[str]) -> np.ndarray:
    """Embed without task prefix (used for plain inputs)."""
    if not texts:
        return np.empty((0, 768), dtype="float32")
    model = _get_text_model()
    arr = model.encode(texts, normalize_embeddings=True)
    return np.asarray(arr, dtype="float32")


def embed_passages(texts: List[str]) -> np.ndarray:
    """Embed for storage (documents)."""
    if not texts:
        return np.empty((0, 768), dtype="float32")
    prefixed = [f"search_document: {t}" for t in texts]
    return embed_texts(prefixed)


def embed_query(text: str) -> np.ndarray:
    """Embed a single query for retrieval."""
    prefixed = [f"search_query: {text}"]
    return embed_texts(prefixed)[0]


def embed_images(images: List[bytes]) -> np.ndarray:
    """Embed raw image bytes. Returns (N, 768)."""
    if not images:
        return np.empty((0, 768), dtype="float32")
    from PIL import Image
    pil = [Image.open(io.BytesIO(b)).convert("RGB") for b in images]
    model = _get_vision_model()
    arr = model.encode(pil, normalize_embeddings=True)
    return np.asarray(arr, dtype="float32")
```

- [ ] **Step 3: Run, expect pass**

```bash
cd backend && pytest tests/test_embedding.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/embedding.py backend/tests/test_embedding.py
git commit -m "feat(rag): Nomic v1.5 text + vision embedders in shared 768-d space"
```

### Edge cases (Task 3)

- **First load downloads ~250MB model**: cache to `MODELS_DIR=/data/models` via `HF_HOME=/data/models` env. Add to `.env.example`:
  ```
  HF_HOME=/data/models
  TRANSFORMERS_CACHE=/data/models
  ```
  And to `docker-compose.yml` `worker` and `backend` env blocks.
- **GPU available**: sentence-transformers auto-detects CUDA. Set `EMBED_DEVICE=cuda` to force.
- **`trust_remote_code=True`** required by Nomic; documented in repo. Acceptable risk since it's a pinned org we trust.
- **Vision model loads CLIP-like image-text contrastively**; we only use the image side, but `nomic-embed-vision-v1.5` exposes both modalities — the call `model.encode([PIL.Image])` returns the image embedding.
- **PIL fails on truncated images**: wrap `Image.open` in try/except in `embed_images`; on failure return a zero vector. (v1: re-raise; surfaced to the worker.)

---

## Task 4: Embed worker

**Files:**
- Create: `backend/app/workers/embed.py`
- Modify: `backend/app/workers/parse.py` (chain enqueue)
- Modify: `backend/worker_main.py`
- Create: `backend/tests/test_embed_worker.py`

- [ ] **Step 1: Write test**

```python
import pytest
import numpy as np


@pytest.mark.asyncio
async def test_embed_worker_inserts_chunks(db, monkeypatch):
    if db.bind.dialect.name == "sqlite":
        pytest.skip("pgvector required")

    from app.models.orm import User, Document, DocumentChunk
    from app.services import embedding
    from app.workers import embed as embed_mod

    u = User(name="u", email="u@u.com", password_hash="x")
    db.add(u); db.commit(); db.refresh(u)
    d = Document(
        user_id=u.id, name="t.md",
        parsed_md="alpha beta gamma. " * 100,
        parsed_pages=[{"page": 1, "text": "alpha beta gamma. " * 100}],
        parse_status="ready",
    )
    db.add(d); db.commit(); db.refresh(d)

    monkeypatch.setattr(embedding, "embed_passages", lambda texts: np.ones((len(texts), 768), dtype="float32"))
    monkeypatch.setattr(embed_mod, "SessionLocal", lambda: db)

    out = await embed_mod.embed_document(ctx={}, doc_id=d.id)
    assert out["ok"] is True
    rows = db.query(DocumentChunk).filter_by(document_id=d.id).all()
    assert len(rows) > 0


@pytest.mark.asyncio
async def test_embed_worker_skips_no_md(db, monkeypatch):
    from app.models.orm import User, Document
    from app.workers import embed as embed_mod
    u = User(name="u", email="u2@u.com", password_hash="x")
    db.add(u); db.commit(); db.refresh(u)
    d = Document(user_id=u.id, name="x.pdf", parsed_md=None, parse_status="ready")
    db.add(d); db.commit(); db.refresh(d)

    monkeypatch.setattr(embed_mod, "SessionLocal", lambda: db)
    out = await embed_mod.embed_document(ctx={}, doc_id=d.id)
    assert out["ok"] is False
    assert "no parsed_md" in out["error"]
```

- [ ] **Step 2: Implement `app/workers/embed.py`**

```python
"""ARQ job: chunk + embed a parsed document; upsert rows in document_chunks."""
import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.orm import Document, DocumentChunk
from app.services.chunking import chunk_markdown
from app.services.embedding import embed_passages

logger = logging.getLogger(__name__)


async def embed_document(ctx, doc_id: int) -> dict:
    db: Session = SessionLocal()
    try:
        doc = db.get(Document, doc_id)
        if doc is None:
            return {"ok": False, "error": "doc not found"}
        if not doc.parsed_md:
            return {"ok": False, "doc_id": doc.id, "error": "no parsed_md"}

        # Wipe existing chunks for this doc (re-embed scenario)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
        db.commit()

        chunks = chunk_markdown(md=doc.parsed_md, pages=doc.parsed_pages or None)
        if not chunks:
            return {"ok": True, "doc_id": doc.id, "chunks": 0}

        texts = [c.text for c in chunks]
        vectors = embed_passages(texts)

        rows = []
        for c, v in zip(chunks, vectors):
            rows.append(DocumentChunk(
                document_id=doc.id,
                user_id=doc.user_id,
                page=c.page,
                kind="text",
                text=c.text,
                token_count=c.token_count,
                embedding=v.tolist(),
            ))
        db.bulk_save_objects(rows)
        db.commit()
        logger.info("doc %d embedded %d chunks", doc.id, len(rows))
        return {"ok": True, "doc_id": doc.id, "chunks": len(rows)}
    except Exception as e:
        logger.exception("embed failed for doc %d", doc_id)
        return {"ok": False, "doc_id": doc_id, "error": str(e)}
    finally:
        db.close()
```

- [ ] **Step 3: Modify parse job to chain embedding**

In `backend/app/workers/parse.py`, after `doc.parse_status = "ready"` and before return, add:

```python
        # Chain embed
        try:
            from arq.connections import ArqRedis  # type: ignore
            redis: ArqRedis = ctx.get("redis") if isinstance(ctx, dict) else None
            if redis is not None:
                await redis.enqueue_job("embed_document", doc.id)
        except Exception as e:
            logger.warning("failed to enqueue embed for doc %d: %s", doc.id, e)
```

- [ ] **Step 4: Register in worker_main**

`backend/worker_main.py`:

```python
from app.workers.queue import redis_settings
from app.workers.parse import parse_document
from app.workers.embed import embed_document


class WorkerSettings:
    functions = [parse_document, embed_document]
    redis_settings = redis_settings()
    job_timeout = 600
    max_jobs = 4
    keep_result = 60
```

- [ ] **Step 5: Run tests, expect pass**

```bash
cd backend && pytest tests/test_embed_worker.py -v
```
Expected: 1 pass + 1 skipped (sqlite).

- [ ] **Step 6: Commit**

```bash
git add backend/app/workers/embed.py backend/app/workers/parse.py backend/worker_main.py backend/tests/test_embed_worker.py
git commit -m "feat(rag): embed worker — chunk + Nomic passages → document_chunks; chained from parse"
```

### Edge cases (Task 4)

- **Bulk insert payload large**: `bulk_save_objects` ok for ≤10k rows. For larger, use psycopg2 `executemany` or `COPY`. v1 acceptable.
- **`embedding` column needs `vector` adapter**: pgvector + SQLAlchemy + `embedding=v.tolist()` works because `pgvector.sqlalchemy.Vector` adapts Python lists.
- **Re-embed clears all old chunks**: ensures shape changes (chunk size config drift) don't leave orphans.
- **Worker memory**: a 100-page PDF → ~200 chunks → 200 × 768 × 4 bytes ≈ 600KB. Tiny.
- **Vision worker not chained automatically**: P8 will enqueue `embed_image_doc` when a user uploads a single image for Visual Doubts. Not chained from parse.

---

## Task 5: Search router

**Files:**
- Modify: `backend/app/schemas/schemas.py` (add Search models)
- Create: `backend/app/routers/search.py`
- Modify: `backend/main.py` (mount)
- Create: `backend/tests/test_search.py`

- [ ] **Step 1: Schemas**

In `backend/app/schemas/schemas.py` append:

```python
class SearchRequest(BaseModel):
    query: str
    document_id: Optional[int] = None
    top_k: int = 6


class SearchHit(BaseModel):
    chunk_id: int
    document_id: int
    page: int
    kind: str
    text: Optional[str] = None
    image_path: Optional[str] = None
    score: float


class SearchResponse(BaseModel):
    hits: List[SearchHit]
```

- [ ] **Step 2: Router**

`backend/app/routers/search.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text as sql_text

from app.core.deps import get_db, get_current_user
from app.models.orm import User
from app.schemas.schemas import SearchRequest, SearchResponse, SearchHit
from app.services.embedding import embed_query, embed_images

router = APIRouter()


def _run_similarity(db: Session, user_id: int, embedding: list[float], document_id: int | None, top_k: int):
    """Run cosine similarity in pgvector and return hits."""
    sql = """
        SELECT id, document_id, page, kind, text, image_path,
               1 - (embedding <=> CAST(:emb AS vector)) AS score
          FROM document_chunks
         WHERE user_id = :uid
           AND (:doc_id IS NULL OR document_id = :doc_id)
         ORDER BY embedding <=> CAST(:emb AS vector)
         LIMIT :k
    """
    rows = db.execute(
        sql_text(sql),
        {"emb": str(embedding), "uid": user_id, "doc_id": document_id, "k": top_k},
    ).all()
    return [
        SearchHit(
            chunk_id=r.id,
            document_id=r.document_id,
            page=r.page,
            kind=r.kind,
            text=r.text,
            image_path=r.image_path,
            score=float(r.score),
        )
        for r in rows
    ]


@router.post("/text", response_model=SearchResponse)
def search_text(
    req: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="empty query")
    if req.top_k < 1 or req.top_k > 50:
        raise HTTPException(status_code=400, detail="top_k must be 1..50")
    vec = embed_query(req.query)
    hits = _run_similarity(db, current_user.id, vec.tolist(), req.document_id, req.top_k)
    return SearchResponse(hits=hits)


@router.post("/image", response_model=SearchResponse)
async def search_image(
    file: UploadFile = File(...),
    document_id: int | None = Form(None),
    top_k: int = Form(6),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if top_k < 1 or top_k > 50:
        raise HTTPException(status_code=400, detail="top_k must be 1..50")
    content = await file.read()
    vecs = embed_images([content])
    if vecs.shape[0] != 1:
        raise HTTPException(status_code=400, detail="failed to embed image")
    hits = _run_similarity(db, current_user.id, vecs[0].tolist(), document_id, top_k)
    return SearchResponse(hits=hits)
```

- [ ] **Step 3: Mount in `main.py`**

In `backend/main.py` add import + include:

```python
from app.routers import search

app.include_router(search.router, prefix="/api/v1/search", tags=["search"])
```

- [ ] **Step 4: Write search test (skipped on sqlite)**

```python
import pytest
import numpy as np


def _signup_login(client, email="s@s.com"):
    client.post("/api/v1/auth/signup", json={"name": "s", "email": email, "password": "pw"})
    r = client.post("/api/v1/auth/login", json={"email": email, "password": "pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}, r


def test_search_text_returns_hits(client, db, monkeypatch):
    if db.bind.dialect.name == "sqlite":
        pytest.skip("pgvector required")

    from app.models.orm import User, Document, DocumentChunk
    headers, login = _signup_login(client)
    u = db.query(User).filter_by(email="s@s.com").one()

    doc = Document(user_id=u.id, name="x", parsed_md="hello", parse_status="ready")
    db.add(doc); db.commit(); db.refresh(doc)

    for i in range(3):
        v = np.ones(768, dtype="float32"); v[i] += 0.5
        v /= np.linalg.norm(v)
        db.add(DocumentChunk(
            document_id=doc.id, user_id=u.id, page=i+1, kind="text",
            text=f"chunk {i}", embedding=v.tolist(), token_count=2,
        ))
    db.commit()

    from app.services import embedding
    monkeypatch.setattr(embedding, "embed_query", lambda q: np.ones(768, dtype="float32") / np.sqrt(768))

    r = client.post("/api/v1/search/text", json={"query": "hello", "top_k": 3}, headers=headers)
    assert r.status_code == 200
    hits = r.json()["hits"]
    assert len(hits) == 3
    assert hits[0]["score"] >= hits[1]["score"] >= hits[2]["score"]
```

- [ ] **Step 5: Run**

```bash
cd backend && pytest tests/test_search.py -v
```
Expected: 1 skipped on sqlite. (Real PG run via integration is in Task 6.)

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/search.py backend/main.py backend/app/schemas/schemas.py backend/tests/test_search.py
git commit -m "feat(rag): search/text + search/image endpoints over pgvector"
```

### Edge cases (Task 5)

- **`<=>` returns cosine *distance* (0 best, 2 worst)**: we convert to similarity via `1 - distance`.
- **String-cast embeddings (`CAST(:emb AS vector)`)** — psycopg2 binds Python lists as text; pgvector parses. Safer than parameter type registration in v1.
- **No hits**: returns empty list, not an error.
- **`document_id` filter**: optional; without it, search spans all the user's docs.
- **Permissions**: the SQL always filters `user_id = :uid`. No cross-tenant leak.
- **Empty query**: 400. Empty embedding query would crash the LSH index.
- **Image of unsupported format (e.g. AVIF)**: PIL raises; FastAPI returns 500. Add Pillow plugins if needed.

---

## Task 6: End-to-end on real PG (manual)

- [ ] **Step 1: Bring up full stack**

```bash
docker compose up -d db redis backend worker
```

- [ ] **Step 2: Wait for parse + embed**

After uploading the sample PDF in P2 Task 6, watch logs:

```bash
docker compose logs -f worker
```
Expect lines: `doc 1 parsed ...` then `doc 1 embedded N chunks`.

- [ ] **Step 3: Query**

```bash
TOKEN=$(... obtain ...)
curl -s -X POST http://localhost:8000/api/v1/search/text \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"key concept","top_k":3}' | jq
```
Expected: 3 hits with score in (0, 1].

- [ ] **Step 4: Inspect HNSW index**

```bash
docker compose exec db psql -U docmind -d docmind -c "\\d+ document_chunks"
```
Confirm `ix_document_chunks_embed_hnsw` index present.

---

## Phase 3 verification checklist

- [ ] `0003_pgvector_chunks.py` upgrade + downgrade + reapply works.
- [ ] `pytest -q` green (sqlite skips for PG-only tests).
- [ ] `embed_document` job populates `document_chunks` after parse.
- [ ] `/api/v1/search/text` returns ranked hits.
- [ ] `/api/v1/search/image` returns ranked hits.
- [ ] HNSW index exists.
- [ ] Logs show "doc N parsed" then "doc N embedded M chunks" without manual intervention.

## Edge cases summary

1. **Nomic Text v1.5 prefix requirement**: `search_query:` / `search_document:`. Without it, retrieval is markedly worse. Use `embed_passages` for storage, `embed_query` for queries; never call `embed_texts` directly in workers.
2. **Shared 768-d space**: image embeddings from `nomic-embed-vision-v1.5` are directly comparable to text embeddings from `nomic-embed-text-v1.5`. Both must be L2-normalised (we set `normalize_embeddings=True`).
3. **GPU memory**: ST loads both models eagerly when accessed. To save VRAM, only load vision model on first `embed_images` call (lazy already).
4. **HF model download flakiness**: pre-download models in `Dockerfile.worker` if needed: `RUN python -c "from sentence_transformers import SentenceTransformer as ST; ST('nomic-ai/nomic-embed-text-v1.5', trust_remote_code=True); ST('nomic-ai/nomic-embed-vision-v1.5', trust_remote_code=True)"`. Adds build time, removes runtime surprises.
5. **Reindex after schema change**: if `EMBED_DIM` ever changes, drop+recreate `document_chunks` (or run a migration). v1 stays at 768.
6. **Multi-tenant safety**: all SQL filters on `user_id`. Tests cover.
7. **Streaming through chunked content for large MD**: chunker holds entire MD in memory. For 1GB MD this OOMs the worker. Documents that big are out of scope.
8. **HNSW recall trade-off**: with `m=16` you get ~95% recall at default `ef_search`. To boost: `SET hnsw.ef_search = 100;` per session if recall complaints emerge.
9. **Image-only docs**: P8 path lets users upload a math problem image; that flow inserts a single `kind='image'` row with embedding from `embed_images`. `text` column stores Docling OCR transcription.
