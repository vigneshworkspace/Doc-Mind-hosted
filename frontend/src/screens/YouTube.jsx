import { useState } from 'react';
import { Icon } from '../components/Shell.jsx';

const EXAMPLES = [
  { id: 1, title: 'MIT OCW · Single Variable Calculus', duration: '47:21', channel: 'MIT OpenCourseWare' },
  { id: 2, title: 'The actual history of the Roman Empire', duration: '1:24:08', channel: 'Crash Course' },
  { id: 3, title: 'Photosynthesis explained simply', duration: '12:04', channel: 'Crash Course Kids' },
];

const CHAPTERS = [
  ['00:00', 'Introduction'],
  ['03:14', 'Limits — the intuition'],
  ['12:08', 'ε-δ definition'],
  ['22:30', 'Derivatives geometrically'],
  ['34:55', 'The difference quotient'],
  ['41:20', 'Worked examples'],
];

export default function YouTube() {
  const [url, setUrl] = useState('');
  const [active, setActive] = useState(null);

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="page-hero">
        <h1>Learn from <em className="t-italic">video.</em></h1>
        <p>Paste a YouTube URL and I'll summarize it, generate chapter markers, and let you ask questions while you watch.</p>
      </div>

      <div className="card-tight" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 14 }}>
        <Icon name="youtube" size={18} className="" />
        <input className="input" style={{ border: 0, background: 'transparent' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="youtube.com/watch?v=..." />
        <button className="btn is-accent" onClick={() => setActive(EXAMPLES[0])}>Analyze</button>
      </div>

      {!active && (
        <div className="grid grid-3">
          {EXAMPLES.map(v => (
            <button
              key={v.id}
              className="card lift"
              style={{ padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'default', border: '1px solid var(--hairline)' }}
              onClick={() => setActive(v)}
            >
              <div style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, var(--paper-2), var(--hairline-2))', display: 'grid', placeItems: 'center', position: 'relative' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ink)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }}>
                  <Icon name="play" size={18} className="" />
                </div>
                <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '3px 8px', background: 'rgba(0,0,0,.65)', color: 'white', fontSize: 11, borderRadius: 4, fontFamily: 'var(--f-mono)' }}>{v.duration}</div>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 500 }}>{v.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{v.channel}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
          <div className="col" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ aspectRatio: '16/9', background: 'var(--ink)', display: 'grid', placeItems: 'center', position: 'relative', color: 'var(--paper)' }}>
                <Icon name="play" size={48} className="" />
                <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12 }}>
                  <div className="t-display" style={{ fontSize: 24, color: 'white' }}>{active.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{active.channel} · {active.duration}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>Summary</div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>
                This lecture introduces the fundamentals of single-variable calculus, beginning with limits as a way to formalize the intuition of "approaching" a value. It progresses to derivatives, framed first geometrically as slopes of tangent lines, then algebraically through the difference quotient. Several worked examples illustrate when the derivative exists and what it tells you about a function's behavior.
              </p>
            </div>
          </div>
          <div className="card card-flush">
            <div className="row" style={{ padding: '14px 16px', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
              <div className="t-eyebrow">Chapters</div>
              <button className="btn is-quiet is-sm" onClick={() => setActive(null)}>← Back</button>
            </div>
            {CHAPTERS.map(([t, l], i) => (
              <div key={i} className="row" style={{ padding: '10px 16px', gap: 12, borderBottom: i === CHAPTERS.length - 1 ? 0 : '1px solid var(--hairline)', cursor: 'default' }}>
                <span className="t-mono" style={{ color: 'var(--ink-3)', fontSize: 12, minWidth: 50 }}>{t}</span>
                <span style={{ fontSize: 13.5 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
