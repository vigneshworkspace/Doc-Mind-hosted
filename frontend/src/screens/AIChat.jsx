import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon } from '../components/Shell';
import foxHeadImg from '../assets/fox-head.png';
import { documents as docsApi } from '../api/index.js';
import { getToken } from '../api/client.js';
import { ErrorRetry } from '../components/GenState.jsx';
import LoaderHelix from '../components/LoaderHelix.jsx';
import PdfPane from '../components/PdfPane.jsx';

const clampW = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Draggable split divider between the chat and the PDF pane. Reports the live
// cursor X to the parent, which converts it to a clamped pane width.
function PaneResizer({ onResize }) {
  const onDown = (e) => {
    e.preventDefault();
    const move = (ev) => onResize(ev.clientX);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return <div className="pdfpane-resizer" onMouseDown={onDown} role="separator" aria-label="Resize PDF pane" />;
}

// Local SSE reader for the chat stream. The shared streamSSE generator yields only
// string tokens and silently drops object frames, so it cannot surface the terminal
// citations frame the backend emits. Rather than edit the shared helper, this screen
// reads the stream directly: it invokes onToken for every reply token and onCitations
// once for the final { __citations__: [...] } frame. Throws on the __error__ frame or
// a non-OK response, exactly like streamSSE, so the caller's catch path is unchanged.
async function streamChat(body, { onToken, onCitations }) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch('/api/v1/chat/stream', {
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
    buf = lines.pop(); // keep the incomplete trailing line
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6);
      if (raw.trim() === '[DONE]') return;
      if (!raw) continue;
      let val;
      try { val = JSON.parse(raw); } catch { continue; }
      if (val && typeof val === 'object') {
        if (val.__error__) throw new Error(val.__error__);
        if (Array.isArray(val.__citations__)) onCitations(val.__citations__);
        continue; // never treat a structured frame as a token
      }
      if (typeof val === 'string' && val.length) onToken(val);
    }
  }
}

// snake_case citation frame → the camelCase shape the panel renders. The backend
// frame bypasses api/index.js's normalize, so this screen does the one mapping it
// needs locally.
function normalizeCitations(list) {
  return (list || []).map((c, i) => ({
    key: `${c.document_id ?? 'd'}-${c.page_start ?? '?'}-${i}`,
    documentId: c.document_id ?? null,
    pageStart: c.page_start ?? null,
    pageEnd: c.page_end ?? null,
    snippet: c.snippet ?? '',
  }));
}

function citationPageLabel(c) {
  if (c.pageStart == null) return null;
  if (c.pageEnd != null && c.pageEnd !== c.pageStart) return `pp. ${c.pageStart}–${c.pageEnd}`;
  return `p. ${c.pageStart}`;
}

