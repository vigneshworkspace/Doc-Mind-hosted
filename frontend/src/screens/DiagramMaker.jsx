import { useState } from 'react';
import { Icon } from '../components/Shell';

function makeDiagram(prompt) {
  const p = prompt.toLowerCase();
  if (p.includes("compiler")) return { title: "Compiler pipeline", nodes: [
    {id:"src", label:"Source code", x:0, y:0, kind:"start"},
    {id:"lex", label:"Lexer", x:1, y:0},
    {id:"par", label:"Parser", x:2, y:0},
    {id:"ast", label:"AST", x:3, y:0, kind:"data"},
    {id:"sem", label:"Semantic\nanalysis", x:4, y:0},
    {id:"opt", label:"Optimizer", x:5, y:0},
    {id:"cg",  label:"Codegen", x:6, y:0, kind:"end"},
  ], edges: [["src","lex"],["lex","par"],["par","ast"],["ast","sem"],["sem","opt"],["opt","cg"]]};
  if (p.includes("photo")) return { title: "Photosynthesis", nodes: [
    {id:"sun", label:"Sunlight", x:0, y:0, kind:"start"},
    {id:"co2", label:"CO₂", x:0, y:1, kind:"data"},
    {id:"h2o", label:"H₂O", x:0, y:2, kind:"data"},
    {id:"chl", label:"Chloroplast", x:2, y:1},
    {id:"glc", label:"Glucose", x:4, y:0, kind:"end"},
    {id:"o2",  label:"O₂", x:4, y:2, kind:"end"},
  ], edges: [["sun","chl"],["co2","chl"],["h2o","chl"],["chl","glc"],["chl","o2"]]};
  if (p.includes("mitosis")) return { title: "Mitosis", nodes: [
    {id:"i", label:"Interphase", x:0, y:0, kind:"start"},
    {id:"p", label:"Prophase", x:1, y:0},
    {id:"m", label:"Metaphase", x:2, y:0},
    {id:"a", label:"Anaphase", x:3, y:0},
    {id:"t", label:"Telophase", x:4, y:0},
    {id:"c", label:"Cytokinesis", x:5, y:0, kind:"end"},
  ], edges: [["i","p"],["p","m"],["m","a"],["a","t"],["t","c"]]};
  if (p.includes("osi")) return { title: "OSI model", nodes: [
    {id:"7", label:"Application", x:0, y:0},
    {id:"6", label:"Presentation", x:0, y:1},
    {id:"5", label:"Session", x:0, y:2},
    {id:"4", label:"Transport", x:0, y:3},
    {id:"3", label:"Network", x:0, y:4},
    {id:"2", label:"Data link", x:0, y:5},
    {id:"1", label:"Physical", x:0, y:6},
  ], edges: [["7","6"],["6","5"],["5","4"],["4","3"],["3","2"],["2","1"]]};
  // default HTTPS
  return { title: "TLS / HTTPS handshake", nodes: [
    {id:"c1", label:"Client Hello", x:0, y:0, kind:"start"},
    {id:"s1", label:"Server Hello\n+ certificate", x:1, y:1},
    {id:"c2", label:"Verify\ncertificate", x:2, y:0},
    {id:"c3", label:"Pre-master\nsecret", x:3, y:1, kind:"data"},
    {id:"k",  label:"Derive\nsession keys", x:4, y:0},
    {id:"d",  label:"Encrypted\ndata", x:5, y:1, kind:"end"},
  ], edges: [["c1","s1"],["s1","c2"],["c2","c3"],["c3","k"],["k","d"]]};
}

