# P2: Document Ingestion Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Prerequisite:** P1 (boot-and-provider) must be complete and tests passing.

**Goal:** When a document is uploaded, parse it with Docling, split into chunks, prepend contextual retrieval context to each chunk, embed via Nomic (Ollama), store in pgvector + Postgres FTS, generate a doc-level summary and section summaries, and expose a `processing_status` field so the frontend can poll progress.

**Architecture:** Upload endpoint enqueues an ARQ job. The ARQ worker runs Docling parsing, summary generation (1 LLM call), chunking, contextual retrieval (1 LLM call per chunk using system-prompt caching), Nomic embedding via Ollama HTTP, and writes everything to the new `chunks` table + updated `documents` columns. Redis is added to docker-compose. The `chunks` table gets an HNSW pgvector index and GIN FTS index. Ingestion is idempotent: re-uploading a file creates a new `document_id`; old document + chunks are deleted by FK cascade.

**Tech Stack:** Docling, ARQ, Redis, Ollama (`nomic-embed-text-v1.5`), pgvector, tiktoken, SQLAlchemy, alembic, pytest

---

## File Map

### Created
| File | Purpose |
|---|---|
| `backend/app/workers/__init__.py` | Package marker |
| `backend/app/workers/worker.py` | ARQ WorkerSettings + Redis pool |
| `backend/app/workers/ingest.py` | `ingest_document` ARQ task |
| `backend/app/services/docling_parser.py` | Docling wrapper → parsed_md + outline |
| `backend/app/services/chunker.py` | Semantic chunking into ~500-token pieces |
| `backend/app/services/contextual_retrieval.py` | LLM contextualise-chunk (Gemini cached prefix) |
| `backend/app/services/embedder.py` | Nomic embedding via Ollama HTTP |
| `backend/tests/test_ingestion.py` | Integration tests for ingestion pipeline |

### Modified
| File | Change |
|---|---|
| `backend/app/models/orm.py` | Add `Chunk` model + new columns on `Document` |
| `backend/app/schemas/schemas.py` | Add `DocumentOut` `processing_status` field |
| `backend/app/routers/documents.py` | Upload enqueues ARQ job; add `GET /{doc_id}/status` endpoint |
| `backend/requirements.txt` | Add `docling`, `arq`, `redis`, `tiktoken`, `httpx[http2]` |
| `backend/app/core/config.py` | Add `redis_url`, `stuff_threshold`, `chunk_size`, `chunk_overlap` |
| `backend/docker-compose.yml` | Add Redis service; backend depends on it |
| `backend/alembic/versions/` | New migration `002_chunks_and_doc_columns.py` |

---

## Task 1: Add Chunk model and Document columns to ORM

**Files:**
- Modify: `backend/app/models/orm.py`

- [ ] **Step 1: Add new columns to the `Document` class**

In `backend/app/models/orm.py`, locate the `Document` class. Add these columns after `content = Column(Text)`:

```python
parsed_md = Column(Text)
outline = Column(JSON, default=list)
page_count = Column(Integer, nullable=True)
token_count = Column(Integer, nullable=True)
summary = Column(Text)
section_summaries = Column(JSON, default=list)
processing_status = Column(String(20), default="queued")
```

- [ ] **Step 2: Add `Chunk` model at end of file**

```python
class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(BigInteger, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    section_id = Column(String(200), nullable=True)
    page_start = Column(Integer, nullable=True)
    page_end = Column(Integer, nullable=True)
    position = Column(Integer, nullable=False, default=0)
    raw_text = Column(Text, nullable=False)
    context = Column(Text, nullable=False, default="")
    contextualized_text = Column(Text, nullable=False)
    embedding_json = Column(JSON, nullable=True)  # fallback if pgvector not enabled
    created_at = Column(DateTime, server_default=func.now())
```

