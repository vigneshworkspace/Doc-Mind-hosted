# Phase 11 — Verification & Acceptance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the full stack works end-to-end. Run the unit/integration tests, run docker-compose stack, walk through every screen and every button on the UI, capture screenshots, and write a brief release-readiness note in `docs/RELEASE_v1.md`.

**Depends on:** Phases 0–10 done.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `backend/tests/test_e2e_smoke.py` | create | Single-process smoke covering auth → upload → generate → chat |
| `docs/RELEASE_v1.md` | create | Acceptance notes + known issues |
| `frontend/screenshot.mjs` | modify | Update Playwright script to walk the 19 screens after login |

---

## Task 1: End-to-end backend smoke

**Files:**
- Create: `backend/tests/test_e2e_smoke.py`

- [ ] **Step 1: Write integration smoke that pretends-end-to-end via the autouse stub**

```python
import io
import pytest


def test_e2e_basic_flow(client):
    # Signup
    r = client.post("/api/v1/auth/signup", json={"name":"E","email":"e@e.com","password":"pw"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    # /me
    r = client.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 200 and r.json()["email"] == "e@e.com"

    # Upload (mock parse via autouse stub — _enqueue_parse no-ops)
    from unittest.mock import AsyncMock
    from app.routers import documents as docs_router
    docs_router._enqueue_parse = AsyncMock()
    r = client.post(
        "/api/v1/documents",
        files={"file": ("a.pdf", io.BytesIO(b"%PDF-1.4 hello"), "application/pdf")},
        headers=h,
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]

    # Mark doc as ready for downstream calls
    from app.models.orm import Document
    from app.db.session import SessionLocal
    db = SessionLocal()
    d = db.get(Document, doc_id)
    d.parse_status = "ready"
    d.parsed_md = "study content"
    db.commit(); db.close()

    # Generate quiz (autouse stub returns 5 fake questions)
    r = client.post("/api/v1/quizzes/generate", json={"document_id":doc_id,"count":3}, headers=h)
    assert r.status_code == 200 and len(r.json()["questions"]) == 3

    # Generate flashcards
    r = client.post("/api/v1/flashcards/generate", json={"document_id":doc_id}, headers=h)
    assert r.status_code == 200

    # Generate mindmap
    r = client.post("/api/v1/mindmaps/generate", json={"document_id":doc_id}, headers=h)
    assert r.status_code == 200

    # Generate quick revise
    r = client.post("/api/v1/quick-revise/generate", json={"document_id":doc_id}, headers=h)
    assert r.status_code == 200

    # Notes CRUD
    r = client.post("/api/v1/notes", json={"title":"n","content":"c","subject":"s"}, headers=h)
    nid = r.json()["id"]
    r = client.get("/api/v1/notes", headers=h)
    assert any(n["id"] == nid for n in r.json())
    r = client.patch(f"/api/v1/notes/{nid}", json={"title":"new"}, headers=h)
    assert r.json()["title"] == "new"
    r = client.delete(f"/api/v1/notes/{nid}", headers=h)
    assert r.status_code == 200

    # Settings round trip
    r = client.get("/api/v1/settings", headers=h)
    assert r.status_code == 200
    r = client.patch("/api/v1/settings", json={"language":"French"}, headers=h)
    assert r.json()["language"] == "French"

    # Chat (non-streaming) — autouse stub returns "stubbed reply"
    r = client.post("/api/v1/chat/complete", json={"messages":[{"role":"user","content":"hi"}]}, headers=h)
    assert r.status_code == 200 and r.json()["content"] == "stubbed reply"
```

- [ ] **Step 2: Run all tests**

```bash
cd backend && pytest -q
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/test_e2e_smoke.py
git commit -m "test(e2e): single-process smoke covering full happy path"
```

---

## Task 2: Docker-compose stack acceptance

This task is manual. Allocate ~30 minutes.

- [ ] **Step 1: Cold-start**

```bash
docker compose down -v   # WARNING: destroys all data
docker compose up -d --build
docker compose ps
```

Expected: `db`, `redis`, `backend`, `worker`, `frontend` all `healthy`.

- [ ] **Step 2: Open the app**

