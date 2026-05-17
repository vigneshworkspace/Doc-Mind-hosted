# Phase 5 — Streaming Chat with RAG + Citations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the synchronous `POST /chat/complete` with an SSE endpoint that (a) embeds the user's latest message, (b) retrieves top-K chunks from pgvector for the active document (or globally for the user if no doc), (c) injects them as a retrieval block in the system prompt, (d) streams the LLM response token-by-token, and (e) emits a final `citations` SSE event with the chunks consulted.

**Architecture:** New endpoint `POST /api/v1/chat/stream` returns `text/event-stream`. SSE events:
- `event: token` — `{ "delta": str }` for each token chunk
- `event: citations` — `{ "chunks": [SearchHit, ...] }` once retrieval is done (sent BEFORE tokens so the UI can render a "Sources" panel as the answer streams)
- `event: error` — `{ "detail": str }` for upstream errors
- `event: done` — empty data

Chat history is persisted in `chat_history` table after the stream completes (collected from the buffer the server kept).

`POST /chat/complete` (non-streaming) stays for backward compat; it gets the same RAG block.

**Tech Stack:** `sse-starlette` for typed SSE responses, existing pgvector search, `app.services.ai_tasks.chat_stream`.

**Depends on:** P1 (router), P3 (search). **Blocks:** P10 (frontend wires).

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/requirements.txt` | modify | `sse-starlette>=2.1.0` |
| `backend/app/services/rag.py` | create | `retrieve_for_query(db, user_id, query, doc_id, k)` |
| `backend/app/routers/chat.py` | modify | Add `POST /stream`, refactor shared logic |
| `backend/app/schemas/schemas.py` | modify | `ChatStreamRequest`, `Citation` |
| `backend/app/services/ai_tasks.py` | modify | `chat_stream` already exists from P1; extend signature to accept `retrieval_block` |
| `backend/tests/test_chat_stream.py` | create | SSE smoke + retrieval injection |

---

## Task 1: RAG retrieval helper

**Files:**
- Create: `backend/app/services/rag.py`
- Create: `backend/tests/test_rag.py`

- [ ] **Step 1: Write tests**

```python
import pytest
import numpy as np


def test_retrieve_filters_user_and_doc(monkeypatch, db):
    if db.bind.dialect.name == "sqlite":
        pytest.skip("pgvector required")
    from app.models.orm import User, Document, DocumentChunk
    from app.services import rag, embedding

    u1 = User(name="u1", email="a@a.com", password_hash="x"); db.add(u1); db.commit(); db.refresh(u1)
    u2 = User(name="u2", email="b@b.com", password_hash="x"); db.add(u2); db.commit(); db.refresh(u2)
    d1 = Document(user_id=u1.id, name="d1", parsed_md="x", parse_status="ready"); db.add(d1); db.commit(); db.refresh(d1)
    d2 = Document(user_id=u1.id, name="d2", parsed_md="x", parse_status="ready"); db.add(d2); db.commit(); db.refresh(d2)
    for d in (d1, d2):
        for i in range(2):
            v = np.ones(768, dtype="float32"); v /= np.linalg.norm(v)
            db.add(DocumentChunk(document_id=d.id, user_id=d.user_id, page=i+1,
                                 kind="text", text=f"d{d.id} p{i+1}",
                                 embedding=v.tolist(), token_count=1))
    db.commit()

    monkeypatch.setattr(embedding, "embed_query", lambda q: np.ones(768, dtype="float32")/np.sqrt(768))
    hits = rag.retrieve_for_query(db, user_id=u1.id, query="x", document_id=d1.id, k=4)
    assert all(h.document_id == d1.id for h in hits)
    assert len(hits) == 2


def test_retrieve_format_block_lists_pages():
    from app.services.rag import format_retrieval_block
    from app.schemas.schemas import SearchHit
    hits = [
        SearchHit(chunk_id=1, document_id=10, page=2, kind="text", text="alpha", score=0.9),
        SearchHit(chunk_id=2, document_id=10, page=5, kind="text", text="beta",  score=0.8),
    ]
    block = format_retrieval_block(hits)
    assert "[1] (doc 10, p.2)" in block
    assert "alpha" in block and "beta" in block


