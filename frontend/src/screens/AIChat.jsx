import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '../components/Shell';
import foxHeadImg from '../assets/fox-head.png';

// ── Elevated message component ────────────────────────────────
function ElevatedMessage({ msg, isHovered, isCopied, onHover, onCopy }) {
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

        {/* Prose text */}
        <div style={{
          paddingLeft: 33,
          fontSize: 15, lineHeight: 1.72,
          color: "var(--ink)", letterSpacing: -0.004,
          textWrap: "pretty", whiteSpace: "pre-wrap",
        }}>
          {msg.text}
        </div>

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
        paddingLeft: 33,
        display: "flex", gap: 5, alignItems: "center",
      }}>
        <ChatDot delay="0s" />
        <ChatDot delay="0.15s" />
        <ChatDot delay="0.3s" />
        <span style={{
          fontSize: 12, color: "var(--ink-4)", marginLeft: 5,
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

// ── Fallback synthesizer (used when Claude is unavailable) ────
function synthesizeFallback(q, ctx, docs) {
  const doc = docs.find(d => String(d.id) === String(ctx));
  const docCtx = doc ? ` of *${doc.name.replace(/\.[a-z]+$/i, "")}*` : "";
  const lq = q.toLowerCase();
  if (lq.includes("summari")) {
    return `Here's a concise summary${docCtx}:\n\n• Core idea: the central thesis is stated up-front.\n• Three supporting frameworks anchor the argument.\n• Two case studies illustrate edge behaviour.\n• Limitations are acknowledged.\n• Future work points toward unresolved questions.`;
  }
  if (lq.includes("quiz") || lq.includes("test me")) {
    return `Happy to quiz you. Head to the Quizzes tab and I'll draft 10 questions — or tell me the topic and difficulty and I'll ask right here.`;
  }
  if (lq.includes("explain") || lq.includes("break down")) {
    return `Think of it this way:\n\nThe rule applies to composite functions — treat the outer and inner parts separately. Find the derivative of each, then multiply them together.\n\nExample: for sin(x²), the outer is sin (derivative: cos) and the inner is x² (derivative: 2x). Result: cos(x²) · 2x.`;
  }
  if (lq.includes("compar")) {
    return `Both share common ground but diverge on key points. The most useful way to compare is along three axes: origin, mechanism, and real-world consequence. Would you like me to build a structured table?`;
  }
  return `Good question${docCtx ? ` about ${docCtx}` : ""}. There are a few angles worth exploring — the short answer depends on how deep you want to go. Tell me your current understanding and I'll calibrate.`;
}

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

  const endRef = useRef(null);
  const scrollRef = useRef(null);
  const textRef = useRef(null);

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

    let reply;
    try {
      const doc = state.documents.find(d => String(d.id) === String(ctxDoc));
      const sys = doc
        ? `You are DocMind, an AI study assistant. The user has loaded "${doc.name}". Be concise, pedagogically precise, under 3 paragraphs.`
        : `You are DocMind, an AI study assistant. Be concise, pedagogically precise, under 3 paragraphs.`;
      reply = await window.claude.complete({
        messages: [{ role: "user", content: `${sys}\n\n${t}` }],
      });
    } catch (e) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 500));
      reply = synthesizeFallback(t, ctxDoc, state.documents);
    }

    setMessages(m => [...m, {
      id: Date.now() + 1, sender: "ai", text: reply, ts: Date.now(),
    }]);
    setThinking(false);
  }

  const activeDoc = state.documents.find(d => String(d.id) === String(ctxDoc));
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
      display: "flex", flexDirection: "column",
      height: "100%",
      marginInline: "-36px", marginTop: -28, marginBottom: -80,
      fontFamily: "var(--f-body)",
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
          <div style={{
            fontFamily: "var(--f-display)",
            fontSize: 30, fontWeight: 600,
            letterSpacing: -0.022, lineHeight: 1,
            color: "var(--ink)",
          }}>
            Ask <em style={{ fontStyle: "italic", fontWeight: 400, color: "var(--ink-2)" }}>anything.</em>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {/* doc context selector */}
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
              onChange={e => setCtxDoc(e.target.value)}
              style={{
                border: 0, outline: 0, background: "transparent",
                color: "var(--ink)", font: "inherit",
                fontSize: 12.5, fontWeight: 500,
                padding: "0 14px 0 4px",
                cursor: "pointer", maxWidth: 200,
              }}
            >
              <option value="">None</option>
              {state.documents.map(d => (
                <option key={d.id} value={d.id}>{d.name.replace(/\.[a-z]+$/i, "")}</option>
              ))}
            </select>
          </div>

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
            <div style={{ marginBottom: 10 }}>
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
                title="Voice"
                style={{
                  width: 34, height: 34, borderRadius: 10,
                  border: "1px solid var(--hairline)",
                  background: "var(--paper-2)",
                  display: "grid", placeItems: "center",
                  cursor: "pointer", color: "var(--ink-3)",
                  transition: "background 0.12s, color 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--card)"; e.currentTarget.style.color = "var(--ink-2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--paper-2)"; e.currentTarget.style.color = "var(--ink-3)"; }}
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

      <style>{`@keyframes dotbounce { 0%, 80%, 100% { transform: translateY(0); } 40% { transform: translateY(-6px); } }`}</style>
    </div>
  );
}

export { ElevatedMessage, ThinkingRow, ChatDot, ChatDivider, synthesizeFallback, CHAT_SUGGESTIONS };
export default ScreenAIChat;
