import { useState } from 'react';
import { Icon } from '../components/Shell';

const CONCEPT_TEXTS = {
  "Photosynthesis": "Plants capture light energy in chlorophyll, then use it to combine CO₂ and water into glucose, releasing oxygen as a byproduct.",
  "Black hole": "A region of spacetime where gravity is so intense that nothing — not even light — can escape past the event horizon.",
  "DNA replication": "The double helix unwinds; each strand serves as a template; new complementary nucleotides are added base by base.",
  "Newton's prism": "White light entering a prism refracts; different wavelengths bend by different amounts, separating into the visible spectrum.",
  "Krebs cycle": "A circular series of reactions inside mitochondria that converts acetyl-CoA into CO₂ and high-energy electron carriers.",
};

function Label({ x, y, text, inside }) {
  return <text x={x} y={y} textAnchor="middle" fontSize="12" fill={inside ? "var(--paper)" : "var(--ink)"} fontFamily="var(--f-body)" fontWeight="500">{text}</text>;
}

function Line({ x1, y1, x2, y2, arrow }) {
  return <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-3)" strokeWidth="1.2" markerEnd={arrow ? "url(#arrow)" : undefined} />
    {arrow && <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="var(--ink-3)" /></marker></defs>}
  </>;
}

function ConceptSVG({ concept }) {
  if (concept === "Black hole") {
    return (
      <svg viewBox="0 0 600 280" style={{width: "100%", maxHeight: 320}}>
        <defs>
          <radialGradient id="bh" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="black" />
            <stop offset="60%" stopColor="black" />
            <stop offset="75%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <ellipse cx="300" cy="140" rx="200" ry="20" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        <ellipse cx="300" cy="140" rx="200" ry="20" fill="none" stroke="var(--accent)" strokeWidth="1" opacity="0.4" transform="rotate(-8 300 140)" />
        <circle cx="300" cy="140" r="70" fill="url(#bh)" />
        <circle cx="300" cy="140" r="50" fill="black" />
        <Label x={300} y={50} text="Accretion disk" />
        <Line x1={300} y1={62} x2={300} y2={118} />
        <Label x={520} y={140} text="Event horizon" />
        <Line x1={500} y1={140} x2={355} y2={140} />
        <Label x={300} y={240} text="Singularity" />
        <Line x1={300} y1={228} x2={300} y2={160} />
      </svg>
    );
  }
  if (concept === "DNA replication") {
    return (
      <svg viewBox="0 0 600 280" style={{width: "100%", maxHeight: 320}}>
        {[...Array(14)].map((_, i) => {
          const x = 80 + i * 32;
          const y1 = 80 + Math.sin(i * 0.5) * 22;
          const y2 = 200 - Math.sin(i * 0.5) * 22;
          return <g key={i}>
            <circle cx={x} cy={y1} r="6" fill="var(--accent)" />
            <circle cx={x} cy={y2} r="6" fill="var(--ink)" />
            <line x1={x} y1={y1} x2={x} y2={y2} stroke="var(--ink-3)" strokeWidth="1.2" />
          </g>;
        })}
        <Label x={300} y={36} text="Template strand" />
        <Label x={300} y={250} text="New complementary strand" />
        <Line x1={300} y1={42} x2={300} y2={70} />
      </svg>
    );
  }
  if (concept === "Newton's prism") {
    const colors = ["#ef4444","#f97316","#facc15","#22c55e","#3b82f6","#6366f1","#a855f7"];
    return (
      <svg viewBox="0 0 600 280" style={{width: "100%", maxHeight: 320}}>
        <line x1="20" y1="140" x2="240" y2="140" stroke="var(--ink)" strokeWidth="2" />
        <polygon points="240,90 320,190 380,90" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.5" />
        {colors.map((c, i) => <line key={i} x1="350" y1="135" x2="580" y2={100 + i * 12} stroke={c} strokeWidth="2.5" />)}
        <Label x={130} y={120} text="White light" />
        <Label x={310} y={70} text="Prism" />
        <Label x={520} y={88} text="Spectrum" />
      </svg>
    );
  }
  if (concept === "Krebs cycle") {
    const steps = ["Acetyl-CoA", "Citrate", "Isocitrate", "α-KG", "Succinyl-CoA", "Succinate", "Fumarate", "Malate"];
    return (
      <svg viewBox="0 0 600 320" style={{width: "100%", maxHeight: 320}}>
        {steps.map((s, i) => {
          const a = (i / steps.length) * Math.PI * 2 - Math.PI / 2;
          const x = 300 + Math.cos(a) * 120;
          const y = 160 + Math.sin(a) * 120;
          return <g key={i}>
            <rect x={x-46} y={y-14} width="92" height="28" rx="14" fill="var(--card)" stroke="var(--hairline)" />
            <text x={x} y={y+4} textAnchor="middle" fontSize="11" fill="var(--ink)" fontWeight="500">{s}</text>
          </g>;
        })}
        <circle cx="300" cy="160" r="160" fill="none" stroke="var(--accent)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="300" y="166" textAnchor="middle" fontSize="14" fill="var(--accent-ink)" fontFamily="var(--f-display)" fontStyle="italic">Krebs cycle</text>
      </svg>
    );
  }
  // Photosynthesis default
  return (
    <svg viewBox="0 0 600 280" style={{width: "100%", maxHeight: 320}}>
      <circle cx="100" cy="60" r="22" fill="var(--accent)" />
      <Label x={100} y={28} text="Sun" />
      {[...Array(6)].map((_, i) => <line key={i} x1="100" y1="60" x2={130 + Math.cos(i*0.6)*40} y2={90 + Math.sin(i*0.6)*40} stroke="var(--accent)" strokeWidth="1.2" />)}
      <ellipse cx="320" cy="170" rx="110" ry="55" fill="color-mix(in oklch, #2E5B3D, white 70%)" stroke="var(--ink-3)" strokeWidth="1.2" />
      <Label x={320} y={170} text="Chloroplast" inside />
      <Label x={130} y={170} text="CO₂ + H₂O" />
      <Line x1={170} y1={170} x2={220} y2={170} arrow />
      <Label x={530} y={140} text="O₂" />
      <Label x={530} y={200} text="Glucose" />
      <Line x1={425} y1={155} x2={500} y2={140} arrow />
      <Line x1={425} y1={185} x2={500} y2={200} arrow />
    </svg>
  );
}