def test_retrieve_format_block_empty():
    from app.services.rag import format_retrieval_block
    assert format_retrieval_block([]) == ""
```

- [ ] **Step 2: Implement**

`backend/app/services/rag.py`:

```python
from typing import List, Optional

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.schemas.schemas import SearchHit
from app.services.embedding import embed_query


def retrieve_for_query(
    db: Session,
    user_id: int,
    query: str,
    document_id: Optional[int] = None,
    k: int = 6,
) -> List[SearchHit]:
    """Embed the query, run cosine search in document_chunks, return hits."""
    if not query.strip():
        return []
    vec = embed_query(query).tolist()
    sql = """
        SELECT id, document_id, page, kind, text, image_path,
               1 - (embedding <=> CAST(:emb AS vector)) AS score
          FROM document_chunks
         WHERE user_id = :uid
           AND (:doc IS NULL OR document_id = :doc)
         ORDER BY embedding <=> CAST(:emb AS vector)
         LIMIT :k
    """
    rows = db.execute(sql_text(sql), {"emb": str(vec), "uid": user_id, "doc": document_id, "k": k}).all()
    return [
        SearchHit(
            chunk_id=r.id, document_id=r.document_id, page=r.page, kind=r.kind,
            text=r.text, image_path=r.image_path, score=float(r.score),
        )
        for r in rows
    ]


def format_retrieval_block(hits: List[SearchHit], max_chars: int = 6000) -> str:
    """Format hits as a numbered context block for the LLM."""
    if not hits:
        return ""
    parts = []
    used = 0
    for i, h in enumerate(hits, start=1):
        head = f"[{i}] (doc {h.document_id}, p.{h.page})\n"
        body = (h.text or "").strip()
        snippet = head + body + "\n"
        if used + len(snippet) > max_chars:
            break
        parts.append(snippet)
        used += len(snippet)
    return "\n".join(parts).strip()
```

- [ ] **Step 3: Run**

```bash
cd backend && pytest tests/test_rag.py -v
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/services/rag.py backend/tests/test_rag.py
git commit -m "feat(rag): retrieve_for_query + format_retrieval_block"
```

---

## Task 2: Add `chat_stream_with_rag` to ai_tasks

**Files:** `backend/app/services/ai_tasks.py`

- [ ] **Step 1: Append**

```python
RAG_INSTRUCTIONS = (
    "You are DocMind, a calm, precise study assistant. "
    "Use ONLY the sources below when answering questions about the user's documents. "
    "If the answer is not in the sources, say so plainly. "
    "Cite sources inline using the [n] markers exactly as labelled."
)


async def chat_stream_with_rag(history, retrieval_block: str = ""):
    if retrieval_block:
        sys = f"{RAG_INSTRUCTIONS}\n\nSOURCES:\n{retrieval_block}"
    else:
        sys = CHAT_SYSTEM_BASE
    provider = _get_provider()
    async for chunk in provider.stream_completion(history, system_prompt=sys):
        yield chunk
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/ai_tasks.py
git commit -m "feat(ai-tasks): chat_stream_with_rag system prompt + retrieval block"
```

---

## Task 3: Streaming chat router

**Files:**
- Modify: `backend/app/routers/chat.py`
- Modify: `backend/app/schemas/schemas.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add dep**

`backend/requirements.txt`: append `sse-starlette>=2.1.0`.

- [ ] **Step 2: Schema additions**

In `backend/app/schemas/schemas.py`:

```python
class ChatStreamRequest(BaseModel):
    messages: List[ChatMessage]
    document_id: Optional[int] = None
    top_k: int = 6


class Citation(BaseModel):
    chunk_id: int
    document_id: int
    page: int
    text: Optional[str] = None
    score: float
```

- [ ] **Step 3: Rewrite `backend/app/routers/chat.py`**

