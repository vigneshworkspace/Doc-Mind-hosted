import { useState } from 'react';
import { Icon } from '../components/Shell';
import MermaidView from '../components/MermaidView.jsx';
import { diagrams } from '../api/index.js';

const STYLES = [
  { label: "Flow", value: "flowchart" },
  { label: "Sequence", value: "sequenceDiagram" },
  { label: "Tree", value: "flowchart" },
];

const TEMPLATES = ["Photosynthesis", "Compiler pipeline", "Mitosis", "OSI model"];

function ScreenDiagramMaker() {
  const [prompt, setPrompt] = useState("How HTTPS handshake works");
  const [styleLabel, setStyleLabel] = useState("Flow");
  const [mermaid, setMermaid] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  async function generate(promptOverride, styleOverride) {
    const p = (promptOverride ?? prompt).trim();
    if (!p) return;
    const styleVal = STYLES.find(s => s.label === (styleOverride ?? styleLabel))?.value || 'flowchart';
    setGenerating(true);
    setError('');
    try {
      const r = await diagrams.generate(p, styleVal);
      setMermaid(r.mermaid || '');
    } catch (err) {
      setError(err.message || 'Could not generate diagram.');
    } finally {
      setGenerating(false);
    }
  }

  function useTemplate(t) {
    setPrompt(t);
    generate(t);
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Diagram <em className="t-italic">maker.</em></h1>
        <p>Describe a process, system, or relationship. I'll lay out boxes and arrows that read left-to-right or top-to-bottom.</p>
      </div>

      <div className="grid" style={{gridTemplateColumns: "1fr 2fr", gap: 18}}>
        <div className="card">
          <div className="t-eyebrow" style={{marginBottom: 14}}>Prompt</div>
          <textarea className="input" value={prompt} onChange={e => setPrompt(e.target.value)} style={{minHeight: 120}} />
          <div className="col" style={{marginTop: 14, gap: 10}}>
            <label className="field-label">Style</label>
            <div className="row" style={{gap: 6}}>
              {STYLES.map(s => (
                <button
                  key={s.label}
                  className={`btn is-sm ${styleLabel === s.label ? "" : "is-ghost"}`}
                  onClick={() => setStyleLabel(s.label)}
                >{s.label}</button>
              ))}
            </div>
            <button className="btn is-accent" disabled={generating} onClick={() => generate()} style={{marginTop: 8}}>
              {generating ? "Drawing…" : <><Icon name="sparkles" size={14} className="" /> Generate</>}
            </button>
            {error && <div style={{color: "var(--err, #dc2626)", fontSize: 13}}>{error}</div>}
          </div>
          <div className="t-eyebrow" style={{marginTop: 22, marginBottom: 10}}>Templates</div>
          <div className="col" style={{gap: 6}}>
            {TEMPLATES.map(t => (
              <button key={t} onClick={() => useTemplate(t)} className="row" style={{justifyContent: "space-between", padding: "8px 12px", background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 8, cursor: "pointer", color: "var(--ink-2)", fontSize: 13}}>
                {t} <Icon name="chevR" size={12} className="" />
              </button>
            ))}
          </div>
        </div>

        <div className="card card-flush" style={{minHeight: 460}}>
          <div className="row" style={{padding: "14px 18px", borderBottom: "1px solid var(--hairline)", justifyContent: "space-between"}}>
            <div>
              <div className="t-eyebrow">Result</div>
              <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 2}}>{prompt || "Diagram"}</div>
            </div>
          </div>
          <div style={{padding: 30, background: "var(--paper-2)", backgroundImage: "radial-gradient(circle, var(--hairline-2) 1px, transparent 1px)", backgroundSize: "20px 20px", minHeight: 380, display: "grid", placeItems: "center"}}>
            {generating ? (
              <div className="t-eyebrow" style={{color: "var(--ink-3)"}}>Drawing…</div>
            ) : mermaid ? (
              <MermaidView code={mermaid} />
            ) : (
              <div className="muted" style={{fontSize: 13}}>Describe something and hit Generate.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenDiagramMaker;
