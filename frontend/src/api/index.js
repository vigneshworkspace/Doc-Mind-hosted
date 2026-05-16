import { api } from './client.js';

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
  upload: (formData) =>
    fetch('/api/v1/documents', { method: 'POST', body: formData, credentials: 'include' }).then(r => r.json()),
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
