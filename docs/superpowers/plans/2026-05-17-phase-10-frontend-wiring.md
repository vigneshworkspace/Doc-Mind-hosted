# Phase 10 — Frontend Wiring (every button hits backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every mock-state dispatch in the frontend with a real fetch against `src/api/*`. Auth stores a JWT in `localStorage`, attaches it to every request, refreshes user state from `/auth/me` on boot. All 19 screens load from the backend; every button does something real.

**Architecture:** A `useApi()` hook returns the typed `api` object plus an `authFetch` wrapper that injects `Authorization: Bearer <token>`. Each screen swaps its mock dispatches for `useEffect`-driven loaders + `useState` for the fetched data. `AppContext` keeps only ephemeral UI state (tab, palette open, etc.); persistent data lives in per-screen state or a thin React-Query cache. (v1 uses plain `useState` + `useEffect`; React-Query is a v2 polish.)

**Tech Stack:** React 18, native `fetch`, EventSource (SSE), simple-peer / browser RTCPeerConnection for FastRTC. No new deps unless needed.

**Depends on:** P1–P9. **Blocks:** P11 verification.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `frontend/src/api/client.js` | modify | Add token storage + `Authorization` header, unify multipart helper |
| `frontend/src/api/index.js` | modify | Add new endpoints: documents.status, documents.pages, search.text, search.image, chat.stream (SSE), vision.solve, yt.ingest, audio.audio_url, audio.status, voice.url |
| `frontend/src/api/auth.js` | create | Token storage helpers (`getToken`, `setToken`, `clearToken`) |
| `frontend/src/hooks/useApi.js` | create | Returns `api` with token already injected |
| `frontend/src/hooks/useDocumentParse.js` | create | Hook polling `/documents/{id}/status` |
| `frontend/src/components/Auth.jsx` | modify | Real signup/login + token store |
| `frontend/src/App.jsx` | modify | Auth bootstrap (read token → /me), pass `authed=true` |
| `frontend/src/screens/Library.jsx` | modify | Real upload (FormData), real list, real delete, parse-status pill |
| `frontend/src/screens/Quiz.jsx` | modify | `quizzes.generate` + `quizzes.save`; show parse-not-ready warning |
| `frontend/src/screens/Flashcards.jsx` | modify | `flashcards.list/generate` |
| `frontend/src/screens/MindMap.jsx` | modify | `mindMaps.list/generate` |
| `frontend/src/screens/DiagramMaker.jsx` | modify | Adopt mermaid: server-driven LLM mermaid generation via new endpoint OR keep local — v1 stays local with comment |
| `frontend/src/screens/ConceptVisualizer.jsx` | KEEP | Local-only visualisation; no backend |
| `frontend/src/screens/AudioRecap.jsx` | modify | `audioRecaps.list/generate` + audio player from `/audio` URL |
| `frontend/src/screens/QuickRevise.jsx` | modify | `quickRevise.list/generate` |
| `frontend/src/screens/PdfQA.jsx` | modify | `chat.stream` SSE; show pages from `/documents/{id}/pages` |
| `frontend/src/screens/AIChat.jsx` | modify | `chat.stream` SSE (replace `window.claude.complete`) |
| `frontend/src/screens/VoiceChat.jsx` | modify | Connect to FastRTC stream |
| `frontend/src/screens/VisualAI.jsx` | modify | Real upload to `/vision/solve` |
| `frontend/src/screens/YouTube.jsx` | modify | `yt.ingest`, list, fetch summary + chapters |
| `frontend/src/screens/Notes.jsx` | modify | `notes.list/create/update/delete` |
| `frontend/src/screens/Groups.jsx` | modify | `groups.list/create/join` |
| `frontend/src/screens/Settings.jsx` | modify | `settings.get/update`, `/me` for name/email |
| `frontend/src/screens/History.jsx` | modify | `history.list` |
| `frontend/src/screens/Pomodoro.jsx` | KEEP | Local state only |
| `frontend/src/screens/Dashboard.jsx` | modify | Aggregate counters from `documents.list`, `quizzes.list`, etc. |
| `frontend/src/data/index.js` | DEPRECATE in screens but keep for type shape constants | |
| `frontend/index.html` | KEEP | no changes |
| `frontend/vite.config.js` | modify | extend proxy: `/api`, `/api/v1/voice` (FastRTC websocket) |

---

## Task 1: Token plumbing

