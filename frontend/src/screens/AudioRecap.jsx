import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from '../components/Shell';
import { ErrorRetry } from '../components/GenState.jsx';
import { audioRecaps as audioRecapsApi } from '../api/index.js';
import { getToken } from '../api/client.js';

// A fixed-shape progress meter. The bar heights are a static, deterministic
// silhouette (NOT fake audio amplitude) and fill with the accent colour purely
// from the real playback `progress` (currentTime / duration) of the served WAV.
const BAR_SHAPE = Array.from({ length: 64 }, (_, i) =>
  Math.max(0.18, Math.min(1, (Math.sin(i * 0.4) * 0.5 + Math.sin(i * 1.2) * 0.3 + Math.cos(i * 0.7) * 0.3 + 1) / 2.5))
);

function Waveform({ playing, progress = 0 }) {
  return (
    <div style={{display: "flex", alignItems: "center", gap: 3, height: 64}}>
      {BAR_SHAPE.map((h, i) => {
        const active = i / BAR_SHAPE.length < progress;
        const phase = playing && Math.abs(i / BAR_SHAPE.length - progress) < 0.04;
        return <div key={i} style={{flex: 1, height: `${h * 100}%`, background: active ? "var(--accent)" : "var(--hairline)", borderRadius: 2, transform: phase ? "scaleY(1.15)" : "scaleY(1)", transition: "transform 0.15s var(--ease), background 0.2s var(--ease)"}}></div>;
      })}
    </div>
  );
}