```python
import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.orm import User, ChatHistory, Document
from app.schemas.schemas import (
    ChatCompleteRequest, ChatCompleteResponse, ChatHistoryOut,
    ChatStreamRequest, Citation,
)
from app.services import ai_tasks
from app.services.rag import retrieve_for_query, format_retrieval_block

router = APIRouter()
logger = logging.getLogger(__name__)


def _build_retrieval(db: Session, user_id: int, last_user_msg: str, document_id: int | None, k: int):
    if not last_user_msg.strip():
        return [], ""
    hits = retrieve_for_query(db, user_id=user_id, query=last_user_msg, document_id=document_id, k=k)
    return hits, format_retrieval_block(hits)


@router.post("/complete", response_model=ChatCompleteResponse)
async def complete(req: ChatCompleteRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if req.document_id:
        doc = db.query(Document).filter(Document.id == req.document_id, Document.user_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.parse_status != "ready":
            raise HTTPException(status_code=400, detail=f"document parse {doc.parse_status}")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    _, block = _build_retrieval(db, current_user.id, last_user, req.document_id, k=6)

    try:
        async def _collect():
            chunks = []
            async for c in ai_tasks.chat_stream_with_rag(messages, retrieval_block=block):
                chunks.append(c)
            return "".join(chunks)
        reply = await _collect()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    chat_record = ChatHistory(
        user_id=current_user.id, document_id=req.document_id,
        messages=messages + [{"role": "assistant", "content": reply}],
    )
    db.add(chat_record); db.commit()

    import os
    return ChatCompleteResponse(content=reply, model=os.getenv("LLM_MODEL", "unknown"))


@router.post("/stream")
async def stream(req: ChatStreamRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if req.document_id:
        doc = db.query(Document).filter(Document.id == req.document_id, Document.user_id == current_user.id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        if doc.parse_status != "ready":
            raise HTTPException(status_code=400, detail=f"document parse {doc.parse_status}")

    messages = [{"role": m.role, "content": m.content} for m in req.messages]
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    hits, block = _build_retrieval(db, current_user.id, last_user, req.document_id, k=req.top_k)

    async def event_gen():
        # Emit citations first
        citations = [
            Citation(chunk_id=h.chunk_id, document_id=h.document_id, page=h.page,
                     text=(h.text or "")[:300], score=h.score)
            for h in hits
        ]
        yield {"event": "citations", "data": json.dumps([c.model_dump() for c in citations])}

        collected = []
        try:
            async for delta in ai_tasks.chat_stream_with_rag(messages, retrieval_block=block):
                if not delta:
                    continue
                collected.append(delta)
                yield {"event": "token", "data": json.dumps({"delta": delta})}
        except Exception as e:
            logger.exception("chat stream upstream error")
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
            return

        # Persist transcript
        reply = "".join(collected)
        try:
            chat_record = ChatHistory(
                user_id=current_user.id, document_id=req.document_id,
                messages=messages + [{"role": "assistant", "content": reply}],
            )
            db.add(chat_record); db.commit()
        except Exception:
            logger.exception("failed to persist chat history")

        yield {"event": "done", "data": ""}

    return EventSourceResponse(event_gen(), media_type="text/event-stream")


@router.get("/history", response_model=List[ChatHistoryOut])
def get_chat_history(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(ChatHistory)
        .filter(ChatHistory.user_id == current_user.id)
        .order_by(ChatHistory.created_at.desc())
        .all()
    )
```

- [ ] **Step 4: Test SSE in TestClient**

`backend/tests/test_chat_stream.py`:

