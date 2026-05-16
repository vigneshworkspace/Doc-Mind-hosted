import { Icon } from '../components/Shell.jsx';

export default function Pomodoro({ pomodoro, setPomodoro }) {
  const minutes = Math.floor(pomodoro.seconds / 60);
  const seconds = pomodoro.seconds % 60;
  const total = pomodoro.mode === 'focus' ? pomodoro.focusMin * 60 : pomodoro.breakMin * 60;
  const progress = 1 - pomodoro.seconds / total;

  function toggle() { setPomodoro(p => ({ ...p, running: !p.running })); }
  function reset() { setPomodoro(p => ({ ...p, running: false, seconds: (p.mode === 'focus' ? p.focusMin : p.breakMin) * 60 })); }
  function switchMode(m) { setPomodoro(p => ({ ...p, mode: m, seconds: (m === 'focus' ? p.focusMin : p.breakMin) * 60, running: false })); }

  const C = 2 * Math.PI * 130;

  return (
    <div className="col" style={{ gap: 24, maxWidth: 720, margin: '0 auto', width: '100%', textAlign: 'center' }}>
      <div className="page-hero" style={{ textAlign: 'left', marginBottom: 0 }}>
        <h1>Time, <em className="t-italic">on your side.</em></h1>
        <p>Twenty-five focused minutes, five to breathe. Repeat.</p>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        {[['focus', 'Focus'], ['break', 'Break']].map(([v, l]) => (
          <button key={v} className={`btn is-sm ${pomodoro.mode === v ? '' : 'is-ghost'}`} onClick={() => switchMode(v)}>{l}</button>
        ))}
      </div>

      <div style={{ position: 'relative', width: 320, height: 320, margin: '0 auto' }}>
        <svg width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="130" fill="none" stroke="var(--hairline)" strokeWidth="1.5" />
          <circle
            cx="160" cy="160" r="130"
            fill="none"
            stroke={pomodoro.mode === 'focus' ? 'var(--accent)' : 'var(--info)'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 160 160)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          {[...Array(60)].map((_, i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const x1 = 160 + Math.cos(a) * 148, y1 = 160 + Math.sin(a) * 148;
            const x2 = 160 + Math.cos(a) * (i % 5 === 0 ? 140 : 144), y2 = 160 + Math.sin(a) * (i % 5 === 0 ? 140 : 144);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-4)" strokeWidth={i % 5 === 0 ? 1.2 : 0.6} />;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="t-eyebrow">{pomodoro.mode === 'focus' ? 'Focusing' : 'Breathe'}</div>
          <div className="t-mono" style={{ fontSize: 72, fontWeight: 300, letterSpacing: '-0.04em', lineHeight: 1, marginTop: 6 }}>
            {String(minutes).padStart(2, '0')}<span style={{ opacity: 0.4 }}>:</span>{String(seconds).padStart(2, '0')}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Cycle {pomodoro.cycle}</div>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
        <button className="btn is-ghost is-icon" onClick={reset}><Icon name="chevL" size={16} className="" /></button>
        <button className="btn is-accent" style={{ width: 72, height: 72, borderRadius: 36 }} onClick={toggle}>
          <Icon name={pomodoro.running ? 'pause' : 'play'} size={26} className="" />
        </button>
        <button className="btn is-ghost is-icon"><Icon name="settings" size={16} className="" /></button>
      </div>

      <div className="grid grid-3" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="card card-tight">
          <div className="t-eyebrow">Focus</div>
          <div className="t-mono" style={{ fontSize: 22, marginTop: 4 }}>{pomodoro.focusMin} min</div>
        </div>
        <div className="card card-tight">
          <div className="t-eyebrow">Break</div>
          <div className="t-mono" style={{ fontSize: 22, marginTop: 4 }}>{pomodoro.breakMin} min</div>
        </div>
        <div className="card card-tight">
          <div className="t-eyebrow">Today</div>
          <div className="t-mono" style={{ fontSize: 22, marginTop: 4 }}>{pomodoro.todayCycles}×</div>
        </div>
      </div>
    </div>
  );
}