function DiagramSVG({ diagram, generating }) {
  const cellW = 140, cellH = 80, gapX = 50, gapY = 30;
  const xs = [...new Set(diagram.nodes.map(n => n.x))];
  const ys = [...new Set(diagram.nodes.map(n => n.y))];
  const W = (Math.max(...xs) + 1) * (cellW + gapX);
  const H = (Math.max(...ys) + 1) * (cellH + gapY);
  function nx(n) { return n.x * (cellW + gapX) + cellW/2; }
  function ny(n) { return n.y * (cellH + gapY) + cellH/2; }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{maxHeight: 500, opacity: generating ? 0.4 : 1, transition: "opacity 0.3s"}}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {diagram.edges.map(([a, b], i) => {
        const na = diagram.nodes.find(n => n.id === a);
        const nb = diagram.nodes.find(n => n.id === b);
        if (!na || !nb) return null;
        const x1 = nx(na), y1 = ny(na), x2 = nx(nb), y2 = ny(nb);
        return <path key={i} d={`M${x1+cellW/2-4} ${y1} L${x2-cellW/2+4} ${y2}`} stroke="var(--ink-3)" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />;
      })}
      {diagram.nodes.map(n => {
        const isStart = n.kind === "start", isEnd = n.kind === "end", isData = n.kind === "data";
        return (
          <g key={n.id} transform={`translate(${nx(n) - cellW/2} ${ny(n) - cellH/2})`}>
            <rect width={cellW} height={cellH} rx={isData ? cellH/2 : 12}
              fill={isStart ? "var(--ink)" : isEnd ? "var(--accent)" : isData ? "var(--accent-soft)" : "var(--card)"}
              stroke={isStart || isEnd ? "none" : "var(--hairline)"} strokeWidth="1" />
            {n.label.split("\n").map((l, i, arr) => (
              <text key={i} x={cellW/2} y={cellH/2 + (i - (arr.length-1)/2) * 14 + 4} textAnchor="middle"
                fill={isStart ? "var(--paper)" : isEnd ? "white" : isData ? "var(--accent-ink)" : "var(--ink)"}
                fontSize="12" fontWeight="500" fontFamily="var(--f-body)">{l}</text>
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function ScreenDiagramMaker({ state }) {
  const [prompt, setPrompt] = useState("How HTTPS handshake works");
  const [diagram, setDiagram] = useState(makeDiagram("HTTPS"));
  const [generating, setGenerating] = useState(false);

  function generate() {
    setGenerating(true);
    setTimeout(() => {
      setDiagram(makeDiagram(prompt));
      setGenerating(false);
    }, 900);
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
              {["Flow", "Sequence", "Tree"].map(s => <button key={s} className="btn is-ghost is-sm">{s}</button>)}
            </div>
            <label className="field-label" style={{marginTop: 6}}>Direction</label>
            <div className="row" style={{gap: 6}}>
              <button className="btn is-sm">Left → Right</button>
              <button className="btn is-ghost is-sm">Top ↓ Bottom</button>
            </div>
            <button className="btn is-accent" disabled={generating} onClick={generate} style={{marginTop: 8}}>
              {generating ? "Drawing…" : <><Icon name="sparkles" size={14} className="" /> Generate</>}
            </button>
          </div>
          <div className="t-eyebrow" style={{marginTop: 22, marginBottom: 10}}>Templates</div>
          <div className="col" style={{gap: 6}}>
            {["Photosynthesis", "Compiler pipeline", "Mitosis", "OSI model"].map(t => (
              <button key={t} onClick={() => { setPrompt(t); setDiagram(makeDiagram(t)); }} className="row" style={{justifyContent: "space-between", padding: "8px 12px", background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 8, cursor: "default", color: "var(--ink-2)", fontSize: 13}}>
                {t} <Icon name="chevR" size={12} className="" />
              </button>
            ))}
          </div>
        </div>

        <div className="card card-flush" style={{minHeight: 460}}>
          <div className="row" style={{padding: "14px 18px", borderBottom: "1px solid var(--hairline)", justifyContent: "space-between"}}>
            <div>
              <div className="t-eyebrow">Result</div>
              <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 2}}>{diagram.title}</div>
            </div>
            <div className="row" style={{gap: 6}}>
              <button className="btn is-quiet is-sm">Copy SVG</button>
              <button className="btn is-ghost is-sm">Export</button>
            </div>
          </div>
          <div style={{padding: 30, background: "var(--paper-2)", backgroundImage: "radial-gradient(circle, var(--hairline-2) 1px, transparent 1px)", backgroundSize: "20px 20px"}}>
            <DiagramSVG diagram={diagram} generating={generating} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { makeDiagram, DiagramSVG };
export default ScreenDiagramMaker;
