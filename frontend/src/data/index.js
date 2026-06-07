// Mock data + reducer (mirrors backend shape for offline dev)

const today = new Date();
const day = (off) => {
  const d = new Date(today);
  d.setDate(today.getDate() - off);
  return d.toISOString().slice(0, 10);
};

export const initialState = {
  user: { name: 'Sam Reyes', email: 'sam@school.edu' },
  documents: [
    { id: 1, name: 'Quantum Physics Intro.pdf', size: '2.1 MB', type: 'pdf', uploadDate: day(7), tags: ['Physics', 'Lecture'], content: 'Quantum physics is the study of matter and energy at the most fundamental level. Quantization means a physical quantity can only have certain discrete values. Wave-particle duality says every particle may be described as either a particle or a wave. The uncertainty principle states there is a fundamental limit to the precision with which certain pairs of physical properties, such as position and momentum, can be known.' },
    { id: 2, name: 'Calculus Cheatsheet.docx', size: '0.5 MB', type: 'docx', uploadDate: day(9), tags: ['Math', 'Formulas'], content: 'Key calculus formulas. The chain rule computes the derivative of a composite function. The product rule finds the derivatives of products of functions. The fundamental theorem of calculus relates differentiation and integration.' },
    { id: 3, name: 'Renaissance Art.pdf', size: '4.2 MB', type: 'pdf', uploadDate: day(14), tags: ['History', 'Art'], content: 'The Renaissance was a period of intense artistic and intellectual activity in Europe, characterized by a renewed interest in classical antiquity and a focus on humanism.' },
    { id: 4, name: 'Macroeconomics Ch.3.pdf', size: '1.8 MB', type: 'pdf', uploadDate: day(2), tags: ['Economics'], content: 'Macroeconomics studies aggregate indicators such as GDP, unemployment rates, and price indices.' },
  ],
  // Honesty contract: the Quiz and Flashcards screens load real data on mount and
  // surface an error + Retry on failure — they never fall back to seeded samples,
  // so these collections start empty.
  quizzes: [],
  flashcardSets: [],
  mindMaps: [
    { id: 1, title: 'Quantum Physics Concepts', date: day(3), sourceDocumentId: 1, root: {
      id: 'root', text: 'Quantum Physics',
      children: [
        { id: '1', text: 'Foundations', children: [
          { id: '1.1', text: 'Quantization', children: [] },
          { id: '1.2', text: 'Duality', children: [] },
          { id: '1.3', text: 'Uncertainty', children: [] },
        ]},
        { id: '2', text: 'Phenomena', children: [
          { id: '2.1', text: 'Photoelectric', children: [] },
          { id: '2.2', text: 'Blackbody', children: [] },
        ]},
        { id: '3', text: 'Math', children: [
          { id: '3.1', text: 'Schrödinger eq.', children: [] },
          { id: '3.2', text: 'Operators', children: [] },
        ]},
        { id: '4', text: 'Interpretation', children: [
          { id: '4.1', text: 'Copenhagen', children: [] },
          { id: '4.2', text: 'Many-worlds', children: [] },
        ]},
      ],
    }},
  ],
  // Honesty contract: the Audio Recap screen loads real recaps on mount and surfaces
  // an error + Retry on failure — it never falls back to seeded recaps (whose Play
  // does nothing), so this collection starts empty.
  audioRecaps: [],
  notes: [
    { id: 1, title: 'Biology Lecture 3', content: 'Mitochondria is the powerhouse of the cell. It generates most of the cell\'s supply of adenosine triphosphate (ATP), used as a source of chemical energy.\n\nKey terms:\n- ATP — currency of cellular energy\n- Cellular respiration — process that yields ATP from glucose\n- Krebs cycle — central reaction sequence inside the mitochondrial matrix', date: day(3), subject: 'Biology' },
    { id: 2, title: 'Project Ideas', content: 'Some things to build:\n1. AI-powered study assistant that generates quizzes and flashcards from any document.\n2. Collaborative whiteboard for study groups.\n3. Spaced-repetition system tuned to test dates.\n4. Audio recaps in different voices.', date: day(4), subject: 'CS Project' },
    { id: 3, title: 'Reading list', content: 'On the shelf:\n- Thinking, Fast and Slow — Kahneman\n- Sapiens — Harari\n- A People\'s History of the United States — Zinn', date: day(8), subject: 'Personal' },
  ],
  // Honesty contract: no fabricated activity. The Dashboard loads real history from
  // the API and the sidebar streak only shows when real data is available.
  activityLog: [],
  streak: 0,
  settings: {
    language: 'English',
    notifications: true,
    autoSave: true,
    studyReminders: false,
    aiProvider: 'gemini',
    ollamaEndpoint: 'http://localhost:11434',
  },
  loading: {},
};

export function reducer(state, action) {
  switch (action.type) {
    case 'add-doc': return { ...state, documents: [action.doc, ...state.documents] };
    case 'add-quiz': return { ...state, quizzes: [action.quiz, ...state.quizzes], activityLog: [...state.activityLog, action.quiz.date] };
    case 'add-flashcard-set': return { ...state, flashcardSets: [action.set, ...state.flashcardSets] };
    case 'add-note': return { ...state, notes: [action.note, ...state.notes] };
    case 'update-note': return { ...state, notes: state.notes.map(n => n.id === action.id ? { ...n, title: action.title, content: action.content } : n) };
    case 'delete-note': return { ...state, notes: state.notes.filter(n => n.id !== action.id) };
    case 'set-settings': return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'set-user': return { ...state, user: { ...state.user, ...action.patch } };

    // ── Bulk-replace actions (from API responses) ─────────────
    case 'set-documents': return { ...state, documents: action.documents };
    case 'set-quizzes': return { ...state, quizzes: action.quizzes };
    case 'set-flashcard-sets': return { ...state, flashcardSets: action.flashcardSets };
    case 'set-mind-maps': return { ...state, mindMaps: action.mindMaps };
    case 'set-audio-recaps': return { ...state, audioRecaps: action.audioRecaps };
    case 'set-notes': return { ...state, notes: action.notes };
    case 'set-settings-full': return { ...state, settings: action.settings };
    case 'set-history': return { ...state, activityLog: action.history };

    // ── Loading flag ──────────────────────────────────────────
    case 'set-loading': return { ...state, loading: { ...(state.loading || {}), [action.key]: action.loading } };

    // ── Reset all user content (keeps account + settings) ─────
    case 'reset-data': return {
      ...state,
      documents: [], quizzes: [], flashcardSets: [], mindMaps: [],
      audioRecaps: [], notes: [],
      activityLog: [], streak: 0,
    };

    default: return state;
  }
}
