import { useState } from 'react';
import { Icon } from '../components/Shell';

function ScreenVisualAI() {
  const [hasImage, setHasImage] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

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

export default ScreenVisualAI;