function ScreenConceptVisualizer() {
  const [concept, setConcept] = useState("Photosynthesis");
  const [active, setActive] = useState("Photosynthesis");
  const [generating, setGenerating] = useState(false);
  const concepts = ["Photosynthesis", "Black hole", "DNA replication", "Newton's prism", "Krebs cycle"];

  function generate(c) {
    setActive(c);
    setGenerating(true);
    setTimeout(() => setGenerating(false), 700);
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Visualize <em className="t-italic">any</em> concept.</h1>
        <p>Drop a topic and I'll draw a clean schematic with labels and a brief explanation.</p>
      </div>

      <div className="card-tight" style={{display: "flex", gap: 8, alignItems: "center", maxWidth: 600, margin: "0 auto", width: "100%", padding: 8, background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 14}}>
        <input className="input" style={{border: 0, background: "transparent"}} value={concept} onChange={e => setConcept(e.target.value)} placeholder="A concept, equation, or process…" onKeyDown={e => e.key === "Enter" && generate(concept)} />
        <button className="btn is-accent" onClick={() => generate(concept)}><Icon name="sparkles" size={14} className="" /> Visualize</button>
      </div>

      <div className="row" style={{gap: 6, flexWrap: "wrap", justifyContent: "center"}}>
        {concepts.map(c => (
          <button key={c} className={`chip lift ${active === c ? "is-accent" : ""}`} style={{cursor: "default", padding: "8px 14px", height: "auto"}} onClick={() => { setConcept(c); generate(c); }}>{c}</button>
        ))}
      </div>

      <div className="card card-flush">
        <div style={{padding: "16px 22px", borderBottom: "1px solid var(--hairline)"}}>
          <div className="t-eyebrow">Schematic</div>
          <div className="t-display" style={{fontSize: 28, marginTop: 4}}>{active}</div>
        </div>
        <div style={{padding: 40, background: "var(--paper-2)", minHeight: 380, position: "relative"}}>
          {generating ? (
            <div style={{display: "grid", placeItems: "center", height: 320, color: "var(--ink-3)"}}>
              <div className="t-eyebrow">Drawing…</div>
            </div>
          ) : (
            <ConceptSVG concept={active} />
          )}
        </div>
        <div style={{padding: "20px 22px", borderTop: "1px solid var(--hairline)"}}>
          <div className="t-eyebrow" style={{marginBottom: 8}}>Explanation</div>
          <p style={{fontSize: 14.5, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 620}}>{CONCEPT_TEXTS[active] || "A focused, labeled view of the concept above — annotations point to the parts that matter most."}</p>
        </div>
      </div>
    </div>
  );
}

export { ConceptSVG, CONCEPT_TEXTS, Label, Line };
export default ScreenConceptVisualizer;
