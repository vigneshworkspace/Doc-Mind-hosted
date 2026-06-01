// Base API client — all calls proxy through Vite to FastAPI at /api/v1

const BASE = '/api/v1';

// ── Token helpers ─────────────────────────────────────────────
export const getToken = () => localStorage.getItem('docmind_token');
export const setToken = (t) => localStorage.setItem('docmind_token', t);
export const clearToken = () => localStorage.removeItem('docmind_token');

// ── Core request ──────────────────────────────────────────────
async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!res.ok) {
    // 401 → token expired/invalid: clear and force re-login (CORRECTIONS P6 issue 7)
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  delete: (path)        => request('DELETE', path),
};
