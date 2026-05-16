// app.jsx — main DocMind shell

const { useState, useEffect, useReducer, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentPalette": ["#4F6BED", "#2DB48A", "#E8B43E", "#ffffff", "#18181b"],
  "typePair": "serif-sans",
  "density": "regular",
  "sidebar": "expanded",
  "fox": true,
  "dark": false
}/*EDITMODE-END*/;

// palette = [accent, accent-2, accent-3, paper-tint, ink]
const PALETTES = [
  ["#4F6BED", "#2DB48A", "#E8B43E", "#ffffff", "#18181b"], // Studio — indigo / teal / gold
  ["#FF6B35", "#2EC4B6", "#FFC233", "#ffffff", "#1A1A2E"], // Citrus — coral / teal / sun
  ["#E5006D", "#2D6CDF", "#C7F65A", "#ffffff", "#0A0A1E"], // Pop Art — magenta / cobalt / lime
  ["#2A9D8F", "#E76F51", "#E9C46A", "#ffffff", "#264653"], // Botanical — emerald / terracotta / ochre
  ["#FF5E5B", "#9D4EDD", "#FFB400", "#ffffff", "#2A1B3D"], // Sunset — coral / purple / amber
  ["#1E40AF", "#DC2626", "#F59E0B", "#ffffff", "#1C1917"], // Atelier — cobalt / vermillion / gold
  ["#7C3AED", "#06B6D4", "#F472B6", "#ffffff", "#1E1B3A"], // Iris — violet / cyan / rose
  ["#16A34A", "#0891B2", "#CA8A04", "#ffffff", "#14532d"], // Forest — green / cyan / amber
  ["#C2410C", "#B45309", "#15803D", "#ffffff", "#1c0a00"], // Ember — burnt orange / ochre / sage
  ["#0F172A", "#E5006D", "#F59E0B", "#ffffff", "#0F172A"], // Midnight — near-black / magenta / gold
];

const TYPE_PAIRS = {
  "serif-sans": { display: '"Instrument Serif", Georgia, serif', body: '"Inter Tight", -apple-system, sans-serif', label: "Instrument × Inter" },
  "sans-only":  { display: '"Inter Tight", -apple-system, sans-serif', body: '"Inter Tight", -apple-system, sans-serif', label: "Inter only" },
  "fraunces-newsreader": { display: '"Newsreader", Georgia, serif', body: '"Inter Tight", sans-serif', label: "Newsreader × Inter" },
  "mono-led":   { display: '"JetBrains Mono", monospace', body: '"Inter Tight", sans-serif', label: "JetBrains × Inter" },
};

// ─────────────────────────── MOCK DATA ───────────────────────────
const today = new Date();
const day = (off) => { const d = new Date(today); d.setDate(today.getDate() - off); return d.toISOString().slice(0, 10); };

