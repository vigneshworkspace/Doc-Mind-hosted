import { useState } from 'react';
import { Icon } from '../components/Shell';

function ScreenQuickRevise({ state }) {
  const [active, setActive] = useState(state.quickReviseSessions[0]);
  const [expanded, setExpanded] = useState({});

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

export default ScreenQuickRevise;