**Files:**
- Create: `frontend/src/api/auth.js`
- Modify: `frontend/src/api/client.js`

- [ ] **Step 1: Token storage**

```js
// frontend/src/api/auth.js
const KEY = 'docmind.jwt';

export function getToken() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {}
}

export function clearToken() { setToken(null); }
```

- [ ] **Step 2: Inject Authorization in client.js**

```js
// frontend/src/api/client.js
import { getToken, clearToken } from './auth.js';

const BASE = '/api/v1';

async function request(method, path, body, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('docmind:unauthorized'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function uploadForm(path, formData) {
  const headers = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b) => request('POST', p, b),
  patch: (p, b) => request('PATCH', p, b),
  delete: (p) => request('DELETE', p),
  upload: (p, fd) => uploadForm(p, fd),
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/auth.js frontend/src/api/client.js
git commit -m "feat(api): JWT in localStorage + Authorization injection + 401 dispatch"
```

---

## Task 2: Endpoint definitions

**Files:** `frontend/src/api/index.js`

- [ ] **Step 1: Replace contents**

```js
import { api } from './client.js';
import { setToken, clearToken, getToken } from './auth.js';

export const auth = {
  login: async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    setToken(r.access_token); return r;
  },
  signup: async (name, email, password) => {
    const r = await api.post('/auth/signup', { name, email, password });
    setToken(r.access_token); return r;
  },
  logout: () => { clearToken(); return api.post('/auth/logout'); },
  me: () => api.get('/auth/me'),
  isAuthed: () => Boolean(getToken()),
};

export const documents = {
  list: () => api.get('/documents'),
  get: (id) => api.get(`/documents/${id}`),
  status: (id) => api.get(`/documents/${id}/status`),
  pages: (id) => api.get(`/documents/${id}/pages`),
  upload: (file) => {
    const fd = new FormData(); fd.append('file', file);
    return api.upload('/documents', fd);
  },
  delete: (id) => api.delete(`/documents/${id}`),
};

export const quizzes = {
  list: () => api.get('/quizzes'),
  get: (id) => api.get(`/quizzes/${id}`),
  generate: (docId, count = 5, difficulty = 'medium', pageRange = null) =>
    api.post('/quizzes/generate', { document_id: docId, count, difficulty, page_range: pageRange }),
  save: (quiz) => api.post('/quizzes', quiz),
  delete: (id) => api.delete(`/quizzes/${id}`),
};

export const flashcards = {
  list: () => api.get('/flashcards'),
  generate: (docId, count = 12, pageRange = null) =>
    api.post('/flashcards/generate', { document_id: docId, count, page_range: pageRange }),
  delete: (id) => api.delete(`/flashcards/${id}`),
};

export const mindMaps = {
  list: () => api.get('/mindmaps'),
  generate: (docId, pageRange = null) => api.post('/mindmaps/generate', { document_id: docId, page_range: pageRange }),
  delete: (id) => api.delete(`/mindmaps/${id}`),
};

export const audioRecaps = {
  list: () => api.get('/audio-recaps'),
  generate: (docId, pageRange = null) => api.post('/audio-recaps/generate', { document_id: docId, page_range: pageRange }),
  status: (id) => api.get(`/audio-recaps/${id}/status`),
  audioUrl: (id) => `/api/v1/audio-recaps/${id}/audio`,
  delete: (id) => api.delete(`/audio-recaps/${id}`),
};

export const quickRevise = {
  list: () => api.get('/quick-revise'),
  generate: (docId, pageRange = null) => api.post('/quick-revise/generate', { document_id: docId, page_range: pageRange }),
  delete: (id) => api.delete(`/quick-revise/${id}`),
};

export const chat = {
  complete: (messages, documentId = null) =>
    api.post('/chat/complete', { messages, document_id: documentId }),
  stream: (messages, documentId = null, topK = 6, onEvent) => {
    // Opens an SSE-via-fetch reader (EventSource doesn't support POST in browsers)
    return streamSSE('/chat/stream', { messages, document_id: documentId, top_k: topK }, onEvent);
  },
  history: () => api.get('/chat/history'),
};

export const notes = {
  list: () => api.get('/notes'),
  get: (id) => api.get(`/notes/${id}`),
  create: (note) => api.post('/notes', note),
  update: (id, patch) => api.patch(`/notes/${id}`, patch),
  delete: (id) => api.delete(`/notes/${id}`),
};

export const groups = {
  list: () => api.get('/groups'),
  create: (group) => api.post('/groups', group),
  join: (id) => api.post(`/groups/${id}/join`),
  leave: (id) => api.post(`/groups/${id}/leave`),
  delete: (id) => api.delete(`/groups/${id}`),
};

export const settings = {
  get: () => api.get('/settings'),
  update: (patch) => api.patch('/settings', patch),
};

export const history = {
  list: () => api.get('/history'),
  log: () => api.post('/history'),
};

export const search = {
  text: (query, documentId = null, topK = 6) =>
    api.post('/search/text', { query, document_id: documentId, top_k: topK }),
  image: (file, documentId = null, topK = 6) => {
    const fd = new FormData(); fd.append('file', file);
    if (documentId) fd.append('document_id', documentId);
    fd.append('top_k', topK);
    return api.upload('/search/image', fd);
  },
};

export const vision = {
  solve: (file) => { const fd = new FormData(); fd.append('file', file); return api.upload('/vision/solve', fd); },
  list: () => api.get('/vision'),
  get: (id) => api.get(`/vision/${id}`),
};

export const yt = {
  ingest: (url, languages = ['en']) => api.post('/yt/ingest', { url, languages }),
  list: () => api.get('/yt'),
  get: (id) => api.get(`/yt/${id}`),
  delete: (id) => api.delete(`/yt/${id}`),
};

export const voice = {
  // FastRTC stream URL: front-end uses Stream client lib or raw RTCPeerConnection
  baseUrl: '/api/v1/voice',
};


// ── SSE helper for POST-based streams ────────────────────────────
async function streamSSE(path, body, onEvent) {
  const token = getToken();
  const res = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const detail = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(detail.detail || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const ev = parseSSEBlock(raw);
      if (ev) onEvent(ev);
    }
  }
}

function parseSSEBlock(raw) {
  const lines = raw.split('\n');
  let event = 'message';
  let data = '';
  for (const line of lines) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) data += line.slice(6);
  }
  if (!event) return null;
  let parsed = data;
  try { parsed = data ? JSON.parse(data) : null; } catch {}
  return { event, data: parsed };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/index.js
git commit -m "feat(api): full DocMind API surface incl. SSE chat stream + uploads"
```

