import { api, getToken } from './client.js';

// Auth
export const auth = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  signup: (name, email, password) => api.post('/auth/signup', { name, email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// Documents
export const documents = {
  list: () => api.get('/documents'),
  get: (id) => api.get(`/documents/${id}`),
  // Lightweight status poll — GET /documents/:id/status returns { id, status }
  status: (id) => api.get(`/documents/${id}/status`),
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
    });
  },
  delete: (id) => api.delete(`/documents/${id}`),
};

// Quizzes
export const quizzes = {
  list: () => api.get('/quizzes'),
  generate: (docId, count, difficulty) => api.post('/quizzes/generate', { document_id: docId, count, difficulty }),
  save: (quiz) => api.post('/quizzes', quiz),
};

// Flashcards
export const flashcards = {
  list: () => api.get('/flashcards'),
  generate: (docId) => api.post('/flashcards/generate', { document_id: docId }),
  save: (set) => api.post('/flashcards', set),
};

// AI Chat
export const chat = {
  complete: (messages, docId) => api.post('/chat/complete', { messages, document_id: docId }),
  history: () => api.get('/chat/history'),
};

// Mind Maps
export const mindMaps = {
  list: () => api.get('/mindmaps'),
  generate: (docId) => api.post('/mindmaps/generate', { document_id: docId }),
};

// Audio Recaps
export const audioRecaps = {
  list: () => api.get('/audio-recaps'),
  get: (id) => api.get(`/audio-recaps/${id}`),
  generate: (docId) => api.post('/audio-recaps/generate', { document_id: docId }),
};

// Quick Revise
export const quickRevise = {
  list: () => api.get('/quick-revise'),
  generate: (docId) => api.post('/quick-revise/generate', { document_id: docId }),
};

// Notes
export const notes = {
  list: () => api.get('/notes'),
  get: (id) => api.get(`/notes/${id}`),
  create: (note) => api.post('/notes', note),
  update: (id, patch) => api.patch(`/notes/${id}`, patch),
  delete: (id) => api.delete(`/notes/${id}`),
};

// Study Groups
export const groups = {
  list: () => api.get('/groups'),
  create: (group) => api.post('/groups', group),
  join: (id) => api.post(`/groups/${id}/join`),
};

// Settings
export const settings = {
  get: () => api.get('/settings'),
  update: (patch) => api.patch('/settings', patch),
};

// History
export const history = {
  list: () => api.get('/history'),
};

// YouTube
export const youtube = {
  analyze: (videoUrl) => api.post('/youtube/transcript', { video_url: videoUrl }),
  summarize: (videoUrl) => api.post('/youtube/summarize', { video_url: videoUrl }),
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
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`); return r.json(); });
  },
};

// Diagrams
export const diagrams = {
  generate: (prompt, style = 'flowchart') => api.post('/diagrams/generate', { prompt, style }),
};

// Concepts
export const concepts = {
  visualize: (concept) => api.post('/concepts/visualize', { concept }),
};