const initialState = {
  user: { name: "Sam Reyes", email: "sam@school.edu" },
  documents: [
    { id: 1, name: "Quantum Physics Intro.pdf", size: "2.1 MB", type: "pdf", uploadDate: day(7), tags: ["Physics", "Lecture"], content: "Quantum physics is the study of matter and energy at the most fundamental level. Quantization means a physical quantity can only have certain discrete values. Wave-particle duality says every particle may be described as either a particle or a wave. The uncertainty principle states there is a fundamental limit to the precision with which certain pairs of physical properties, such as position and momentum, can be known." },
    { id: 2, name: "Calculus Cheatsheet.docx", size: "0.5 MB", type: "docx", uploadDate: day(9), tags: ["Math", "Formulas"], content: "Key calculus formulas. The chain rule computes the derivative of a composite function. The product rule finds the derivatives of products of functions. The fundamental theorem of calculus relates differentiation and integration." },
    { id: 3, name: "Renaissance Art.pdf", size: "4.2 MB", type: "pdf", uploadDate: day(14), tags: ["History", "Art"], content: "The Renaissance was a period of intense artistic and intellectual activity in Europe, characterized by a renewed interest in classical antiquity and a focus on humanism." },
    { id: 4, name: "Macroeconomics Ch.3.pdf", size: "1.8 MB", type: "pdf", uploadDate: day(2), tags: ["Economics"], content: "Macroeconomics studies aggregate indicators such as GDP, unemployment rates, and price indices." },
  ],
  quizzes: [
    { id: 1, title: "History of Rome", questions: [], completed: true, score: 85, date: day(2) },
    { id: 2, title: "Algebra Basics", questions: [], completed: true, score: 92, date: day(4) },
    { id: 3, title: "Intro to Physics", questions: [], completed: false, score: null, date: day(1) },
    { id: 4, title: "Quantum Physics Quiz", questions: [], completed: true, score: 100, date: day(6) },
    { id: 5, title: "Calculus Practice", questions: [], completed: true, score: 78, date: day(10) },
  ],
  flashcardSets: [
    { id: 1, title: "Quantum Physics Basics", date: day(5), sourceDocumentId: 1, cards: [
      { id: 1, question: "What is quantization?", answer: "The concept that a physical quantity can only have certain discrete values." },
      { id: 2, question: "What is wave-particle duality?", answer: "Every particle may be described as either a particle or a wave." },
      { id: 3, question: "State the uncertainty principle.", answer: "There is a fundamental limit to the precision with which certain pairs of physical properties, such as position and momentum, can be known simultaneously." },
    ]},
    { id: 2, title: "Key Calculus Formulas", date: day(8), sourceDocumentId: 2, cards: [
      { id: 1, question: "What is the chain rule?", answer: "A formula to compute the derivative of a composite function: (f(g(x)))′ = f′(g(x))·g′(x)." },
      { id: 2, question: "What is the product rule?", answer: "(uv)′ = u′v + uv′. The derivative of a product is not the product of the derivatives." },
    ]},
  ],
  mindMaps: [
    { id: 1, title: "Quantum Physics Concepts", date: day(3), sourceDocumentId: 1, root: {
      id: "root", text: "Quantum Physics",
      children: [
        { id: "1", text: "Foundations", children: [
          { id: "1.1", text: "Quantization", children: [] },
          { id: "1.2", text: "Duality", children: [] },
          { id: "1.3", text: "Uncertainty", children: [] },
        ]},
        { id: "2", text: "Phenomena", children: [
          { id: "2.1", text: "Photoelectric", children: [] },
          { id: "2.2", text: "Blackbody", children: [] },
        ]},
        { id: "3", text: "Math", children: [
          { id: "3.1", text: "Schrödinger eq.", children: [] },
          { id: "3.2", text: "Operators", children: [] },
        ]},
        { id: "4", text: "Interpretation", children: [
          { id: "4.1", text: "Copenhagen", children: [] },
          { id: "4.2", text: "Many-worlds", children: [] },
        ]},
      ]
    }},
  ],
  audioRecaps: [
    { id: 1, title: "Understanding Quantum Physics", date: day(1), sourceDocumentId: 1,
      summary: "Quick conversational overview of quantization and wave-particle duality.",
      script: [
        { speaker: "Alex", dialogue: "Hey Ben, let's dive into Quantum Physics. Where do we even start?" },
        { speaker: "Ben", dialogue: "The biggest idea is quantization. Physical properties like energy come in discrete amounts — like steps on a staircase, not a ramp." },
        { speaker: "Alex", dialogue: "So energy isn't infinitely divisible?" },
        { speaker: "Ben", dialogue: "Right. And there's wave-particle duality: tiny things like electrons act as both particles and waves at the same time." },
        { speaker: "Alex", dialogue: "Wild. What about uncertainty?" },
        { speaker: "Ben", dialogue: "The uncertainty principle says you can't pin down both position and momentum precisely. Pick one." },
      ]
    },
    { id: 2, title: "Calculus in 4 Minutes", date: day(6), sourceDocumentId: 2,
      summary: "Chain and product rules, fast.",
      script: [
        { speaker: "Alex", dialogue: "Let's do the chain rule." },
        { speaker: "Ben", dialogue: "A composite function is one inside another. The chain rule says to differentiate from the outside in, multiplying as you go." },
        { speaker: "Alex", dialogue: "And the product rule?" },
        { speaker: "Ben", dialogue: "First times derivative of second, plus second times derivative of first." },
      ]
    },
  ],
  quickReviseSessions: [
    { id: 1, title: "Calculus Cheatsheet Simplified", date: day(3), sourceDocumentId: 2, points: [
      { keyPoint: "The Chain Rule", simplifiedExplanation: "If you nest one function inside another, the chain rule tells you how a change at the inside ripples through to the outside. Differentiate the outer, keep the inner, multiply by the inner's own derivative.", detailedExplanation: "Formally, for f(g(x)), the derivative is f′(g(x))·g′(x). This is essential whenever you encounter compositions — exponentials of polynomials, trigonometric expressions involving x², and so on." },
      { keyPoint: "The Product Rule", simplifiedExplanation: "When two functions are multiplied, you can't just multiply their derivatives. Each one contributes — derivative of the first times the second, plus the first times derivative of the second.", detailedExplanation: "(uv)′ = u′v + uv′. The product rule is what makes calculus work for things like x·sin(x) — you need both factors' contributions." },
      { keyPoint: "Fundamental Theorem", simplifiedExplanation: "Integration and differentiation are reverse operations. The integral of a derivative recovers the original, up to a constant.", detailedExplanation: "The first part: if F′(x) = f(x), then ∫ₐᵇ f(x)dx = F(b) − F(a). The second part: differentiation of the integral of f recovers f." },
    ]},
  ],
  notes: [
    { id: 1, title: "Biology Lecture 3", content: "Mitochondria is the powerhouse of the cell. It generates most of the cell's supply of adenosine triphosphate (ATP), used as a source of chemical energy.\n\nKey terms:\n- ATP — currency of cellular energy\n- Cellular respiration — process that yields ATP from glucose\n- Krebs cycle — central reaction sequence inside the mitochondrial matrix", date: day(3), subject: "Biology" },
    { id: 2, title: "Project Ideas", content: "Some things to build:\n1. AI-powered study assistant that generates quizzes and flashcards from any document.\n2. Collaborative whiteboard for study groups.\n3. Spaced-repetition system tuned to test dates.\n4. Audio recaps in different voices.", date: day(4), subject: "CS Project" },
    { id: 3, title: "Reading list", content: "On the shelf:\n- Thinking, Fast and Slow — Kahneman\n- Sapiens — Harari\n- A People's History of the United States — Zinn", date: day(8), subject: "Personal" },
  ],
  studyGroups: [
    { id: 1, name: "Finals Prep Group", members: 5, subject: "General", nextSession: "Thursday, 6:00 PM", description: "Covering all major topics for the final exams. Bring your hardest questions and we'll work through them." },
    { id: 2, name: "Calculus Crew", members: 8, subject: "Mathematics", nextSession: "Friday, 3:00 PM", description: "Weekly review of calculus concepts with rotating presenters." },
    { id: 3, name: "Quantum Reading Circle", members: 4, subject: "Physics", nextSession: "Sunday, 11:00 AM", description: "Slow read through Griffiths. Currently on chapter 3." },
    { id: 4, name: "History Through Sources", members: 12, subject: "History", nextSession: "Tuesday, 5:00 PM", description: "Primary-source readings and weekly discussion." },
  ],
  activityLog: [day(1), day(1), day(2), day(2), day(3), day(4), day(4), day(5), day(7), day(8), day(8), day(10), day(11), day(13)],
  streak: 12,
  settings: {
    language: "English",
    notifications: true,
    autoSave: true,
    studyReminders: false,
    aiProvider: "gemini",
    ollamaEndpoint: "http://localhost:11434",
  },
};

