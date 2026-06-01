import { useState, useEffect, useRef, useMemo } from 'react';
import foxHeadImg from '../assets/fox-head.png';

// ── Icon ─────────────────────────────────────────────────────────────────────
export function Icon({ name, size = 18, className = "nav-icon" }) {
  const stroke = "currentColor", sw = 1.6;
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke, strokeWidth: sw, strokeLinecap: "round", strokeLinejoin: "round", className,
  };
  const P = {
    dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
    'ai-chat': <><path d="M21 12c0 4-4 7-9 7-1.4 0-2.7-.2-3.9-.6L4 20l1-3.5C3.7 15 3 13.6 3 12c0-4 4-7 9-7s9 3 9 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></>,
    documents: <><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/><path d="M12 7v5l3 2"/></>,
    'quiz-generator': <><path d="M12 3a4 4 0 0 0-4 4c0 1.7 1 3 2 3.5V13h4v-2.5c1-.5 2-1.8 2-3.5a4 4 0 0 0-4-4Z"/><path d="M10 16h4M11 20h2"/></>,
    'pdf-qa': <><rect x="4" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/><circle cx="17.5" cy="17.5" r="3.5"/><path d="M16 17h0M17.5 16v3"/></>,
    'visual-ai': <><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M3 17l5-5 4 4 3-3 6 6"/></>,
    'concept-visualizer': <><circle cx="12" cy="12" r="2"/><ellipse cx="12" cy="12" rx="9" ry="3.5"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-60 12 12)"/></>,
    'ai-diagram-maker': <><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7 14 17M16 7 13 17M8 6h8"/></>,
    flashcards: <><rect x="3" y="6" width="14" height="14" rx="2"/><rect x="7" y="3" width="14" height="14" rx="2" fill="var(--paper)"/></>,
    'mind-map': <><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8 7 16 11M8 17 16 13"/></>,
    'audio-recap': <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></>,
    'quick-revise': <><polygon points="13 2 4 14 12 14 11 22 20 10 12 10 13 2"/></>,
    'voice-chat': <><path d="M12 3v18"/><path d="M8 7v10M16 7v10M4 11v2M20 11v2"/></>,
    pomodoro: <><circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><path d="M9 3h6"/></>,
    'study-notes': <><path d="M5 4h11l4 4v12a0 0 0 0 1 0 0H5a0 0 0 0 1 0 0V4Z"/><path d="M16 4v4h4"/><path d="M9 12h7M9 16h5"/></>,
    'study-groups': <><circle cx="9" cy="9" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c1-3 4-4 6-4s5 1 6 4"/><path d="M15 15c1.5 0 5 1 6 4"/></>,
    youtube: <><rect x="3" y="6" width="18" height="12" rx="3"/><polygon points="10.5 9.5 15 12 10.5 14.5"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .67.41 1.27 1 1.51.6.25 1.3.11 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06c-.44.52-.58 1.22-.33 1.82.24.59.84 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.67 0-1.27.41-1.51 1Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
    moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevR: <><path d="m9 6 6 6-6 6"/></>,
    chevL: <><path d="m15 6-6 6 6 6"/></>,
    chevD: <><path d="m6 9 6 6 6-6"/></>,
    chevU: <><path d="m6 15 6-6 6 6"/></>,
    timer: <><circle cx="12" cy="13" r="8"/><path d="M12 13V9"/><path d="M9 3h6"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
    play: <><polygon points="6 4 20 12 6 20 6 4"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    check: <><polyline points="4 12 10 18 20 6"/></>,
    star: <><polygon points="12 2 15 9 22 10 17 15 19 22 12 18 5 22 7 15 2 10 9 9 12 2"/></>,
    flame: <><path d="M12 22c4 0 7-3 7-7 0-3-2-4-3-7 0-2 1-3 0-5-2 3-5 2-6 5-1 2 0 4-1 5-2 2-4 2-4 7 0 4 3 7 7 7Z"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
    send: <><path d="M22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
    sparkles: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/><path d="m6 6 3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/></>,
    bell: <><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21h4"/></>,
    logout: <><path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M3 12h12"/></>,
  };
  return <svg {...common}>{P[name] || null}</svg>;
}

