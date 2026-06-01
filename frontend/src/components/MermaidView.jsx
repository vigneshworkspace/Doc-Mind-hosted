import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// securityLevel 'strict' — diagram source is model/user-generated, so HTML and
// click handlers in the source must not execute (XSS surface). Switch to
// 'antiscript' only if clickable nodes become a required feature.
mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' });

let _idCounter = 0;

export default function MermaidView({ code }) {
  const ref = useRef(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code || !ref.current) return;
    let cancelled = false;
    const id = `mmd-${_idCounter++}`;
    setError('');
    mermaid.render(id, code)
      .then(({ svg }) => { if (!cancelled && ref.current) ref.current.innerHTML = svg; })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)); });
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: 'var(--err, #dc2626)', fontSize: 13, marginBottom: 8 }}>Diagram render error</div>
        <pre style={{ fontSize: 12, background: 'var(--paper-2)', padding: 12, borderRadius: 8, overflow: 'auto' }}>{code}</pre>
      </div>
    );
  }
  return <div ref={ref} style={{ display: 'grid', placeItems: 'center', padding: 16 }} />;
}