---

## Task 3: Auth screen + App boot

**Files:**
- Modify: `frontend/src/components/Auth.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Auth screen**

Replace `submit` logic. Imports:

```js
import { auth } from '../api/index.js';
```

Function `submit`:

```js
async function submit(e) {
  e.preventDefault();
  setError(null);
  try {
    if (mode === 'login') {
      await auth.login(form.email, form.password);
    } else {
      await auth.signup(form.name, form.email, form.password);
    }
    const me = await auth.me();
    onAuth(me);
  } catch (err) {
    setError(err.message || 'Authentication failed');
    setShake(true); setTimeout(() => setShake(false), 400);
  }
}
```

Render `error` below the password field:

```jsx
{error && <div style={{color:'var(--danger)',fontSize:12}}>{error}</div>}
```

Reset password placeholder default from `"••••••••"` to `""` so the user actually types.

- [ ] **Step 2: App bootstrap**

In `frontend/src/App.jsx`, modify the top of the component:

```jsx
import { useState, useEffect, useReducer, useCallback } from 'react';
import { auth } from './api/index.js';

// inside App():
const [loggedIn, setLoggedIn] = useState(false);
const [authChecked, setAuthChecked] = useState(false);
// ...

useEffect(() => {
  let mounted = true;
  (async () => {
    if (auth.isAuthed()) {
      try {
        const me = await auth.me();
        if (!mounted) return;
        dispatch({ type: 'set-user', patch: me });
        setLoggedIn(true);
      } catch {
        setLoggedIn(false);
      }
    }
    setAuthChecked(true);
  })();
  function onUnauth() { setLoggedIn(false); }
  window.addEventListener('docmind:unauthorized', onUnauth);
  return () => { mounted = false; window.removeEventListener('docmind:unauthorized', onUnauth); };
}, []);

if (!authChecked) return null; // or splash
```

Pass `setLoggedIn` into both Auth screen + Logout. Logout button calls `auth.logout()` then `setLoggedIn(false)`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Auth.jsx frontend/src/App.jsx
git commit -m "feat(auth): real signup/login + token bootstrap + 401 logout dispatch"
```

---

