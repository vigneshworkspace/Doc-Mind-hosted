// screens-learn.jsx — Quiz, Flashcards, PDF Q&A, Audio Recap, Quick Revise

const { useState: useS2, useEffect: useE2, useRef: useR2 } = React;

// ─────────────────────────── QUIZ ───────────────────────────
const SAMPLE_QUIZ_QUESTIONS = [
  { questionText: "What does 'quantization' mean in quantum physics?", options: ["Energy comes in discrete packets", "Particles always move", "Light is a continuous wave only", "Mass is the same as energy"], correctAnswer: "Energy comes in discrete packets", explanation: "Quantization means certain physical quantities can only take on specific, discrete values rather than any value along a continuum." },
  { questionText: "Wave-particle duality applies to…", options: ["Only photons", "Only electrons", "Both matter and light", "Only large objects"], correctAnswer: "Both matter and light", explanation: "Matter and light both exhibit wave-like and particle-like properties depending on the experiment performed." },
  { questionText: "The uncertainty principle limits the precision of which pair?", options: ["Position and momentum", "Mass and weight", "Color and temperature", "Voltage and current"], correctAnswer: "Position and momentum", explanation: "Heisenberg's principle states there's a fundamental limit on simultaneously knowing position and momentum." },
  { questionText: "Which experiment demonstrated photons?", options: ["Cavendish", "Photoelectric effect", "Ohm's law", "Stern–Gerlach"], correctAnswer: "Photoelectric effect", explanation: "Einstein's analysis of the photoelectric effect showed light energy arrives in discrete quanta." },
  { questionText: "Schrödinger's equation describes…", options: ["Classical orbits", "Wavefunctions evolving in time", "Newton's third law", "Brownian motion only"], correctAnswer: "Wavefunctions evolving in time", explanation: "It is the central equation of non-relativistic quantum mechanics, governing how wavefunctions change over time." },
];

