// screens-core.jsx — Dashboard, Library, AI Chat

const { useState: useS1, useEffect: useE1, useRef: useR1, useMemo: useM1 } = React;

// ─────────────────────────── DASHBOARD ───────────────────────────
function ScreenDashboard({ state, setTab, dispatch }) {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 6 ? "Up early" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const completed = state.quizzes.filter(q => q.completed);
  const avgScore = completed.length ? Math.round(completed.reduce((a, q) => a + (q.score || 0), 0) / completed.length) : 0;
  const streak = state.streak;

  // issue number derived from weekday / streak for fun
  const issueNum = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000) + 100;

  return (
    <div className="col" style={{gap: 40}}>
      {/* MASTHEAD */}
      <div className="masthead">
        <span>DocMind <em style={{fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: "var(--ink-3)", marginLeft: 6, fontFamily: "var(--f-display)", fontSize: 14}}>Daily</em></span>
        <span style={{display: "flex", gap: 22}}>
          <span>Vol. XII</span>
          <span>No. {issueNum}</span>
          <span>{now.toLocaleDateString(undefined, {month: "long", day: "numeric", year: "numeric"})}</span>
          <span style={{display: "inline-flex", alignItems: "center", gap: 6}}><span className="dot"></span>Live</span>
        </span>
      </div>

      {/* HERO ROW: greeting + lead + dstack */}
      <div className="dash-hero" style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end"}}>
        <div>
          <h1 className="t-display" style={{fontSize: 60, lineHeight: 1.04, letterSpacing: "-0.025em"}}>
            {greet}, <em className="t-italic">{(state.user.name || "Student").split(" ")[0]}</em>.
          </h1>
          <p style={{maxWidth: "58ch", marginTop: 16, fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)"}}>
            You've kept a {streak}-day streak<span className="fn">1</span>. Two quizzes wait, three new ideas sit in the library, and one audio recap is queued for your commute<span className="fn">2</span>. Quiet work ahead.
          </p>
        </div>
        <div style={{display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 14}}>
          <div className="dstack">
            <span className="d-month">{now.toLocaleDateString(undefined, {month: "short"})}</span>
            <span className="d-day">{now.getDate()}</span>
            <span className="d-wd">{now.toLocaleDateString(undefined, {weekday: "short"})}</span>
          </div>
          <button className="btn is-ghost is-sm" onClick={() => setTab("pomodoro")}>
            <Icon name="pomodoro" size={12} className="" /> Start focus
          </button>
        </div>
      </div>

      {/* BIG ASYMMETRIC ROW: streak + open + recommend */}
      <div className="dash-bigrow" style={{display: "grid", gridTemplateColumns: "1.1fr 1.4fr 1fr", gap: 18}}>
        {/* streak card with bignum */}
        <div className="card" style={{display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 24, minHeight: 220, position: "relative", overflow: "hidden"}}>
          <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
            <span className="tag">Streak</span>
            <Icon name="flame" size={16} className="" />
          </div>
          <div>
            <div className="bignum"><em>{streak}</em></div>
            <div className="row" style={{gap: 6, marginTop: 8, color: "var(--ink-3)", fontSize: 12.5}}>
              <span>days running</span>
              <span style={{color: "var(--ink-4)"}}>·</span>
              <span>best: 21</span>
            </div>
          </div>
          {/* tiny weekday dots */}
          <div className="row" style={{gap: 6, marginTop: 14}}>
            {["M","T","W","T","F","S","S"].map((d, i) => (
              <div key={i} style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4}}>
                <div style={{width: 18, height: 18, borderRadius: 4, background: i <= 4 ? "var(--accent)" : "var(--paper-2)", border: i > 4 ? "1px solid var(--hairline)" : 0}}></div>
                <span style={{fontSize: 9.5, color: "var(--ink-4)", fontWeight: 500}}>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OPEN — what to pick up */}
        <div className="paper-card" style={{display: "flex", flexDirection: "column", gap: 14, minHeight: 220, padding: 22, paddingTop: 18}}>
          <div className="row" style={{justifyContent: "space-between"}}>
            <span className="tag">Continue</span>
            <button className="btn is-quiet is-sm" onClick={() => setTab("history")}>All →</button>
          </div>
          <div>
            <div className="muted" style={{fontSize: 11.5, marginBottom: 4}}><span className="numeral">I.</span> The quiz you started</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 22, lineHeight: 1.15, marginTop: 2}}>{state.quizzes.find(q => !q.completed)?.title || state.quizzes[0]?.title}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 4}}>Started {state.quizzes.find(q => !q.completed)?.date} · 4 of 10 questions answered</div>
            <button className="btn is-sm is-accent" style={{marginTop: 12}} onClick={() => setTab("quiz-generator")}><Icon name="play" size={11} className="" /> Resume</button>
          </div>
          <div className="hairline" style={{marginTop: 4}}></div>
          <div>
            <div className="muted" style={{fontSize: 11.5, marginBottom: 4}}><span className="numeral">II.</span> Where you left reading</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 2}}>{state.documents[0]?.name}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 2}}>Page 4 of 12</div>
          </div>
        </div>

        {/* FOX RECOMMENDS */}
        <div className="card" style={{minHeight: 220, padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "var(--ink)", color: "var(--paper)", borderColor: "var(--ink)"}}>
          <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
            <span className="tag" style={{color: "var(--ink-4)"}}>The fox suggests</span>
            <FoxBadge accent={getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#B8533A'} />
          </div>
          <div className="pullquote" style={{color: "var(--paper)", fontSize: 20}}>
            Twelve minutes of flashcards before bed beats an hour cramming.
          </div>
          <div className="row" style={{justifyContent: "space-between", color: "var(--ink-4)", fontSize: 12}}>
            <span>Tonight's session</span>
            <button className="btn is-sm is-ghost" style={{background: "rgba(255,255,255,.08)", borderColor: "transparent", color: "var(--paper)"}} onClick={() => setTab("flashcards")}>Open →</button>
          </div>
        </div>
      </div>

      {/* METRICS STRIP — tag style */}
      <div className="dash-metrics" style={{display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0, border: "1px solid var(--hairline)", borderRadius: 12, overflow: "hidden"}}>
        {[
          {label: "Documents", value: state.documents.length, sub: "in library"},
          {label: "Quizzes", value: completed.length, sub: "completed"},
          {label: "Avg. score", value: `${avgScore}%`, sub: "last 30 days"},
          {label: "Hours focused", value: "14.2", sub: "this week"},
        ].map((m, i) => (
          <div key={m.label} style={{padding: "18px 22px", borderRight: i === 3 ? 0 : "1px solid var(--hairline)", background: "var(--card)"}}>
            <div className="tag">{m.label}</div>
            <div className="t-mono" style={{fontSize: 30, fontWeight: 400, marginTop: 10, letterSpacing: "-0.02em"}}>{m.value}</div>
            <div className="muted" style={{fontSize: 11.5, marginTop: 2}}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* SECTION: MAKE SOMETHING */}
      <div>
        <div className="row" style={{alignItems: "baseline", justifyContent: "space-between", marginBottom: 18}}>
          <h2 className="t-display" style={{fontSize: 38, letterSpacing: "-0.02em"}}>Make <em className="t-italic">something.</em></h2>
          <span className="tag">§ Generators</span>
        </div>
        <div className="dash-generators" style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16}}>
          <GeneratorCard hue="peach" title="Quiz" badge="Most popular" tab="quiz-generator" onClick={() => setTab("quiz-generator")}
            preview={<QuizPreview />} />
          <GeneratorCard hue="mint" title="Test" badge="From your docs" tab="quiz-generator" onClick={() => setTab("quiz-generator")}
            preview={<TestPreview />} />
          <GeneratorCard hue="sky" title="Flashcards" badge="Spaced repetition" tab="flashcards" onClick={() => setTab("flashcards")}
            preview={<FlashPreview />} />
          <GeneratorCard hue="lilac" title="Tutor session" badge="One-on-one" tab="ai-chat" onClick={() => setTab("ai-chat")}
            preview={<TutorPreview />} />
          <GeneratorCard hue="sky2" title="Chat" badge="Ask anything" tab="ai-chat" onClick={() => setTab("ai-chat")}
            preview={<ChatPreview />} />
          <GeneratorCard hue="rose" title="Podcast" badge="Listen & learn" tab="audio-recap" onClick={() => setTab("audio-recap")}
            preview={<PodcastPreview />} />
        </div>
      </div>

      {/* BIG TWO-COLUMN: activity heatmap + pull quote */}
      <div className="dash-twocol" style={{display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18}}>
        <ActivityCard streak={state.streak} activityLog={state.activityLog} />
        <div className="stripe-card" style={{padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
          <span className="tag">Editor's note</span>
          <div className="pullquote">
            We don't rise to the level of our goals; we fall to the level of our systems.
          </div>
          <div className="marg" style={{maxWidth: 280, alignSelf: "flex-end"}}>James Clear, paraphrased — a useful reminder when motivation is low.</div>
        </div>
      </div>

      {/* RECENT LIBRARY — paper-styled list */}
      <div>
        <div className="row" style={{justifyContent: "space-between", marginBottom: 14, alignItems: "baseline"}}>
          <h2 className="t-display" style={{fontSize: 32}}>From the <em className="t-italic">library</em></h2>
          <button className="btn is-ghost is-sm" onClick={() => setTab("documents")}>Open library</button>
        </div>
        <div className="card card-flush">
          {state.documents.map((d, i) => (
            <button key={d.id} className="lift" style={{display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto", gap: 18, alignItems: "center", padding: "14px 22px", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: i === state.documents.length - 1 ? 0 : "1px solid var(--hairline)", cursor: "default"}} onClick={() => setTab("pdf-qa")}>
              <span className="t-mono" style={{color: "var(--ink-4)", fontSize: 11, width: 24}}>{String(i+1).padStart(2,"0")}</span>
              <DocIcon ext={d.type} />
              <div>
                <div style={{fontWeight: 500, fontFamily: "var(--f-display)", fontSize: 18}}>{d.name.replace(/\.[a-z]+$/i, "")}</div>
                <div className="muted" style={{fontSize: 12, marginTop: 2}}>{d.uploadDate} · {d.size} · {d.type.toUpperCase()}</div>
              </div>
              <div className="row" style={{gap: 6}}>
                {d.tags.map(t => <span key={t} className="chip">{t}</span>)}
              </div>
              <button className="btn is-quiet is-sm" onClick={(e) => { e.stopPropagation(); setTab("quiz-generator"); }}>Quiz</button>
              <Icon name="chevR" size={14} className="" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
window.ScreenDashboard = ScreenDashboard;

function FoxBadge({ accent }) {
  return (
    <img src="assets/fox-head.png" alt="" width="34" height="34" style={{display: "block", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.18))"}} />
  );
}
window.FoxBadge = FoxBadge;

// ─── Pastel generator card with mini preview ───
function GeneratorCard({ hue, title, badge, preview, onClick }) {
  return (
    <button className={`gen-card gen-${hue}`} onClick={onClick}>
      <div className="gen-card-badge">{badge}</div>
      <div className="gen-card-preview">{preview}</div>
      <div className="gen-card-foot">
        <span className="gen-card-title">{title}</span>
        <span className="gen-card-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
        </span>
      </div>
    </button>
  );
}
window.GeneratorCard = GeneratorCard;

// ─── Preview components for each generator ───
function QuizPreview() {
  return (
    <div className="prev-card">
      <div className="prev-eyebrow">Quiz · physics</div>
      <div className="prev-question">What is wave-particle duality?</div>
      <div className="prev-options">
        <div className="prev-opt"><span className="prev-key">A</span> Particles only</div>
        <div className="prev-opt is-correct"><span className="prev-key">B</span> Both wave and particle <span className="prev-check">✓</span></div>
      </div>
    </div>
  );
}
function TestPreview() {
  return (
    <div className="prev-card">
      <div className="prev-eyebrow">Test · calculus</div>
      <div className="prev-question">The chain rule is for…</div>
      <div className="prev-options">
        <div className="prev-opt"><span className="prev-key">A</span> Sums</div>
        <div className="prev-opt"><span className="prev-key">B</span> Products</div>
        <div className="prev-opt is-correct"><span className="prev-key">C</span> Compositions <span className="prev-check">✓</span></div>
      </div>
    </div>
  );
}
function FlashPreview() {
  return (
    <div className="prev-flash">
      <div className="prev-flash-card prev-flash-back"></div>
      <div className="prev-flash-card prev-flash-mid"></div>
      <div className="prev-flash-card prev-flash-front">
        <span className="prev-flash-label">Q</span>
        <span className="prev-flash-text">Quantization</span>
      </div>
    </div>
  );
}
function TutorPreview() {
  return (
    <div className="prev-card">
      <div className="prev-eyebrow">Tutor · ML</div>
      <div className="prev-bubble prev-bubble-user">What's the difference between AI &amp; ML?</div>
      <div className="prev-wave">
        {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 0.4, 0.6, 0.3].map((h, i) => (
          <span key={i} style={{height: `${h * 100}%`}} />
        ))}
      </div>
    </div>
  );
}
function ChatPreview() {
  return (
    <div className="prev-card">
      <div className="prev-eyebrow">Chat · today</div>
      <div className="prev-bubble prev-bubble-ai">Curious how machines learn?</div>
      <div className="prev-input">
        <span>Write something…</span>
        <span className="prev-input-send">→</span>
      </div>
    </div>
  );
}
function PodcastPreview() {
  return (
    <div className="prev-card prev-card-podcast">
      <div className="prev-eyebrow">Listen · core concept</div>
      <div className="prev-podcast-row">
        <div className="prev-wave prev-wave-sm">
          {[0.3, 0.6, 0.4, 0.8, 0.5].map((h, i) => <span key={i} style={{height: `${h * 100}%`}} />)}
        </div>
        <div className="prev-podcast-art">
          <img src="assets/fox-head.png" alt="" />
        </div>
        <div className="prev-wave prev-wave-sm">
          {[0.5, 0.3, 0.7, 0.4, 0.6].map((h, i) => <span key={i} style={{height: `${h * 100}%`}} />)}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, icon, tone }) {
  return (
    <div className="card card-tight" style={{display: "flex", alignItems: "center", gap: 14}}>
      <div style={{width: 38, height: 38, borderRadius: 10, background: tone === "accent" ? "var(--accent-soft)" : "var(--paper-2)", color: tone === "accent" ? "var(--accent-ink)" : "var(--ink-2)", display: "grid", placeItems: "center"}}>
        <Icon name={icon} size={18} className="" />
      </div>
      <div>
        <div className="t-eyebrow" style={{fontSize: 10}}>{label}</div>
        <div style={{display: "flex", alignItems: "baseline", gap: 4}}>
          <span className="t-mono" style={{fontSize: 24, fontWeight: 500, color: "var(--ink)"}}>{value}</span>
          {unit && <span className="muted" style={{fontSize: 12}}>{unit}</span>}
        </div>
      </div>
    </div>
  );
}
window.Metric = Metric;

function Action({ title, sub, icon, onClick }) {
  return (
    <button className="card lift" style={{textAlign: "left", cursor: "default", display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start"}} onClick={onClick}>
      <div style={{width: 40, height: 40, borderRadius: 10, background: "var(--paper-2)", display: "grid", placeItems: "center"}}>
        <Icon name={icon} size={20} className="" />
      </div>
      <div>
        <div style={{fontFamily: "var(--f-display)", fontSize: 22, lineHeight: 1, marginBottom: 4}}>{title}</div>
        <div className="muted" style={{fontSize: 13}}>{sub}</div>
      </div>
      <div className="row" style={{width: "100%", justifyContent: "flex-end", color: "var(--ink-3)"}}>
        <Icon name="chevR" size={16} className="" />
      </div>
    </button>
  );
}
window.Action = Action;

function DocIcon({ ext }) {
  const e = (ext || "").toUpperCase().slice(0, 3);
  return (
    <div style={{width: 36, height: 44, borderRadius: 4, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative"}}>
      <span className="t-mono" style={{fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: 0.5}}>{e}</span>
      <div style={{position: "absolute", top: 0, right: 0, width: 0, height: 0, borderLeft: "6px solid var(--card)", borderBottom: "6px solid transparent"}}></div>
    </div>
  );
}
window.DocIcon = DocIcon;

function ActivityCard({ streak, activityLog }) {
  // 8 columns × 7 rows = 56 days
  const cells = useM1(() => {
    const today = new Date();
    const arr = [];
    for (let i = 55; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const count = (activityLog || []).filter(x => x === key).length;
      // seed deterministic
      const seed = (d.getDate() * 13 + d.getMonth() * 7) % 5;
      arr.push({ date: key, count: count + (seed < 2 ? 0 : seed - 1) });
    }
    return arr;
  }, [activityLog]);
  const max = Math.max(1, ...cells.map(c => c.count));
  return (
    <div className="card">
      <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
        <div>
          <span className="t-eyebrow">Last 8 weeks</span>
          <div style={{fontFamily: "var(--f-display)", fontSize: 22, marginTop: 4}}>Consistency</div>
        </div>
        <div className="chip is-accent"><Icon name="flame" size={11} className="" /> {streak} day streak</div>
      </div>
      <div style={{marginTop: 18, display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 5}}>
        {cells.map((c, i) => {
          const a = c.count === 0 ? 0.08 : 0.18 + (c.count / max) * 0.7;
          return <div key={i} title={`${c.date}: ${c.count}`} style={{aspectRatio: "1", borderRadius: 4, background: `color-mix(in oklch, var(--accent) ${a * 100}%, var(--paper-2))`}}></div>;
        })}
      </div>
      <div className="row" style={{justifyContent: "space-between", marginTop: 12, color: "var(--ink-4)", fontSize: 11}}>
        <span>Less</span>
        <div className="row" style={{gap: 3}}>
          {[0.1, 0.3, 0.5, 0.7, 0.9].map(a => <div key={a} style={{width: 10, height: 10, borderRadius: 3, background: `color-mix(in oklch, var(--accent) ${a * 100}%, var(--paper-2))`}}></div>)}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
window.ActivityCard = ActivityCard;


// ─────────────────────────── LIBRARY ───────────────────────────
function ScreenDocuments({ state, dispatch, setTab }) {
  const [filter, setFilter] = useS1("all");
  const [q, setQ] = useS1("");
  const [view, setView] = useS1("grid");
  const tags = ["all", ...new Set(state.documents.flatMap(d => d.tags))];
  const docs = state.documents.filter(d => {
    if (filter !== "all" && !d.tags.includes(filter)) return false;
    if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function addSample() {
    dispatch({ type: "add-doc", doc: {
      id: Date.now(),
      name: ["Organic Chemistry Notes.pdf", "World History — WWII.pdf", "Linear Algebra Ch.3.pdf", "Macroeconomics.docx"][Math.floor(Math.random()*4)],
      size: `${(Math.random() * 4 + 0.5).toFixed(1)} MB`,
      type: ["pdf", "pdf", "docx"][Math.floor(Math.random()*3)],
      uploadDate: new Date().toISOString().slice(0, 10),
      tags: [["Chemistry","Notes"], ["History"], ["Math"], ["Economics", "Notes"]][Math.floor(Math.random()*4)],
    }});
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="masthead">
        <span>Library <em style={{fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: "var(--ink-3)", marginLeft: 6, fontFamily: "var(--f-display)", fontSize: 14}}>Index</em></span>
        <span style={{display: "flex", gap: 22}}>
          <span>{state.documents.length} items</span>
          <span>{tags.length - 1} tags</span>
          <span>updated {state.documents[0]?.uploadDate}</span>
        </span>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end", paddingBottom: 18, borderBottom: "1px solid var(--hairline)", marginBottom: 8}}>
        <div>
          <h1 className="t-display" style={{fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.025em"}}>Your <em className="t-italic">library</em>.</h1>
          <p style={{color: "var(--ink-3)", maxWidth: "56ch", marginTop: 12, fontSize: 14.5}}>Every document is searchable, summarizable, and ready to become a quiz, flashcard set, or mind map.</p>
        </div>
        <div className="marg" style={{maxWidth: 220}}>Tip<span className="fn">†</span> — drag a PDF anywhere on this page to upload.</div>
      </div>

      <div className="row" style={{gap: 10, flexWrap: "wrap"}}>
        <div className="topbar-search" style={{width: 280, height: 36, background: "var(--card)"}}>
          <Icon name="search" size={14} className="" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" style={{border: 0, outline: 0, background: "transparent", flex: 1, font: "inherit", fontSize: 13, color: "var(--ink)"}} />
        </div>
        <div className="row" style={{gap: 6, padding: 3, background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 9}}>
          {tags.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`btn is-sm ${filter === t ? "" : "is-quiet"}`} style={{height: 26, fontSize: 12, padding: "0 10px"}}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <div className="row" style={{gap: 2, padding: 2, background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 8}}>
          <button onClick={() => setView("grid")} className={`btn is-sm ${view === "grid" ? "" : "is-quiet"}`} style={{height: 28, padding: "0 10px"}}>Grid</button>
          <button onClick={() => setView("list")} className={`btn is-sm ${view === "list" ? "" : "is-quiet"}`} style={{height: 28, padding: "0 10px"}}>List</button>
        </div>
        <button className="btn is-accent" onClick={addSample}><Icon name="upload" size={14} className="" /> Upload</button>
      </div>

      {view === "grid" ? (
        <div className="grid grid-3">
          {docs.map(d => (
            <div key={d.id} className="card lift" style={{display: "flex", flexDirection: "column", gap: 14, cursor: "default"}} onClick={() => setTab("pdf-qa")}>
              <div style={{aspectRatio: "4/3", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative"}}>
                <DocIcon ext={d.type} />
                <div style={{position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent 0, transparent 6px, color-mix(in oklch, var(--hairline) 50%, transparent) 6px, color-mix(in oklch, var(--hairline) 50%, transparent) 7px)", borderRadius: 10, pointerEvents: "none"}}></div>
              </div>
              <div>
                <div style={{fontWeight: 500, marginBottom: 4}}>{d.name}</div>
                <div className="muted" style={{fontSize: 12}}>{d.uploadDate} · {d.size}</div>
              </div>
              <div className="row" style={{gap: 6, flexWrap: "wrap"}}>{d.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
              <div className="row" style={{gap: 6, marginTop: 4}}>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("pdf-qa"); }}>Ask</button>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("quiz-generator"); }}>Quiz</button>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("flashcards"); }}>Cards</button>
              </div>
            </div>
          ))}
          <button className="card lift" onClick={addSample} style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "default", color: "var(--ink-3)", borderStyle: "dashed", minHeight: 200}}>
            <Icon name="plus" size={22} className="" />
            <div style={{fontFamily: "var(--f-display)", fontSize: 18}}>Add a document</div>
            <div className="muted" style={{fontSize: 12}}>PDF · DOCX · TXT</div>
          </button>
        </div>
      ) : (
        <div className="card card-flush">
          {docs.map((d, i) => (
            <div key={d.id} style={{display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 16, alignItems: "center", padding: "14px 18px", borderBottom: i === docs.length - 1 ? 0 : "1px solid var(--hairline)"}}>
              <DocIcon ext={d.type} />
              <div>
                <div style={{fontWeight: 500}}>{d.name}</div>
                <div className="muted" style={{fontSize: 12}}>{d.uploadDate} · {d.size}</div>
              </div>
              <div className="row" style={{gap: 6}}>{d.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
              <button className="btn is-quiet is-sm" onClick={() => setTab("pdf-qa")}>Ask →</button>
              <Icon name="chevR" size={14} className="" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
window.ScreenDocuments = ScreenDocuments;


// ─────────────────────────── AI CHAT ───────────────────────────

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
            <img src="assets/fox-head.png" alt="" width="15" height="15"
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
window.ElevatedMessage = ElevatedMessage;

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
          <img src="assets/fox-head.png" alt="" width="15" height="15"
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
window.ThinkingRow = ThinkingRow;

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
window.ChatDot = ChatDot;

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

// ── Main screen ───────────────────────────────────────────────
function ScreenAIChat({ state, dispatch }) {
  const [messages, setMessages] = useS1([
    { id: 1, sender: "ai", text: "Hi — drop a question, paste text, or add document context above. I'll keep my answers grounded in what you share.", ts: Date.now() }
  ]);
  const [input, setInput] = useS1("");
  const [thinking, setThinking] = useS1(false);
  const [ctxDoc, setCtxDoc] = useS1("");
  const [copiedId, setCopiedId] = useS1(null);
  const [hoverId, setHoverId] = useS1(null);

  const endRef = useR1(null);
  const scrollRef = useR1(null);
  const textRef = useR1(null);

  useE1(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, thinking]);

  // Auto-resize textarea
  useE1(() => {
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
  const msgGroups = useM1(() => {
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
    </div>
  );
}
window.ScreenAIChat = ScreenAIChat;

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

// Dot kept for any legacy usage
function Dot({ delay }) {
  return <span style={{width: 6, height: 6, borderRadius: 50, background: "var(--ink-3)", animation: `dotbounce 1s ${delay} infinite ease-in-out`, display: "inline-block"}}></span>;
}
window.Dot = Dot;