// ── Elevated message component ────────────────────────────────
function ElevatedMessage({ msg, isHovered, isCopied, onHover, onCopy, citationDocName, onOpenSource }) {
  const isAI = msg.sender === "ai";
  const timeStr = msg.ts
    ? new Date(msg.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  if (isAI) {
    return (
      <div
        onMouseEnter={() => onHover(msg.id)}
        onMouseLeave={() => onHover(null)}
        style={{ padding: "22px 0 2px", position: "relative" }}
      >
        {/* Avatar row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 9, marginBottom: 11,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
            background: "var(--accent)",
            display: "grid", placeItems: "center",
            boxShadow: "0 2px 6px color-mix(in oklch, var(--accent) 30%, transparent)",
          }}>
            <img src={foxHeadImg} alt="" width="15" height="15"
              style={{ objectFit: "contain", filter: "brightness(2) saturate(0)" }} />
          </div>
          <span style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1,
            color: "var(--ink-3)", textTransform: "uppercase",
          }}>DocMind</span>
          <span style={{
            fontSize: 10.5, color: "var(--ink-4)", marginLeft: 2,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}>{timeStr}</span>
        </div>

        {/* Prose text — error replies are visually distinct, never styled as a
            normal grounded answer. */}
        <div style={{
          marginLeft: 33,
          paddingLeft: msg.error ? 12 : 0,
          borderLeft: msg.error ? "2px solid var(--err, #dc2626)" : "none",
          fontSize: 15, lineHeight: 1.72,
          color: msg.error ? "var(--err, #dc2626)" : "var(--ink)", letterSpacing: -0.004,
          textWrap: "pretty", whiteSpace: "pre-wrap",
        }}>
          {msg.text}
        </div>

        {/* Citations — the grounding chunks behind this answer. Hidden on error
            replies, which never carry sources. */}
        {!msg.error && msg.citations && msg.citations.length > 0 && (
          <CitationsPanel
            citations={msg.citations}
            docName={citationDocName}
            onOpen={onOpenSource}
          />
        )}

        {/* Hover actions */}
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          marginTop: 10, paddingLeft: 33,
          opacity: isHovered ? 1 : 0,
          transition: "opacity 0.15s",
          pointerEvents: isHovered ? "auto" : "none",
        }}>
          <button
            onClick={() => onCopy(msg.text, msg.id)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 26, padding: "0 10px",
              border: "1px solid var(--hairline)",
              borderRadius: 100, background: "var(--card)",
              color: isCopied ? "var(--accent-ink)" : "var(--ink-3)",
              fontSize: 11, fontWeight: 500, cursor: "pointer",
              transition: "color 0.12s, border-color 0.12s",
            }}
          >
            {isCopied ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 12 10 18 20 6"/></svg>
                Copied
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // User message
  return (
    <div style={{
      padding: "22px 0 2px",
      display: "flex", justifyContent: "flex-end",
    }}>
      <div style={{
        maxWidth: "72%",
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.1,
            color: "var(--ink-4)", textTransform: "uppercase",
          }}>You</span>
          <span style={{
            fontSize: 10.5, color: "var(--ink-4)",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}>{timeStr}</span>
        </div>
        <div style={{
          padding: "11px 16px",
          background: "var(--ink)",
          color: "var(--paper)",
          borderRadius: 18, borderBottomRightRadius: 5,
          fontSize: 14.5, lineHeight: 1.55,
          letterSpacing: -0.004,
          textWrap: "pretty",
          boxShadow: "0 4px 18px rgba(15,23,42,0.13)",
        }}>
          {msg.text}
        </div>
      </div>
    </div>
  );
}

// ── Thinking indicator ────────────────────────────────────────
function ThinkingRow() {
  return (
    <div style={{ padding: "22px 0 2px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 9, marginBottom: 14,
      }}>
        <div style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0,
          background: "var(--accent)",
          display: "grid", placeItems: "center",
        }}>
          <img src={foxHeadImg} alt="" width="15" height="15"
            style={{ objectFit: "contain", filter: "brightness(2) saturate(0)" }} />
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: 0.1,
          color: "var(--ink-3)", textTransform: "uppercase",
        }}>DocMind</span>
      </div>
      <div style={{
        display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
      }}>
        <LoaderHelix dots={6} speed={1.6} variant="dna" />
        <span style={{
          fontSize: 12, color: "var(--ink-4)",
          fontStyle: "italic", letterSpacing: 0.01,
        }}>thinking…</span>
      </div>
    </div>
  );
}

function ChatDot({ delay }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: "var(--ink-3)",
      animation: `dotbounce 1s ${delay} infinite ease-in-out`,
      display: "inline-block",
    }}></span>
  );
}

// ── Divider with label ─────────────────────────────────────────
function ChatDivider({ label }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "18px 0 4px",
    }}>
      <div style={{ flex: 1, height: 1, background: "var(--hairline-2)" }}></div>
      <span style={{
        fontSize: 10, fontWeight: 600, color: "var(--ink-4)",
        letterSpacing: 0.1, textTransform: "uppercase",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        whiteSpace: "nowrap",
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--hairline-2)" }}></div>
    </div>
  );
}

