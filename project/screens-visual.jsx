// screens-visual.jsx — Mind Map, Diagram Maker, Concept Visualizer, Visual AI, YouTube

const { useState: useS3, useEffect: useE3, useRef: useR3, useMemo: useM3 } = React;

// ─────────────────────────── MIND MAP ───────────────────────────
function layoutMindmap(root) {
  // radial layout: root at center, children fan out
  const W = 1000, H = 600;
  const cx = W / 2, cy = H / 2;
  const positioned = [];
  function place(node, level, angle, parentX, parentY) {
    const radius = level === 0 ? 0 : level * 170;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    node._x = x; node._y = y; node._parentX = parentX; node._parentY = parentY;
    positioned.push(node);
    const children = node.children || [];
    if (children.length > 0) {
      const spread = level === 0 ? Math.PI * 2 : Math.PI * 0.6;
      const start = level === 0 ? 0 : angle - spread / 2;
      children.forEach((c, i) => {
        const step = children.length === 1 ? 0 : spread / (children.length - 1);
        const a = children.length === 1 ? angle : start + step * i;
        place(c, level + 1, a, x, y);
      });
    }
  }
  // clone to avoid mutating
  function clone(n) { return { ...n, children: (n.children || []).map(clone) }; }
  const r = clone(root);
  place(r, 0, 0, cx, cy);
  return { nodes: positioned, W, H };
}

function ScreenMindMap({ state }) {
  const [active, setActive] = useS3(state.mindMaps[0]);
  const [zoom, setZoom] = useS3(0.8);
  const [pan, setPan] = useS3({x: 0, y: 0});
  const draggingRef = useR3(null);
  const { nodes, W, H } = useM3(() => layoutMindmap(active.root), [active]);
  const [selected, setSelected] = useS3(null);

  function onDown(e) { draggingRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }
  function onMove(e) {
    if (!draggingRef.current) return;
    const d = draggingRef.current;
    setPan({x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y)});
  }
  function onUp() { draggingRef.current = null; }

  return (
    <div className="col" style={{gap: 18}}>
      <div className="row" style={{justifyContent: "space-between", flexWrap: "wrap", gap: 10}}>
        <div>
          <div className="t-eyebrow">Mind map</div>
          <div className="t-display" style={{fontSize: 32, marginTop: 4}}>{active.title}</div>
        </div>
        <div className="row" style={{gap: 8}}>
          <select className="input" style={{width: "auto"}} value={active.id} onChange={e => setActive(state.mindMaps.find(m => m.id === +e.target.value))}>
            {state.mindMaps.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <button className="btn is-ghost is-sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
          <span className="kbd" style={{minWidth: 50, textAlign: "center"}}>{Math.round(zoom * 100)}%</span>
          <button className="btn is-ghost is-sm" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}>+</button>
          <button className="btn is-accent is-sm"><Icon name="plus" size={12} className="" /> Generate</button>
        </div>
      </div>
      <div className="card card-flush" style={{height: 600, overflow: "hidden", background: "var(--paper-2)", backgroundImage: "radial-gradient(circle, var(--hairline-2) 1px, transparent 1px)", backgroundSize: "22px 22px", position: "relative", cursor: "default"}}
           onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
        <svg width="100%" height="100%" viewBox={`${-pan.x/zoom} ${-pan.y/zoom} ${W/zoom} ${H/zoom}`}>
          {nodes.filter(n => n._parentX).map(n => (
            <path key={n.id + "-l"} d={`M${n._parentX} ${n._parentY} Q${(n._parentX+n._x)/2} ${n._parentY} ${n._x} ${n._y}`} stroke="var(--ink-4)" strokeWidth="1.5" fill="none" />
          ))}
          {nodes.map((n, i) => {
            const isRoot = !n._parentX;
            const w = isRoot ? 170 : 130;
            const h = isRoot ? 48 : 38;
            return (
              <g key={n.id} transform={`translate(${n._x - w/2} ${n._y - h/2})`} onClick={() => setSelected(n.id)} style={{cursor: "default"}}>
                <rect width={w} height={h} rx="10" fill={isRoot ? "var(--ink)" : selected === n.id ? "var(--accent-soft)" : "var(--card)"} stroke={selected === n.id ? "var(--accent)" : "var(--hairline)"} strokeWidth={selected === n.id ? "1.5" : "1"} />
                <text x={w/2} y={h/2 + 4} textAnchor="middle" fontSize={isRoot ? 14 : 12} fill={isRoot ? "var(--paper)" : "var(--ink)"} fontFamily={isRoot ? "var(--f-display)" : "var(--f-body)"} fontStyle={isRoot ? "italic" : "normal"} fontWeight="500">{n.text}</text>
              </g>
            );
          })}
        </svg>
        <div style={{position: "absolute", bottom: 14, left: 14, padding: "8px 12px", background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 11.5, color: "var(--ink-3)"}}>
          Drag to pan · Click a node · {nodes.length} nodes
        </div>
      </div>
    </div>
  );
}
window.ScreenMindMap = ScreenMindMap;