Visit `http://localhost`. The Auth screen loads, no console errors.

- [ ] **Step 3: Sign up**

Use any email + password. Land on Dashboard. Counters initially 0.

- [ ] **Step 4: Upload PDF**

Library → Upload → pick a small PDF (~10 pages). Card shows `pending` → `running` → `ready`. (Wait ~30s on CPU.)

- [ ] **Step 5: Generate Quiz**

Quiz → Source: just-uploaded doc → Generate. 3–5 questions render. Answer them. Submit. Score appears. Back to Dashboard. New quiz in History.

- [ ] **Step 6: Generate Flashcards**

Flashcards → Generate from doc → cards flip with Space.

- [ ] **Step 7: Generate Mind Map**

Mind Maps → Generate. Nodes render; drag pan works.

- [ ] **Step 8: Audio Recap**

Audio Recap → Generate. Loading spinner. After ~30s on CPU, audio file appears; Play streams it.

- [ ] **Step 9: Quick Revise**

Quick Revise → Generate. 5–7 key points render; Go deeper expands.

- [ ] **Step 10: AI Chat**

AI Chat → choose the doc → "summarise" → tokens stream; citations appear; doc-chip works.

- [ ] **Step 11: PDF Q&A**

PDF Q&A → ask "explain page 3" → answer streams; chips show page citations.

- [ ] **Step 12: Visual Doubts**

Visual Doubts → upload `3x+7=22.png` → steps + result render.

- [ ] **Step 13: Voice Chat**

Voice Chat → Start → grant mic → speak "explain entropy" → reply audio plays.

- [ ] **Step 14: YouTube**

YouTube → paste a captioned URL → Analyze → summary + chapter list appear.

- [ ] **Step 15: Notes**

Notes → + → write → blur saves → reload → still there.

- [ ] **Step 16: Groups**

Groups → New → fill → Create → appears in list. Join bumps member count.

- [ ] **Step 17: Pomodoro**

Pomodoro → Start. Top-bar mini appears. Pause / resume / reset work.

- [ ] **Step 18: Settings**

Settings → switch provider (gemini → groq if configured) → save → backend honours on next chat.

- [ ] **Step 19: History**

History shows quiz + flashcards + mindmap + audio recap + quick revise rows grouped by day.

- [ ] **Step 20: Dashboard**

Dashboard counters reflect everything generated. Library recent docs list works.

---

## Task 3: Playwright walk-through screenshots

**Files:** `frontend/screenshot.mjs`

- [ ] **Step 1: Rewrite to walk the 19 screens after authed bootstrap**

```js
import { chromium } from 'playwright';

const TABS = [
  'dashboard','documents','ai-chat','quiz-generator','flashcards','mind-map',
  'ai-diagram-maker','concept-visualizer','audio-recap','quick-revise',
  'pdf-qa','visual-ai','voice-chat','study-notes','study-groups','pomodoro',
  'history','settings','youtube',
];

const APP = process.env.APP_URL || 'http://localhost';
const EMAIL = process.env.E2E_EMAIL || `e2e+${Date.now()}@e2e.local`;
const PW = process.env.E2E_PW || 'e2e-pass-12345';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(APP);
// Signup
await page.click('text=Create an account');
await page.fill('input[autocomplete=name]', 'E2E');
await page.fill('input[type=email]', EMAIL);
await page.fill('input[type=password]', PW);
await page.click('button[type=submit]');
await page.waitForSelector('text=Dashboard', { timeout: 20000 });

for (const tab of TABS) {
  await page.evaluate((t) => {
    // Click a nav button by label or set via a global helper if exposed
    const buttons = [...document.querySelectorAll('.nav-item')];
    const target = buttons.find(b => b.querySelector('.nav-icon')?.parentElement?.dataset?.tab === t)
                || buttons[0];
    target?.click();
  }, tab);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `screenshots/${tab}.png`, fullPage: true });
}

await browser.close();
```

(Tab clicking is brittle; if your screens expose a `data-tab` attribute on `.nav-item`, this works. Otherwise add such an attribute in `Shell.jsx` `<button …>` for tests.)

- [ ] **Step 2: Run**

```bash
cd frontend && node screenshot.mjs
```