// ── Citations panel ───────────────────────────────────────────
// Rendered under a grounded AI answer. Each row is the chunk reference that
// backed the reply; clicking opens the source at that page with the snippet
// highlighted (onOpen).
function CitationsPanel({ citations, docName, onOpen }) {
  if (!citations || citations.length === 0) return null;
  return (
    <div style={{ marginLeft: 33, marginTop: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 0.1,
        color: "var(--ink-4)", textTransform: "uppercase", marginBottom: 8,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/>
        </svg>
        {citations.length} {citations.length === 1 ? "source" : "sources"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {citations.map((c, i) => {
          const page = citationPageLabel(c);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onOpen(c)}
              title="Open source"
              style={{
                textAlign: "left",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: 10, alignItems: "start",
                padding: "9px 12px",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
                background: "var(--card)",
                cursor: "pointer",
                transition: "border-color 0.12s, background 0.12s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "color-mix(in oklch, var(--accent) 40%, var(--hairline))"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--hairline)"; }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                minWidth: 20, height: 20, padding: "0 6px",
                fontSize: 10.5, fontWeight: 700,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                color: "var(--accent-ink)",
                background: "color-mix(in oklch, var(--accent) 12%, var(--card))",
                border: "1px solid color-mix(in oklch, var(--accent) 22%, var(--hairline))",
                borderRadius: 6, marginTop: 1,
              }}>{i + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{
                  display: "flex", alignItems: "center", gap: 8,
                  fontSize: 11.5, fontWeight: 600, color: "var(--ink-2)", marginBottom: 3,
                }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {docName || (c.documentId != null ? `Document ${c.documentId}` : "Source")}
                  </span>
                  {page && (
                    <span style={{
                      flexShrink: 0,
                      fontSize: 10, fontWeight: 600, color: "var(--ink-4)",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}>{page}</span>
                  )}
                </span>
                <span style={{
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-3)",
                }}>{c.snippet}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Suggestion grid for empty state ───────────────────────────
const CHAT_SUGGESTIONS = [
  {
    cat: "Summarize",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>,
    items: ["5-bullet summary of my notes", "Key takeaways from last upload"],
  },
  {
    cat: "Explain",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
    items: ["Explain entropy simply", "Break down the chain rule"],
  },
  {
    cat: "Quiz me",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a4 4 0 0 0-4 4c0 1.7 1 3 2 3.5V13h4v-2.5c1-.5 2-1.8 2-3.5a4 4 0 0 0-4-4Z"/><path d="M10 16h4M11 20h2"/></svg>,
    items: ["10 questions on my docs", "Test me on chapter 3"],
  },
  {
    cat: "Compare",
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3H5a2 2 0 0 0-2 2v4"/><path d="M15 3h4a2 2 0 0 1 2 2v4"/><path d="M9 21H5a2 2 0 0 1-2-2v-4"/><path d="M15 21h4a2 2 0 0 0 2-2v-4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>,
    items: ["AI vs Machine Learning", "Two economic theories"],
  },
];

// ── Main screen ───────────────────────────────────────────────
function ScreenAIChat({ state, dispatch }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: "ai", text: "Hi — drop a question, paste text, or add document context above. I'll keep my answers grounded in what you share.", ts: Date.now() }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [ctxDoc, setCtxDoc] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);

  // Document picker — loaded from the real list endpoint. On failure we show
  // ErrorRetry instead of falling back to seeded/mock docs (honesty contract).
  const [docs, setDocs] = useState([]);
  const [docsError, setDocsError] = useState('');
  const [docsLoading, setDocsLoading] = useState(true);

  // PDF reading pane — { doc, page, snippet } currently open, or null.
  const [pdfPane, setPdfPane] = useState(null);
  const [paneW, setPaneW] = useState(() => {
    const v = Number(localStorage.getItem('docmind.pdfPaneW'));
    return v >= 380 ? v : 480;
  });
  // Under 1040px the split is too tight — the pane becomes a slide-over drawer.
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1040
  );
  useEffect(() => {
    const onR = () => setIsNarrow(window.innerWidth < 1040);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const onPaneResize = useCallback((clientX) => {
    const w = clampW(window.innerWidth - clientX, 380, Math.min(760, window.innerWidth * 0.6));
    setPaneW(w);
    localStorage.setItem('docmind.pdfPaneW', String(Math.round(w)));
  }, []);

  const loadDocs = useCallback(() => {
    setDocsLoading(true);
    setDocsError('');
    docsApi.list()
      .then(list => {
        const arr = Array.isArray(list) ? list : [];
        setDocs(arr);
        // Share the real list with the rest of the app, replacing seed data.
        dispatch({ type: 'set-documents', documents: arr });
      })
      .catch(e => setDocsError(e?.message || 'Could not load your documents.'))
      .finally(() => setDocsLoading(false));
  }, [dispatch]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  // documentId -> display name, for labelling citations and the source drawer.
  const docNameById = useMemo(() => {
    const m = new Map();
    for (const d of docs) m.set(String(d.id), (d.name || '').replace(/\.[a-z]+$/i, ""));
    return m;
  }, [docs]);

  // Open the reading pane for a document (by id or doc object).
  const openDocPane = useCallback((idOrDoc, { page = 1, snippet = '' } = {}) => {
    const d = (idOrDoc && typeof idOrDoc === 'object')
      ? idOrDoc
      : (docs.find(x => String(x.id) === String(idOrDoc)) || { id: idOrDoc, name: '', type: '' });
    setPdfPane({ doc: d, page, snippet });
  }, [docs]);

  // Citation click → open the cited doc at its page, highlight the snippet.
  const handleOpenSource = useCallback((citation) => {
    const d = docs.find(x => String(x.id) === String(citation.documentId)) || null;
    setPdfPane({ doc: d, page: citation.pageStart || 1, snippet: citation.snippet || '' });
  }, [docs]);

  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const textRef = useRef(null);
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const sttOK = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Dictate into the composer using the browser's SpeechRecognition.
  function toggleDictation() {
    if (!sttOK) return;
    if (listening) { recogRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = true;
    r.continuous = false;
    let base = input ? input + ' ' : '';
    let final = base;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      setInput((final + interim).trim());
    };
    r.onend = () => { setListening(false); recogRef.current = null; };
    r.onerror = () => { setListening(false); recogRef.current = null; };
    recogRef.current = r;
    setListening(true);
    r.start();
  }
  useEffect(() => () => { try { recogRef.current?.stop(); } catch { /* noop */ } }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [input]);

  function copyText(text, id) {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  }

  async function send(text) {
    const t = (text ?? input).trim();
    if (!t || thinking) return;
    const now = Date.now();
    setMessages(m => [...m, { id: now, sender: "user", text: t, ts: now }]);
    setInput("");
    setThinking(true);

    const aiMsgId = now + 1;
    const body = { messages: [{ role: "user", content: t }] };
    if (ctxDoc) body.document_id = ctxDoc;

    // Keep the "thinking" indicator until the FIRST token arrives, then flip
    // to a streaming AI bubble (CORRECTIONS P6 issue 6).
    let firstChunk = true;
    let streamed = false;
    try {
      await streamChat(body, {
        onToken: (token) => {
          if (firstChunk) {
            setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: token, ts: Date.now() }]);
            setThinking(false);
            firstChunk = false;
            streamed = true;
          } else {
            // The streaming bubble is always the last message — append in place
            // instead of mapping the whole array on every token (O(1) vs O(n)).
            setMessages(m => {
              const last = m[m.length - 1];
              if (!last || last.id !== aiMsgId) return m;
              const next = m.slice();
              next[next.length - 1] = { ...last, text: last.text + token };
              return next;
            });
          }
        },
        // Terminal frame: attach the grounding citations to the answer bubble.
        onCitations: (raw) => {
          const citations = normalizeCitations(raw);
          if (citations.length === 0) return;
          setMessages(m => m.map(msg => msg.id === aiMsgId ? { ...msg, citations } : msg));
        },
      });
    } catch (e) {
      // Surface a real error — never fabricate a mock answer that looks grounded.
      setThinking(false);
      const errText = (e && e.message) ? e.message : "DocMind is unavailable. Please retry.";
      if (firstChunk) {
        setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: errText, ts: Date.now(), error: true }]);
        firstChunk = false;
      } else {
        // Partial answer already shown; flag the bubble as interrupted.
        setMessages(m => m.map(msg => msg.id === aiMsgId
          ? { ...msg, error: true, text: (msg.text || "") + "\n\n_(response interrupted — please retry)_" }
          : msg));
      }
    }
    if (firstChunk) {
      // 200 but no tokens — honest empty state, not a fabricated answer.
      setThinking(false);
      setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: "No response was generated. Please retry.", ts: Date.now(), error: true }]);
    }
    void streamed;
  }

  const activeDoc = docs.find(d => String(d.id) === String(ctxDoc));
  const showEmpty = messages.length <= 1;

  // Group messages into date clusters — when empty, skip the lone greeting
  const msgGroups = useMemo(() => {
    const today = new Date().toDateString();
    const groups = [];
    let cur = null;
    const visible = showEmpty ? [] : messages; // hide greeting behind empty state
    visible.forEach(m => {
      const day = m.ts ? new Date(m.ts).toDateString() : today;
      const label = day === today ? "Today" : day;
      if (!cur || cur.label !== label) {
        cur = { label, msgs: [] };
        groups.push(cur);
      }
      cur.msgs.push(m);
    });
    return groups;
  }, [messages, showEmpty]);

  return (
    <div style={{
      display: "flex",
      height: "100%",
      marginInline: "-36px", marginTop: -28, marginBottom: -80,
      fontFamily: "var(--f-body)",
    }}>

      {/* ── Chat column ────────────────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column",
        flex: "1 1 0", minWidth: 360, height: "100%",
      }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 36px",
        borderBottom: "1px solid var(--hairline-2)",
        flexShrink: 0,
        gap: 16,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.14,
            color: "var(--ink-4)", textTransform: "uppercase",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            marginBottom: 4,
          }}>Conversation</div>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--f-display)",
            fontSize: 30, fontWeight: 600,
            letterSpacing: -0.022, lineHeight: 1,
            color: "var(--ink)",
          }}>
            Ask <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>anything.</em>
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* doc context picker — real list; on failure a retry, never mock docs */}
          {docsError ? (
            <button
              type="button"
              onClick={loadDocs}
              title={docsError}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 14px", borderRadius: 100,
                border: "1px solid color-mix(in oklch, var(--danger) 32%, var(--hairline))",
                background: "color-mix(in oklch, var(--danger), var(--card) 90%)",
                color: "color-mix(in oklch, var(--danger) 60%, var(--ink))",
                fontSize: 12, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              Docs failed — retry
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "center",
              height: 34, borderRadius: 100,
              border: "1px solid var(--hairline)",
              background: "var(--card)", overflow: "hidden",
            }}>
              <span style={{
                padding: "0 8px 0 14px",
                fontSize: 11, fontWeight: 600, letterSpacing: 0.04,
                color: "var(--ink-4)", textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}>Doc</span>
              <select
                value={ctxDoc}
                onChange={e => { const v = e.target.value; setCtxDoc(v); if (v) openDocPane(v, { page: 1 }); }}
                disabled={docsLoading}
                aria-label="Document context"
                style={{
                  border: 0, outline: 0, background: "transparent",
                  color: "var(--ink)", font: "inherit",
                  fontSize: 12.5, fontWeight: 500,
                  padding: "0 14px 0 4px",
                  cursor: docsLoading ? "default" : "pointer", maxWidth: 200,
                  opacity: docsLoading ? 0.6 : 1,
                }}
              >
                <option value="">{docsLoading ? "Loading…" : "None"}</option>
                {docs.map(d => (
                  <option key={d.id} value={d.id}>{(d.name || '').replace(/\.[a-z]+$/i, "")}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ width: 1, height: 18, background: "var(--hairline)" }}></div>

          <button
            className="btn is-ghost is-sm"
            onClick={() => setMessages([messages[0]])}
            style={{ height: 34, padding: "0 14px", borderRadius: 100, fontSize: 12 }}
          >
            New chat
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────── */}
      <div
        ref={scrollRef}
        style={{
          flex: "1 1 auto", overflowY: "auto",
          padding: "8px 36px 24px",
        }}
      >
        <div style={{ maxWidth: 740, margin: "0 auto" }}>

          {/* Empty state */}
          {showEmpty && (
            <div style={{ paddingTop: 20, paddingBottom: 16 }}>
              <div style={{
                fontFamily: "var(--f-display)",
                fontSize: 32, fontWeight: 500,
                letterSpacing: -0.02, lineHeight: 1.12,
                color: "var(--ink)", marginBottom: 20,
              }}>
                What would you like to explore
                <em style={{ fontStyle: "italic", color: "var(--ink-3)" }}> today?</em>
              </div>

              {/* Compact suggestion rows */}
              <div style={{
                border: "1px solid var(--hairline)",
                borderRadius: 14,
                background: "var(--card)",
                overflow: "hidden",
              }}>
                {CHAT_SUGGESTIONS.map((s, si) => (
                  <div key={s.cat} style={{
                    display: "grid",
                    gridTemplateColumns: "80px 1fr 1fr",
                    borderBottom: si < CHAT_SUGGESTIONS.length - 1 ? "1px solid var(--hairline-2)" : "none",
                  }}>
                    {/* Category label */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "14px 12px",
                      borderRight: "1px solid var(--hairline-2)",
                    }}>
                      <span style={{ color: "var(--ink-4)", flexShrink: 0 }}>{s.icon}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.1,
                        color: "var(--ink-4)", textTransform: "uppercase",
                      }}>{s.cat}</span>
                    </div>
                    {/* Items */}
                    {s.items.map((item, ii) => (
                      <button
                        key={item}
                        onClick={() => send(item)}
                        style={{
                          textAlign: "left",
                          border: 0,
                          borderLeft: ii === 1 ? "1px solid var(--hairline-2)" : "none",
                          background: "transparent",
                          padding: "14px 14px",
                          color: "var(--ink-2)",
                          fontSize: 13, fontWeight: 450,
                          letterSpacing: -0.003,
                          lineHeight: 1.3,
                          cursor: "pointer",
                          transition: "background 0.1s, color 0.1s",
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = "var(--paper-2)";
                          e.currentTarget.style.color = "var(--ink)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = "var(--ink-2)";
                        }}
                      >
                        <span style={{ color: "var(--ink-4)", marginRight: 2, fontSize: 11 }}>"</span>
                        {item}
                        <span style={{ color: "var(--ink-4)", fontSize: 11 }}>"</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message groups */}
          {msgGroups.map((group, gi) => (
            <div key={gi}>
              <ChatDivider label={group.label} />
              {group.msgs.map(m => (
                <ElevatedMessage
                  key={m.id}
                  msg={m}
                  isHovered={hoverId === m.id}
                  isCopied={copiedId === m.id}
                  onHover={setHoverId}
                  onCopy={copyText}
                  citationDocName={m.citations?.[0] ? docNameById.get(String(m.citations[0].documentId)) : null}
                  onOpenSource={handleOpenSource}
                />
              ))}
            </div>
          ))}

          {thinking && <ThinkingRow />}
          <div ref={endRef} style={{ height: 4 }}></div>
        </div>
      </div>

      {/* ── Composer ───────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        padding: "0 36px 28px",
        borderTop: "1px solid var(--hairline-2)",
        background: "var(--paper)",
      }}>
        <div style={{ maxWidth: 740, margin: "0 auto", paddingTop: 16 }}>

          {/* Active doc chip */}
          {activeDoc && (
            <div style={{ marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "4px 10px 4px 8px",
                background: "color-mix(in oklch, var(--accent) 8%, var(--card))",
                border: "1px solid color-mix(in oklch, var(--accent) 22%, var(--hairline))",
                borderRadius: 100,
                fontSize: 11.5, fontWeight: 500,
                color: "var(--accent-ink)",
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/>
                  <path d="M14 3v5h5"/>
                </svg>
                {activeDoc.name.replace(/\.[a-z]+$/i, "")}
                <button
                  onClick={() => setCtxDoc("")}
                  style={{
                    border: 0, background: "transparent",
                    padding: 0, cursor: "pointer",
                    color: "var(--accent-ink)", opacity: 0.55,
                    display: "grid", placeItems: "center",
                    width: 14, height: 14,
                  }}
                >
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <button
                type="button"
                onClick={() => openDocPane(activeDoc, { page: 1 })}
                title="View this document"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  height: 26, padding: "0 11px", borderRadius: 100,
                  border: "1px solid var(--hairline)", background: "var(--card)",
                  color: "var(--ink-3)", fontSize: 11, fontWeight: 500, cursor: "pointer",
                  transition: "color 0.12s, border-color 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "color-mix(in oklch, var(--accent) 40%, var(--hairline))"; e.currentTarget.style.color = "var(--accent-ink)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--hairline)"; e.currentTarget.style.color = "var(--ink-3)"; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/></svg>
                View PDF
              </button>
            </div>
          )}

          {/* Textarea box */}
          <div style={{
            display: "flex", alignItems: "flex-end", gap: 8,
            padding: "10px 12px",
            background: "var(--card)",
            border: "1px solid var(--hairline)",
            borderRadius: 18,
            boxShadow: "0 1px 8px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.03)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}>
            <textarea
              ref={textRef}
              aria-label="Message DocMind"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              onFocus={e => {
                e.currentTarget.parentElement.style.borderColor = "color-mix(in oklch, var(--accent) 40%, var(--hairline))";
                e.currentTarget.parentElement.style.boxShadow = "0 1px 8px rgba(15,23,42,0.05), 0 0 0 3px color-mix(in oklch, var(--accent) 10%, transparent)";
              }}
              onBlur={e => {
                e.currentTarget.parentElement.style.borderColor = "var(--hairline)";
                e.currentTarget.parentElement.style.boxShadow = "0 1px 8px rgba(15,23,42,0.05), 0 4px 16px rgba(15,23,42,0.03)";
              }}
              placeholder={activeDoc
                ? `Ask about "${activeDoc.name.replace(/\.[a-z]+$/i, "")}"…`
                : "Message DocMind…"}
              style={{
                border: 0, outline: 0, background: "transparent",
                flex: 1, fontFamily: "var(--f-body)",
                fontSize: 14.5, color: "var(--ink)",
                lineHeight: 1.55, resize: "none",
                minHeight: 24, height: 24,
                padding: "2px 0",
              }}
            ></textarea>

            <div style={{
              display: "flex", gap: 4, alignItems: "center", flexShrink: 0,
            }}>
              <button
                onClick={toggleDictation}
                disabled={!sttOK}
                title={sttOK ? (listening ? "Stop dictation" : "Dictate") : "Speech recognition not supported in this browser"}
                aria-label={listening ? "Stop dictation" : "Dictate message"}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: listening ? "1px solid var(--accent)" : "1px solid var(--hairline)",
                  background: listening ? "var(--accent)" : "var(--paper-2)",
                  display: "grid", placeItems: "center",
                  cursor: sttOK ? "pointer" : "not-allowed", color: listening ? "white" : "var(--ink-3)",
                  opacity: sttOK ? 1 : 0.5,
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="3" width="6" height="12" rx="3"/>
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>
                </svg>
              </button>

              <button
                onClick={() => send()}
                disabled={!input.trim() || thinking}
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: 0,
                  background: input.trim() && !thinking ? "var(--ink)" : "var(--hairline)",
                  display: "grid", placeItems: "center",
                  cursor: input.trim() && !thinking ? "pointer" : "default",
                  color: input.trim() && !thinking ? "white" : "var(--ink-4)",
                  transition: "background 0.15s, transform 0.1s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (input.trim() && !thinking) e.currentTarget.style.transform = "scale(1.06)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </button>
            </div>
          </div>

          <div style={{
            textAlign: "center", marginTop: 8,
            fontSize: 11, color: "var(--ink-4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
          }}>
            <kbd style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9.5, fontWeight: 600, padding: "1px 5px",
              background: "var(--paper-2)", border: "1px solid var(--hairline)",
              borderBottomWidth: 2, borderRadius: 4,
            }}>Enter</kbd>
            <span>to send</span>
            <span style={{ color: "var(--hairline)", margin: "0 4px" }}>·</span>
            <kbd style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9.5, fontWeight: 600, padding: "1px 5px",
              background: "var(--paper-2)", border: "1px solid var(--hairline)",
              borderBottomWidth: 2, borderRadius: 4,
            }}>Shift+Enter</kbd>
            <span>for new line</span>
          </div>
        </div>
      </div>

      </div>{/* ── /Chat column ── */}

      {/* ── PDF reading pane: in-flow split (wide) ─────────── */}
      {pdfPane && !isNarrow && (
        <>
          <PaneResizer onResize={onPaneResize} />
          <div style={{ width: paneW, flexShrink: 0, height: "100%", borderLeft: "1px solid var(--hairline)" }}>
            <PdfPane
              key={String(pdfPane.doc?.id ?? 'snippet')}
              doc={pdfPane.doc}
              page={pdfPane.page}
              snippet={pdfPane.snippet}
              onClose={() => setPdfPane(null)}
            />
          </div>
        </>
      )}

      {/* ── PDF reading pane: slide-over drawer (narrow) ───── */}
      {pdfPane && isNarrow && (
        <PdfPane
          asDrawer
          key={String(pdfPane.doc?.id ?? 'snippet')}
          doc={pdfPane.doc}
          page={pdfPane.page}
          snippet={pdfPane.snippet}
          onClose={() => setPdfPane(null)}
        />
      )}

      <style>{`
        @keyframes dotbounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }
        .pdfpane-resizer { width: 8px; flex-shrink: 0; cursor: col-resize; position: relative; align-self: stretch; }
        .pdfpane-resizer::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: var(--hairline); transition: background .12s, width .12s; }
        .pdfpane-resizer:hover::after { width: 3px; left: calc(50% - 1px); background: var(--accent); }
      `}</style>
    </div>
  );
}

export { ElevatedMessage, ThinkingRow, ChatDot, ChatDivider, CHAT_SUGGESTIONS };
export default ScreenAIChat;
