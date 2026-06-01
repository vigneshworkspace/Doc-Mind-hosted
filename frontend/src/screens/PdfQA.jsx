import { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Shell';
import { DocIcon } from './Dashboard';
import { streamSSE } from '../api/stream.js';
import { documents as docsApi } from '../api/index.js';
import LoaderHelix from '../components/LoaderHelix.jsx';

function ScreenPdfQA({ state, dispatch }) {
  const [doc, setDoc] = useState(state.documents[0]);
  const [detail, setDetail] = useState(null);   // full doc incl. parsed text + page_count
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [messages, setMessages] = useState([
    { id: 0, sender: "ai", text: "Loaded — ask me anything from this document and I'll cite where I'm looking." }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView?.({block: "end"}), [messages]);

  // Pull the real parsed content for the selected document. The list endpoint
  // only returns metadata; GET /documents/:id carries parsed_md/content/page_count.
  useEffect(() => {
    if (!doc?.id) { setDetail(null); return; }
    let cancelled = false;
    setLoadingDoc(true);
    docsApi.get(doc.id)
      .then(d => { if (!cancelled) setDetail(d); })
      .catch(() => { if (!cancelled) setDetail(null); })  // fall back to mock content below
      .finally(() => { if (!cancelled) setLoadingDoc(false); });
    return () => { cancelled = true; };
  }, [doc?.id]);

  // Real extracted text, with mock-data fallback for the seeded demo documents.
  const docText = (detail?.parsed_md || detail?.content || doc?.content || "").trim();
  const pageCount = detail?.page_count ?? null;
  const status = detail?.processing_status || doc?.processing_status;
  const stillProcessing = status && status !== "ready" && !docText;

  async function send() {
    const t = input.trim();
    if (!t || thinking) return;
    const now = Date.now();
    setMessages(m => [...m, { id: now, sender: "user", text: t }]);
    setInput("");
    setThinking(true);

    const aiMsgId = now + 1;
    const body = { messages: [{ role: "user", content: t }] };
    if (doc?.id) body.document_id = doc.id;

    let firstChunk = true;
    try {
      for await (const token of streamSSE('/chat/stream', body)) {
        if (firstChunk) {
          setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: token }]);
          setThinking(false);
          firstChunk = false;
        } else {
          setMessages(m => m.map(msg => msg.id === aiMsgId ? { ...msg, text: msg.text + token } : msg));
        }
      }
    } catch {
      setThinking(false);
      if (firstChunk) {
        setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: 'Could not reach the server. Check your connection.' }]);
      }
    }
    if (firstChunk) {
      setThinking(false);
      setMessages(m => [...m, { id: aiMsgId, sender: "ai", text: 'No response from the server.' }]);
    }
  }

  return (
    <div className="grid" style={{gridTemplateColumns: "1.1fr 1fr", height: "calc(100vh - var(--top-h) - 40px)", gap: 16}}>
      <div className="card card-flush" style={{display: "flex", flexDirection: "column", overflow: "hidden"}}>
        <div className="row" style={{padding: "14px 16px", borderBottom: "1px solid var(--hairline)", gap: 10}}>
          <DocIcon ext={doc?.type} />
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{doc?.name}</div>
            <div className="muted" style={{fontSize: 11.5}}>{doc?.size}{pageCount ? ` · ${pageCount} page${pageCount === 1 ? "" : "s"}` : ""}</div>
          </div>
          <select className="input" style={{width: "auto", height: 30, fontSize: 12, paddingRight: 28}} value={doc?.id || ""} onChange={e => setDoc(state.documents.find(d => d.id === +e.target.value))}>
            {state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="scroll-area" style={{flex: 1, background: "var(--paper-2)", padding: 24}}>
          <div style={{background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "28px 32px", boxShadow: "0 1px 0 var(--paper-2)", maxWidth: 520, margin: "0 auto"}}>
            <div className="t-mono" style={{fontSize: 10, color: "var(--ink-4)", marginBottom: 16}}>EXTRACTED TEXT</div>
            <div className="t-display" style={{fontSize: 22, marginBottom: 14}}>{doc?.name?.replace(/\.[a-z]+$/i, "")}</div>
            {loadingDoc ? (
              <div style={{display: "grid", placeItems: "center", padding: "32px 0", gap: 12}}>
                <LoaderHelix dots={8} speed={1.8} variant="dna" />
                <span className="muted" style={{fontSize: 12}}>Loading document…</span>
              </div>
            ) : stillProcessing ? (
              <p className="muted" style={{fontSize: 13}}>Still processing this document ({status}). The parsed text will appear once extraction finishes.</p>
            ) : docText ? (
              <pre style={{fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "var(--f-body)", margin: 0}}>{docText.slice(0, 4000)}{docText.length > 4000 ? "…" : ""}</pre>
            ) : (
              <p className="muted" style={{fontSize: 13}}>No text could be extracted from this document.</p>
            )}
          </div>
        </div>
      </div>
      <div className="card card-flush" style={{display: "flex", flexDirection: "column", overflow: "hidden"}}>
        <div className="row" style={{padding: "14px 16px", borderBottom: "1px solid var(--hairline)", justifyContent: "space-between"}}>
          <div>
            <div className="t-eyebrow">Ask</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 2}}>Conversation</div>
          </div>
          <button className="btn is-ghost is-sm" onClick={() => setMessages(messages.slice(0, 1))}>Reset</button>
        </div>
        <div className="scroll-area" style={{flex: 1, padding: 18}}>
          <div style={{display: "flex", flexDirection: "column", gap: 14}}>
            {messages.map((m, i) => (
              <div key={i} style={{alignSelf: m.sender === "user" ? "flex-end" : "flex-start", maxWidth: "85%"}}>
                {m.sender === "user" ? (
                  <div style={{background: "var(--ink)", color: "var(--paper)", padding: "9px 13px", borderRadius: 12, borderBottomRightRadius: 4, fontSize: 13.5}}>{m.text}</div>
                ) : (
                  <div className="card-tight" style={{background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 12, padding: "10px 13px", fontSize: 13.5}}>
                    {m.text}
                    {m.cites && <div className="row" style={{gap: 6, marginTop: 8}}>{m.cites.map(c => <span key={c} className="chip is-accent">{c}</span>)}</div>}
                  </div>
                )}
              </div>
            ))}
            {thinking && (
              <div style={{alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4}}>
                <LoaderHelix dots={6} speed={1.6} variant="dna" />
                <span className="muted" style={{fontSize: 12, fontStyle: "italic"}}>thinking…</span>
              </div>
            )}
            <div ref={endRef}></div>
          </div>
        </div>
        <div style={{padding: 14, borderTop: "1px solid var(--hairline)"}}>
          <div className="row" style={{gap: 6, marginBottom: 10, flexWrap: "wrap"}}>
            {["Summarize this", "Explain page 3", "Quiz me on Ch. 1"].map(s => (
              <button key={s} className="chip" onClick={() => setInput(s)} style={{cursor: "default"}}>{s}</button>
            ))}
          </div>
          <div className="card-tight" style={{display: "flex", gap: 8, alignItems: "flex-end", padding: 6}}>
            <input className="input" aria-label="Ask about this document" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about this document…" style={{border: 0, background: "transparent"}} />
            <button className="btn is-accent is-icon is-sm" onClick={send}><Icon name="send" size={14} className="" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenPdfQA;