- [ ] **Step 3: Commit screenshots**

```bash
git add frontend/screenshots/*.png frontend/screenshot.mjs
git commit -m "test(ui): playwright captures all 19 screens after auth"
```

---

## Task 4: Release notes

**Files:**
- Create: `docs/RELEASE_v1.md`

- [ ] **Step 1: Write**

```markdown
# DocMind v1 Release Notes

**Date:** 2026-05-17

## What's in v1

- Multi-provider LLM (Gemini / OpenAI / Ollama / Groq / NVIDIA) via copied Lexi router.
- Real document upload with Docling parsing → Markdown + per-page text + status.
- pgvector-backed RAG with multimodal Nomic Embed (text + image, 768-d shared).
- Streaming chat with citations (SSE).
- Generators: quiz, flashcards, mind-map, audio-recap (with TTS via Kokoro), quick-revise.
- Visual Doubts (Docling OCR + LLM step-by-step solver).
- Voice chat (FastRTC + faster-whisper + Kokoro).
- YouTube ingestion via copied youtube_transcript module + LLM summary + chapters.
- Frontend: every button on every screen hits real backend (no mocks).
- Docker compose: db (pgvector), redis, backend, worker, frontend.

## Known issues / deferred

- No Google OAuth (v2)
- No refresh tokens; 7-day JWT (v2)
- No real-time job notifications (frontend polls status)
- Handwritten OCR via Docling/EasyOCR is best-effort
- yt-dlp fallback (no captions case) deferred to v2
- Single-tenant deployment; no per-user file quota
- No PDF/DOCX export of generated artefacts

## Operational tips

- First request to a worker downloads embedding + Kokoro models (~1GB). Pre-warm in image build for production.
- Set `GEMINI_API_KEYS` to a comma-separated list to enable key rotation under quota pressure.
- For GPU: set `WHISPER_DEVICE=cuda`, `WHISPER_COMPUTE=float16`, `EMBED_DEVICE=cuda`, build with CUDA-enabled base image.
- Backups: snapshot the `appdata` named docker volume (`/data` inside containers) + Postgres dump.
```

- [ ] **Step 2: Commit**

```bash
git add docs/RELEASE_v1.md
git commit -m "docs(release): v1 release notes"
```

---

## Phase 11 verification checklist

- [ ] `pytest -q` from `backend/` returns green (all tests across phases).
- [ ] `docker compose up --build -d` brings every service to `healthy`.
- [ ] Manual UI walk-through covers all 20 acceptance steps without errors.
- [ ] Screenshots committed.
- [ ] Release notes committed.

## Edge cases / fail recovery

1. **Backend won't start on cold compose**: check `docker compose logs backend` — most often missing env var (`GEMINI_API_KEYS`) or schema-import error. Schemas import bug was fixed in P0; re-verify.
2. **Worker stuck on first parse**: model download in progress; tail `worker` logs. Acceptable on first run.
3. **SSE chat hangs**: check nginx buffering settings (P5 + P10 task 10).
4. **WebRTC fails on remote LAN**: no TURN server configured. Document v2 TODO.
5. **Pgvector index build slow**: only at first re-embed of all docs. Acceptable.
6. **Kokoro 404 on model files**: GitHub release tag changed; update `kokoro_loader._ensure_model_files()` URLs.

---

## Self-review

Spec coverage:
- P0 fixes schema bug + adds infra (migration, storage, compose). ✓
- P1 copies LLM router, builds `ai_tasks`, swaps routers. ✓
- P2 Docling pipeline. ✓
- P3 pgvector + multimodal Nomic. ✓
- P4 generators on parsed text. ✓
- P5 streaming chat + RAG + citations. ✓
- P6 Kokoro TTS. ✓
- P7 FastRTC voice. ✓
- P8 Vision via Docling OCR. ✓
- P9 YT module copy + summary. ✓
- P10 every button → backend. ✓
- P11 verification. ✓

No placeholders remain. Function names checked: `chat_stream_with_rag`, `solve_visual_doubt`, `summarize_youtube`, `resolve_doc_text`, `synth_recap`, `embed_document`, `parse_document` — all used consistently.