function reducer(state, action) {
  switch (action.type) {
    case "add-doc": return { ...state, documents: [action.doc, ...state.documents] };
    case "add-quiz": return { ...state, quizzes: [action.quiz, ...state.quizzes], activityLog: [...state.activityLog, action.quiz.date] };
    case "add-flashcard-set": return { ...state, flashcardSets: [action.set, ...state.flashcardSets] };
    case "add-note": return { ...state, notes: [action.note, ...state.notes] };
    case "update-note": return { ...state, notes: state.notes.map(n => n.id === action.id ? {...n, title: action.title, content: action.content} : n) };
    case "add-group": return { ...state, studyGroups: [action.group, ...state.studyGroups] };
    case "set-settings": return { ...state, settings: {...state.settings, ...action.patch} };
    case "set-user": return { ...state, user: {...state.user, ...action.patch} };
    default: return state;
  }
}

// ─────────────────────────── ROOT ───────────────────────────
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [foxClicks, setFoxClicks] = useState(0);
  const [state, dispatch] = useReducer(reducer, initialState);

  // pomodoro global
  const [pomodoro, setPomodoro] = useState({
    mode: "focus", running: false, seconds: 25 * 60,
    focusMin: 25, breakMin: 5, cycle: 1, todayCycles: 2,
  });
  useEffect(() => {
    if (!pomodoro.running) return;
    const id = setInterval(() => {
      setPomodoro(p => {
        if (p.seconds <= 1) {
          const nextMode = p.mode === "focus" ? "break" : "focus";
          return { ...p, mode: nextMode, seconds: (nextMode === "focus" ? p.focusMin : p.breakMin) * 60, cycle: nextMode === "focus" ? p.cycle + 1 : p.cycle, todayCycles: nextMode === "focus" ? p.todayCycles + 1 : p.todayCycles };
        }
        return {...p, seconds: p.seconds - 1};
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoro.running]);

  // apply tweaks → CSS variables
  // NOTE: all setProperty calls pass "important" so they win over the
  // !important lock in the HTML <style> block.
  useEffect(() => {
    const r = document.documentElement;
    const imp = "important";
    const p = t.accentPalette || PALETTES[0];
    const [a1, a2, a3, paper, ink] = p;

    r.style.setProperty("--accent",     a1, imp);
    r.style.setProperty("--accent-ink", `color-mix(in oklch, ${a1} 78%, black 22%)`, imp);
    r.style.setProperty("--accent-soft",`color-mix(in oklch, ${a1} 14%, white)`, imp);
    r.style.setProperty("--accent-2",   a2 || "#2DB48A", imp);
    r.style.setProperty("--accent-2-soft", `color-mix(in oklch, ${a2 || "#2DB48A"} 14%, white)`, imp);
    r.style.setProperty("--accent-3",   a3 || "#E8B43E", imp);
    r.style.setProperty("--accent-3-soft", `color-mix(in oklch, ${a3 || "#E8B43E"} 18%, white)`, imp);

    // paper & ink — only in light mode; dark mode uses the .is-dark class vars
    if (!t.dark) {
      r.style.setProperty("--paper",   paper || "#ffffff", imp);
      r.style.setProperty("--paper-2", paper
        ? `color-mix(in oklch, ${paper} 88%, ${a1} 12%)`
        : "oklch(98% 0.002 250)", imp);
      r.style.setProperty("--ink",     ink   || "oklch(20% 0.012 260)", imp);
      r.style.setProperty("--card",    paper || "#ffffff", imp);
    } else {
      // remove inline overrides so .is-dark stylesheet rule takes over
      r.style.removeProperty("--paper");
      r.style.removeProperty("--paper-2");
      r.style.removeProperty("--ink");
      r.style.removeProperty("--card");
    }

    const pair = TYPE_PAIRS[t.typePair] || TYPE_PAIRS["serif-sans"];
    r.style.setProperty("--f-display", pair.display, imp);
    r.style.setProperty("--f-body",    pair.body,    imp);

    document.body.classList.toggle("is-dark",    !!t.dark);
    document.body.classList.toggle("is-compact", t.density === "compact");
    document.body.classList.toggle("is-comfy",   t.density === "comfy");
    document.body.classList.toggle("is-regular", t.density === "regular" || !t.density);
  }, [t]);

  function handleAuth(user) {
    dispatch({ type: "set-user", patch: user });
    setLoggedIn(true);
  }

  if (!loggedIn) return (
    <>
      <AuthScreen onAuth={handleAuth} />
      {/* Mount TweaksPanel unconditionally so __edit_mode_available fires at page-load time,
          not after the auth gate — host toolbar only waits for the first postMessage. */}
      <TweaksPanel></TweaksPanel>
    </>
  );

  const content = (() => {
    switch (tab) {
      case "dashboard": return <ScreenDashboard state={state} setTab={setTab} dispatch={dispatch} />;
      case "documents": return <ScreenDocuments state={state} dispatch={dispatch} setTab={setTab} />;
      case "ai-chat": return <ScreenAIChat state={state} dispatch={dispatch} />;
      case "youtube": return <ScreenYouTube />;
      case "quiz-generator": return <ScreenQuiz state={state} dispatch={dispatch} setTab={setTab} />;
      case "flashcards": return <ScreenFlashcards state={state} dispatch={dispatch} />;
      case "mind-map": return <ScreenMindMap state={state} />;
      case "ai-diagram-maker": return <ScreenDiagramMaker state={state} />;
      case "concept-visualizer": return <ScreenConceptVisualizer />;
      case "audio-recap": return <ScreenAudioRecap state={state} />;
      case "quick-revise": return <ScreenQuickRevise state={state} />;
      case "pdf-qa": return <ScreenPdfQA state={state} dispatch={dispatch} />;
      case "visual-ai": return <ScreenVisualAI />;
      case "voice-chat": return <ScreenVoiceChat />;
      case "study-notes": return <ScreenNotes state={state} dispatch={dispatch} />;
      case "study-groups": return <ScreenGroups state={state} dispatch={dispatch} />;
      case "pomodoro": return <ScreenPomodoro pomodoro={pomodoro} setPomodoro={setPomodoro} />;
      case "history": return <ScreenHistory state={state} setTab={setTab} />;
      case "settings": return <ScreenSettings state={state} dispatch={dispatch} />;
      default: return null;
    }
  })();

  const flushTabs = ["ai-chat", "pdf-qa"];
  const isFlush = flushTabs.includes(tab);

  return (
    <div className={`app ${t.sidebar === "rail" ? "is-rail" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}>
      <Sidebar tab={tab} setTab={(x) => { setTab(x); setMobileOpen(false); }} onLogout={() => setLoggedIn(false)} user={state.user} />
      <div className="main">
        <TopBar
          tab={tab}
          dark={t.dark}
          onToggleDark={() => setTweak("dark", !t.dark)}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenMenu={() => setMobileOpen(true)}
          pomodoro={pomodoro}
          setPomodoro={setPomodoro}
          setTab={setTab}
          user={state.user}
          onLogout={() => setLoggedIn(false)}
        />
        <div className={`content ${isFlush ? "is-flush" : ""}`} key={tab}>
          {content}
        </div>
      </div>

      <FoxCompanion tab={tab} accent={(t.accentPalette || PALETTES[0])[0]} hidden={!t.fox} foxIndex={foxClicks} />

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} setTab={setTab} documents={state.documents} />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={(v) => setTweak("dark", v)} />
        <TweakColor label="Palette" value={t.accentPalette} options={PALETTES} onChange={(v) => setTweak("accentPalette", v)} />

        <TweakSection label="Typography" />
        <TweakRadio label="Pairing" value={t.typePair} options={Object.keys(TYPE_PAIRS)} onChange={(v) => setTweak("typePair", v)} />

        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakRadio label="Sidebar" value={t.sidebar} options={["rail", "expanded"]} onChange={(v) => setTweak("sidebar", v)} />

        <TweakSection label="Companion" />
        <TweakToggle label="Fox mascot" value={t.fox} onChange={(v) => setTweak("fox", v)} />
      </TweaksPanel>
    </div>
  );
}

// helper: oklch shift wrapper that works with hex
function oklchShift(hex, lightDelta, soften) {
  // convert hex to a CSS color-mix expression for cheap adjustments
  if (soften) {
    return `color-mix(in oklch, ${hex} ${Math.round((1-lightDelta)*100)}%, var(--paper))`;
  }
  // darker variant
  return `color-mix(in oklch, ${hex} 80%, ${lightDelta < 0 ? "black" : "white"} 20%)`;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