```python
import json
import pytest


def _auth(client, email="c@c.com"):
    client.post("/api/v1/auth/signup", json={"name":"c","email":email,"password":"pw"})
    r = client.post("/api/v1/auth/login", json={"email":email,"password":"pw"})
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_stream_emits_citations_and_tokens(client, monkeypatch):
    from app.services import ai_tasks, rag

    async def fake_stream(messages, retrieval_block=""):
        for c in ["Hello ", "world"]:
            yield c

    monkeypatch.setattr(ai_tasks, "chat_stream_with_rag", fake_stream)
    monkeypatch.setattr(rag, "retrieve_for_query", lambda *a, **kw: [])

    headers = _auth(client)
    resp = client.post(
        "/api/v1/chat/stream",
        json={"messages": [{"role": "user", "content": "hi"}], "top_k": 3},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.text
    assert "event: citations" in body
    assert '"delta": "Hello "' in body
    assert '"delta": "world"' in body
    assert "event: done" in body


def test_stream_errors_emit_error_event(client, monkeypatch):
    from app.services import ai_tasks, rag

    async def boom(messages, retrieval_block=""):
        raise RuntimeError("LLM exploded")
        yield  # unreachable; satisfies async-gen typing

    monkeypatch.setattr(ai_tasks, "chat_stream_with_rag", boom)
    monkeypatch.setattr(rag, "retrieve_for_query", lambda *a, **kw: [])

    headers = _auth(client, "err@err.com")
    resp = client.post(
        "/api/v1/chat/stream",
        json={"messages": [{"role": "user", "content": "x"}], "top_k": 3},
        headers=headers,
    )
    body = resp.text
    assert "event: error" in body
    assert "LLM exploded" in body
```

- [ ] **Step 5: Run**

```bash
cd backend && pytest tests/test_chat_stream.py -v
```

- [ ] **Step 6: Commit**

```bash
git add backend/requirements.txt backend/app/schemas/schemas.py backend/app/routers/chat.py backend/tests/test_chat_stream.py
git commit -m "feat(chat): SSE /stream with retrieval citations and persistence"
```

### Edge cases (Task 3)

- **`TestClient` collects all SSE events into `resp.text`** — useful for assertions, but real clients consume incrementally. Body is multipart-like with `event: …` lines separated by `\n\n`.
- **Provider stream errors mid-stream**: `yield error` then return. We do NOT persist a partial assistant message (avoids saving half-tokens). Mention this in code comment.
- **Empty `messages`**: `last_user` defaults to empty; no retrieval block; LLM gets only `[]`. Behaviour: model usually replies with "How can I help?". v1 acceptable.
- **`top_k` > 50**: cap silently to 50 in `retrieve_for_query`? v1: no cap, but server-side cap on `top_k` is in `SearchRequest` (P3). For chat we trust client; document a future hardening.
- **`document_id` for a doc owned by another user**: 404 (filter clause). No cross-tenant leak.
- **Persistence after partial token output but stream aborted**: client disconnect may cancel the generator. SSE Starlette catches `asyncio.CancelledError` → ChatHistory row never committed. Acceptable.

---

## Task 4: End-to-end SSE smoke

- [ ] **Step 1: Run compose**

```bash
docker compose up -d
```

- [ ] **Step 2: Stream a query**

```bash
TOKEN=...
curl -N -X POST http://localhost:8000/api/v1/chat/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"summarise"}],"top_k":3}'
```
Expected: live stream of `event: citations` then `event: token`s then `event: done`.

---

## Phase 5 verification checklist

- [ ] `pytest -q` green.
- [ ] `chat/stream` emits citations + tokens + done.
- [ ] `chat/complete` still works (back-compat).
- [ ] `chat/complete` and `chat/stream` both honour parse-status gate.
- [ ] Citations correctly reference `document_id` + `page`.

## Edge cases summary

1. **SSE proxy buffering**: nginx (the frontend container's proxy) may buffer SSE. Add to nginx.conf for `/api/v1/chat/stream`:
   ```
   proxy_buffering off;
   proxy_set_header Connection '';
   chunked_transfer_encoding off;
   ```
   Already needed for live streaming.
2. **Token-counting**: we do not enforce a max-tokens cap; relies on provider's `max_tokens`. Document `LLM_MAX_TOKENS` env if needed.
3. **Long contexts blow up provider**: 24k retrieval block + chat history is below Gemini 2.5 Flash's 1M-tok window but providers vary. Cap retrieval block via `format_retrieval_block(max_chars=…)`.
4. **No retrieval results**: stream proceeds with only `CHAT_SYSTEM_BASE` system prompt; LLM still answers from its training data. UI says "no sources cited".
5. **Citations are 1-indexed** to match `[n]` markers in the LLM output.
6. **Privacy**: retrieved chunks include `text`; we truncate to 300 chars before SSE. Reduces leakage if a UI logs SSE traffic.
