import { Icon } from '../components/Shell.jsx';

export default function History({ state, setTab }) {
  const events = [
    ...state.quizzes.map(q => ({ kind: 'quiz-generator', id: q.id, title: q.title, date: q.date, meta: q.completed ? `${q.score}%` : 'in progress', icon: 'quiz-generator' })),
    ...state.flashcardSets.map(f => ({ kind: 'flashcards', id: f.id, title: f.title, date: f.date, meta: `${f.cards.length} cards`, icon: 'flashcards' })),
    ...state.mindMaps.map(m => ({ kind: 'mind-map', id: m.id, title: m.title, date: m.date, meta: 'mind map', icon: 'mind-map' })),
    ...state.audioRecaps.map(r => ({ kind: 'audio-recap', id: r.id, title: r.title, date: r.date, meta: 'audio recap', icon: 'audio-recap' })),
    ...state.quickReviseSessions.map(s => ({ kind: 'quick-revise', id: s.id, title: s.title, date: s.date, meta: 'quick revise', icon: 'quick-revise' })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const groups = events.reduce((g, e) => { (g[e.date] ||= []).push(e); return g; }, {});

  return (
    <div className="col" style={{ gap: 24, maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <div className="page-hero" style={{ marginBottom: 0, paddingBottom: 18 }}>
        <h1>Everything you've <em className="t-italic">made.</em></h1>
        <p>Quizzes, cards, mind maps, recaps — all of it, ordered by day.</p>
      </div>
      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <div className="row" style={{ alignItems: 'baseline', gap: 14, marginBottom: 12 }}>
            <div className="t-display" style={{ fontSize: 28 }}>
              {new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="t-mono" style={{ color: 'var(--ink-4)', fontSize: 12 }}>{date}</div>
          </div>
          <div className="card card-flush">
            {items.map((e, i) => (
              <button
                key={`${e.kind}-${e.id}`}
                onClick={() => setTab(e.kind)}
                className="lift"
                style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', gap: 14, alignItems: 'center', padding: '14px 18px', width: '100%', textAlign: 'left', background: 'transparent', border: 0, borderBottom: i === items.length - 1 ? 0 : '1px solid var(--hairline)', cursor: 'default' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--paper-2)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={e.icon} size={16} className="" />
                </div>
                <div>
                  <div style={{ fontWeight: 500 }}>{e.title}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{e.kind.replace('-', ' ')}</div>
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
