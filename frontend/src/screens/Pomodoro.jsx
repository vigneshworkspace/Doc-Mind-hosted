function ScreenPomodoro({ pomodoro, setPomodoro }) {
  const total = (pomodoro.mode === "focus" ? pomodoro.focusMin : pomodoro.breakMin) * 60;
  const progress = 1 - pomodoro.seconds / total;
  const mm = String(Math.floor(pomodoro.seconds / 60)).padStart(2, "0");
  const ss = String(pomodoro.seconds % 60).padStart(2, "0");
  const isFocus = pomodoro.mode === "focus";
  const C = 2 * Math.PI * 80;

  function toggle() { setPomodoro(p => ({ ...p, running: !p.running })); }
  function reset() { setPomodoro(p => ({ ...p, running: false, seconds: (p.mode === "focus" ? p.focusMin : p.breakMin) * 60 })); }

  return (
    <div className="content-inner" style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 60 }}>
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>Focus</div>
      <h1 className="t-display" style={{ fontSize: 36, marginBottom: 40 }}>Pomodoro</h1>
      <svg width="200" height="200" viewBox="0 0 200 200" style={{ marginBottom: 32 }}>
        <circle cx="100" cy="100" r="80" fill="none" stroke="var(--hairline)" strokeWidth="8" />
        <circle cx="100" cy="100" r="80" fill="none"
                stroke={isFocus ? "var(--accent)" : "var(--info)"}
                strokeWidth="8" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
                transform="rotate(-90 100 100)"
                style={{ transition: "stroke-dashoffset 1s linear" }} />
        <text x="100" y="108" textAnchor="middle"
              style={{ font: "bold 40px var(--f-mono, monospace)", fill: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
          {mm}:{ss}
        </text>
      </svg>
      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn is-accent" onClick={toggle}>
          {pomodoro.running ? "Pause" : "Start"}
        </button>
        <button className="btn is-ghost" onClick={reset}>Reset</button>
      </div>
      <p style={{ marginTop: 24, color: "var(--ink-3)", fontSize: 14 }}>
        {isFocus ? `Focus session ${pomodoro.cycle}` : "Break time"} · {pomodoro.todayCycles} cycles today
      </p>
    </div>
  );
}

export default ScreenPomodoro;