## Task 4: Library screen — real upload + parse status polling

**Files:**
- Modify: `frontend/src/screens/Library.jsx`
- Create: `frontend/src/hooks/useDocumentParse.js`

- [ ] **Step 1: Polling hook**

```js
import { useEffect, useState, useRef } from 'react';
import { documents } from '../api/index.js';

export default function useDocumentParse(docs, intervalMs = 2000) {
  const [statuses, setStatuses] = useState({});
  const docsRef = useRef(docs);
  docsRef.current = docs;

  useEffect(() => {
    const id = setInterval(async () => {
      const inflight = docsRef.current.filter(d => ['pending', 'running'].includes(d.parse_status));
      if (!inflight.length) return;
      const results = await Promise.allSettled(inflight.map(d => documents.status(d.id)));
      const patch = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') patch[inflight[i].id] = r.value;
      });
      setStatuses(s => ({ ...s, ...patch }));
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return statuses;
}
```

- [ ] **Step 2: Library screen — replace mock dispatches**

Top of file:

```jsx
import { useState, useEffect } from 'react';
import { documents as docsApi } from '../api/index.js';
import useDocumentParse from '../hooks/useDocumentParse.js';
```

Replace `state.documents` reads with local fetched state:

```jsx
const [docs, setDocs] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let mounted = true;
  setLoading(true);
  docsApi.list().then(d => { if (mounted) setDocs(d); }).catch(e => setError(e.message)).finally(() => setLoading(false));
  return () => { mounted = false; };
}, []);

const liveStatuses = useDocumentParse(docs);

const dispDocs = docs.map(d => ({ ...d, parse_status: liveStatuses[d.id]?.parse_status || d.parse_status }));
```

Replace `addSample` (random mock) with real upload:

```jsx
const fileInputRef = useRef(null);

async function onUpload(file) {
  try {
    const created = await docsApi.upload(file);
    setDocs(prev => [created, ...prev]);
  } catch (e) {
    setError(e.message);
  }
}
```

JSX file input:

```jsx
<input
  ref={fileInputRef}
  type="file"
  accept=".pdf,.docx,.pptx,.txt,.md,.html,.png,.jpg,.jpeg"
  style={{display:'none'}}
  onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value=''; }}
/>
<button className="btn is-accent" onClick={() => fileInputRef.current?.click()}>
  <Icon name="upload" size={14} /> Upload
</button>
```

Replace the "Upload" dashed-tile click with the same `fileInputRef.current?.click()`.

Show parse status pill on each card:

```jsx
<span className={`chip ${d.parse_status === 'ready' ? '' : d.parse_status === 'failed' ? 'is-danger' : 'is-accent'}`}>
  {d.parse_status}
</span>
```

Delete button per card:

```jsx
async function onDelete(id) {
  try { await docsApi.delete(id); setDocs(prev => prev.filter(d => d.id !== id)); } catch (e) { setError(e.message); }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useDocumentParse.js frontend/src/screens/Library.jsx
git commit -m "feat(library): real upload with parse-status pill + polling + delete"
```

---

## Task 5: Quiz, Flashcards, MindMap, AudioRecap, QuickRevise

Each screen follows the same shape: replace `state.quizzes` etc. with `useState` fetched from `<api>.list()`; replace `dispatch({type:'add-quiz', ...})` with `<api>.generate(...)` then `<api>.save(...)`. Add parse-status guard via `documents.get` if needed.

### 5a — Quiz

Replace `startQuiz`:

```jsx
const [generating, setGenerating] = useState(false);
const [errMsg, setErrMsg] = useState(null);

async function startQuiz() {
  setGenerating(true); setErrMsg(null);
  try {
    const transient = await quizzes.generate(config.docId || null, config.count, config.difficulty);
    setQuestions(transient.questions);
    setIdx(0); setAnswers({}); setMode('taking');
  } catch (e) {
    setErrMsg(e.message);
  } finally { setGenerating(false); }
}
```

Replace `finish`:

```jsx
async function finish() {
  const correct = questions.filter((q, i) => answers[i] === q.correct_answer).length;
  const score = Math.round((correct / questions.length) * 100);
  await quizzes.save({
    title: `Practice — ${new Date().toLocaleDateString()}`,
    questions, completed: true, score
  });
  setMode('result');
}
```

Imports: `import { quizzes } from '../api/index.js';`.

