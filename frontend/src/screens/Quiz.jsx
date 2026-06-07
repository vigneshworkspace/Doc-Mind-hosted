import { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Shell';
import { ErrorRetry } from '../components/GenState.jsx';
import { quizzes as quizzesApi } from '../api/index.js';

const SAMPLE_QUIZ_QUESTIONS = [
  { questionText: "What does 'quantization' mean in quantum physics?", options: ["Energy comes in discrete packets", "Particles always move", "Light is a continuous wave only", "Mass is the same as energy"], correctAnswer: "Energy comes in discrete packets", explanation: "Quantization means certain physical quantities can only take on specific, discrete values rather than any value along a continuum." },
  { questionText: "Wave-particle duality applies to…", options: ["Only photons", "Only electrons", "Both matter and light", "Only large objects"], correctAnswer: "Both matter and light", explanation: "Matter and light both exhibit wave-like and particle-like properties depending on the experiment performed." },
  { questionText: "The uncertainty principle limits the precision of which pair?", options: ["Position and momentum", "Mass and weight", "Color and temperature", "Voltage and current"], correctAnswer: "Position and momentum", explanation: "Heisenberg's principle states there's a fundamental limit on simultaneously knowing position and momentum." },
  { questionText: "Which experiment demonstrated photons?", options: ["Cavendish", "Photoelectric effect", "Ohm's law", "Stern–Gerlach"], correctAnswer: "Photoelectric effect", explanation: "Einstein's analysis of the photoelectric effect showed light energy arrives in discrete quanta." },
  { questionText: "Schrödinger's equation describes…", options: ["Classical orbits", "Wavefunctions evolving in time", "Newton's third law", "Brownian motion only"], correctAnswer: "Wavefunctions evolving in time", explanation: "It is the central equation of non-relativistic quantum mechanics, governing how wavefunctions change over time." },
];

function ScreenQuiz({ state, dispatch, setTab }) {
  const [mode, setMode] = useState("config"); // config | taking | result
  const [config, setConfig] = useState({ docId: state.documents[0]?.id ?? "", count: 5, difficulty: "medium", adaptive: false });
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  // Set when adaptive was requested but the server had no score history to learn
  // from and explicitly fell back to a normal quiz. We surface this honestly.
  const [adaptiveNote, setAdaptiveNote] = useState("");
  // Honesty contract: on a failed list() we show an error + Retry, never fabricated rows.
  const [listError, setListError] = useState("");

  // Mount: load the real quiz list. On failure we surface ErrorRetry and leave the
  // collection empty — never substitute seeded sample quizzes.
  const reloadList = useCallback(() => {
    setListError("");
    quizzesApi.list()
      .then(qs => dispatch({ type: 'set-quizzes', quizzes: qs }))
      .catch(e => setListError(e.message || "Couldn't load your quizzes — please retry."));
  }, [dispatch]);

  useEffect(() => { reloadList(); }, [reloadList]);

  async function startQuiz() {
    setGenerating(true);
    setError("");
    setAdaptiveNote("");
    try {
      const result = await quizzesApi.generate(config.docId || null, {
        count: config.count,
        difficulty: config.difficulty,
        adaptive: config.adaptive,
      });
      const qs = (result && result.questions) || [];
      if (!qs.length) throw new Error("No questions were generated. Try a different document.");
      // Honesty contract: when adaptive was requested but the server had no score
      // history, it falls back to a normal quiz and returns adaptiveNote. Surface it.
      if (config.adaptive && result.adaptiveNote) setAdaptiveNote(result.adaptiveNote);
      // Real questions only — never silently substitute sample content.
      setQuestions(qs);
      setIdx(0);
      setAnswers({});
      setMode("taking");
    } catch (e) {
      setError(e.message || "Couldn't generate a quiz — the AI service may be busy. Please retry.");
    } finally {
      setGenerating(false);
    }
  }

  function answer(opt) {
    setAnswers(a => ({...a, [idx]: opt}));
  }

  function finish() {
    const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length;
    const score = Math.round((correct / questions.length) * 100);
    const quizData = {
      title: `Practice — ${new Date().toLocaleDateString()}`,
      questions, completed: true, score,
      date: new Date().toISOString().slice(0, 10),
    };
    // Optimistic local update
    dispatch({ type: "add-quiz", quiz: { id: Date.now(), ...quizData } });
    setMode("result");
    // Persist to backend (fire-and-forget)
    quizzesApi.save(quizData).catch(() => {});
  }

  if (mode === "config") return (
    <div className="col" style={{gap: 28}}>
      <div className="masthead">
        <span>Quizzes <em style={{fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: "var(--ink-3)", marginLeft: 6, fontFamily: "var(--f-display)", fontSize: 14}}>Practice</em></span>
        <span style={{display: "flex", gap: 22}}>
          <span>{state.quizzes.length} total</span>
          <span>avg. {Math.round(state.quizzes.filter(q=>q.completed).reduce((a,q)=>a+(q.score||0),0)/Math.max(1,state.quizzes.filter(q=>q.completed).length))}%</span>
          <span>best 100%</span>
        </span>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "flex-end", paddingBottom: 22, borderBottom: "1px solid var(--hairline)"}}>
        <div>
          <h1 className="t-display" style={{fontSize: 60, lineHeight: 1.04, letterSpacing: "-0.025em"}}>Quiz <em className="t-italic">yourself.</em></h1>
          <p style={{maxWidth: "55ch", marginTop: 14, fontSize: 15, color: "var(--ink-2)", lineHeight: 1.6}}>Pick a document, pick a length, and I'll generate questions tuned to the level you choose. Every answer comes with an explanation.</p>
        </div>
        <div className="bignum" style={{fontSize: 96, color: "var(--accent)"}}>{state.quizzes.filter(q=>q.completed).length}</div>
      </div>
      <div className="grid" style={{gridTemplateColumns: "1.4fr 1fr"}}>
        <div className="card">
          <span className="tag" style={{marginBottom: 14, display: "block"}}><span className="numeral">§</span> New quiz</span>
          <div className="col" style={{gap: 18}}>
            <div>
              <label className="field-label">Source</label>
              <select className="input" value={config.docId} onChange={e => setConfig(c => ({...c, docId: e.target.value}))}>
                {state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                <option value="">General knowledge</option>
              </select>
            </div>
            {listError && (
              <ErrorRetry message={listError} onRetry={reloadList} />
            )}
            {error && (
              <ErrorRetry message={error} onRetry={startQuiz} />
            )}
            {adaptiveNote && (
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--ink-2)", padding: "10px 12px", borderRadius: 8, background: "var(--paper-2)", borderLeft: "3px solid var(--accent)" }}>
                {adaptiveNote}
              </div>
            )}
            <div>
              <label className="field-label">Difficulty</label>
              <div className="row" style={{gap: 6}}>
                {[["easy","Easy"], ["medium","Medium"], ["hard","Hard"]].map(([v, l]) => (
                  <button key={v} onClick={() => setConfig(c => ({...c, difficulty: v}))}
                    className={`btn is-sm ${config.difficulty === v ? "" : "is-ghost"}`}
                    style={{flex: 1}}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Mode</label>
              <button
                type="button"
                onClick={() => setConfig(c => ({...c, adaptive: !c.adaptive}))}
                className={`btn is-sm ${config.adaptive ? "is-accent" : "is-ghost"}`}
                aria-pressed={config.adaptive}
                style={{width: "100%", justifyContent: "flex-start", gap: 10}}>
                <Icon name="sparkles" size={13} className="" />
                Adaptive (focus my weak areas)
                <span style={{marginLeft: "auto", fontSize: 11, color: "var(--ink-3)"}}>{config.adaptive ? "On" : "Off"}</span>
              </button>
              <p className="muted" style={{fontSize: 11.5, marginTop: 6, lineHeight: 1.45}}>
                Targets topics you scored low on in past quizzes. Needs some completed quizzes first.
              </p>
            </div>
            <div>
              <label className="field-label">Number of questions — {config.count}</label>
              <input type="range" min="3" max="5" value={config.count} onChange={e => setConfig(c => ({...c, count: +e.target.value}))} style={{width: "100%"}} />
              <div className="row" style={{justifyContent: "space-between", color: "var(--ink-4)", fontSize: 11}}>
                <span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <button className="btn is-accent is-lg" onClick={startQuiz} disabled={generating}>
              <Icon name="sparkles" size={14} className="" /> {generating ? 'Generating…' : 'Generate & start'}
            </button>
          </div>
        </div>
        <div className="card">
          <div className="t-eyebrow" style={{marginBottom: 14}}>Recent</div>
          <div className="col" style={{gap: 0}}>
            {state.quizzes.filter(q => q.completed).slice(0, 5).map((q, i) => (
              <div key={q.id} className="row" style={{justifyContent: "space-between", padding: "12px 0", borderBottom: i === Math.min(4, state.quizzes.filter(x => x.completed).length - 1) ? 0 : "1px solid var(--hairline)"}}>
                <div>
                  <div style={{fontWeight: 500, fontSize: 13.5}}>{q.title}</div>
                  <div className="muted" style={{fontSize: 11.5}}>{q.date}</div>
                </div>
                <div className="t-mono" style={{color: q.score >= 80 ? "var(--ok)" : q.score >= 60 ? "var(--warn)" : "var(--danger)", fontSize: 14, fontWeight: 500}}>{q.score}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (mode === "taking") {
    const q = questions[idx];
    const chosen = answers[idx];
    return (
      <div className="col" style={{gap: 24, maxWidth: 720, margin: "0 auto", width: "100%"}}>
        <div className="row" style={{justifyContent: "space-between"}}>
          <div className="t-eyebrow">Question {idx + 1} / {questions.length}</div>
          <button className="btn is-quiet is-sm" onClick={() => setMode("config")}>Exit</button>
        </div>
        <div style={{height: 4, borderRadius: 4, background: "var(--paper-2)", overflow: "hidden"}}>
          <div style={{height: "100%", width: `${((idx + 1) / questions.length) * 100}%`, background: "var(--accent)", transition: "width 0.3s var(--ease)"}}></div>
        </div>
        <div className="card" style={{padding: 28}}>
          <div className="t-display" style={{fontSize: 28, lineHeight: 1.2, marginBottom: 24}}>{q.questionText}</div>
          <div className="col" style={{gap: 10}}>
            {q.options.map((opt, i) => {
              const isChosen = chosen === opt;
              const isCorrect = opt === q.correctAnswer;
              const showCorrect = chosen && isCorrect;
              const showWrong = isChosen && !isCorrect;
              return (
                <button key={i} onClick={() => !chosen && answer(opt)}
                  className="lift"
                  style={{
                    textAlign: "left", padding: "14px 16px",
                    background: showCorrect ? "color-mix(in oklch, var(--ok), white 88%)" : showWrong ? "color-mix(in oklch, var(--danger), white 90%)" : isChosen ? "var(--paper-2)" : "var(--card)",
                    border: `1px solid ${showCorrect ? "var(--ok)" : showWrong ? "var(--danger)" : "var(--hairline)"}`,
                    borderRadius: 12,
                    color: "var(--ink)", display: "flex", alignItems: "center", gap: 14, cursor: chosen ? "default" : "default",
                    width: "100%"
                  }}>
                  <span className="t-mono" style={{width: 22, textAlign: "center", color: "var(--ink-3)"}}>{String.fromCharCode(65+i)}</span>
                  <span style={{flex: 1, fontSize: 14.5}}>{opt}</span>
                  {showCorrect && <Icon name="check" size={16} className="" />}
                </button>
              );
            })}
          </div>
          {chosen && (
            <div style={{marginTop: 18, padding: "14px 16px", background: "var(--paper-2)", borderRadius: 10, borderLeft: `3px solid ${chosen === q.correctAnswer ? "var(--ok)" : "var(--accent)"}`}}>
              <div className="t-eyebrow" style={{marginBottom: 4}}>{chosen === q.correctAnswer ? "Correct" : "Not quite"}</div>
              <div style={{fontSize: 13.5, color: "var(--ink-2)"}}>{q.explanation}</div>
            </div>
          )}
        </div>
        <div className="row" style={{justifyContent: "space-between"}}>
          <button className="btn is-ghost" disabled={idx === 0} onClick={() => setIdx(i => i - 1)}><Icon name="chevL" size={14} className="" /> Prev</button>
          {idx < questions.length - 1
            ? <button className="btn is-accent" disabled={!chosen} onClick={() => setIdx(i => i + 1)}>Next <Icon name="chevR" size={14} className="" /></button>
            : <button className="btn is-accent" disabled={!chosen} onClick={finish}>Finish</button>}
        </div>
      </div>
    );
  }

  // result
  const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length;
  const score = Math.round((correct / questions.length) * 100);
  return (
    <div className="col" style={{gap: 24, maxWidth: 640, margin: "0 auto", width: "100%", alignItems: "stretch"}}>
      <div className="card" style={{textAlign: "center", padding: "40px 28px"}}>
        <div className="t-eyebrow" style={{marginBottom: 6}}>You scored</div>
        <div className="t-display" style={{fontSize: 92, lineHeight: 1, color: "var(--accent)"}}>{score}<span style={{fontSize: 36}}>%</span></div>
        <div className="muted" style={{marginTop: 8}}>{correct} of {questions.length} correct</div>
        <div className="row" style={{justifyContent: "center", gap: 10, marginTop: 22}}>
          <button className="btn is-ghost" onClick={() => setMode("config")}>New quiz</button>
          <button className="btn is-accent" onClick={() => setTab("dashboard")}>Back to dashboard</button>
        </div>
      </div>
      <div className="card">
        <div className="t-eyebrow" style={{marginBottom: 14}}>Review</div>
        <div className="col" style={{gap: 14}}>
          {questions.map((q, i) => {
            const isCorrect = answers[i] === q.correctAnswer;
            return (
              <div key={i} className="row" style={{gap: 12, alignItems: "flex-start"}}>
                <div style={{width: 26, height: 26, borderRadius: 6, background: isCorrect ? "color-mix(in oklch, var(--ok), white 80%)" : "color-mix(in oklch, var(--danger), white 88%)", color: isCorrect ? "var(--ok)" : "var(--danger)", display: "grid", placeItems: "center", flexShrink: 0}}>
                  <Icon name={isCorrect ? "check" : "chevR"} size={14} className="" />
                </div>
                <div>
                  <div style={{fontSize: 13.5, fontWeight: 500}}>{q.questionText}</div>
                  <div className="muted" style={{fontSize: 12, marginTop: 3}}>Your answer: {answers[i] || "—"} · Correct: {q.correctAnswer}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { SAMPLE_QUIZ_QUESTIONS };
export default ScreenQuiz;
