# DocMind — Feature Reality Audit

What actually works vs what's dummy, judged from source (not the UI).

## How to read this
- ✅ **Real** — wired to backend, does real work when services are up.
- ⚠️ **Partial** — core works, but parts are faked or a sub-feature is dead.
- ❌ **Dummy** — hardcoded / simulated / dead control; no real backend effect.

## Hard dependencies (if these are down, "real" features silently fall back to mock)
- **Postgres + pgvector** — all persistence + vector search.
- **Redis + ARQ worker** — document ingestion + audio recap jobs. **If worker is not running, uploads never parse** → `parsed_md` empty → PDF Q&A preview blank, generators get empty context.
- **Ollama** (`nomic-embed-text`) — embeddings. **If down, embeddings are zero-vectors** → RAG retrieval is useless (chat still works via small-doc stuffing / general mode).
- **Docling** — real PDF/DOCX parsing. If not installed, parser falls back to raw UTF-8 decode → binary PDFs become garbage text.
- **Gemini API key** — all generation. Without it, everything degrades to canned mock output.
- **faster-whisper + VibeVoice/Coqui TTS + torch** — voice. Heavy, usually not installed.

---

## I. STUDY

### Dashboard — ❌ mostly dummy
Almost everything is hardcoded decoration:
- Streak `12`, "best: 21", "Hours focused 14.2", weekday dots (`i <= 4`), "Page 4 of 12", "4 of 10 questions answered" — all literals.
- Activity heatmap mixes real `activityLog` with a deterministic random seed (`seed = (date*13+month*7)%5`) — fake density.
- "Editor's note" quote, "the fox suggests" tip — static strings.
- **Real bits:** Documents count, completed-quiz count, avg score (computed from state). The generator cards are just nav buttons.

### Library — ✅ real
Upload (multipart → disk → ARQ enqueue), list, delete, status-polling all wired. Falls back to mock list if backend down. Drag-to-upload claim in copy is **not implemented** (only the click picker works).

### AI Chat — ✅ real (one dead control)
Real SSE streaming to the RAG pipeline; document-context selector real; falls back to local `synthesizeFallback` on error. ❌ **Mic/voice button in the composer has no handler — dead.**

### YouTube — ⚠️ partial
Transcript fetch + LLM summary/chapters/key-points are **real** (youtube-transcript-api). ❌ But the "video" is a fake placeholder (play icon + video_id) — **no embedded player**; you can't actually watch. IP-blocking from cloud is a known failure mode.

---

## II. GENERATE

### Quizzes — ✅ real
Generate (LLM structured output) → take → score → save. Falls back to `SAMPLE_QUIZ_QUESTIONS`.

### Flashcards — ⚠️ partial
Generate + list + flip study = real. ❌ **SRS buttons (Again/Hard/Good/Easy) are dead** — no spaced-repetition logic, no handlers, no scheduling.

### Mind Maps — ✅ real
LLM generate + radial SVG layout + pan/zoom. Works.

### Diagrams — ✅ real
Prompt → LLM → Mermaid → render. ("Tree" style silently maps to flowchart.)

### Concepts — ✅ real
Concept → LLM → Mermaid + explanation. Works.

### Audio Recap — ⚠️ partial / ❌ no audio
The **script + summary generation is real** (6-step critique pipeline). ❌ **There is no actual audio.** The waveform is sine-generated bars, "playback" is a `setInterval` that steps the transcript at 3.5s/line. The recap is never sent to TTS, no audio file is produced or played. It's a text script with a fake player.

### Quick Revise — ✅ real
Generate key points + expand simple/detailed. Works.

---

## III. ASK

### PDF Q&A — ✅ real
Chat streaming + real extracted document text in the preview (fixed this session). Needs the ingest worker to have parsed the doc, else preview shows "still processing / no text".

### Visual Doubts — ✅ real
Image upload → Gemini vision → step-by-step solution. Works with a Gemini key.

### Voice — ⚠️ conditionally real (usually dummy in practice)
Full WS pipeline exists: PCM capture → faster-whisper STT → chat → VibeVoice/Coqui TTS → WAV playback. Real code, but depends on heavy local stack (torch, whisper, TTS). If not installed/running → connection error. **Works only on a fully provisioned host.**

---

## IV. WORKSPACE

### Notes — ✅ real
CRUD + autosave on blur + word count. Local fallback if API down.

### Groups — ⚠️ partial (data bug)
Create/list/join are real. ❌ **Field mismatch:** backend returns `members_count`, frontend reads `g.members` → after a real API load, member count and avatar stack render wrong/empty (works only on mock data). ❌ "View" button dead. Backend `leave` endpoint has no UI.

### Pomodoro — ✅ real
Pure-frontend timer (lives in App, ticks via interval, focus/break cycles). Works. No persistence across reload. ❌ settings gear button is dead.

### History — ✅ real-ish
Aggregates quizzes/cards/maps/recaps/revise from state; loads activity dates from API. As real as the underlying lists.

---

## Cross-cutting dead controls
- **Auth:** "Continue with Google" button, "Forgot?" link, "Remember me" checkbox — all dead/no-op.
- **Settings:** "Reset all data" (Danger) button is dead. Provider/language/toggles are real (optimistic + API). Default `ai_provider` in backend is `"anthropic"` but no Anthropic provider exists and the UI only offers Gemini/Ollama.
- **Sidebar:** "12-day streak" hardcoded.
- **AI Chat / composer:** mic button dead.
- **Flashcards:** SRS rating buttons dead.

## One-line verdict
Generation + Q&A + RAG chat + library/notes are **genuinely wired** (given the services). The **Dashboard is largely a mockup**, **Audio Recap has no real audio**, **YouTube can't actually play video**, **Voice needs a heavy unprovisioned stack**, and a scatter of buttons (Google auth, SRS, reset, group view, recap/pomodoro extras) are **decorative dead-ends**. The biggest silent trap: with **no ARQ worker / no Ollama**, the app looks alive (mock fallbacks) while doing no real AI.