function ScreenAudioRecap({ state, dispatch }) {
  const [active, setActive] = useState(state.audioRecaps[0]);
  const [playing, setPlaying] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const [position, setPosition] = useState(0);
  const [pollId, setPollId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(state.documents[0]?.id ?? null);
  const [genError, setGenError] = useState("");
  // Honesty contract: on a failed list() we show an error + Retry, never fabricated recaps.
  const [listError, setListError] = useState("");
  const audioRef = useRef(null);

  // Mount: load the real recaps. On failure we surface ErrorRetry and leave the
  // library empty — never substitute seeded sample recaps (whose Play does nothing).
  const reloadList = useCallback(() => {
    setListError("");
    audioRecapsApi.list()
      .then(recaps => {
        const list = Array.isArray(recaps) ? recaps : [];
        dispatch?.({ type: 'set-audio-recaps', audioRecaps: list });
        setActive(list[0]);
      })
      .catch(e => setListError(e.message || "Couldn't load your audio recaps — please retry."));
  }, [dispatch]);

  useEffect(() => { reloadList(); }, [reloadList]);

  // Poll for recap readiness. The api layer normalizes snake_case -> camelCase, so
  // the status field arrives as `processingStatus`.
  useEffect(() => {
    if (!pollId) return;
    const intervalId = setInterval(async () => {
      try {
        const recap = await audioRecapsApi.get(pollId);
        // Stop on either terminal state. 'failed' must surface honestly, not hang.
        if (recap.processingStatus === 'ready' || recap.processingStatus === 'failed') {
          setPollId(null);
          setGenerating(false);
          audioRecapsApi.list().then(recaps => {
            dispatch?.({ type: 'set-audio-recaps', audioRecaps: recaps });
            const fresh = Array.isArray(recaps) ? recaps.find(r => r.id === recap.id) : null;
            if (fresh) setActive(fresh);
          }).catch(() => { setActive(recap); });
        }
      } catch {
        // keep polling
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [pollId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate() {
    const docId = selectedDocId ?? state.documents[0]?.id;
    if (docId == null) { setGenError("Upload a document first, then pick it as the source."); return; }
    setGenError("");
    setGenerating(true);
    try {
      const recap = await audioRecapsApi.generate(docId);
      dispatch?.({ type: 'set-audio-recaps', audioRecaps: [recap, ...state.audioRecaps] });
      setActive(recap);
      if (recap.processingStatus !== 'ready') {
        setPollId(recap.id);
      } else {
        setGenerating(false);
      }
    } catch (err) {
      setGenerating(false);
      setGenError(err.message || "Couldn't start the recap — the AI service may be busy. Please retry.");
    }
  }

  const script = active?.script || [];
  const failed = active?.processingStatus === 'failed';
  // Only the real server-rendered WAV is played. No browser speechSynthesis fallback.
  // The api layer normalizes audio_url -> audioUrl, so read the camelCase field.
  const hasAudio = !!active?.audioUrl && !failed;
  const audioSrc = hasAudio ? `${active.audioUrl}?token=${getToken() || ''}` : null;

  // Real <audio> playback: drive progress + transcript highlight from currentTime.
  useEffect(() => {
    const el = audioRef.current;
    if (!hasAudio || !el) return;
    const onTime = () => {
      const d = el.duration || 0;
      setPosition(d ? el.currentTime / d : 0);
      if (d && script.length) setLineIdx(Math.min(script.length - 1, Math.floor((el.currentTime / d) * script.length)));
    };
    const onEnd = () => { setPlaying(false); setLineIdx(0); setPosition(0); };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnd);
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('ended', onEnd); };
  }, [hasAudio, active, script.length]);

  // Reset/pause the audio element when switching recaps.
  useEffect(() => {
    const el = audioRef.current;
    if (hasAudio && el) { el.pause(); el.currentTime = 0; }
    setPlaying(false); setLineIdx(0); setPosition(0);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = script.length;
  // Progress is driven entirely by the real <audio> element's currentTime/duration.
  const progress = position;
  const safeLine = script[lineIdx] || { speaker: 'Alex', dialogue: '' };

  function togglePlay() {
    const el = audioRef.current;
    if (!hasAudio || !el) return;
    if (el.paused) { el.play().then(() => setPlaying(true)).catch(() => {}); }
    else { el.pause(); setPlaying(false); }
  }
  function seek(delta) {
    const el = audioRef.current;
    if (!hasAudio || !el) return;
    el.currentTime = Math.max(0, Math.min((el.duration || 0), el.currentTime + delta));
  }

  function retryGenerate() {
    const docId = active?.sourceDocumentId ?? selectedDocId;
    if (docId != null) setSelectedDocId(docId);
    handleGenerate();
  }

  return (
    <div className="col" style={{gap: 24}}>
      <div className="page-hero">
        <h1>Audio <em className="t-italic">recap.</em></h1>
        <p>Two voices, your topic, conversational. Made for the bus ride, the dishes, or the lawn mower.</p>
      </div>

      <div className="grid" style={{gridTemplateColumns: "1.5fr 1fr"}}>
        <div className="card" style={{display: "flex", flexDirection: "column", gap: 18}}>
          <div className="row" style={{justifyContent: "space-between", alignItems: "flex-start"}}>
            <div>
              <div className="t-eyebrow">Now playing</div>
              <div className="t-display" style={{fontSize: 26, marginTop: 4}}>{active?.title}</div>
            </div>
            <span className="chip">{script.length} turns</span>
          </div>

          <Waveform playing={playing} progress={progress} />

          <div className="row" style={{justifyContent: "space-between", color: "var(--ink-3)", fontSize: 12}}>
            <span className="t-mono">{total ? lineIdx + 1 : 0} / {total}</span>
            <span className="t-mono">{playing ? safeLine.speaker : 'paused'}</span>
          </div>

          <div className="row" style={{justifyContent: "center", gap: 12}}>
            <button className="btn is-ghost is-icon" onClick={() => seek(-10)} disabled={!hasAudio}><Icon name="chevL" size={16} className="" /></button>
            <button className="btn is-accent" style={{width: 56, height: 56, borderRadius: 28}}
              onClick={togglePlay}
              disabled={!hasAudio}
              title={hasAudio ? '' : 'No audio available for this recap'}>
              <Icon name={playing ? "pause" : "play"} size={20} className="" />
            </button>
            <button className="btn is-ghost is-icon" onClick={() => seek(10)} disabled={!hasAudio}><Icon name="chevR" size={16} className="" /></button>
          </div>

          {hasAudio && <audio ref={audioRef} src={audioSrc} preload="metadata" style={{display: "none"}} />}

          {failed && (
            <ErrorRetry
              message="Audio synthesis failed for this recap. The text-to-speech engine couldn't render the script."
              onRetry={retryGenerate}
            />
          )}

          <div style={{padding: "14px 16px", background: "var(--paper-2)", borderRadius: 12}}>
            <div className="row" style={{alignItems: "flex-start", gap: 12}}>
              <div style={{width: 32, height: 32, borderRadius: 50, background: safeLine.speaker === "Alex" ? "var(--accent)" : "var(--ink)", color: "white", display: "grid", placeItems: "center", fontFamily: "var(--f-display)", fontStyle: "italic", flexShrink: 0}}>{safeLine.speaker[0]}</div>
              <div>
                <div className="t-eyebrow" style={{marginBottom: 4}}>{safeLine.speaker}</div>
                <div style={{fontSize: 14, lineHeight: 1.55}}>{generating ? 'Generating recap…' : safeLine.dialogue}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-flush">
          <div style={{padding: "16px 18px", borderBottom: "1px solid var(--hairline)"}}>
            <div className="t-eyebrow">Library</div>
            <div style={{fontFamily: "var(--f-display)", fontSize: 18, marginTop: 4}}>{state.audioRecaps.length} recaps</div>
            <label className="field-label" style={{ marginTop: 12, marginBottom: 4, display: "block" }}>Source document</label>
            <select
              className="input"
              style={{ width: "100%" }}
              value={selectedDocId ?? ""}
              onChange={e => { setGenError(""); setSelectedDocId(e.target.value ? Number(e.target.value) : null); }}
              disabled={!state.documents.length}
            >
              {state.documents.length
                ? state.documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                : <option value="">No documents — upload one first</option>}
            </select>
            {genError && <div style={{ color: "var(--err, #dc2626)", fontSize: 12.5, marginTop: 6 }}>{genError}</div>}
            {listError && <div style={{ marginTop: 10 }}><ErrorRetry message={listError} onRetry={reloadList} /></div>}
          </div>
          <div>
            {state.audioRecaps.map((r, i) => (
              <button key={r.id} className="lift" style={{display: "block", width: "100%", textAlign: "left", padding: "12px 18px", borderBottom: i === state.audioRecaps.length - 1 ? 0 : "1px solid var(--hairline)", background: r.id === active?.id ? "var(--paper-2)" : "transparent", border: 0, cursor: "default"}} onClick={() => { setActive(r); setPlaying(false); setLineIdx(0); setPosition(0); }}>
                <div style={{fontWeight: 500, fontSize: 13.5}}>{r.title}</div>
                <div className="muted" style={{fontSize: 12, marginTop: 2}}>{r.date}</div>
              </button>
            ))}
            <button className="lift" style={{display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 18px", color: "var(--ink-3)", background: "transparent", border: 0, borderTop: "1px solid var(--hairline)", cursor: "default", fontFamily: "var(--f-body)"}} onClick={handleGenerate} disabled={generating || !(selectedDocId ?? state.documents[0]?.id)}>
              <Icon name="plus" size={14} className="" /> {generating ? 'Generating…' : 'New recap'}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="t-eyebrow" style={{marginBottom: 14}}>Transcript</div>
        <div className="col" style={{gap: 14}}>
          {script.map((line, i) => (
            <div key={i} className="row" onClick={() => { setPlaying(false); setLineIdx(i); }} style={{alignItems: "flex-start", gap: 12, opacity: i === lineIdx ? 1 : 0.6, transition: "opacity 0.3s var(--ease)", cursor: "pointer"}}>
              <div style={{width: 24, height: 24, borderRadius: 50, background: line.speaker === "Alex" ? "var(--accent)" : "var(--ink)", color: "white", display: "grid", placeItems: "center", fontSize: 10, flexShrink: 0, fontFamily: "var(--f-display)", fontStyle: "italic"}}>{line.speaker[0]}</div>
              <div>
                <div className="muted" style={{fontSize: 11, marginBottom: 2}}>{line.speaker}</div>
                <div style={{fontSize: 14, lineHeight: 1.55}}>{line.dialogue}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { Waveform };
export default ScreenAudioRecap;
