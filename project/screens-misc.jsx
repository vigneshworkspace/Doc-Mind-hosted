// screens-misc.jsx — Notes, Groups, Pomodoro, History, Settings, Voice Chat

const { useState: useS4, useEffect: useE4, useRef: useR4 } = React;

// ─────────────────────────── NOTES ───────────────────────────
function ScreenNotes({ state, dispatch }) {
  const [active, setActive] = useS4(state.notes[0]?.id);
  const note = state.notes.find(n => n.id === active);
  const [title, setTitle] = useS4(note?.title || "");
  const [content, setContent] = useS4(note?.content || "");

  useE4(() => { setTitle(note?.title || ""); setContent(note?.content || ""); }, [active]);

  function save() {
    if (note) dispatch({ type: "update-note", id: note.id, title, content });
  }
  function add() {
    const n = { id: Date.now(), title: "Untitled", content: "", subject: "General", date: new Date().toISOString().slice(0,10) };
    dispatch({ type: "add-note", note: n });
    setActive(n.id);
  }

  return (
    <div className="grid" style={{gridTemplateColumns: "260px 1fr", gap: 18, height: "calc(100vh - var(--top-h) - 56px)"}}>
      <div className="card card-flush" style={{display: "flex", flexDirection: "column"}}>
        <div className="row" style={{padding: "14px 14px 10px", justifyContent: "space-between"}}>
          <div className="t-eyebrow">Notes</div>
          <button className="btn is-quiet is-sm" onClick={add}><Icon name="plus" size={12} className="" /></button>
        </div>
        <div className="scroll-area" style={{flex: 1, padding: "0 8px 12px"}}>
          {state.notes.map(n => (
            <button key={n.id} className="lift" style={{width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, background: n.id === active ? "var(--paper-2)" : "transparent", border: 0, marginBottom: 2, cursor: "default"}} onClick={() => { save(); setActive(n.id); }}>
              <div style={{fontSize: 13.5, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{n.title}</div>
              <div className="muted" style={{fontSize: 11.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{n.subject} · {n.date}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{display: "flex", flexDirection: "column", overflow: "hidden"}}>
        {note ? (
          <>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} onBlur={save} style={{border: 0, background: "transparent", fontFamily: "var(--f-display)", fontSize: 36, padding: 0, height: "auto", letterSpacing: "-0.02em"}} />
            <div className="row" style={{gap: 8, marginTop: 6, marginBottom: 14}}>
              <span className="chip">{note.subject}</span>
              <span className="muted" style={{fontSize: 12}}>{note.date}</span>
              <div className="spacer"></div>
              <span className="muted" style={{fontSize: 12}}>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
            </div>
            <textarea className="input scroll-area" value={content} onChange={e => setContent(e.target.value)} onBlur={save} placeholder="Start writing…" style={{flex: 1, border: 0, background: "transparent", padding: 0, fontFamily: "var(--f-body)", fontSize: 15, lineHeight: 1.7, resize: "none"}} />
          </>
        ) : (
          <div className="muted" style={{display: "grid", placeItems: "center", height: "100%"}}>No note selected.</div>
        )}
      </div>
    </div>
  );
}
window.ScreenNotes = ScreenNotes;


// ─────────────────────────── STUDY GROUPS ───────────────────────────
function ScreenGroups({ state, dispatch }) {
  const [creating, setCreating] = useS4(false);
  const [draft, setDraft] = useS4({ name: "", subject: "", description: "" });

  function create() {
    const g = { id: Date.now(), name: draft.name || "New group", subject: draft.subject || "General", description: draft.description, members: 1, nextSession: "" };
    dispatch({ type: "add-group", group: g });
    setCreating(false);
    setDraft({ name: "", subject: "", description: "" });
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <div className="row" style={{justifyContent: "space-between", alignItems: "flex-end"}}>
          <div>
            <h1>Study, <em className="t-italic">together.</em></h1>
            <p>Form groups around a subject, schedule sessions, share notes.</p>
          </div>
          <button className="btn is-accent" onClick={() => setCreating(c => !c)}><Icon name="plus" size={14} className="" /> New group</button>
        </div>
      </div>

      {creating && (
        <div className="card">
          <div className="grid grid-2" style={{gap: 14, marginBottom: 14}}>
            <div><label className="field-label">Name</label><input className="input" value={draft.name} onChange={e => setDraft(d => ({...d, name: e.target.value}))} placeholder="e.g. Calculus Crew" /></div>
            <div><label className="field-label">Subject</label><input className="input" value={draft.subject} onChange={e => setDraft(d => ({...d, subject: e.target.value}))} placeholder="Mathematics" /></div>
          </div>
          <label className="field-label">Description</label>
          <textarea className="input" value={draft.description} onChange={e => setDraft(d => ({...d, description: e.target.value}))} placeholder="What will you focus on?"></textarea>
          <div className="row" style={{gap: 8, marginTop: 12, justifyContent: "flex-end"}}>
            <button className="btn is-quiet" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn is-accent" onClick={create}>Create</button>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {state.studyGroups.map(g => (
          <div key={g.id} className="card lift" style={{display: "flex", flexDirection: "column", gap: 14, cursor: "default"}}>
            <div className="row" style={{justifyContent: "space-between"}}>
              <span className="chip is-accent">{g.subject}</span>
              <span className="muted" style={{fontSize: 12}}>{g.members} members</span>
            </div>
            <div>
              <div style={{fontFamily: "var(--f-display)", fontSize: 26, lineHeight: 1.1}}>{g.name}</div>
              <p className="muted" style={{fontSize: 13.5, marginTop: 8, lineHeight: 1.55}}>{g.description}</p>
            </div>
            <div className="hairline" style={{margin: "4px 0"}}></div>
            <div className="row" style={{justifyContent: "space-between", alignItems: "center"}}>
              <div className="row" style={{gap: -8}}>
                {[...Array(Math.min(4, g.members))].map((_, i) => (
                  <div key={i} style={{width: 26, height: 26, borderRadius: 50, background: `oklch(${60 + i*5}% 0.06 ${50 + i*60})`, border: "2px solid var(--card)", marginLeft: i === 0 ? 0 : -8, color: "white", display: "grid", placeItems: "center", fontSize: 10, fontFamily: "var(--f-display)", fontStyle: "italic"}}>{String.fromCharCode(65 + i)}</div>
                ))}
                {g.members > 4 && <div style={{width: 26, height: 26, borderRadius: 50, background: "var(--paper-2)", border: "2px solid var(--card)", marginLeft: -8, color: "var(--ink-3)", display: "grid", placeItems: "center", fontSize: 10}}>+{g.members - 4}</div>}
              </div>
              <div className="row" style={{gap: 6}}>
                <button className="btn is-ghost is-sm">View</button>
                <button className="btn is-accent is-sm">Join</button>
              </div>
            </div>
            {g.nextSession && (
              <div className="card-tight" style={{background: "var(--paper-2)", padding: "10px 12px", borderRadius: 8, fontSize: 12.5, color: "var(--ink-2)"}}>
                <span className="t-eyebrow" style={{marginRight: 6}}>Next</span> {g.nextSession}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
window.ScreenGroups = ScreenGroups;


// ─────────────────────────── POMODORO ───────────────────────────
function ScreenPomodoro({ pomodoro, setPomodoro }) {
  const minutes = Math.floor(pomodoro.seconds / 60);
  const seconds = pomodoro.seconds % 60;
  const total = pomodoro.mode === "focus" ? pomodoro.focusMin * 60 : pomodoro.breakMin * 60;
  const progress = 1 - pomodoro.seconds / total;

  function toggle() { setPomodoro(p => ({...p, running: !p.running})); }
  function reset() { setPomodoro(p => ({...p, running: false, seconds: (p.mode === "focus" ? p.focusMin : p.breakMin) * 60})); }
  function switchMode(m) { setPomodoro(p => ({...p, mode: m, seconds: (m === "focus" ? p.focusMin : p.breakMin) * 60, running: false})); }

  const C = 2 * Math.PI * 130;

  return (
    <div className="col" style={{gap: 24, maxWidth: 720, margin: "0 auto", width: "100%", textAlign: "center"}}>
      <div className="page-hero" style={{textAlign: "left", marginBottom: 0}}>
        <h1>Time, <em className="t-italic">on your side.</em></h1>
        <p>Twenty-five focused minutes, five to breathe. Repeat.</p>
      </div>

      <div className="row" style={{justifyContent: "center", gap: 6}}>
        {[["focus", "Focus"], ["break", "Break"]].map(([v, l]) => (
          <button key={v} className={`btn is-sm ${pomodoro.mode === v ? "" : "is-ghost"}`} onClick={() => switchMode(v)}>{l}</button>
        ))}
      </div>

      <div style={{position: "relative", width: 320, height: 320, margin: "0 auto"}}>
        <svg width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="130" fill="none" stroke="var(--hairline)" strokeWidth="1.5" />
          <circle cx="160" cy="160" r="130" fill="none" stroke={pomodoro.mode === "focus" ? "var(--accent)" : "var(--info)"} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 160 160)" style={{transition: "stroke-dashoffset 1s linear"}} />
          {/* tick marks */}
          {[...Array(60)].map((_, i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const x1 = 160 + Math.cos(a) * 148, y1 = 160 + Math.sin(a) * 148;
            const x2 = 160 + Math.cos(a) * (i % 5 === 0 ? 140 : 144), y2 = 160 + Math.sin(a) * (i % 5 === 0 ? 140 : 144);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-4)" strokeWidth={i % 5 === 0 ? 1.2 : 0.6} />;
          })}
        </svg>
        <div style={{position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"}}>
          <div className="t-eyebrow">{pomodoro.mode === "focus" ? "Focusing" : "Breathe"}</div>
          <div className="t-mono" style={{fontSize: 72, fontWeight: 300, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 6}}>
            {String(minutes).padStart(2, "0")}<span style={{opacity: 0.4}}>:</span>{String(seconds).padStart(2, "0")}
          </div>
          <div className="muted" style={{fontSize: 12, marginTop: 8}}>Cycle {pomodoro.cycle}</div>
        </div>
      </div>

      <div className="row" style={{justifyContent: "center", gap: 12}}>
        <button className="btn is-ghost is-icon" onClick={reset}><Icon name="chevL" size={16} className="" /></button>
        <button className="btn is-accent" style={{width: 72, height: 72, borderRadius: 36}} onClick={toggle}>
          <Icon name={pomodoro.running ? "pause" : "play"} size={26} className="" />
        </button>
        <button className="btn is-ghost is-icon"><Icon name="settings" size={16} className="" /></button>
      </div>

      <div className="grid grid-3" style={{maxWidth: 480, margin: "0 auto"}}>
        <div className="card card-tight">
          <div className="t-eyebrow">Focus</div>
          <div className="t-mono" style={{fontSize: 22, marginTop: 4}}>{pomodoro.focusMin} min</div>
        </div>
        <div className="card card-tight">
          <div className="t-eyebrow">Break</div>
          <div className="t-mono" style={{fontSize: 22, marginTop: 4}}>{pomodoro.breakMin} min</div>
        </div>
        <div className="card card-tight">
          <div className="t-eyebrow">Today</div>
          <div className="t-mono" style={{fontSize: 22, marginTop: 4}}>{pomodoro.todayCycles}×</div>
        </div>
      </div>
    </div>
  );
}
window.ScreenPomodoro = ScreenPomodoro;


// ─────────────────────────── HISTORY ───────────────────────────
function ScreenHistory({ state, setTab }) {
  const events = [
    ...state.quizzes.map(q => ({ kind: "quiz", id: q.id, title: q.title, date: q.date, meta: q.completed ? `${q.score}%` : "in progress", icon: "quiz-generator" })),
    ...state.flashcardSets.map(f => ({ kind: "flashcards", id: f.id, title: f.title, date: f.date, meta: `${f.cards.length} cards`, icon: "flashcards" })),
    ...state.mindMaps.map(m => ({ kind: "mind-map", id: m.id, title: m.title, date: m.date, meta: "mind map", icon: "mind-map" })),
    ...state.audioRecaps.map(r => ({ kind: "audio-recap", id: r.id, title: r.title, date: r.date, meta: "audio recap", icon: "audio-recap" })),
    ...state.quickReviseSessions.map(s => ({ kind: "quick-revise", id: s.id, title: s.title, date: s.date, meta: "quick revise", icon: "quick-revise" })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const groups = events.reduce((g, e) => { (g[e.date] ||= []).push(e); return g; }, {});

  return (
    <div className="col" style={{gap: 24, maxWidth: 760, margin: "0 auto", width: "100%"}}>
      <div className="page-hero" style={{marginBottom: 0, paddingBottom: 18}}>
        <h1>Everything you've <em className="t-italic">made.</em></h1>
        <p>Quizzes, cards, mind maps, recaps — all of it, ordered by day.</p>
      </div>
      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <div className="row" style={{alignItems: "baseline", gap: 14, marginBottom: 12}}>
            <div className="t-display" style={{fontSize: 28}}>{new Date(date).toLocaleDateString(undefined, {weekday: "long", month: "long", day: "numeric"})}</div>
            <div className="t-mono" style={{color: "var(--ink-4)", fontSize: 12}}>{date}</div>
          </div>
          <div className="card card-flush">
            {items.map((e, i) => (
              <button key={`${e.kind}-${e.id}`} onClick={() => setTab(e.kind)} className="lift" style={{display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 14, alignItems: "center", padding: "14px 18px", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: i === items.length - 1 ? 0 : "1px solid var(--hairline)", cursor: "default"}}>
                <div style={{width: 32, height: 32, borderRadius: 8, background: "var(--paper-2)", display: "grid", placeItems: "center"}}>
                  <Icon name={e.icon} size={16} className="" />
                </div>
                <div>
                  <div style={{fontWeight: 500}}>{e.title}</div>
                  <div className="muted" style={{fontSize: 12, marginTop: 2}}>{e.kind.replace("-", " ")}</div>
                </div>
                <span className="chip">{e.meta}</span>
                <Icon name="chevR" size={14} className="" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
window.ScreenHistory = ScreenHistory;


// ─────────────────────────── SETTINGS ───────────────────────────
function ScreenSettings({ state, dispatch }) {
  const s = state.settings;
  function set(k, v) { dispatch({ type: "set-settings", patch: {[k]: v}}); }
  return (
    <div className="col" style={{gap: 24, maxWidth: 720, margin: "0 auto", width: "100%"}}>
      <div className="page-hero">
        <h1>Make it <em className="t-italic">yours.</em></h1>
        <p>Tune defaults. Toggle the things that get in your way.</p>
      </div>

      <SettingsGroup title="Account">
        <SettingsRow label="Name" sub={state.user.email}>
          <input className="input" style={{width: 240}} value={state.user.name} onChange={e => dispatch({ type: "set-user", patch: { name: e.target.value }})} />
        </SettingsRow>
        <SettingsRow label="Email">
          <input className="input" style={{width: 240}} value={state.user.email} onChange={e => dispatch({ type: "set-user", patch: { email: e.target.value }})} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="AI">
        <SettingsRow label="Provider" sub="Where AI inference happens">
          <select className="input" style={{width: 240}} value={s.aiProvider} onChange={e => set("aiProvider", e.target.value)}>
            <option value="gemini">Gemini · cloud</option>
            <option value="ollama">Ollama · local</option>
          </select>
        </SettingsRow>
        {s.aiProvider === "ollama" && (
          <SettingsRow label="Endpoint">
            <input className="input" style={{width: 240}} value={s.ollamaEndpoint} onChange={e => set("ollamaEndpoint", e.target.value)} />
          </SettingsRow>
        )}
        <SettingsRow label="Language">
          <select className="input" style={{width: 240}} value={s.language} onChange={e => set("language", e.target.value)}>
            <option>English</option><option>French</option><option>Spanish</option><option>German</option><option>Hindi</option>
          </select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Study">
        <SettingsRow label="Notifications" sub="Quiz reminders, group sessions, and study streaks">
          <Switch on={s.notifications} onChange={v => set("notifications", v)} />
        </SettingsRow>
        <SettingsRow label="Auto-save notes">
          <Switch on={s.autoSave} onChange={v => set("autoSave", v)} />
        </SettingsRow>
        <SettingsRow label="Study reminders" sub="Nudge me if I haven't opened a doc in a few days">
          <Switch on={s.studyReminders} onChange={v => set("studyReminders", v)} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Danger">
        <SettingsRow label="Reset all data" sub="Clears documents, quizzes, flashcards, notes, and history">
          <button className="btn is-ghost is-sm" style={{color: "var(--danger)"}}>Reset</button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
window.ScreenSettings = ScreenSettings;

function SettingsGroup({ title, children }) {
  return (
    <div>
      <div className="t-eyebrow" style={{marginBottom: 12}}>{title}</div>
      <div className="card card-flush">{children}</div>
    </div>
  );
}
function SettingsRow({ label, sub, children }) {
  return (
    <div className="row" style={{padding: "14px 18px", justifyContent: "space-between", gap: 16, borderBottom: "1px solid var(--hairline)", alignItems: "center"}}>
      <div>
        <div style={{fontWeight: 500, fontSize: 14}}>{label}</div>
        {sub && <div className="muted" style={{fontSize: 12, marginTop: 2}}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}
function Switch({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{width: 44, height: 26, borderRadius: 13, background: on ? "var(--accent)" : "var(--hairline)", border: 0, position: "relative", cursor: "default", transition: "background 0.2s var(--ease)"}}>
      <div style={{position: "absolute", top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: 50, background: "white", boxShadow: "0 1px 3px rgba(0,0,0,.15)", transition: "left 0.2s var(--ease)"}}></div>
    </button>
  );
}


// ─────────────────────────── VOICE CHAT ───────────────────────────
function ScreenVoiceChat() {
  const [state, setSt] = useS4("idle"); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useS4("");
  const [reply, setReply] = useS4("");

  function start() {
    setSt("listening");
    setTranscript("");
    setReply("");
    setTimeout(() => { setTranscript("Explain entropy in one paragraph."); setSt("thinking"); }, 1600);
    setTimeout(() => { setReply("Entropy is a measure of disorder — or more precisely, the number of microscopic configurations that yield the same macroscopic state. A messy desk has more arrangements than a tidy one, so it has higher entropy."); setSt("speaking"); }, 2900);
    setTimeout(() => setSt("idle"), 7000);
  }

  const colors = state === "listening" ? "var(--accent)" : state === "speaking" ? "var(--ok)" : "var(--ink-3)";

  return (
    <div className="col" style={{gap: 32, height: "100%", justifyContent: "center", alignItems: "center", padding: "40px 20px"}}>
      <div className="t-eyebrow">{state === "idle" ? "Hold to talk" : state === "listening" ? "Listening" : state === "thinking" ? "Thinking" : "Speaking"}</div>

      <div onClick={state === "idle" ? start : undefined} style={{position: "relative", width: 280, height: 280, display: "grid", placeItems: "center", cursor: "default"}}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `1.5px solid ${colors}`,
            opacity: state === "idle" ? 0.2 + i * 0.1 : 0.4 - i * 0.1,
            transform: `scale(${0.6 + i * 0.2})`,
            animation: state !== "idle" ? `voicepulse ${1.6 + i * 0.4}s ${i * 0.2}s ease-in-out infinite` : "none",
          }}></div>
        ))}
        <div style={{width: 120, height: 120, borderRadius: "50%", background: state === "idle" ? "var(--ink)" : "var(--accent)", display: "grid", placeItems: "center", color: state === "idle" ? "var(--paper)" : "white", transition: "background 0.3s var(--ease)"}}>
          <Icon name="mic" size={36} className="" />
        </div>
      </div>

      {transcript && (
        <div className="card" style={{maxWidth: 480, padding: "14px 18px"}}>
          <div className="t-eyebrow" style={{marginBottom: 4}}>You said</div>
          <div style={{fontSize: 16, fontFamily: "var(--f-display)"}}>{transcript}</div>
        </div>
      )}
      {reply && (
        <div className="card" style={{maxWidth: 520, padding: "14px 18px", background: "var(--ink)", color: "var(--paper)", border: 0}}>
          <div className="t-eyebrow" style={{color: "var(--ink-4)", marginBottom: 4}}>DocMind</div>
          <div style={{fontSize: 15, lineHeight: 1.55}}>{reply}</div>
        </div>
      )}

      <style>{`@keyframes voicepulse { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }`}</style>
    </div>
  );
}
window.ScreenVoiceChat = ScreenVoiceChat;