Field rename: backend uses snake_case `question_text`, `correct_answer`. Update all `q.questionText` → `q.question_text` and `q.correctAnswer` → `q.correct_answer`.

Show error toast/inline if `errMsg`.

Commit per screen:

```bash
git add frontend/src/screens/Quiz.jsx
git commit -m "feat(quiz): generate/save via API; snake_case field names; error surface"
```

### 5b–5e — Flashcards, MindMap, AudioRecap, QuickRevise

Same pattern. AudioRecap additionally:

- After `generate`, poll `audioRecaps.status(id)` every 2s.
- `<audio src={audioRecaps.audioUrl(active.id)} controls />` when `tts_status === 'ready'`.
- Show "Synthesising audio…" placeholder while pending.

MindMap: backend returns `result.root` whose shape matches the existing `layoutMindmap` function. Update select-on-list to fetch from `mindMaps.list()` and call `generate(docId)` from a header button.

QuickRevise: same fetch + render pattern; field rename `keyPoint` → `key_point`, `simplifiedExplanation` → `simplified_explanation`, `detailedExplanation` → `detailed_explanation`.

Commit each.

---

## Task 6: AIChat (SSE) + PdfQA (SSE)

**Files:** `frontend/src/screens/AIChat.jsx`, `frontend/src/screens/PdfQA.jsx`

- [ ] **Step 1: AIChat** — replace `send`:

```jsx
import { chat } from '../api/index.js';

async function send(text) {
  const t = (text ?? input).trim();
  if (!t || thinking) return;
  const now = Date.now();
  setMessages(m => [...m, { id: now, sender: 'user', text: t, ts: now }]);
  setInput(''); setThinking(true);

  const aiId = Date.now() + 1;
  let buffer = '';
  setMessages(m => [...m, { id: aiId, sender: 'ai', text: '', ts: aiId, citations: [] }]);

  try {
    await chat.stream(
      [...messages.filter(m => m.sender !== 'ai-greeting').map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text })),
       { role: 'user', content: t }],
      ctxDoc || null,
      6,
      ({ event, data }) => {
        if (event === 'citations') {
          setMessages(m => m.map(msg => msg.id === aiId ? { ...msg, citations: data } : msg));
        } else if (event === 'token' && data?.delta) {
          buffer += data.delta;
          setMessages(m => m.map(msg => msg.id === aiId ? { ...msg, text: buffer } : msg));
        } else if (event === 'error') {
          setMessages(m => m.map(msg => msg.id === aiId ? { ...msg, text: `⚠ ${data?.detail || 'error'}` } : msg));
        }
      }
    );
  } finally {
    setThinking(false);
  }
}
```

Render `msg.citations` as chips beneath assistant messages.

- [ ] **Step 2: PdfQA** — same SSE plumbing; `documentId` is `doc.id`; render citations under bubble using existing `<span className="chip is-accent">{c.text.slice(0,80)}</span>`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/screens/AIChat.jsx frontend/src/screens/PdfQA.jsx
git commit -m "feat(chat): SSE streaming via chat.stream with citations rendering"
```

---

## Task 7: VisualAI + YouTube + VoiceChat

**Files:** `frontend/src/screens/VisualAI.jsx`, `frontend/src/screens/YouTube.jsx`, `frontend/src/screens/VoiceChat.jsx`

- [ ] **Step 1: VisualAI**

```jsx
import { vision } from '../api/index.js';
const fileRef = useRef(null);
async function onUpload(file) {
  setLoading(true); setHasImage(true); setAnswer(null);
  try {
    const out = await vision.solve(file);
    setAnswer({ problem: out.problem, steps: out.steps.map(s => s.text), result: out.result });
  } catch (e) { setAnswer({ error: e.message }); } finally { setLoading(false); }
}
```

Replace `simulateUpload` button with `<input type="file" accept="image/*" ...>`.

- [ ] **Step 2: YouTube**

```jsx
import { yt } from '../api/index.js';

async function analyze() {
  if (!url) return;
  setLoading(true);
  try {
    const v = await yt.ingest(url, ['en']);
    setActive(v); setUrl('');
  } catch (e) { setError(e.message); } finally { setLoading(false); }
}
```

Render `active.summary` and `active.chapters`.

- [ ] **Step 3: VoiceChat — FastRTC client**

Install client library — FastRTC ships a JS helper, OR use raw RTCPeerConnection. Simplest for v1:

```jsx
import { voice } from '../api/index.js';
import { useEffect, useRef, useState } from 'react';