// ── Nav definitions ──────────────────────────────────────────────────────────
export const NAV_GROUPS = [
  { label: "Study", items: [
    { id: "dashboard", label: "Dashboard" },
    { id: "documents", label: "Library" },
    { id: "ai-chat", label: "AI Chat" },
    { id: "youtube", label: "YouTube" },
  ]},
  { label: "Generate", items: [
    { id: "quiz-generator", label: "Quizzes" },
    { id: "flashcards", label: "Flashcards" },
    { id: "mind-map", label: "Mind Maps" },
    { id: "ai-diagram-maker", label: "Diagrams" },
    { id: "concept-visualizer", label: "Concepts" },
    { id: "audio-recap", label: "Audio Recap" },
    { id: "quick-revise", label: "Quick Revise" },
  ]},
  { label: "Ask", items: [
    { id: "pdf-qa", label: "PDF Q&A" },
    { id: "visual-ai", label: "Visual Doubts" },
    { id: "voice-chat", label: "Voice" },
  ]},
  { label: "Workspace", items: [
    { id: "study-notes", label: "Notes" },
    { id: "study-groups", label: "Groups" },
    { id: "pomodoro", label: "Pomodoro" },
    { id: "history", label: "History" },
  ]},
];

export const NAV_TITLES = {
  dashboard: { eyebrow: "Today", title: "Dashboard" },
  documents: { eyebrow: "Library", title: "Documents" },
  'ai-chat': { eyebrow: "Conversation", title: "AI Chat" },
  youtube:   { eyebrow: "Watch", title: "YouTube" },
  'quiz-generator': { eyebrow: "Practice", title: "Quizzes" },
  flashcards: { eyebrow: "Repeat", title: "Flashcards" },
  'mind-map': { eyebrow: "Map", title: "Mind Maps" },
  'ai-diagram-maker': { eyebrow: "Sketch", title: "Diagrams" },
  'concept-visualizer': { eyebrow: "See", title: "Concept Visualizer" },
  'audio-recap': { eyebrow: "Listen", title: "Audio Recap" },
  'quick-revise': { eyebrow: "Skim", title: "Quick Revise" },
  'pdf-qa': { eyebrow: "Ask", title: "PDF Q&A" },
  'visual-ai': { eyebrow: "Ask", title: "Visual Doubts" },
  'voice-chat': { eyebrow: "Speak", title: "Voice" },
  'study-notes': { eyebrow: "Write", title: "Notes" },
  'study-groups': { eyebrow: "Together", title: "Study Groups" },
  pomodoro: { eyebrow: "Focus", title: "Pomodoro" },
  history: { eyebrow: "Past", title: "History" },
  settings: { eyebrow: "Configure", title: "Settings" },
};

