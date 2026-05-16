import { useState, useRef, useMemo } from 'react';
import { Icon } from '../components/Shell';

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
  const [active, setActive] = useState(state.mindMaps[0]);
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({x: 0, y: 0});
  const draggingRef = useRef(null);
  const { nodes, W, H } = useMemo(() => layoutMindmap(active.root), [active]);
  const [selected, setSelected] = useState(null);

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

export { layoutMindmap };
export default ScreenMindMap;
