import { useState, useRef, useEffect } from 'react';
import { Icon } from '../components/Shell';
import { visualAI } from '../api/index.js';

function ScreenVisualAI() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  async function handleFile(f) {
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setAnswer(null);
    setError('');
    setLoading(true);
    try {
      const r = await visualAI.solve(f, '');
      setAnswer(r);
    } catch (err) {
      setError(err.message || 'Could not solve the problem.');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setAnswer(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="col" style={{gap: 24, maxWidth: 760, margin: "0 auto", width: "100%"}}>
      <div className="page-hero">
        <h1>Ask a <em className="t-italic">doubt</em>.</h1>
        <p>Snap a photo of a problem, equation, or handwritten note. I'll work through it step by step and show you exactly where I'm looking.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{display: "none"}}
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {!file && (
        <button onClick={() => inputRef.current?.click()} className="card lift" style={{padding: 60, textAlign: "center", borderStyle: "dashed", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 14}}>
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

      {file && (
        <div className="grid" style={{gridTemplateColumns: "1fr 1fr", gap: 18}}>
          <div className="card" style={{padding: 0, overflow: "hidden"}}>
            <div style={{aspectRatio: "4/3", background: "var(--paper-2)", display: "grid", placeItems: "center", position: "relative", overflow: "hidden"}}>
              {previewUrl && <img src={previewUrl} alt="problem" style={{width: "100%", height: "100%", objectFit: "contain"}} />}
            </div>
            <div className="row" style={{padding: "10px 14px", justifyContent: "space-between"}}>
              <span className="muted" style={{fontSize: 12}}>{file.name}</span>
              <button className="btn is-quiet is-sm" onClick={reset}>Replace</button>
            </div>
          </div>
          <div className="card">
            {loading && <div className="muted" style={{padding: 20}}>Reading the image…</div>}
            {error && !loading && <div style={{color: "var(--err, #dc2626)", fontSize: 13, padding: 20}}>{error}</div>}
            {answer && !loading && (
              <>
                <div className="t-eyebrow">Step by step</div>
                <div style={{fontFamily: "var(--f-display)", fontSize: 22, marginTop: 4, marginBottom: 14}}>{answer.problem}</div>
                <div className="col" style={{gap: 10}}>
                  {(answer.steps || []).map((s, i) => (
                    <div key={i} className="row" style={{gap: 12, alignItems: "flex-start"}}>
                      <div style={{width: 22, height: 22, borderRadius: 50, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, flexShrink: 0}}>{i+1}</div>
                      <div style={{fontSize: 14, lineHeight: 1.55}}>{s}</div>
                    </div>
                  ))}
                </div>
                {answer.result && (
                  <div className="card-tight" style={{marginTop: 16, background: "var(--paper-2)", padding: "12px 14px", borderRadius: 10, borderLeft: "3px solid var(--ok)"}}>
                    <div className="t-eyebrow" style={{marginBottom: 4}}>Answer</div>
                    <div className="t-mono" style={{fontSize: 18, color: "var(--ink)"}}>{answer.result}</div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScreenVisualAI;