function ScreenQuiz({ state, dispatch, setTab }) {
  const [mode, setMode] = useS2("config"); // config | taking | result
  const [config, setConfig] = useS2({ docId: state.documents[0]?.id ?? "", count: 5, difficulty: "medium" });
  const [questions, setQuestions] = useS2([]);
  const [idx, setIdx] = useS2(0);
  const [answers, setAnswers] = useS2({});

  function startQuiz() {
    const qs = SAMPLE_QUIZ_QUESTIONS.slice(0, config.count);
    setQuestions(qs);
    setIdx(0);
    setAnswers({});
    setMode("taking");
  }

  function answer(opt) {
    setAnswers(a => ({...a, [idx]: opt}));
  }

  function finish() {
    const correct = questions.filter((q, i) => answers[i] === q.correctAnswer).length;
    const score = Math.round((correct / questions.length) * 100);
    dispatch({ type: "add-quiz", quiz: {
      id: Date.now(), title: `Practice — ${new Date().toLocaleDateString()}`,
      questions, completed: true, score, date: new Date().toISOString().slice(0, 10)
    }});
    setMode("result");
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
          <span className="tag" style={{marginBottom: 14, display: "block"}}><span className="numeral">\u00a7</span> New quiz</span>
          <div className="col" style={{gap: 18}}>
            <div>
              <label className="field-label">Source</label>
              <select className="input" value={config.docId} onChange={e => setConfig(c => ({...c, docId: e.target.value}))}>
                {state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                <option value="">General knowledge</option>
              </select>
            </div>
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
              <label className="field-label">Number of questions — {config.count}</label>
              <input type="range" min="3" max="5" value={config.count} onChange={e => setConfig(c => ({...c, count: +e.target.value}))} style={{width: "100%"}} />
              <div className="row" style={{justifyContent: "space-between", color: "var(--ink-4)", fontSize: 11}}>
                <span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <button className="btn is-accent is-lg" onClick={startQuiz}>
              <Icon name="sparkles" size={14} className="" /> Generate & start
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
            const correct = answers[i] === q.correctAnswer;
            return (
              <div key={i} className="row" style={{gap: 12, alignItems: "flex-start"}}>
                <div style={{width: 26, height: 26, borderRadius: 6, background: correct ? "color-mix(in oklch, var(--ok), white 80%)" : "color-mix(in oklch, var(--danger), white 88%)", color: correct ? "var(--ok)" : "var(--danger)", display: "grid", placeItems: "center", flexShrink: 0}}>
                  <Icon name={correct ? "check" : "chevR"} size={14} className="" />
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
window.ScreenQuiz = ScreenQuiz;


// ─────────────────────────── FLASHCARDS ───────────────────────────
function ScreenFlashcards({ state, dispatch }) {
  const [active, setActive] = useS2(null); // a flashcard set being studied
  const [flipped, setFlipped] = useS2(false);
  const [idx, setIdx] = useS2(0);

  function startSet(set) { setActive(set); setIdx(0); setFlipped(false); }

  if (!active) return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1><em className="t-italic">Flashcards</em>, by you and for you.</h1>
        <p>Pick a set to study, or generate one from any document. Press space to flip; arrow keys to move on.</p>
      </div>
      <div className="grid grid-3">
        {state.flashcardSets.map(set => (
          <div key={set.id} className="card lift" style={{cursor: "default"}} onClick={() => startSet(set)}>
            <div style={{aspectRatio: "16/9", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative", marginBottom: 14, overflow: "hidden"}}>
              <div style={{position: "absolute", inset: "auto 18px 18px 18px", height: "70%", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 8, boxShadow: "0 -8px 0 -2px var(--paper), 0 -8px 0 -3px var(--hairline), 0 -16px 0 -4px var(--paper), 0 -16px 0 -5px var(--hairline)"}}></div>
              <div style={{position: "relative", fontFamily: "var(--f-display)", fontSize: 24, color: "var(--ink-3)"}}>{set.cards.length}</div>
            </div>
            <div style={{fontWeight: 500}}>{set.title}</div>
            <div className="muted" style={{fontSize: 12, marginTop: 3}}>{set.cards.length} cards · {set.date}</div>
          </div>
        ))}
        <button className="card lift" style={{borderStyle: "dashed", color: "var(--ink-3)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 220, cursor: "default"}}
          onClick={() => {
            const newSet = { id: Date.now(), title: "New set", date: new Date().toISOString().slice(0,10), cards: [
              {id: 1, question: "What is the chain rule?", answer: "A formula to compute the derivative of a composite function — multiply the derivatives of each link."},
              {id: 2, question: "Define mitochondria.", answer: "The cell's power plants — they convert food into ATP."},
              {id: 3, question: "Newton's first law?", answer: "An object in motion stays in motion unless acted on by an external force."},
            ]};
            dispatch({ type: "add-flashcard-set", set: newSet });
          }}>
          <Icon name="plus" size={20} className="" />
          <div style={{fontFamily: "var(--f-display)", fontSize: 18}}>Generate a set</div>
          <div className="muted" style={{fontSize: 12}}>From any document or topic</div>
        </button>
      </div>
    </div>
  );

  const card = active.cards[idx];
  return (
    <div className="col" style={{gap: 18, maxWidth: 640, margin: "0 auto", width: "100%"}}>
      <div className="row" style={{justifyContent: "space-between"}}>
        <button className="btn is-quiet is-sm" onClick={() => setActive(null)}>← All sets</button>
        <div className="t-eyebrow">{idx + 1} / {active.cards.length}</div>
        <div style={{width: 80}}></div>
      </div>
      <div style={{height: 3, borderRadius: 3, background: "var(--paper-2)", overflow: "hidden"}}>
        <div style={{height: "100%", width: `${((idx + 1) / active.cards.length) * 100}%`, background: "var(--accent)", transition: "width 0.3s var(--ease)"}}></div>
      </div>
      <div onClick={() => setFlipped(f => !f)} style={{aspectRatio: "5/3", perspective: 1400, cursor: "default"}}>
        <div style={{position: "relative", height: "100%", transformStyle: "preserve-3d", transition: "transform 0.55s var(--ease)", transform: flipped ? "rotateY(180deg)" : "none"}}>
          <FlipFace face="front" content={card.question} hint="Tap to flip" />
          <FlipFace face="back" content={card.answer} hint="Tap to flip back" />
        </div>
      </div>
      <div className="row" style={{justifyContent: "space-between"}}>
        <button className="btn is-ghost" disabled={idx === 0} onClick={() => { setIdx(i => i - 1); setFlipped(false); }}><Icon name="chevL" size={14} className="" /> Prev</button>
        <div className="row" style={{gap: 6}}>
          <button className="btn is-ghost is-sm">Again</button>
          <button className="btn is-ghost is-sm">Hard</button>
          <button className="btn is-ghost is-sm">Good</button>
          <button className="btn is-accent is-sm">Easy</button>
        </div>
        <button className="btn is-ghost" disabled={idx === active.cards.length - 1} onClick={() => { setIdx(i => i + 1); setFlipped(false); }}>Next <Icon name="chevR" size={14} className="" /></button>
      </div>
    </div>
  );
}
window.ScreenFlashcards = ScreenFlashcards;

function FlipFace({ face, content, hint }) {
  return (
    <div className="card" style={{position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: face === "back" ? "rotateY(180deg)" : "none", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 36, textAlign: "center", background: face === "back" ? "var(--ink)" : "var(--card)", color: face === "back" ? "var(--paper)" : "var(--ink)", border: "1px solid var(--hairline)"}}>
      <div className="t-eyebrow" style={{position: "absolute", top: 18, left: 24, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{face === "front" ? "Question" : "Answer"}</div>
      <div className="t-display" style={{fontSize: 32, lineHeight: 1.2, maxWidth: 500}}>{content}</div>
      <div className="muted" style={{position: "absolute", bottom: 18, fontSize: 11, color: face === "back" ? "var(--ink-4)" : "var(--ink-3)"}}>{hint}</div>
    </div>
  );
}


// ─────────────────────────── PDF Q&A ───────────────────────────
function ScreenPdfQA({ state, dispatch }) {
  const [doc, setDoc] = useS2(state.documents[0]);
  const [messages, setMessages] = useS2([
    { sender: "ai", text: "Loaded — ask me anything from this document and I'll cite where I'm looking." }
  ]);
  const [input, setInput] = useS2("");
  const endRef = useR2(null);
  useE2(() => endRef.current?.scrollIntoView?.({block: "end"}), [messages]);

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
window.ScreenPdfQA = ScreenPdfQA;


// ─────────────────────────── AUDIO RECAP ───────────────────────────
function ScreenAudioRecap({ state }) {
  const [active, setActive] = useS2(state.audioRecaps[0]);
  const [playing, setPlaying] = useS2(false);
  const [lineIdx, setLineIdx] = useS2(0);
  const [position, setPosition] = useS2(0);

  useE2(() => {
    if (!playing) return;
    const total = active.script.length * 3.5;
    const id = setInterval(() => {
      setPosition(p => {
        const np = p + 0.1;
        if (np >= total) { setPlaying(false); return total; }
        setLineIdx(Math.min(active.script.length - 1, Math.floor(np / 3.5)));
        return np;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, active]);

  const total = active.script.length * 3.5;
  const mm = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2, "0")}`;

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Audio <em className="t-italic">recap.</em></h1>
        <p>Two voices, your topic, conversational. Made for the bus ride, the dishes, or the lawn mower.</p>
      </div>

      <div className="grid" style={{gridTemplateColumns: "1.5fr 1fr"}}>
        <div className="card" style={{display: "flex", flexDirection: "column", gap: 18}}>
          <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
            <div>
              <div className="t-eyebrow">Now playing</div>
              <div className="t-display" style={{fontSize: 26, marginTop: 4}}>{active.title}</div>
            </div>
            <span className="chip">{active.script.length} turns · ~{Math.round(total)}s</span>
          </div>

          <Waveform playing={playing} progress={position / total} />

          <div className="row" style={{justifyContent: "space-between", color: "var(--ink-3)", fontSize: 12}}>
            <span className="t-mono">{mm(position)}</span>
            <span className="t-mono">{mm(total)}</span>
          </div>

          <div className="row" style={{justifyContent: "center", gap: 12}}>
            <button className="btn is-ghost is-icon" onClick={() => { setPosition(Math.max(0, position - 5)); setLineIdx(Math.max(0, Math.floor((position-5)/3.5))); }}><Icon name="chevL" size={16} className="" /></button>
            <button className="btn is-accent" style={{width: 56, height: 56, borderRadius: 28}} onClick={() => setPlaying(p => !p)}>
              <Icon name={playing ? "pause" : "play"} size={20} className="" />
            </button>
            <button className="btn is-ghost is-icon" onClick={() => { setPosition(Math.min(total, position + 5)); setLineIdx(Math.min(active.script.length-1, Math.floor((position+5)/3.5))); }}><Icon name="chevR" size={16} className="" /></button>
          </div>

          <div style={{padding: "14px 16px", background: "var(--paper-2)", borderRadius: 12}}>
            <div className="row" style={{alignItems: "flex-start", gap: 12}}>
              <div style={{width: 32, height: 32, borderRadius: 50, background: active.script[lineIdx].speaker === "Alex" ? "var(--accent)" : "var(--ink)", color: "white", display: "grid", placeItems: "center", fontFamily: "var(--f-display)", fontStyle: "italic", flexShrink: 0}}>{active.script[lineIdx].speaker[0]}</div>
              <div>
                <div className="t-eyebrow" style={{marginBottom: 4}}>{active.script[lineIdx].speaker}</div>
                <div style={{fontSize: 14, lineHeight: 1.55}}>{active.script[lineIdx].dialogue}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-flush">
          <div style={{padding: "16px 18px", borderBottom: "1px solid var(--hairline)"}}>
            <div className="t-eyebrow">Library</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 4}}>{state.audioRecaps.length} recaps</div>
          </div>
          <div>
            {state.audioRecaps.map((r, i) => (
              <button key={r.id} className="lift" style={{display: "block", width: "100%", textAlign: "left", padding: "12px 18px", borderBottom: i === state.audioRecaps.length - 1 ? 0 : "1px solid var(--hairline)", background: r.id === active.id ? "var(--paper-2)" : "transparent", border: 0, cursor: "default"}} onClick={() => { setActive(r); setPlaying(false); setLineIdx(0); setPosition(0); }}>
                <div style={{fontWeight: 500, fontSize: 13.5}}>{r.title}</div>
                <div className="muted" style={{fontSize: 12, marginTop: 2}}>{r.date}</div>
              </button>
            ))}
            <button className="lift" style={{display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", color: "var(--ink-3)", background: "transparent", border: 0, borderTop: "1px solid var(--hairline)", cursor: "default", fontFamily: "var(--f-body)"}}>
              <Icon name="plus" size={14} className="" /> New recap
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="t-eyebrow" style={{marginBottom: 14}}>Transcript</div>
        <div className="col" style={{gap: 14}}>
          {active.script.map((line, i) => (
            <div key={i} className="row" style={{alignItems: "flex-start", gap: 12, opacity: i === lineIdx ? 1 : 0.6, transition: "opacity 0.3s var(--ease)"}}>
              <div style={{width: 24, height: 24, borderRadius: 50, background: line.speaker === "Alex" ? "var(--accent)" : "var(--ink)", color: "white", display: "grid", placeItems: "center", fontSize: 10, flexShrink: 0, fontFamily: "var(--f-display)", fontStyle: "italic"}}>{line.speaker[0]}</div>
              <div>
                <div className="muted" style={{fontSize: 11, marginBottom: 2}}>{line.speaker}</div>
                <div style={{fontSize: 14, lineHeight: 1.55}}>{line.dialogue}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.ScreenAudioRecap = ScreenAudioRecap;

function Waveform({ playing, progress = 0 }) {
  const bars = useS2(() => Array.from({length: 64}, (_, i) => {
    const v = (Math.sin(i * 0.4) * 0.5 + Math.sin(i * 1.2) * 0.3 + Math.cos(i * 0.7) * 0.3 + 1) / 2.5;
    return Math.max(0.15, Math.min(1, v * 0.9 + Math.random() * 0.1));
  }))[0];
  return (
    <div style={{display: "flex", alignItems: "center", gap: 3, height: 64}}>
      {bars.map((h, i) => {
        const active = i / bars.length < progress;
        const phase = playing && Math.abs(i / bars.length - progress) < 0.04;
        return <div key={i} style={{flex: 1, height: `${h * 100}%`, background: active ? "var(--accent)" : "var(--hairline)", borderRadius: 2, transform: phase ? "scaleY(1.15)" : "scaleY(1)", transition: "transform 0.15s var(--ease), background 0.2s var(--ease)"}}></div>;
      })}
    </div>
  );
}


// ─────────────────────────── QUICK REVISE ───────────────────────────
function ScreenQuickRevise({ state }) {
  const [active, setActive] = useS2(state.quickReviseSessions[0]);
  const [expanded, setExpanded] = useS2({});

  return (
    <div className="col" style={{gap: 24, maxWidth: 820, margin: "0 auto", width: "100%"}}>
      <div className="page-hero" style={{marginBottom: 0, paddingBottom: 18}}>
        <h1>Quick <em className="t-italic">revise.</em></h1>
        <p>The TL;DR of any document — read in two minutes, expand for depth, move on.</p>
      </div>
      <div className="row" style={{justifyContent: "space-between"}}>
        <select className="input" style={{width: "auto", maxWidth: 360}} value={active.id} onChange={e => setActive(state.quickReviseSessions.find(s => s.id === +e.target.value))}>
          {state.quickReviseSessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <div className="chip">{active.points.length} key points</div>
      </div>
      <div className="col" style={{gap: 14}}>
        {active.points.map((p, i) => (
          <div key={i} className="card">
            <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start", gap: 14}}>
              <div style={{flex: 1}}>
                <div className="row" style={{gap: 10, marginBottom: 8}}>
                  <span className="t-mono" style={{fontSize: 11, color: "var(--ink-4)"}}>{String(i+1).padStart(2, "0")}</span>
                  <span className="t-eyebrow">Key point</span>
                </div>
                <div className="t-display" style={{fontSize: 22, lineHeight: 1.2, marginBottom: 10}}>{p.keyPoint}</div>
                <p style={{color: "var(--ink-2)", fontSize: 14, lineHeight: 1.6}}>{p.simplifiedExplanation}</p>
                {expanded[i] && (
                  <div style={{marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--hairline)"}}>
                    <div className="t-eyebrow" style={{marginBottom: 6}}>The full picture</div>
                    <p style={{color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.65}}>{p.detailedExplanation}</p>
                  </div>
                )}
              </div>
            </div>
            <button className="btn is-quiet is-sm" style={{marginTop: 10}} onClick={() => setExpanded(e => ({...e, [i]: !e[i]}))}>
              {expanded[i] ? "Show less" : "Go deeper"}
              <Icon name={expanded[i] ? "chevU" : "chevD"} size={12} className="" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
window.ScreenQuickRevise = ScreenQuickRevise;
