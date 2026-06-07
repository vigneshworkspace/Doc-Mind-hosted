// Base API client — all calls proxy through Vite to FastAPI at /api/v1

const BASE = '/api/v1';

// ── Token helpers ─────────────────────────────────────────────
// "Remember me" → localStorage (persists across browser restarts).
// Unchecked → sessionStorage (cleared when the tab closes).
const KEY = 'docmind_token';
export const getToken = () => {
  const t = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
  // Guard against a poisoned value: a buggy caller storing `undefined`/`null`
  // serializes to the literal strings "undefined"/"null", which are truthy and
  // would send `Bearer undefined` → 401. Treat those as no token.
  return t && t !== 'undefined' && t !== 'null' ? t : null;
};
export const setToken = (t, persist = true) => {
  if (persist) { localStorage.setItem(KEY, t); sessionStorage.removeItem(KEY); }
  else { sessionStorage.setItem(KEY, t); localStorage.removeItem(KEY); }
};
export const clearToken = () => { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); };

// ── Core request ──────────────────────────────────────────────
async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });
  } catch (e) {
    // Network/transport failure (server down, CORS, offline) — log centrally and
    // rethrow a clear message for the calling screen to show.
    console.error(`[API] ${method} ${path} — network error:`, e.message);
    throw new Error('Network error — is the backend running? Please retry.');
  }

  if (!res.ok) {
    // 401 → token expired/invalid: clear and signal the app to drop to the login
    // screen. We do NOT window.location.reload() — a hard reload mid-render makes
    // the app "flash in and bounce out" and can loop if a stale token keeps 401ing.
    // Instead emit an event App.jsx listens for and do a clean in-SPA logout.
    if (res.status === 401) {
      clearToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      throw new Error('Your session has expired. Please sign in again.');
    }
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const message = err.detail || `HTTP ${res.status}`;
    console.error(`[API] ${method} ${path} → ${res.status}:`, message);
    throw new Error(message);
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
