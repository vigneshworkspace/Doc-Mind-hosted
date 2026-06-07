import { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Shell';
import { ErrorRetry } from '../components/GenState.jsx';
import { history as historyApi } from '../api/index.js';
import foxHeadImg from '../assets/fox-head.png';

const keyOf = (d) => d.toISOString().slice(0, 10);

// ─────────────────────────── DASHBOARD ───────────────────────────
function ScreenDashboard({ state, setTab, dispatch }) {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 6 ? "Up early" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const completed = state.quizzes.filter(q => q.completed);
  const avgScore = completed.length ? Math.round(completed.reduce((a, q) => a + (q.score || 0), 0) / completed.length) : 0;

  // ── Real activity from the API (history.list) ───────────────────────
  // Response (post-normalize): { days: [{ date, count }], streak, bestStreak, total }.
  // No mock fallback — on failure we surface ErrorRetry per the honesty contract.
  const [hist, setHist] = useState(null);
  const [histError, setHistError] = useState(false);
  const [histLoading, setHistLoading] = useState(true);

  const loadHistory = useCallback(() => {
    setHistLoading(true);
    setHistError(false);
    historyApi.list()
      .then((res) => { setHist(res); setHistLoading(false); })
      .catch(() => { setHist(null); setHistError(true); setHistLoading(false); });
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const days = hist?.days || [];
  const streak = hist?.streak ?? 0;
  const bestStreak = Math.max(hist?.bestStreak ?? 0, streak);
  const histReady = !!hist && !histError;

  // ── Real derived metrics (was hardcoded) ───────────────────────────
  const incompleteQuizzes = state.quizzes.filter(q => !q.completed).length;
  const docCount = state.documents.length;
  const recapCount = state.audioRecaps?.length || 0;
  const startedQuiz = state.quizzes.find(q => !q.completed) || state.quizzes[0];
  const lastDoc = state.documents[0];

  // Distinct active dates -> Set of YYYY-MM-DD keys (drives heatmap + dots).
  const activitySet = useMemo(() => new Set(days.map(d => d.date)), [days]);
  // this week's Mon→Sun activity (real, from API days)
  const weekActivity = useMemo(() => {
    const base = new Date();
    const dow = (base.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(base); monday.setDate(base.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      return activitySet.has(keyOf(d));
    });
  }, [activitySet]);
  // sessions logged in the last 7 days (sum of per-day counts, real)
  const sessions7 = useMemo(() => {
    const cutoff = Date.now() - 7 * 86400000;
    return days.reduce((sum, d) => (new Date(d.date).getTime() >= cutoff ? sum + d.count : sum), 0);
  }, [days]);
  // most recent active days for the inline activity timeline (History absorbed)
  const recentActivity = useMemo(
    () => [...days].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8),
    [days],
  );

  // issue number derived from day-of-year for fun
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
            {histReady ? `You've kept a ${streak}-day streak. ` : ''}{incompleteQuizzes} quiz{incompleteQuizzes === 1 ? '' : 'zes'} {incompleteQuizzes === 1 ? 'waits' : 'wait'}, {docCount} document{docCount === 1 ? '' : 's'} in your library, and {recapCount} audio recap{recapCount === 1 ? '' : 's'} ready. Quiet work ahead.
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
          {histError ? (
            <ErrorRetry message="Couldn't load your activity." onRetry={loadHistory} />
          ) : (
            <>
              <div>
                <div className="bignum"><em>{histLoading ? '·' : streak}</em></div>
                <div className="row" style={{gap: 6, marginTop: 8, color: "var(--ink-3)", fontSize: 12.5}}>
                  <span>days running</span>
                  <span style={{color: "var(--ink-4)"}}>·</span>
                  <span>best: {histLoading ? '—' : bestStreak}</span>
                </div>
              </div>
              {/* tiny weekday dots — real, from this week's activity */}
              <div className="row" style={{gap: 6, marginTop: 14}}>
                {["M","T","W","T","F","S","S"].map((d, i) => {
                  const on = histReady && weekActivity[i];
                  return (
                    <div key={i} style={{flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4}}>
                      <div style={{width: 18, height: 18, borderRadius: 4, background: on ? "var(--accent)" : "var(--paper-2)", border: on ? 0 : "1px solid var(--hairline)"}}></div>
                      <span style={{fontSize: 9.5, color: "var(--ink-4)", fontWeight: 500}}>{d}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* OPEN — what to pick up */}
        <div className="paper-card" style={{display: "flex", flexDirection: "column", gap: 14, minHeight: 220, padding: 22, paddingTop: 18}}>
          <div className="row" style={{justifyContent: "space-between"}}>
            <span className="tag">Continue</span>
          </div>
          <div>
            <div className="muted" style={{fontSize: 11.5, marginBottom: 4}}><span className="numeral">I.</span> {startedQuiz?.completed ? 'Your latest quiz' : 'The quiz you started'}</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 22, lineHeight: 1.15, marginTop: 2}}>{startedQuiz?.title || 'No quizzes yet'}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 4}}>
              {startedQuiz?.date ? `${startedQuiz.date}` : 'Generate one to begin'}
              {startedQuiz?.questions?.length ? ` · ${startedQuiz.questions.length} questions` : ''}
              {startedQuiz?.completed && startedQuiz?.score != null ? ` · scored ${startedQuiz.score}%` : ''}
            </div>
            <button className="btn is-sm is-accent" style={{marginTop: 12}} onClick={() => setTab("quiz-generator")}><Icon name="play" size={11} className="" /> {startedQuiz?.completed ? 'New quiz' : 'Resume'}</button>
          </div>
          <div className="hairline" style={{marginTop: 4}}></div>
          <div>
            <div className="muted" style={{fontSize: 11.5, marginBottom: 4}}><span className="numeral">II.</span> Most recent document</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 2}}>{lastDoc?.name || 'Upload a document'}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 2}}>{lastDoc ? `${lastDoc.size || ''}${lastDoc.page_count ? ` · ${lastDoc.page_count} pages` : ''}` : 'Library is empty'}</div>
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
          {label: "Avg. score", value: `${avgScore}%`, sub: "completed quizzes"},
          {label: "Sessions", value: sessions7, sub: "last 7 days"},
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

      {/* BIG TWO-COLUMN: activity heatmap + inline activity timeline (History absorbed) */}
      <div className="dash-twocol" style={{display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 18}}>
        <ActivityCard
          streak={streak}
          activitySet={activitySet}
          loading={histLoading}
          error={histError}
          onRetry={loadHistory}
        />
        <ActivityTimeline
          items={recentActivity}
          loading={histLoading}
          error={histError}
          onRetry={loadHistory}
        />
      </div>

      {/* RECENT LIBRARY — paper-styled list */}
      <div>
        <div className="row" style={{justifyContent: "space-between", marginBottom: 14, alignItems: "baseline"}}>
          <h2 className="t-display" style={{fontSize: 32}}>From the <em className="t-italic">library</em></h2>
          <button className="btn is-ghost is-sm" onClick={() => setTab("documents")}>Open library</button>
        </div>
        <div className="card card-flush">
          {state.documents.map((d, i) => (
            <div key={d.id} className="lift" role="button" tabIndex={0} style={{display: "grid", gridTemplateColumns: "auto auto 1fr auto auto auto", gap: 18, alignItems: "center", padding: "14px 22px", width: "100%", textAlign: "left", background: "transparent", border: 0, borderBottom: i === state.documents.length - 1 ? 0 : "1px solid var(--hairline)", cursor: "default"}} onClick={() => setTab("ai-chat")}>
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

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function ActivityCard({ streak, activitySet, loading, error, onRetry }) {
  const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 prev, etc.

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const view = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const monthName = view.toLocaleString(undefined, { month: "long" });

  // 6 weeks × 7 = 42 stable cells; leading/trailing days belong to adjacent months.
  const cells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay();         // 0 = Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const out = [];
    for (let i = 0; i < firstDow; i++) out.push({ day: prevDays - firstDow + 1 + i, inMonth: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      out.push({ day: d, inMonth: true, key, active: activitySet.has(key), isToday: key === todayKey });
    }
    let trail = 1;
    while (out.length < 42) out.push({ day: trail++, inMonth: false });
    return out;
  }, [year, month, activitySet, todayKey]);

  if (error) {
    return (
      <div className="card">
        <span className="t-eyebrow">Consistency</span>
        <div style={{ marginTop: 16 }}>
          <ErrorRetry message="Couldn't load your activity heatmap." onRetry={onRetry} />
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ opacity: loading ? 0.55 : 1, transition: "opacity .2s" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span className="t-eyebrow">Consistency</span>
          <div style={{ fontFamily: "var(--f-display)", fontSize: 22, marginTop: 4 }}>{monthName}, {year}</div>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <div className="chip is-accent" style={{ marginRight: 4 }}><Icon name="flame" size={11} className="" /> {streak} day streak</div>
          <button className="btn is-ghost is-icon is-sm" aria-label="Previous month" onClick={() => setMonthOffset(o => o - 1)}><Icon name="chevL" size={14} className="" /></button>
          <button className="btn is-ghost is-icon is-sm" aria-label="Next month" disabled={monthOffset >= 0} onClick={() => setMonthOffset(o => Math.min(0, o + 1))}><Icon name="chevR" size={14} className="" /></button>
        </div>
      </div>

      {/* weekday header */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {WEEKDAYS.map(w => (
          <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--ink-4)", letterSpacing: "0.04em", paddingBottom: 4 }}>{w}</div>
        ))}
      </div>

      {/* date grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((c, i) => {
          const base = { aspectRatio: "1", display: "grid", placeItems: "center", borderRadius: "50%", fontSize: 13, fontFamily: "var(--f-mono)", fontVariantNumeric: "tabular-nums" };
          if (!c.inMonth) {
            return <div key={i} style={{ ...base, color: "var(--ink-4)", opacity: 0.4 }}>{c.day}</div>;
          }
          if (c.isToday) {
            return <div key={i} title={c.active ? "Active today" : "Today"} style={{ ...base, background: "var(--accent)", color: "white", fontWeight: 600 }}>{c.day}</div>;
          }
          if (c.active) {
            return <div key={i} title={`${c.key}: active`} style={{ ...base, background: "color-mix(in oklch, var(--accent) 22%, var(--paper-2))", color: "var(--accent-ink)", fontWeight: 600 }}>{c.day}</div>;
          }
          return <div key={i} style={{ ...base, color: "var(--ink-2)" }}>{c.day}</div>;
        })}
      </div>
    </div>
  );
}

// Inline activity timeline — the standalone History screen was folded in here.
// Renders the most recent active days (real per-day counts from the API).
function relativeDay(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ActivityTimeline({ items, loading, error, onRetry }) {
  return (
    <div className="stripe-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="tag">Recent activity</span>
        <span className="tag" style={{ color: "var(--ink-4)" }}>§ History</span>
      </div>

      {error ? (
        <ErrorRetry message="Couldn't load recent activity." onRetry={onRetry} />
      ) : loading ? (
        <div className="muted" style={{ fontSize: 13, color: "var(--ink-3)" }}>Loading activity…</div>
      ) : items.length === 0 ? (
        <div className="muted" style={{ fontSize: 13, color: "var(--ink-3)" }}>
          No study activity logged yet. Take a quiz or review flashcards to start your streak.
        </div>
      ) : (
        <div className="col" style={{ gap: 0 }}>
          {items.map((it, i) => (
            <div
              key={it.date}
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                padding: "11px 0",
                borderBottom: i === items.length - 1 ? 0 : "1px solid var(--hairline)",
              }}
            >
              <div className="row" style={{ gap: 12, alignItems: "center" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "var(--f-display)", fontSize: 16 }}>{relativeDay(it.date)}</div>
                  <div className="muted t-mono" style={{ fontSize: 11, color: "var(--ink-4)" }}>{it.date}</div>
                </div>
              </div>
              <span className="chip">{it.count} session{it.count === 1 ? "" : "s"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScreenDashboard;