export default function VoiceChat() {
  const [status, setStatus] = useState('idle');
  const pcRef = useRef(null);

  async function start() {
    setStatus('connecting');
    const pc = new RTCPeerConnection();
    pcRef.current = pc;

    pc.ontrack = (e) => {
      const audio = new Audio();
      audio.srcObject = e.streams[0];
      audio.play();
    };

    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getAudioTracks().forEach(t => pc.addTrack(t, mic));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const resp = await fetch(`${voice.baseUrl}/webrtc/offer`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
    });
    const answer = await resp.json();
    await pc.setRemoteDescription(answer);
    setStatus('connected');
  }

  function stop() {
    pcRef.current?.close();
    pcRef.current = null;
    setStatus('idle');
  }

  useEffect(() => () => pcRef.current?.close(), []);

  return (
    <div className="col" style={{gap:24, alignItems:'center', padding:40}}>
      <div className="t-eyebrow">{status}</div>
      <button className="btn is-accent" onClick={status === 'idle' ? start : stop}>
        {status === 'idle' ? 'Start' : 'Stop'}
      </button>
    </div>
  );
}
```

Note: the endpoint `/api/v1/voice/webrtc/offer` is what FastRTC's `Stream.mount(app, path=...)` exposes. If FastRTC names the route differently (e.g. `/offer`), adjust.

- [ ] **Step 4: Commit per screen.**

---

## Task 8: Notes, Groups, Settings, History, Dashboard

### Notes

```jsx
import { notes as notesApi } from '../api/index.js';

useEffect(() => { notesApi.list().then(setNotes); }, []);
async function add() {
  const n = await notesApi.create({ title:'Untitled', content:'', subject:'General' });
  setNotes(prev => [n, ...prev]); setActiveId(n.id);
}
async function save() {
  if (!note) return;
  await notesApi.update(note.id, { title, content });
}
```

### Groups

```jsx
import { groups as groupsApi } from '../api/index.js';

useEffect(() => { groupsApi.list().then(setGroups); }, []);
async function create() {
  const g = await groupsApi.create(draft);
  setGroups(prev => [g, ...prev]); setCreating(false);
}
async function join(id) { await groupsApi.join(id); setGroups(prev => prev.map(g => g.id === id ? { ...g, members_count: g.members_count + 1 } : g)); }
```

Wire View (none v1) and Join.

### Settings

```jsx
import { settings as settingsApi, auth } from '../api/index.js';

useEffect(() => { settingsApi.get().then(setSettings); auth.me().then(setUser); }, []);
async function update(k, v) {
  const next = await settingsApi.update({ [k]: v });
  setSettings(next);
}
async function updateName(name) {
  // Not yet in backend — placeholder for v2. For now keep mock dispatch.
}
```

Note: user name/email PATCH isn't in v1 backend; document as v2. Disable those inputs and label them "v2".

Wire **Reset** button to call (new): `POST /api/v1/settings/reset` — out of v1 scope; remove button or label as "coming soon".

### History

```jsx
import { quizzes, flashcards, mindMaps, audioRecaps, quickRevise } from '../api/index.js';

useEffect(() => {
  Promise.all([
    quizzes.list(), flashcards.list(), mindMaps.list(), audioRecaps.list(), quickRevise.list()
  ]).then(([q, f, m, a, r]) => {
    setEvents([
      ...q.map(x => ({kind:'quiz-generator',id:x.id,title:x.title,date:x.date,meta:x.completed?`${x.score}%`:'in progress'})),
      ...f.map(x => ({kind:'flashcards',id:x.id,title:x.title,date:x.date,meta:`${x.cards?.length || 0} cards`})),
      ...m.map(x => ({kind:'mind-map',id:x.id,title:x.title,date:x.date,meta:'mind map'})),
      ...a.map(x => ({kind:'audio-recap',id:x.id,title:x.title,date:x.date,meta:'audio recap'})),
      ...r.map(x => ({kind:'quick-revise',id:x.id,title:x.title,date:x.date,meta:'quick revise'})),
    ].sort((a,b)=>b.date?.localeCompare(a.date)));
  });
}, []);
```

### Dashboard

Add useEffect that fetches counts:

```jsx
const [docCount, setDocCount] = useState(0);
const [quizDone, setQuizDone] = useState(0);
const [avgScore, setAvgScore] = useState(0);

