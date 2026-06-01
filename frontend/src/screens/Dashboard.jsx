import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '../components/Shell';
import foxHeadImg from '../assets/fox-head.png';

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
            <div key={d.id} className="lift" role="button" tabIndex={0} style={{display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto", gap: 18, alignItems: "center", padding: "14px 22px", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: i === state.documents.length - 1 ? 0 : "1px solid var(--hairline)", cursor: "default"}} onClick={() => setTab("pdf-qa")}>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FoxBadge({ accent }) {
  return (
    <img src={foxHeadImg} alt="" width="34" height="34" style={{display: "block", objectFit: "contain", filter: "drop-shadow(0 1px 3px rgba(0,0,0,.18))"}} />
  );
}

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
          <img src={foxHeadImg} alt="" />
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

export function DocIcon({ ext }) {
  const e = (ext || "").toUpperCase().slice(0, 3);
  return (
    <div style={{width: 36, height: 44, borderRadius: 4, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative"}}>
      <span className="t-mono" style={{fontSize: 9.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: 0.5}}>{e}</span>
      <div style={{position: "absolute", top: 0, right: 0, width: 0, height: 0, borderLeft: "6px solid var(--card)", borderBottom: "6px solid transparent"}}></div>
    </div>
  );
}

function ActivityCard({ streak, activityLog }) {
  // 8 columns × 7 rows = 56 days
  const cells = useMemo(() => {
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

export default ScreenDashboard;
