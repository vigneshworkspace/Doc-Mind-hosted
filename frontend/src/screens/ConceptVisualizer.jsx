import { useState } from 'react';
import { Icon } from '../components/Shell';
import MermaidView from '../components/MermaidView.jsx';
import { concepts as conceptsApi } from '../api/index.js';

const PRESETS = ["Photosynthesis", "Black hole", "DNA replication", "Newton's prism", "Krebs cycle"];

function ScreenConceptVisualizer() {
  const [concept, setConcept] = useState("Photosynthesis");
  const [active, setActive] = useState("");
  const [mermaid, setMermaid] = useState('');
  const [explanation, setExplanation] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function visualize(c) {
    const value = (c ?? concept).trim();
    if (!value) return;
    setActive(value);
    setGenerating(true);
    setError('');
    try {
      const r = await conceptsApi.visualize(value);
      setMermaid(r.mermaid || '');
      setExplanation(r.explanation || '');
    } catch (err) {
      setError(err.message || 'Could not visualize this concept.');
      setMermaid('');
      setExplanation('');
    } finally {
      setGenerating(false);
    }
  }

  function usePreset(c) {
    setConcept(c);
    visualize(c);
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Visualize <em className="t-italic">any</em> concept.</h1>
        <p>Drop a topic and I'll draw a clean schematic with labels and a brief explanation.</p>
      </div>

      <div className="card-tight" style={{display: "flex", gap: 8, alignItems: "center", maxWidth: 600, margin: "0 auto", width: "100%", padding: 8, background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 14}}>
        <input className="input" aria-label="Concept to visualize" style={{border: 0, background: "transparent"}} value={concept} onChange={e => setConcept(e.target.value)} placeholder="A concept, equation, or process…" onKeyDown={e => e.key === "Enter" && visualize()} />
        <button className="btn is-accent" disabled={generating} onClick={() => visualize()}><Icon name="sparkles" size={14} className="" /> Visualize</button>
      </div>

      <div className="row" style={{gap: 6, flexWrap: "wrap", justifyContent: "center"}}>
        {PRESETS.map(c => (
          <button key={c} className={`chip lift ${active === c ? "is-accent" : ""}`} style={{cursor: "pointer", padding: "8px 14px", height: "auto"}} onClick={() => usePreset(c)}>{c}</button>
        ))}
      </div>

      {error && (
        <div style={{color: "var(--err, #dc2626)", fontSize: 13, textAlign: "center"}}>{error}</div>
      )}

      {(active || generating) && (
        <div className="card card-flush">
          <div style={{padding: "16px 22px", borderBottom: "1px solid var(--hairline)"}}>
            <div className="t-eyebrow">Schematic</div>
            <div className="t-display" style={{fontSize: 28, marginTop: 4}}>{active}</div>
          </div>
          <div style={{padding: 40, background: "var(--paper-2)", minHeight: 380, position: "relative", display: "grid", placeItems: "center"}}>
            {generating ? (
              <div style={{display: "grid", placeItems: "center", height: 320, color: "var(--ink-3)"}}>
                <div className="t-eyebrow">Drawing…</div>
              </div>
            ) : mermaid ? (
              <MermaidView code={mermaid} />
            ) : (
              <div className="muted" style={{fontSize: 13}}>No diagram returned.</div>
            )}
          </div>
          {!generating && explanation && (
            <div style={{padding: "20px 22px", borderTop: "1px solid var(--hairline)"}}>
              <div className="t-eyebrow" style={{marginBottom: 8}}>Explanation</div>
              <p style={{fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620}}>{explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScreenConceptVisualizer;