// ── Sidebar ───────────────────────────────────────────────────────────────────
export function Sidebar({ tab, setTab, onLogout, user }) {
  const today = new Date();
  const day = today.getDate();
  const month = today.toLocaleString("en", { month: "short" }).toLowerCase();
  const weekday = today.toLocaleString("en", { weekday: "short" }).toLowerCase();
  const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

  return (
    <aside className="side">
      {/* masthead */}
      <div className="side-masthead">
        <div className="side-mast-row">
          <img className="side-mast-fox" src={foxHeadImg} alt="DocMind" />
          <div>
            <div className="side-mast-brand">Doc<em>Mind</em></div>
            <div className="side-mast-tag">your study buddy</div>
          </div>
        </div>
      </div>

      <nav className="side-nav">
        {NAV_GROUPS.map((group, gi) => (
          <div className="side-group" key={group.label}>
            <div className="side-group-label">
              <span className="side-group-num">{ROMAN[gi]}.</span> {group.label.toLowerCase()}
              <span className="side-group-rule" />
            </div>
            {group.items.map((item, ii) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? "is-active" : ""}`}
                onClick={() => setTab(item.id)}>
                <span className="nav-num">{ROMAN[ii]}</span>
                <span className="nav-label">{item.label}</span>
                <Icon name={item.id} size={14} className="nav-icon" />
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="side-foot">
        <div className="side-today">
          <div className="side-today-head">
            <span className="side-today-eyebrow">today</span>
            <span className="side-today-wd">{weekday}.</span>
          </div>
          <div className="side-today-row">
            <span className="side-today-day">{day}</span>
            <div className="side-today-meta">
              <div className="side-today-month">{month}</div>
              <div className="side-today-streak">
                <span className="side-today-flame">●</span> 12-day streak
              </div>
            </div>
          </div>
        </div>
        <button
          className={`nav-item is-quiet ${tab === "settings" ? "is-active" : ""}`}
          onClick={() => setTab("settings")}>
          <span className="nav-num">·</span>
          <span className="nav-label">Settings</span>
          <Icon name="settings" size={14} className="nav-icon" />
        </button>
      </div>
    </aside>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
export function TopBar({ tab, dark, onToggleDark, onOpenSearch, onOpenMenu, pomodoro, setPomodoro, setTab, user, onLogout }) {
  const t = NAV_TITLES[tab] || { eyebrow: "", title: tab };
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onOpenMenu} aria-label="Menu">
        <Icon name="menu" size={16} className="" />
      </button>
      <div className="crumbs">
        <div className="crumbs-rule" aria-hidden="true">
          <span className="crumbs-rule-dot" />
          <span className="crumbs-eyebrow">— {t.eyebrow}</span>
        </div>
        <span className="crumbs-title">{t.title}</span>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {pomodoro && pomodoro.seconds < (pomodoro.mode === "focus" ? pomodoro.focusMin : pomodoro.breakMin) * 60 && (
          <PomodoroMini pomodoro={pomodoro} setPomodoro={setPomodoro} onOpen={() => setTab && setTab("pomodoro")} />
        )}
        <button className="topbar-search" onClick={onOpenSearch}>
          <Icon name="search" size={14} className="" />
          <span style={{ flex: 1, textAlign: "left" }}>Search everything…</span>
          <span className="nav-kbd">⌘K</span>
        </button>
        <ThemeToggle dark={dark} onToggle={onToggleDark} />
        <button className="topbar-user" onClick={onLogout} title="Log out">
          <span className="topbar-user-avatar">{(user?.name || "S")[0]}</span>
          <span className="topbar-user-name">{(user?.name || "Student").split(" ")[0]}</span>
        </button>
      </div>
    </header>
  );
}

// ── ThemeToggle ───────────────────────────────────────────────────────────────
export function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      className={`theme-toggle ${dark ? "is-dark" : "is-light"}`}
      onClick={onToggle}
      aria-label="Toggle theme"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="theme-toggle-knob" aria-hidden="true" />
      <span className="theme-toggle-icon theme-toggle-icon--sun" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>
        </svg>
      </span>
      <span className="theme-toggle-icon theme-toggle-icon--moon" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>
        </svg>
      </span>
    </button>
  );
}

// ── PomodoroMini ──────────────────────────────────────────────────────────────
export function PomodoroMini({ pomodoro, setPomodoro, onOpen }) {
  const total = (pomodoro.mode === "focus" ? pomodoro.focusMin : pomodoro.breakMin) * 60;
  const progress = 1 - pomodoro.seconds / total;
  const mm = String(Math.floor(pomodoro.seconds / 60)).padStart(2, "0");
  const ss = String(pomodoro.seconds % 60).padStart(2, "0");
  const isFocus = pomodoro.mode === "focus";
  const color = isFocus ? "var(--accent)" : "var(--info)";
  const C = 2 * Math.PI * 9;

  function toggle(e) { e.stopPropagation(); setPomodoro(p => ({ ...p, running: !p.running })); }
  function reset(e) { e.stopPropagation(); setPomodoro(p => ({ ...p, running: false, seconds: (p.mode === "focus" ? p.focusMin : p.breakMin) * 60 })); }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen?.(); } }}
      title="Open Pomodoro"
      style={{
        display: "flex", alignItems: "center", gap: 10,
        height: 32, padding: "0 4px 0 8px",
        background: "var(--card)",
        border: "1px solid var(--hairline)",
        borderRadius: 8,
        cursor: "default",
        animation: "pomslide 0.35s var(--ease) backwards",
      }}>
      <svg width="22" height="22" viewBox="0 0 22 22" style={{ flexShrink: 0 }}>
        <circle cx="11" cy="11" r="9" fill="none" stroke="var(--hairline)" strokeWidth="2" />
        <circle cx="11" cy="11" r="9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                transform="rotate(-90 11 11)"
                style={{ transition: "stroke-dashoffset 1s linear" }} />
        {pomodoro.running ? (
          <g><rect x="8.5" y="7" width="1.6" height="8" rx="0.5" fill={color} />
             <rect x="11.9" y="7" width="1.6" height="8" rx="0.5" fill={color} /></g>
        ) : (
          <polygon points="9,7 9,15 15,11" fill={color} />
        )}
      </svg>
      <div className="row" style={{ gap: 4, alignItems: "baseline" }}>
        <span className="t-mono" style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{mm}<span style={{ opacity: 0.4 }}>:</span>{ss}</span>
        <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: 0.1, textTransform: "uppercase", color: "var(--ink-4)" }}>{isFocus ? "focus" : "break"}</span>
      </div>
      <div className="row" style={{ gap: 2 }}>
        <button type="button" onClick={toggle} aria-label={pomodoro.running ? "Pause" : "Play"} title={pomodoro.running ? "Pause" : "Play"}
              style={{ width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", cursor: "default", background: "transparent", border: "none", padding: 0, color: "inherit" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <Icon name={pomodoro.running ? "pause" : "play"} size={11} className="" />
        </button>
        <button type="button" onClick={reset} aria-label="Reset" title="Reset"
              style={{ width: 24, height: 24, borderRadius: 6, display: "grid", placeItems: "center", cursor: "default", background: "transparent", border: "none", padding: 0, color: "inherit" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "var(--paper-2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <Icon name="chevL" size={11} className="" />
        </button>
      </div>
    </div>
  );
}

// ── CommandPalette ────────────────────────────────────────────────────────────
export function CommandPalette({ open, setOpen, setTab, documents = [] }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  useEffect(() => {
    function onKey(e) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(o => !o); }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const allItems = useMemo(() => {
    const navs = NAV_GROUPS.flatMap(g => g.items.map(i => ({ kind: "nav", id: i.id, label: i.label, group: g.label })));
    const docs = documents.map(d => ({ kind: "doc", id: d.id, label: d.name, group: "Documents" }));
    return [...navs, ...docs];
  }, [documents]);

  const filtered = allItems.filter(i => i.label.toLowerCase().includes(q.toLowerCase())).slice(0, 8);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.22)", zIndex: 200, display: "grid", placeItems: "start center", paddingTop: "12vh" }} onClick={() => setOpen(false)}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(560px, calc(100vw - 32px))", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.18)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--hairline)" }}>
          <Icon name="search" size={16} className="" />
          <input ref={inputRef} aria-label="Jump to anything" value={q} onChange={e => setQ(e.target.value)} placeholder="Jump to anything…" style={{ border: 0, outline: 0, background: "transparent", flex: 1, font: "inherit", fontSize: 14, color: "var(--ink)" }} />
          <span className="kbd">esc</span>
        </div>
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: 6 }}>
          {filtered.length === 0 && <div className="muted" style={{ padding: 18, textAlign: "center" }}>Nothing found.</div>}
          {filtered.map((item, i) => (
            <button key={i} className="nav-item" style={{ margin: 0 }} onClick={() => { if (item.kind === "nav") setTab(item.id); setOpen(false); }}>
              <Icon name={item.kind === "nav" ? item.id : "documents"} />
              <span className="nav-label">{item.label}</span>
              <span className="muted" style={{ fontSize: 11 }}>{item.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
