// frontend/src/api/stream.js
// Async generator for Server-Sent Events over POST (fetch + ReadableStream).
// Yields each raw data payload string. Stops at [DONE].

import { getToken } from './client.js';

export async function* streamSSE(path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`/api/v1${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6);
      if (raw.trim() === '[DONE]') return;
      if (!raw) continue;
      // Payloads are JSON-encoded by the backend so embedded newlines never split a
      // frame. Parse without trimming so token whitespace is preserved exactly.
      let val;
      try {
        val = JSON.parse(raw);
      } catch {
        continue;
      }
      if (val && typeof val === 'object' && val.__error__) {
        throw new Error(val.__error__);
      }
      if (typeof val === 'string' && val.length) yield val;
    }
  }
}