// ─────────────────────────── DIAGRAM MAKER ───────────────────────────
function ScreenDiagramMaker({ state }) {
  const [prompt, setPrompt] = useS3("How HTTPS handshake works");
  const [diagram, setDiagram] = useS3(makeDiagram("HTTPS"));
  const [generating, setGenerating] = useS3(false);

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
window.ScreenDiagramMaker = ScreenDiagramMaker;

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


// ─────────────────────────── CONCEPT VISUALIZER ───────────────────────────
function ScreenConceptVisualizer() {
  const [concept, setConcept] = useS3("Photosynthesis");
  const [active, setActive] = useS3("Photosynthesis");
  const [generating, setGenerating] = useS3(false);
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
window.ScreenConceptVisualizer = ScreenConceptVisualizer;

const CONCEPT_TEXTS = {
  "Photosynthesis": "Plants capture light energy in chlorophyll, then use it to combine CO₂ and water into glucose, releasing oxygen as a byproduct.",
  "Black hole": "A region of spacetime where gravity is so intense that nothing — not even light — can escape past the event horizon.",
  "DNA replication": "The double helix unwinds; each strand serves as a template; new complementary nucleotides are added base by base.",
  "Newton's prism": "White light entering a prism refracts; different wavelengths bend by different amounts, separating into the visible spectrum.",
  "Krebs cycle": "A circular series of reactions inside mitochondria that converts acetyl-CoA into CO₂ and high-energy electron carriers.",
};

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
function Label({ x, y, text, inside }) {
  return <text x={x} y={y} textAnchor="middle" fontSize="12" fill={inside ? "var(--paper)" : "var(--ink)"} fontFamily="var(--f-body)" fontWeight="500">{text}</text>;
}
function Line({ x1, y1, x2, y2, arrow }) {
  return <>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--ink-3)" strokeWidth="1.2" markerEnd={arrow ? "url(#arrow)" : undefined} />
    {arrow && <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="var(--ink-3)" /></marker></defs>}
  </>;
}


// ─────────────────────────── VISUAL AI / ASK DOUBTS ───────────────────────────
function ScreenVisualAI() {
  const [hasImage, setHasImage] = useS3(false);
  const [answer, setAnswer] = useS3(null);
  const [loading, setLoading] = useS3(false);

  function simulateUpload() {
    setHasImage(true);
    setLoading(true);
    setAnswer(null);
    setTimeout(() => {
      setLoading(false);
      setAnswer({
        problem: "Solve for x: 3x + 7 = 22",
        steps: [
          "Subtract 7 from both sides: 3x = 15.",
          "Divide both sides by 3: x = 5.",
          "Check: 3(5) + 7 = 22. ✓",
        ],
        result: "x = 5"
      });
    }, 1400);
  }

  return (
    <div className="col" style={{gap: 24, maxWidth: 760, margin: "0 auto", width: "100%"}}>
      <div className="page-hero">
        <h1>Ask a <em className="t-italic">doubt</em>.</h1>
        <p>Snap a photo of a problem, equation, or handwritten note. I'll work through it step by step and show you exactly where I'm looking.</p>
      </div>

      {!hasImage && (
        <button onClick={simulateUpload} className="card lift" style={{padding: 60, textAlign: "center", borderStyle: "dashed", cursor: "default", display: "flex", flexDirection: "column", alignItems: "center", gap: 14}}>
          <div style={{width: 56, height: 56, borderRadius: 14, background: "var(--paper-2)", display: "grid", placeItems: "center"}}>
            <Icon name="upload" size={22} className="" />
          </div>
          <div>
            <div className="t-display" style={{fontSize: 26}}>Drop an image</div>
            <div className="muted" style={{marginTop: 4}}>or paste from clipboard · take a photo · pick from library</div>
          </div>
          <div className="row" style={{gap: 8, marginTop: 6}}>
            <span className="chip">JPG</span><span className="chip">PNG</span><span className="chip">HEIC</span>
          </div>
        </button>
      )}

      {hasImage && (
        <div className="grid" style={{gridTemplateColumns: "1fr 1fr", gap: 18}}>
          <div className="card" style={{padding: 0, overflow: "hidden"}}>
            <div style={{aspectRatio: "4/3", background: "var(--paper-2)", display: "grid", placeItems: "center", position: "relative", backgroundImage: "repeating-linear-gradient(45deg, var(--paper-2) 0, var(--paper-2) 12px, var(--hairline-2) 12px, var(--hairline-2) 13px)"}}>
              <div style={{background: "var(--card)", padding: "28px 36px", border: "1px solid var(--hairline)", borderRadius: 8, fontFamily: "var(--f-display)", fontSize: 28}}>3x + 7 = 22</div>
            </div>
            <div className="row" style={{padding: "10px 14px", justifyContent: "space-between"}}>
              <span className="muted" style={{fontSize: 12}}>problem.jpg</span>
              <button className="btn is-quiet is-sm" onClick={() => { setHasImage(false); setAnswer(null); }}>Replace</button>
            </div>
          </div>
          <div className="card">
            {loading && <div className="muted" style={{padding: 20}}>Reading the image…</div>}
            {answer && (
              <>
                <div className="t-eyebrow">Step by step</div>
                <div style={{fontFamily: "var(--f-display)", fontSize: 22, marginTop: 4, marginBottom: 14}}>{answer.problem}</div>
                <div className="col" style={{gap: 10}}>
                  {answer.steps.map((s, i) => (
                    <div key={i} className="row" style={{gap: 12, alignItems: "flex-start"}}>
                      <div style={{width: 22, height: 22, borderRadius: 50, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, flexShrink: 0}}>{i+1}</div>
                      <div style={{fontSize: 14, lineHeight: 1.55}}>{s}</div>
                    </div>
                  ))}
                </div>
                <div className="card-tight" style={{marginTop: 16, background: "var(--paper-2)", padding: "12px 14px", borderRadius: 10, borderLeft: "3px solid var(--ok)"}}>
                  <div className="t-eyebrow" style={{marginBottom: 4}}>Answer</div>
                  <div className="t-mono" style={{fontSize: 18, color: "var(--ink)"}}>{answer.result}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
window.ScreenVisualAI = ScreenVisualAI;


// ─────────────────────────── YOUTUBE ───────────────────────────
function ScreenYouTube() {
  const [url, setUrl] = useS3("");
  const [active, setActive] = useS3(null);

  const examples = [
    {id: 1, title: "MIT OCW · Single Variable Calculus", duration: "47:21", channel: "MIT OpenCourseWare", thumb: "calc"},
    {id: 2, title: "The actual history of the Roman Empire", duration: "1:24:08", channel: "Crash Course", thumb: "rome"},
    {id: 3, title: "Photosynthesis explained simply", duration: "12:04", channel: "Crash Course Kids", thumb: "leaf"},
  ];

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Learn from <em className="t-italic">video.</em></h1>
        <p>Paste a YouTube URL and I'll summarize it, generate chapter markers, and let you ask questions while you watch.</p>
      </div>

      <div className="card-tight" style={{display: "flex", gap: 8, alignItems: "center", padding: 8, background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 14}}>
        <Icon name="youtube" size={18} className="" />
        <input className="input" style={{border: 0, background: "transparent"}} value={url} onChange={e => setUrl(e.target.value)} placeholder="youtube.com/watch?v=..." />
        <button className="btn is-accent" onClick={() => setActive(examples[0])}>Analyze</button>
      </div>

      {!active && (
        <div className="grid grid-3">
          {examples.map(v => (
            <button key={v.id} className="card lift" style={{padding: 0, overflow: "hidden", textAlign: "left", cursor: "default", border: "1px solid var(--hairline)"}} onClick={() => setActive(v)}>
              <div style={{aspectRatio: "16/9", background: `linear-gradient(135deg, var(--paper-2), var(--hairline-2))`, display: "grid", placeItems: "center", position: "relative"}}>
                <div style={{width: 48, height: 48, borderRadius: 50, background: "var(--ink)", display: "grid", placeItems: "center", color: "var(--paper)"}}>
                  <Icon name="play" size={18} className="" />
                </div>
                <div style={{position: "absolute", bottom: 8, right: 8, padding: "3px 8px", background: "rgba(0,0,0,.65)", color: "white", fontSize: 11, borderRadius: 4, fontFamily: "var(--f-mono)"}}>{v.duration}</div>
              </div>
              <div style={{padding: 14}}>
                <div style={{fontWeight: 500}}>{v.title}</div>
                <div className="muted" style={{fontSize: 12, marginTop: 4}}>{v.channel}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="grid" style={{gridTemplateColumns: "1.6fr 1fr", gap: 18}}>
          <div className="col" style={{gap: 14}}>
            <div className="card" style={{padding: 0, overflow: "hidden"}}>
              <div style={{aspectRatio: "16/9", background: "var(--ink)", display: "grid", placeItems: "center", position: "relative", color: "var(--paper)"}}>
                <Icon name="play" size={48} className="" />
                <div style={{position: "absolute", bottom: 12, left: 12, right: 12}}>
                  <div className="t-display" style={{fontSize: 24, color: "white"}}>{active.title}</div>
                  <div style={{fontSize: 12, opacity: 0.7}}>{active.channel} · {active.duration}</div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="t-eyebrow" style={{marginBottom: 10}}>Summary</div>
              <p style={{fontSize: 14, lineHeight: 1.6}}>This lecture introduces the fundamentals of single-variable calculus, beginning with limits as a way to formalize the intuition of "approaching" a value. It progresses to derivatives, framed first geometrically as slopes of tangent lines, then algebraically through the difference quotient. Several worked examples illustrate when the derivative exists and what it tells you about a function's behavior.</p>
            </div>
          </div>
          <div className="card card-flush">
            <div className="row" style={{padding: "14px 16px", justifyContent: "space-between", borderBottom: "1px solid var(--hairline)"}}>
              <div className="t-eyebrow">Chapters</div>
              <button className="btn is-quiet is-sm" onClick={() => setActive(null)}>← Back</button>
            </div>
            {[
              ["00:00", "Introduction"],
              ["03:14", "Limits — the intuition"],
              ["12:08", "ε-δ definition"],
              ["22:30", "Derivatives geometrically"],
              ["34:55", "The difference quotient"],
              ["41:20", "Worked examples"],
            ].map(([t, l], i) => (
              <div key={i} className="row" style={{padding: "10px 16px", gap: 12, borderBottom: i === 5 ? 0 : "1px solid var(--hairline)", cursor: "default"}}>
                <span className="t-mono" style={{color: "var(--ink-3)", fontSize: 12, minWidth: 50}}>{t}</span>
                <span style={{fontSize: 13.5}}>{l}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
window.ScreenYouTube = ScreenYouTube;
