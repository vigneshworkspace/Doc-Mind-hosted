import { useState, useEffect } from 'react';
import { Icon } from '../components/Shell';

function Waveform({ playing, progress = 0 }) {
  const bars = useState(() => Array.from({length: 64}, (_, i) => {
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

function ScreenAudioRecap({ state }) {
  const [active, setActive] = useState(state.audioRecaps[0]);
  const [playing, setPlaying] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [position, setPosition] = useState(0);

  useEffect(() => {
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

export { Waveform };
export default ScreenAudioRecap;
