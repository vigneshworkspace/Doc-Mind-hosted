import { api, getToken } from './client.js';

// ── Normalization ────────────────────────────────────────────────────────────
// The backend speaks snake_case; the UI speaks camelCase. `normalize` is the ONE
// deep helper that converts every object key snake_case -> camelCase on the way
// in. It recurses through arrays and nested objects and is idempotent (keys that
// are already camelCase pass through untouched), so per-endpoint normalizers can
// safely run on top of it.
//
// Explicit boundary gaps this guarantees are fixed (snake -> camel):
//   ai_provider  -> aiProvider
//   auto_save    -> autoSave
//   upload_date  -> uploadDate
//   is_demo      -> isDemo      (honesty contract: demo-data marker)
const _snakeToCamel = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

export function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object' && value.constructor === Object) {
    const out = {};
    for (const key of Object.keys(value)) {
      out[_snakeToCamel(key)] = normalize(value[key]);
    }
    return out;
  }
  return value; // primitives, Dates, null, etc. pass through unchanged
}

// Auth
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }).then(normalize),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }).then(normalize),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me').then(normalize),
};

// Documents
export const documents = {
  list: () => api.get('/documents').then(normalize),
  get: (id) => api.get(`/documents/${id}`).then(normalize),
  // Lightweight status poll — GET /documents/:id/status returns { id, status }
  status: (id) => api.get(`/documents/${id}/status`).then(normalize),
  upload: (formData) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch('/api/v1/documents', {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ detail: r.statusText }));
        throw new Error(err.detail || `HTTP ${r.status}`);
      }
      return r.json();
    }).then(normalize);
  },
  delete: (id) => api.delete(`/documents/${id}`),
  // Fetch the ORIGINAL uploaded file as a Blob (for the in-app PDF viewer).
  // Sent with the Bearer header like every other call — PDF.js consumes the
  // bytes directly, so we never put the token in a URL/query param. Returns
  // { blob, type } so the caller can branch on application/pdf vs. other.
  file: async (id) => {
    const token = getToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const r = await fetch(`/api/v1/documents/${id}/file`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ detail: r.statusText }));
      throw new Error(err.detail || `HTTP ${r.status}`);
    }
    const blob = await r.blob();
    return { blob, type: blob.type || r.headers.get('Content-Type') || '' };
  },
};

// Quizzes
// `normalize` already converts question_text -> questionText, correct_answer ->
// correctAnswer, is_demo -> isDemo, etc. _normQuiz only fills defaults so the UI
// never renders blanks. _denormQuestion de-camelizes on save for the backend.
const _normQuestion = (q) => ({
  ...q,
  questionText: q.questionText ?? '',
  options: q.options ?? [],
  correctAnswer: q.correctAnswer ?? '',
  explanation: q.explanation ?? '',
});
const _normQuiz = (z) => (z ? { ...z, questions: (z.questions || []).map(_normQuestion) } : z);
const _denormQuestion = (q) => ({
  question_text: q.questionText ?? q.question_text ?? '',
  options: q.options ?? [],
  correct_answer: q.correctAnswer ?? q.correct_answer ?? '',
  explanation: q.explanation ?? '',
});
export const quizzes = {
  list: () => api.get('/quizzes').then(normalize).then((a) => (a || []).map(_normQuiz)),
  // opts: { count, difficulty, adaptive? }. Adaptive quizzes tune difficulty to
  // the learner's prior scores server-side; the flag is forwarded as adaptive.
  generate: (docId, { count, difficulty, adaptive = false } = {}) =>
    api.post('/quizzes/generate', { document_id: docId, count, difficulty, adaptive })
      .then(normalize)
      .then(_normQuiz),
  save: (quiz) => api.post('/quizzes', { ...quiz, questions: (quiz.questions || []).map(_denormQuestion) }).then(normalize),
};

// Flashcards
export const flashcards = {
  list: () => api.get('/flashcards').then(normalize),
  generate: (docId) => api.post('/flashcards/generate', { document_id: docId }).then(normalize),
  save: (set) => api.post('/flashcards', set).then(normalize),
  // Persist a spaced-repetition rating for a single card. grade is the review
  // quality (e.g. 0-5 SM-2 scale or 'again'|'hard'|'good'|'easy' — backend maps).
  // PATH GUESS: POST /flashcards/:setId/cards/:cardId/review
  review: (setId, cardId, grade) =>
    api.post(`/flashcards/${setId}/cards/${cardId}/review`, { grade }).then(normalize),
};

// AI Chat (with citations)
// chat.complete returns { message|content, citations: [...] }. chat.stream yields
// streamed tokens via the SSE endpoint and, on the terminal frame, the citations
// array; callers iterate streamSSE('/chat/stream', body) directly for tokens and
// read the citations from the final payload. Exposed here so the path is owned in
// one place.
export const chat = {
  complete: (messages, docId) =>
    api.post('/chat/complete', { messages, document_id: docId }).then(normalize),
  // Convenience for non-streaming callers that just want { citations } resolved.
  streamPath: '/chat/stream', // consumed by streamSSE in screens
  history: () => api.get('/chat/history').then(normalize),
};

// Mind Maps
export const mindMaps = {
  list: () => api.get('/mindmaps').then(normalize),
  generate: (docId) => api.post('/mindmaps/generate', { document_id: docId }).then(normalize),
};

// Audio Recaps
export const audioRecaps = {
  list: () => api.get('/audio-recaps').then(normalize),
  get: (id) => api.get(`/audio-recaps/${id}`).then(normalize),
  generate: (docId) => api.post('/audio-recaps/generate', { document_id: docId }).then(normalize),
};

// Notes
export const notes = {
  list: () => api.get('/notes').then(normalize),
  get: (id) => api.get(`/notes/${id}`).then(normalize),
  create: (note) => api.post('/notes', note).then(normalize),
  update: (id, patch) => api.patch(`/notes/${id}`, patch).then(normalize),
  delete: (id) => api.delete(`/notes/${id}`),
};

// Settings
export const settings = {
  get: () => api.get('/settings').then(normalize),
  update: (patch) => api.patch('/settings', patch).then(normalize),
};

// History — folded into the Dashboard (no standalone tab). The list endpoint
// stays so Dashboard can surface recent activity.
export const history = {
  list: () => api.get('/history').then(normalize),
};

// YouTube
export const youtube = {
  analyze: (videoUrl) => api.post('/youtube/transcript', { video_url: videoUrl }).then(normalize),
  summarize: (videoUrl) => api.post('/youtube/summarize', { video_url: videoUrl }).then(normalize),
};

// Visual AI — multipart image upload (mirrors documents.upload style)
export const visualAI = {
  solve: (file, prompt = '') => {
    const token = getToken();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('prompt', prompt);
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetch('/api/v1/visual-ai/solve', { method: 'POST', headers, body: fd, credentials: 'include' })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`); return r.json(); })
      .then(normalize);
  },
};

// Visualize — single merged surface replacing the old diagrams + concepts APIs.
// kind selects the output: 'diagram' (mermaid/flowchart from a prompt) or
// 'concept' (a concept map for an idea). The first positional arg is the
// prompt for diagrams or the concept for concept maps.
// PATH GUESS: POST /visualize/generate { input, kind, style? }
export const visualize = {
  generate: (input, kind = 'diagram', { style = 'flowchart' } = {}) =>
    api.post('/visualize/generate', { input, kind, style }).then(normalize),
};
