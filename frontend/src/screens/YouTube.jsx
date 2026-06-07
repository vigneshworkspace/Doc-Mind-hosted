import { useState } from 'react';
import { Icon } from '../components/Shell.jsx';
import { youtube as youtubeApi } from '../api/index.js';

// "mm:ss" or "h:mm:ss" → seconds
function tsToSec(ts) {
  if (!ts) return 0;
  const parts = String(ts).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

const EXAMPLES = [
  { title: 'MIT OCW · Single Variable Calculus', duration: '47:21', channel: 'MIT OpenCourseWare', url: 'https://www.youtube.com/watch?v=jbIQW0gkgxo' },
  { title: 'The actual history of the Roman Empire', duration: '1:24:08', channel: 'Crash Course', url: 'https://www.youtube.com/watch?v=GBaHPND2QJg' },
  { title: 'Photosynthesis explained simply', duration: '12:04', channel: 'Crash Course Kids', url: 'https://www.youtube.com/watch?v=eo5XndJaz-Y' },
];

export default function YouTube() {
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState('');
  const [result, setResult] = useState(null);
  const [startSec, setStartSec] = useState(0); // chapter seek → iframe ?start=

  async function handleAnalyze(overrideUrl) {
    const target = (overrideUrl ?? url).trim();
    if (!target) return;
    setAnalyzing(true);
    setAnalyzeError('');
    setStartSec(0);
    try {
      // r shape: { video_id, transcript, summary, chapters: [{timestamp, title}], key_points[] }
      const r = await youtubeApi.summarize(target);
      setResult(r);
    } catch (err) {
      setAnalyzeError(err.message || 'Could not analyze video.');
    } finally {
      setAnalyzing(false);
    }
  }

  function fillExample(ex) {
    setUrl(ex.url);
    handleAnalyze(ex.url);
  }

  const chapters = result?.chapters || [];
  const keyPoints = result?.key_points || [];

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="page-hero">
        <h1>Learn from <em className="t-italic">video.</em></h1>
        <p>Paste a YouTube URL and I'll summarize it, generate chapter markers, and let you ask questions while you watch.</p>
      </div>

      <div className="card-tight" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8, background: 'var(--card)', border: '1px solid var(--hairline)', borderRadius: 14 }}>
        <Icon name="youtube" size={18} className="" />
        <input className="input" aria-label="YouTube video URL" style={{ border: 0, background: 'transparent' }} value={url} onChange={e => setUrl(e.target.value)} placeholder="youtube.com/watch?v=..." onKeyDown={e => e.key === 'Enter' && handleAnalyze()} />
        <button className="btn is-accent" onClick={() => handleAnalyze()} disabled={analyzing}>{analyzing ? 'Analyzing…' : 'Analyze'}</button>
      </div>

      {analyzeError && (
        <div style={{ color: 'var(--err, #dc2626)', fontSize: 13 }}>{analyzeError}</div>
      )}

      {!result && !analyzing && (
        <div className="grid grid-3">
          {EXAMPLES.map(v => (
            <button
              key={v.url}
              className="card lift"
              style={{ padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--hairline)' }}
              onClick={() => fillExample(v)}
            >
              <div style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, var(--paper-2), var(--hairline-2))', display: 'grid', placeItems: 'center', position: 'relative' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--ink)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }}>
                  <Icon name="play" size={18} className="" />
                </div>
                <div style={{ position: 'absolute', bottom: 8, right: 8, padding: '3px 8px', background: 'rgba(0,0,0,.65)', color: 'white', fontSize: 11, borderRadius: 4, fontFamily: 'var(--f-mono)' }}>{v.duration}</div>
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ fontWeight: 500 }}>{v.title}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{v.channel}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {result && (
        <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: 18 }}>
          <div className="col" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {result.video_id ? (
                <div style={{ aspectRatio: '16/9' }}>
                  <iframe
                    key={startSec}
                    width="100%"
                    height="100%"
                    src={`https://www.youtube-nocookie.com/embed/${result.video_id}?rel=0&modestbranding=1&start=${startSec}${startSec ? '&autoplay=1' : ''}`}
                    title="YouTube video player"
                    style={{ border: 0, display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div style={{ aspectRatio: '16/9', background: 'var(--ink)', display: 'grid', placeItems: 'center', color: 'var(--paper)' }}>
                  <span className="muted" style={{ color: 'var(--ink-4)' }}>No playable video id</span>
                </div>
              )}
            </div>
            <div className="card">
              <div className="t-eyebrow" style={{ marginBottom: 10 }}>Summary</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {result.summary || 'No summary available.'}
              </p>
            </div>
            {keyPoints.length > 0 && (
              <div className="card">
                <div className="t-eyebrow" style={{ marginBottom: 10 }}>Key points</div>
                <div className="col" style={{ gap: 8 }}>
                  {keyPoints.map((kp, i) => (
                    <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 6, height: 6, borderRadius: 50, background: 'var(--accent)', marginTop: 7, flexShrink: 0 }} />
                      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{kp}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card card-flush">
            <div className="row" style={{ padding: '14px 16px', justifyContent: 'space-between', borderBottom: '1px solid var(--hairline)' }}>
              <div className="t-eyebrow">Chapters</div>
              <button className="btn is-quiet is-sm" onClick={() => { setResult(null); }}>← Back</button>
            </div>
            {chapters.length === 0 && (
              <div className="muted" style={{ padding: '14px 16px', fontSize: 13 }}>No chapters detected.</div>
            )}
            {chapters.map((ch, i) => (
              <button
                key={i}
                onClick={() => setStartSec(tsToSec(ch.timestamp))}
                title="Jump to this chapter"
                className="lift"
                style={{ display: 'flex', alignItems: 'center', width: '100%', textAlign: 'left', padding: '10px 16px', gap: 12, border: 0, borderBottom: i === chapters.length - 1 ? 0 : '1px solid var(--hairline)', background: 'transparent', cursor: 'pointer' }}
              >
                <span className="t-mono" style={{ color: 'var(--accent)', fontSize: 12, minWidth: 50 }}>{ch.timestamp}</span>
                <span style={{ fontSize: 13.5 }}>{ch.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