useEffect(() => {
  Promise.all([documentsApi.list(), quizzesApi.list()]).then(([d, q]) => {
    setDocCount(d.length);
    const completed = q.filter(x => x.completed);
    setQuizDone(completed.length);
    setAvgScore(completed.length ? Math.round(completed.reduce((a,x)=>a+(x.score||0),0)/completed.length) : 0);
  });
}, []);
```

Replace metric strip values with these. Keep streak/hours as static placeholders v1.

Commit each screen separately.

---

## Task 9: Dead buttons cleanup

For each button identified in the audit that previously had no handler, either:

- Wire it to a backend call (preferred).
- Or, hide it / label "v2" if backend support deferred.

| Button | Decision | Action |
|---|---|---|
| "Forgot?" link in Auth | Hide v1 | Comment out the link |
| "Continue with Google" | Hide v1 | Comment out |
| MindMap "Generate" button | Wire | `await mindMaps.generate(activeDoc.id)` then push into list |
| Diagram "Copy SVG"/"Export" | Wire | Copy SVG: `navigator.clipboard.writeText(serializer.serializeToString(svgEl))` — local |
| Diagram Style/Direction selectors | Hide v1 | Leave decorative |
| Audio "New recap" | Wire | scroll to generator dropdown |
| Groups "View" | Hide v1 | Comment out |
| Pomodoro settings cog | Hide v1 | Comment out |
| Settings "Reset" | Hide v1 | Hide |
| Voice button in chat composer | Wire | `setTab('voice-chat')` |

Per change, commit per file.

---

## Task 10: Vite proxy + Dockerfile

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/nginx.conf` to disable buffering for `/api/v1/chat/stream` and `/api/v1/voice`.

- [ ] **Step 1: vite.config.js**

```js
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
```

- [ ] **Step 2: nginx.conf** add inside `location /api/`:

```
proxy_buffering off;
proxy_set_header Connection '';
chunked_transfer_encoding off;
proxy_read_timeout 3600;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/vite.config.js frontend/nginx.conf
git commit -m "chore(proxy): disable buffering for streaming endpoints"
```

---

## Phase 10 verification checklist

- [ ] Login/signup creates a JWT; refresh of the browser stays logged in.
- [ ] Logout clears token; subsequent API calls 401 → auto-logout.
- [ ] Upload a PDF; status badge transitions pending → running → ready.
- [ ] Generate Quiz: 3 questions render; finish + Back to Dashboard works; the new quiz appears in History.
- [ ] Flashcards generate set; cards flip.
- [ ] Mind map generates from a doc; nodes render.
- [ ] Audio recap generates; audio plays in browser.
- [ ] Quick revise generates; Go deeper expands.
- [ ] AI Chat streams tokens with citations.
- [ ] PDF Q&A streams answer + page citations.
- [ ] Visual Doubts uploads PNG; steps + result render.
- [ ] Voice chat: speak → reply audio heard back.
- [ ] YouTube ingest captioned video; summary + chapters appear.
- [ ] Notes CRUD persists; navigating away + back keeps state.
- [ ] Groups create + join updates count.
- [ ] Settings provider switch persists.
- [ ] Pomodoro count + state local-only — still works.

## Edge cases summary

1. **Network failure mid-stream**: SSE reader throws; UI shows `⚠ error`; user can retry.
2. **401 mid-session**: any API call clears token + dispatches `docmind:unauthorized`; App re-renders login.
3. **File >50MB**: backend rejects 400 with `file too large`; UI surfaces.
4. **Slow Docling**: status pill stays `running`; "Generate" buttons disabled until `ready`.
5. **Vite proxy + SSE**: dev requires `proxy_buffering off`; production via nginx already configured.
6. **CORS**: backend `CORS_ORIGINS` already includes `http://localhost:5173` and `http://localhost`.
7. **WebRTC ICE on different host**: works on localhost; for remote, configure a TURN server in FastRTC (out of v1).
8. **LocalStorage in private mode**: graceful degradation — token not persisted, user re-logs each tab.
9. **Renaming legacy mock fields**: search for `questionText`, `correctAnswer`, `sourceDocumentId`, `keyPoint`, `simplifiedExplanation`, `detailedExplanation` across screens and rename to snake_case.
10. **Logout button is the user avatar in TopBar**: change `onClick={onLogout}` to call `auth.logout().finally(...)` then `setLoggedIn(false)`.