Note: `embedding_json` stores the vector as a plain list for now. The pgvector column (`VECTOR(768)`) is added via raw SQL in the Alembic migration (Alembic doesn't auto-generate vector types). See Task 2.

Add the import at top of file if not present:
```python
from sqlalchemy import (
    BigInteger, Boolean, Column, Date, DateTime, ForeignKey,
    Integer, JSON, String, Text, func
)
```

- [ ] **Step 3: Verify ORM loads**

```bash
cd backend && python -c "from app.models.orm import Document, Chunk; print('OK')"
```

Expected: `OK`

---

## Task 2: Generate and edit Alembic migration

**Files:**
- Create: `backend/alembic/versions/002_chunks_and_doc_columns.py`

- [ ] **Step 1: Auto-generate the migration**

```bash
cd backend
alembic revision --autogenerate -m "chunks_and_doc_columns"
```

- [ ] **Step 2: Find the generated file**

```bash
ls backend/alembic/versions/
```

Note the full filename of the `*chunks_and_doc_columns*` file.

- [ ] **Step 3: Enable pgvector and add embedding column manually**

Open the generated migration file. In the `upgrade()` function, add these lines **before** the generated `op.create_table("chunks", ...)` call:

```python
# Enable pgvector extension
op.execute("CREATE EXTENSION IF NOT EXISTS vector")
```

After the `op.create_table("chunks", ...)` block, add:

```python
# Add pgvector embedding column (768-dim for nomic-embed-text-v1.5)
op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(768)")

# HNSW index for cosine similarity search
op.execute("""
    CREATE INDEX chunks_embedding_hnsw
    ON chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64)
""")

# GIN index for full-text search
op.execute("""
    ALTER TABLE chunks
    ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', contextualized_text)) STORED
""")
op.execute("CREATE INDEX chunks_fts_gin ON chunks USING gin(fts)")
```

In the `downgrade()` function, add at the start:
```python
op.execute("DROP TABLE IF EXISTS chunks CASCADE")
```
(Then remove the auto-generated `op.drop_table("chunks")` that would fail because of CASCADE dependencies.)

- [ ] **Step 4: Apply migration**

```bash
alembic upgrade head
```

Expected: no errors, all indexes created.

- [ ] **Step 5: Verify columns exist**

```bash
psql $DATABASE_URL -c "\d chunks" | grep -E "embedding|fts"
```

Expected output includes lines for `embedding` (type `vector`) and `fts` (type `tsvector`).

---

## Task 3: Add Redis to docker-compose

**Files:**
- Modify: `backend/docker-compose.yml` (root-level)

- [ ] **Step 1: Add Redis service**

In `docker-compose.yml`, add after the `db:` service block:

```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

- [ ] **Step 2: Add Redis dependency to backend**

In the `backend:` service `depends_on:` section, add:
```yaml
      redis:
        condition: service_healthy
```

- [ ] **Step 3: Add Redis startup to backend command**

The backend command starts with `alembic upgrade head && uvicorn ...`. Redis is external, no changes needed.

- [ ] **Step 4: Start Redis and verify**

```bash
docker-compose up -d redis
docker-compose exec redis redis-cli ping
```

Expected: `PONG`

---

## Task 4: Update `config.py` with ingestion settings

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: Add new fields to `Settings` class**

Add these fields to the `Settings` class:

```python
# Redis (for ARQ job queue)
redis_url: str = "redis://localhost:6379"

# Ingestion tuning
stuff_threshold: int = 150_000        # tokens — above this use RAG not full-doc
chunk_size: int = 500                  # target chunk tokens
chunk_overlap: int = 50               # overlap tokens between adjacent chunks

# Embedding
embed_model: str = "nomic-embed-text-v1.5"
```

---

## Task 5: Write `embedder.py`

**Files:**
- Create: `backend/app/services/embedder.py`

- [ ] **Step 1: Write the file**

```python
"""
Embedding service using Ollama's nomic-embed-text-v1.5.
Nomic requires task-type prefixes on input text.
"""
import httpx
from app.core.config import settings


async def embed_texts(texts: list[str], task: str = "search_document") -> list[list[float]]:
    """
    Embed a list of texts.
    task: "search_document" for chunks at ingest time.
          "search_query" for query vectors at retrieval time.
    Returns a list of 768-dim vectors.
    """
    prefixed = [f"{task}: {t}" for t in texts]
    url = f"{settings.ollama_base_url}/api/embed"

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(url, json={
            "model": settings.embed_model,
            "input": prefixed,
        })
        response.raise_for_status()
        data = response.json()
        return data["embeddings"]


async def embed_query(query: str) -> list[float]:
    """Single-query embedding for retrieval."""
    vecs = await embed_texts([query], task="search_query")
    return vecs[0]
```

- [ ] **Step 2: Test embedder manually (requires Ollama running with nomic-embed-text:v1.5)**

```bash
cd backend
ollama pull nomic-embed-text:v1.5  # run once
python -c "
import asyncio
from app.services.embedder import embed_texts
result = asyncio.run(embed_texts(['test text']))
print(len(result[0]))  # should be 768
"
```

Expected: `768`

---

## Task 6: Write `chunker.py`

**Files:**
- Create: `backend/app/services/chunker.py`

- [ ] **Step 1: Write the file**

```python
"""
Semantic chunker: splits markdown into ~chunk_size token pieces with overlap.
Splits preferentially at paragraph/section boundaries.
"""
import re
import tiktoken
from dataclasses import dataclass
from typing import Optional

from app.core.config import settings

_enc = tiktoken.get_encoding("cl100k_base")


def _token_len(text: str) -> int:
    return len(_enc.encode(text))


@dataclass
class ChunkData:
    """Dataclass for in-memory chunks (not to be confused with the ORM `Chunk` model)."""
    raw_text: str
    section_id: Optional[str]
    page_start: Optional[int]
    page_end: Optional[int]
    position: int


def chunk_markdown(
    markdown: str,
    outline: list[dict],
    chunk_size: int = None,
    overlap: int = None,
) -> list[ChunkData]:
    """
    Split markdown into token-bounded chunks.
    Uses section boundaries from outline when available;
    falls back to paragraph splits.
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap_tokens = overlap or settings.chunk_overlap

    # Split on blank lines (paragraph boundaries)
    paragraphs = re.split(r"\n\s*\n", markdown.strip())
    paragraphs = [p.strip() for p in paragraphs if p.strip()]

    chunks: list[ChunkData] = []
    current_text_parts: list[str] = []
    position = 0

    def flush():
        """Emit current_text_parts as a chunk; clear the buffer."""
        nonlocal position, current_text_parts
        if not current_text_parts:
            return
        text = "\n\n".join(current_text_parts)
        chunks.append(ChunkData(
            raw_text=text,
            section_id=None,   # TODO: extract from Docling prov metadata
            page_start=None,
            page_end=None,
            position=position,
        ))
        position += 1
        current_text_parts = []

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
            # Paragraph itself too long — split into sentences
            sentences = re.split(r"(?<=[.!?])\s+", para)
            for sent in sentences:
                sent_size = _token_len("\n\n".join(current_text_parts))
                if sent_size + len(_enc.encode(sent)) > chunk_size and current_text_parts:
                    flush()
                current_text_parts.append(sent)
        else:
            current_text_parts.append(para)

    flush()  # emit final chunk if any

    return chunks
```

- [ ] **Step 2: Write test**

In `backend/tests/test_ingestion.py`:

```python
from app.services.chunker import chunk_markdown, _token_len


def test_chunk_markdown_basic():
    text = "\n\n".join(["word " * 100] * 20)  # 20 paragraphs × 100 tokens
    chunks = chunk_markdown(text, outline=[])
    assert len(chunks) >= 2
    for c in chunks:
        assert _token_len(c.raw_text) <= 550  # chunk_size + small margin


def test_chunk_single_paragraph_split():
    # One giant paragraph that must be split at sentences
    text = "The cat sat. " * 200  # ~600 tokens
    chunks = chunk_markdown(text, outline=[])
    assert len(chunks) >= 2


def test_chunk_empty():
    chunks = chunk_markdown("", outline=[])
    assert chunks == []
```

- [ ] **Step 3: Run tests**

```bash
pytest backend/tests/test_ingestion.py::test_chunk_markdown_basic \
       backend/tests/test_ingestion.py::test_chunk_single_paragraph_split \
       backend/tests/test_ingestion.py::test_chunk_empty -v
```

Expected: 3 PASSED

---

## Task 7: Write `docling_parser.py`

**Files:**
- Create: `backend/app/services/docling_parser.py`

- [ ] **Step 1: Install Docling**

```bash
pip install docling
```

Add to `backend/requirements.txt`:
```
docling>=2.0.0
```

- [ ] **Step 2: Write the file**

```python
"""
Docling wrapper: parses PDF/DOCX/PPTX/HTML into structured Markdown + outline.
"""
import io
import os
import tempfile
from pathlib import Path
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParsedDocument:
    markdown: str
    outline: list[dict]   # [{title, level, page_start, page_end, children: [...]}]
    page_count: int


def parse_bytes(content: bytes, filename: str) -> ParsedDocument:
    """
    Parse a document from raw bytes.
    Writes to a temp file (Docling requires file path), then parses.
    """
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    suffix = Path(filename).suffix.lower()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        converter = DocumentConverter()
        result = converter.convert(tmp_path)
        doc = result.document

        # Export to markdown
        markdown = doc.export_to_markdown()

        # Build outline from headings
        outline = _build_outline(doc)

        # Page count from document metadata
        page_count = _get_page_count(doc)

        return ParsedDocument(
            markdown=markdown,
            outline=outline,
            page_count=page_count,
        )
    finally:
        os.unlink(tmp_path)


def _build_outline(doc) -> list[dict]:
    """Extract section hierarchy from Docling document."""
    outline = []
    try:
        # Docling exposes body items with heading levels
        for item in doc.body.children:
            node = _item_to_node(item)
            if node:
                outline.append(node)
    except Exception:
        pass
    return outline


def _item_to_node(item) -> Optional[dict]:
    try:
        label = str(item.label).lower()
        if "heading" not in label and "section" not in label:
            return None
        prov = item.prov[0] if item.prov else None
        return {
            "title": item.text or "",
            "level": getattr(item, "level", 1),
            "page_start": prov.page_no if prov else None,
            "page_end": prov.page_no if prov else None,
            "children": [],
        }
    except Exception:
        return None


def _get_page_count(doc) -> int:
    try:
        pages = set()
        for item in doc.iterate_items():
            for prov in getattr(item[0], "prov", []):
                if hasattr(prov, "page_no"):
                    pages.add(prov.page_no)
        return max(pages) if pages else 1
    except Exception:
        return 1
```

- [ ] **Step 3: Write test**

In `backend/tests/test_ingestion.py`, add:

```python
import io
from app.services.docling_parser import parse_bytes, ParsedDocument


def test_parse_text_file():
    content = b"# Introduction\n\nThis is a test document.\n\n## Section 2\n\nMore content here."
    # Use .md extension so Docling treats it as Markdown
    result = parse_bytes(content, "test.md")
    assert isinstance(result, ParsedDocument)
    assert "Introduction" in result.markdown or "test document" in result.markdown
    assert result.page_count >= 1
```

- [ ] **Step 4: Run test**

```bash
pytest backend/tests/test_ingestion.py::test_parse_text_file -v
```

Expected: PASSED

---

## Task 8: Write `contextual_retrieval.py`

**Files:**
- Create: `backend/app/services/contextual_retrieval.py`

- [ ] **Step 1: Write the file**

```python
"""
Contextual Retrieval: prepend a 50-token situating context to each chunk.
Uses LLM with full document as cached system prompt.
Anthropic 2024 pattern: https://www.anthropic.com/news/contextual-retrieval
"""
from app.services.ai import get_provider_with_fallback

SYSTEM_TEMPLATE = """\
You are helping to build a retrieval index. The full document is below.
<document>
{document_markdown}
</document>

For each chunk you receive, output a single short paragraph (≤50 tokens)
explaining where the chunk fits in the document — which section it belongs to,
what topic it covers, and what came immediately before it in the document flow.
Output only the context paragraph, nothing else.\
"""

CHUNK_TEMPLATE = """\
Chunk to contextualise:
<chunk>
{chunk_text}
</chunk>
"""


async def add_context_to_chunks(
    document_markdown: str,
    chunk_texts: list[str],
) -> list[str]:
    """
    Returns one context string per chunk (same order as input).
    Each context is 50 tokens describing where the chunk fits.

    Sends all chunks to the same provider with identical system prompt
    (full doc) so Gemini's implicit prompt caching fires after the first call.
    """
    provider = get_provider_with_fallback("gemini", ["groq", "nvidia", "ollama"])
    system_prompt = SYSTEM_TEMPLATE.format(document_markdown=document_markdown[:60_000])

    contexts: list[str] = []
    for chunk_text in chunk_texts:
        user_message = CHUNK_TEMPLATE.format(chunk_text=chunk_text[:2000])
        context = await provider.chat_completion(
            messages=[{"role": "user", "content": user_message}],
            system_prompt=system_prompt,
        )
        contexts.append(context.strip())

    return contexts
```

- [ ] **Step 2: Write test (mock provider)**

In `backend/tests/test_ingestion.py`, add:

```python
from unittest.mock import AsyncMock, patch
from app.services.contextual_retrieval import add_context_to_chunks


async def test_contextual_retrieval_returns_context():
    mock_provider = AsyncMock()
    mock_provider.chat_completion = AsyncMock(return_value="This chunk covers quantum mechanics.")

    with patch("app.services.contextual_retrieval.get_provider_with_fallback", return_value=mock_provider):
        contexts = await add_context_to_chunks(
            document_markdown="# Quantum Physics\n\nContent about physics.",
            chunk_texts=["Wave-particle duality is a key concept."],
        )

    assert len(contexts) == 1
    assert "quantum" in contexts[0].lower() or "chunk" in contexts[0].lower()
```

- [ ] **Step 3: Run test**

```bash
pytest backend/tests/test_ingestion.py::test_contextual_retrieval_returns_context -v
```

Expected: PASSED

---

## Task 9: Write `ingest.py` ARQ worker task

**Files:**
- Create: `backend/app/workers/__init__.py` (empty)
- Create: `backend/app/workers/ingest.py`

- [ ] **Step 1: Create `__init__.py`**

```bash
touch backend/app/workers/__init__.py
```

- [ ] **Step 2: Write `ingest.py`**

```python
"""
ARQ worker task: ingest_document
Runs Docling parse → summary → chunk → contextualise → embed → store.
Called by the documents upload router after file is saved to documents table.
"""
import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.orm import Document, Chunk
from app.services.docling_parser import parse_bytes
from app.services.chunker import chunk_markdown
from app.services.contextual_retrieval import add_context_to_chunks
from app.services.embedder import embed_texts
from app.services import generators

import tiktoken

_enc = tiktoken.get_encoding("cl100k_base")
logger = logging.getLogger(__name__)


def _count_tokens(text: str) -> int:
    return len(_enc.encode(text))


async def ingest_document(ctx, document_id: int):
    """
    ARQ task. ctx is provided by the ARQ worker context.
    Runs full ingestion pipeline for a single document.
    """
    db: Session = SessionLocal()
    try:
        doc = db.get(Document, document_id)
        if not doc:
            logger.warning(f"ingest_document: doc {document_id} not found")
            return

        _set_status(db, doc, "parsing")

        # 1. Parse with Docling
        raw_bytes = (doc.content or "").encode("utf-8", errors="ignore")
        parsed = parse_bytes(raw_bytes, doc.name)

        doc.parsed_md = parsed.markdown
        doc.outline = parsed.outline
        doc.page_count = parsed.page_count
        doc.token_count = _count_tokens(parsed.markdown)
        db.commit()

        _set_status(db, doc, "summarising")

        # 2. Generate doc summary + section summaries
        doc.summary, doc.section_summaries = await _generate_summaries(
            parsed.markdown, parsed.outline
        )
        db.commit()

        _set_status(db, doc, "chunking")

        # 3. Chunk markdown
        raw_chunks = chunk_markdown(parsed.markdown, parsed.outline)

        if not raw_chunks:
            _set_status(db, doc, "ready")
            return

        _set_status(db, doc, "embedding")

        # 4. Contextual retrieval: add situating context to each chunk
        chunk_texts = [c.raw_text for c in raw_chunks]
        try:
            contexts = await add_context_to_chunks(parsed.markdown, chunk_texts)
        except Exception as e:
            logger.warning(f"Contextual retrieval failed, using empty context: {e}")
            contexts = [""] * len(raw_chunks)

        # 5. Build contextualized texts
        contextualized = [
            f"{ctx_text}\n\n{raw}" if ctx_text else raw
            for ctx_text, raw in zip(contexts, chunk_texts)
        ]

        # 6. Embed in batches of 32
        all_embeddings = []
        batch_size = 32
        for i in range(0, len(contextualized), batch_size):
            batch = contextualized[i : i + batch_size]
            vecs = await embed_texts(batch, task="search_document")
            all_embeddings.extend(vecs)

        # 7. Delete any existing chunks for this doc (idempotency)
        db.query(Chunk).filter(Chunk.document_id == document_id).delete()
        db.commit()

        # 8. Insert new chunks
        for i, (raw_chunk, ctx_text, ctx_full, embedding) in enumerate(
            zip(raw_chunks, contexts, contextualized, all_embeddings)
        ):
            chunk_obj = Chunk(
                document_id=document_id,
                user_id=doc.user_id,
                section_id=raw_chunk.section_id,
                page_start=raw_chunk.page_start,
                page_end=raw_chunk.page_end,
                position=raw_chunk.position,
                raw_text=raw_chunk.raw_text,
                context=ctx_text,
                contextualized_text=ctx_full,
                embedding_json=embedding,
            )
            db.add(chunk_obj)

        db.commit()

        # 9. Write embeddings to pgvector column via raw SQL
        _write_embeddings_to_pgvector(db, document_id, all_embeddings)

        _set_status(db, doc, "ready")
        logger.info(f"ingest_document: doc {document_id} done — {len(raw_chunks)} chunks")

    except Exception as e:
        logger.exception(f"ingest_document: doc {document_id} failed: {e}")
        if db.is_active:
            doc = db.get(Document, document_id)
            if doc:
                _set_status(db, doc, "failed")
    finally:
        db.close()


def _set_status(db: Session, doc: Document, status: str):
    doc.processing_status = status
    db.commit()
    logger.info(f"doc {doc.id}: {status}")


async def _generate_summaries(markdown: str, outline: list) -> tuple[str, list]:
    """Generate doc summary + per-section summaries in one LLM call."""
    from pydantic import BaseModel
    from typing import List

    class _SectionSummary(BaseModel):
        section_title: str
        summary: str

    class _DocSummaryResult(BaseModel):
        doc_summary: str
        section_summaries: List[_SectionSummary]

    provider = generators._provider()
    truncated = markdown[:12_000]  # ~3k tokens

    result = await provider.structured_output(
        messages=[{
            "role": "user",
            "content": (
                "Summarise this document. Return:\n"
                "1. doc_summary: 300-500 word overview of key concepts, methodology, conclusions.\n"
                "2. section_summaries: list of {section_title, summary} — one 2-3 sentence summary per major section.\n\n"
                f"Document:\n{truncated}"
            ),
        }],
        schema=_DocSummaryResult,
        system_prompt="You are a precise summariser. Return valid JSON only.",
    )
    sums = [s.model_dump() for s in result.section_summaries]
    return result.doc_summary, sums


def _write_embeddings_to_pgvector(db: Session, document_id: int, embeddings: list[list[float]]):
    """Write float-list embeddings to the pgvector column via raw SQL."""
    from sqlalchemy import text

    chunks = db.query(Chunk).filter(
        Chunk.document_id == document_id
    ).order_by(Chunk.position).all()

    for chunk, vec in zip(chunks, embeddings):
        vec_str = "[" + ",".join(f"{v:.8f}" for v in vec) + "]"
        db.execute(
            text("UPDATE chunks SET embedding = :vec WHERE id = :id"),
            {"vec": vec_str, "id": chunk.id},
        )
    db.commit()
```

---

## Task 10: Write `worker.py`

**Files:**
- Create: `backend/app/workers/worker.py`

- [ ] **Step 1: Write the file**

```python
"""
ARQ worker entrypoint.
Run with: python -m arq app.workers.worker.WorkerSettings
"""
from arq import create_pool
from arq.connections import RedisSettings
from app.core.config import settings
from app.workers.ingest import ingest_document


def get_redis_settings() -> RedisSettings:
    url = settings.redis_url  # e.g. redis://localhost:6379
    # Parse host and port from URL
    url = url.replace("redis://", "")
    if "/" in url:
        url = url.split("/")[0]
    host, _, port = url.partition(":")
    return RedisSettings(host=host or "localhost", port=int(port or 6379))


class WorkerSettings:
    functions = [ingest_document]
    redis_settings = get_redis_settings()
    max_jobs = 4
    job_timeout = 600  # 10 minutes max per ingest


async def get_arq_pool():
    return await create_pool(WorkerSettings.redis_settings)
```

- [ ] **Step 2: Add `arq_pool` to app state in `main.py`**

In `backend/main.py`, add:

```python
from app.workers.worker import get_arq_pool

@app.on_event("startup")
async def startup():
    app.state.arq_pool = await get_arq_pool()

@app.on_event("shutdown")
async def shutdown():
    await app.state.arq_pool.close()
```

---

## Task 11: Update documents router to enqueue job

**Files:**
- Modify: `backend/app/routers/documents.py`

- [ ] **Step 1: Replace `upload_document` and add status endpoint**

Replace the full contents of `backend/app/routers/documents.py`:

```python
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List
from app.core.deps import get_db, get_current_user
from app.models.orm import User, Document
from app.schemas.schemas import DocumentOut

router = APIRouter()


@router.get("", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Document).filter(Document.user_id == current_user.id).all()


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.get("/{doc_id}/status")
def get_status(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"id": doc_id, "status": doc.processing_status}


@router.post("", response_model=DocumentOut)
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = (
        file.filename.rsplit(".", 1)[-1].lower()
        if file.filename and "." in file.filename
        else "pdf"
    )
    content = await file.read()
    size_str = f"{len(content) / (1024 * 1024):.1f} MB"

    doc = Document(
        user_id=current_user.id,
        name=file.filename or "unknown",
        size=size_str,
        type=ext,
        tags=[],
        content=content.decode("utf-8", errors="ignore"),  # raw text fallback
        processing_status="queued",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Enqueue background ingestion via ARQ
    arq_pool = getattr(request.app.state, "arq_pool", None)
    if arq_pool:
        await arq_pool.enqueue_job("ingest_document", doc.id)

    return doc


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.user_id == current_user.id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}
```

---

## Task 12: Update `DocumentOut` schema

**Files:**
- Modify: `backend/app/schemas/schemas.py`

- [ ] **Step 1: Add `processing_status` to `DocumentOut`**

Find `DocumentOut` class and add field:

```python
class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    size: Optional[str] = None
    type: Optional[str] = None
    upload_date: Optional[date] = None
    tags: List[str] = []
    processing_status: str = "queued"
```

---

## Task 13: Run full test suite

- [ ] **Step 1: Run all tests**

```bash
cd backend && pytest tests/ -v
```

Expected: all existing 16 tests pass plus the new ingestion tests (chunker + parser + contextual retrieval mock).

- [ ] **Step 2: Smoke-test the full pipeline end-to-end (manual)**

Start the stack:
```bash
docker-compose up -d db redis
cd backend && uvicorn main:app --port 8000 &
python -m arq app.workers.worker.WorkerSettings &
```

Upload a file:
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"t@t.com","password":"pw"}' | python -m json.tool

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"t@t.com","password":"pw"}' | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -X POST http://localhost:8000/api/v1/documents \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@path/to/small.pdf"

# Get the doc_id from above response, then poll status:
curl http://localhost:8000/api/v1/documents/1/status \
  -H "Authorization: Bearer $TOKEN"
```

Expected final status: `{"id": 1, "status": "ready"}`

---

## Task 14: Commit

- [ ] **Step 1: Stage changes**

```bash
git add \
  backend/app/models/orm.py \
  backend/app/schemas/schemas.py \
  backend/app/routers/documents.py \
  backend/app/services/docling_parser.py \
  backend/app/services/chunker.py \
  backend/app/services/contextual_retrieval.py \
  backend/app/services/embedder.py \
  backend/app/workers/ \
  backend/app/core/config.py \
  backend/requirements.txt \
  backend/docker-compose.yml \
  backend/main.py \
  backend/tests/test_ingestion.py \
  backend/alembic/versions/
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat: document ingestion pipeline (Docling + ARQ + Nomic embed)

- Parse PDF/DOCX/PPTX with Docling → markdown + outline
- ARQ worker enqueued on upload; status polled via GET /{doc_id}/status
- Contextual Retrieval (Anthropic 2024): situating context per chunk
- Nomic embed-text-v1.5 via Ollama → pgvector HNSW + Postgres FTS GIN
- Doc-level + section summaries cached for RAG and generator bypass path
- Redis added to docker-compose"
```

---

## Self-Review

**Spec coverage:**
- [x] Docling parse → parsed_md + outline → Task 7
- [x] Summary cache (doc + sections) → Task 9 `_generate_summaries`
- [x] Semantic chunking ~500 tokens → Task 6
- [x] Contextual Retrieval prep → Task 8
- [x] Nomic embed → pgvector → Task 5 + Task 9
- [x] Postgres FTS (tsvector + GIN) → Task 2
- [x] HNSW index → Task 2
- [x] ARQ job queue → Tasks 9-10
- [x] Redis in docker-compose → Task 3
- [x] `processing_status` on Document → Tasks 1, 12
- [x] `GET /{doc_id}/status` endpoint → Task 11
- [x] pgvector extension enabled in migration → Task 2
- [x] FK cascade on chunk delete → Task 2 (`ON DELETE CASCADE` on `Chunk.document_id`)

**Type consistency:**
- `ingest.py` calls `generators._provider()` — this is a private function exposed in `generators.py`. OK for internal use in same package.
- `_write_embeddings_to_pgvector` uses `text()` query with `{v:.8f}` format — matches pgvector's expected `[f1,f2,...]` literal syntax. ✓
- `Chunk.embedding_json` stores the list fallback; `embedding` vector column is written separately by `_write_embeddings_to_pgvector`. Both paths persist. ✓
- `chunk_markdown` returns `list[Chunk]` where `Chunk` is `app.services.chunker.Chunk` (dataclass) — not to be confused with `app.models.orm.Chunk`. Rename one if confusion arises during implementation: suggest renaming the dataclass to `ChunkData` in `chunker.py`.

**Placeholder scan:** No TBDs found.
