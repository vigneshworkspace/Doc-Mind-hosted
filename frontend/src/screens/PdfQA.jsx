import { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Shell';
import { DocIcon } from './Dashboard';

function ScreenPdfQA({ state, dispatch }) {
  const [doc, setDoc] = useState(state.documents[0]);
  const [messages, setMessages] = useState([
    { sender: "ai", text: "Loaded — ask me anything from this document and I'll cite where I'm looking." }
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  useEffect(() => endRef.current?.scrollIntoView?.({block: "end"}), [messages]);

  function send() {
    if (!input.trim()) return;
    const u = { sender: "user", text: input };
    setMessages(m => [...m, u]);
    setInput("");
    setTimeout(() => {
      setMessages(m => [...m, { sender: "ai", text: `According to ${doc.name}, ${input.toLowerCase().includes("summar") ? "the document outlines three central concepts: quantization, wave-particle duality, and the uncertainty principle. Each is illustrated through a canonical experiment." : "the passage you're asking about is best summarized on page 4. The argument hinges on the distinction between continuous and discrete quantities — which is precisely the foundation for the chapter's later claims about measurement."}`, cites: ["p.3", "p.4–5"] }]);
    }, 700);
  }

  return (
    <div className="grid" style={{gridTemplateColumns: "1.1fr 1fr", height: "calc(100vh - var(--top-h) - 40px)", gap: 16}}>
      <div className="card card-flush" style={{display: "flex", flexDirection: "column", overflow: "hidden"}}>
        <div className="row" style={{padding: "14px 16px", borderBottom: "1px solid var(--hairline)", gap: 10}}>
          <DocIcon ext={doc?.type} />
          <div style={{flex: 1, minWidth: 0}}>
            <div style={{fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{doc?.name}</div>
            <div className="muted" style={{fontSize: 11.5}}>{doc?.size} · 12 pages</div>
          </div>
          <select className="input" style={{width: "auto", height: 30, fontSize: 12, paddingRight: 28}} value={doc?.id || ""} onChange={e => setDoc(state.documents.find(d => d.id === +e.target.value))}>
            {state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="scroll-area" style={{flex: 1, background: "var(--paper-2)", padding: 24}}>
          <div style={{background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "28px 32px", boxShadow: "0 1px 0 var(--paper-2)", maxWidth: 520, margin: "0 auto"}}>
            <div className="t-mono" style={{fontSize: 10, color: "var(--ink-4)", marginBottom: 16}}>PAGE 3</div>
            <div className="t-display" style={{fontSize: 22, marginBottom: 14}}>{doc?.name?.replace(/\.[a-z]+$/i, "")}</div>
            <p style={{fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", marginBottom: 12}}>{doc?.content?.slice(0, 280)}{doc?.content && doc.content.length > 280 ? "…" : ""}</p>
            <p style={{fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)", marginBottom: 12}}>The argument proceeds by considering what it would mean for energy to be infinitely divisible. Empirically, this turns out not to be the case: black-body radiation curves can only be explained if energy comes in indivisible packets, called <em>quanta</em>.</p>
            <p style={{fontSize: 13, lineHeight: 1.7, color: "var(--ink-2)"}}>This insight, due to Planck and later extended by Einstein, set the stage for the formalism developed in the following chapter.</p>
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
            <input className="input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask about this document…" style={{border: 0, background: "transparent"}} />
            <button className="btn is-accent is-icon is-sm" onClick={send}><Icon name="send" size={14} className="" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenPdfQA;
