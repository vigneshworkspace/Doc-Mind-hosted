// screens-voice.jsx — Studio
// A calm, professional voice interface.
// Single canvas viz: soft disk + radial spectrum + speak-ripples + halo.
// Editorial transcript reveal. Refined control rail.

const { useState: useSV, useEffect: useEV, useRef: useRV, useMemo: useMV } = React;

// ── helper: CSS var → rgb string (with optional alpha) ──────────────────
function readVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) { return fallback; }
}
function hexToRgba(hex, a) {
  // accepts #rgb / #rrggbb — best-effort, for known accent
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16) || 79;
  const g = parseInt(h.slice(2, 4), 16) || 107;
  const b = parseInt(h.slice(4, 6), 16) || 237;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// ── Studio viz ──────────────────────────────────────────────────────────
function StudioOrb({ status, energyRef, freqRef, beatRef }) {
  const canvasRef = useRV(null);

  useEV(() => {
    const cnv = canvasRef.current;
    if (!cnv) return;
    const ctx = cnv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function size() {
      const rect = cnv.getBoundingClientRect();
      cnv.width = Math.round(rect.width * dpr);
      cnv.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    const ro = new ResizeObserver(size);
    ro.observe(cnv);

    // expanding ripples that emit on beat / speak
    const ripples = [];
    let lastBeat = 0;

    let raf;
    let t0 = performance.now();
    let smoothE = 0;
    let smoothB = 0;
    let bars = new Float32Array(96);

    function frame(t) {
      const rect = cnv.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const cx = W / 2, cy = H / 2;
      const time = (t - t0) / 1000;

      // ease energy + beat
      const targetE = Math.max(0, Math.min(1, energyRef.current || 0));
      smoothE += (targetE - smoothE) * 0.16;
      const targetB = Math.max(0, beatRef.current || 0);
      smoothB += (targetB - smoothB) * 0.22;

      // accent (read once-ish — cheap)
      const accentHex = (readVar("--accent", "#4F6BED") || "#4F6BED").trim();
      const ink2 = readVar("--ink-2", "#3a3f55");
      const isActive = status !== "idle";

      ctx.clearRect(0, 0, W, H);

      // ── outer soft halo ──
      const haloR = Math.min(W, H) * 0.48;
      const haloAlpha = 0.06 + smoothE * 0.18 + (isActive ? 0.04 : 0);
      const halo = ctx.createRadialGradient(cx, cy, haloR * 0.25, cx, cy, haloR);
      halo.addColorStop(0, hexToRgba(accentHex, haloAlpha));
      halo.addColorStop(0.55, hexToRgba(accentHex, haloAlpha * 0.35));
      halo.addColorStop(1, hexToRgba(accentHex, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, haloR, 0, Math.PI * 2); ctx.fill();

      // ── ripples (speak / beat) ──
      if (status === "speaking" || status === "listening") {
        // emit a ripple when smoothed beat crosses threshold
        if (smoothB > 0.18 && t - lastBeat > 220) {
          ripples.push({ born: t, life: 1400 });
          lastBeat = t;
        }
        // also emit slow background ripples while speaking
        if (status === "speaking" && ripples.length < 4 && (t - lastBeat > 900)) {
          ripples.push({ born: t, life: 1800 });
          lastBeat = t;
        }
      }
      const baseR = Math.min(W, H) * 0.18;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const k = (t - r.born) / r.life;
        if (k >= 1) { ripples.splice(i, 1); continue; }
        const radius = baseR + k * Math.min(W, H) * 0.32;
        const alpha = (1 - k) * 0.35;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = hexToRgba(accentHex, alpha);
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── radial spectrum ticks ──
      const freq = freqRef.current; // Uint8Array
      const ringR = Math.min(W, H) * 0.30;
      const N = 96;
      const arc = Math.PI * 2 / N;
      ctx.lineCap = "round";
      for (let i = 0; i < N; i++) {
        // sample frequency — voice band emphasis
        let v = 0;
        if (freq && freq.length) {
          const norm = i / N;
          const bin = Math.floor(Math.pow(norm, 1.3) * Math.min(freq.length, 40)) + 1;
          v = (freq[bin] || 0) / 255;
        } else if (isActive) {
          v = (Math.sin(time * 3.0 + i * 0.18) * 0.5 + 0.5) * (0.25 + smoothE * 0.5);
        } else {
          v = 0.04 + Math.sin(time * 0.6 + i * 0.18) * 0.02;
        }
        // smooth bars
        bars[i] = bars[i] * 0.62 + v * 0.38;
        const a = -Math.PI / 2 + i * arc + time * 0.05; // slow rotation
        const len = 4 + bars[i] * (isActive ? 42 : 8);
        const x1 = cx + Math.cos(a) * ringR;
        const y1 = cy + Math.sin(a) * ringR;
        const x2 = cx + Math.cos(a) * (ringR + len);
        const y2 = cy + Math.sin(a) * (ringR + len);
        const aOpacity = isActive ? (0.18 + bars[i] * 0.7) : 0.16;
        ctx.strokeStyle = hexToRgba(accentHex, aOpacity);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // ── inner disk ──
      const breath = 1 + Math.sin(time * 1.1) * 0.018 + smoothE * 0.08 + smoothB * 0.05;
      const diskR = Math.min(W, H) * 0.165 * breath;

      // disk core gradient (paper → faint accent tint)
      const disk = ctx.createRadialGradient(
        cx - diskR * 0.25, cy - diskR * 0.3, diskR * 0.1,
        cx, cy, diskR
      );
      disk.addColorStop(0, hexToRgba(accentHex, 0.04));
      disk.addColorStop(0.45, hexToRgba(accentHex, 0.10 + smoothE * 0.08));
      disk.addColorStop(1, hexToRgba(accentHex, 0.22 + smoothE * 0.10));
      ctx.fillStyle = disk;
      ctx.beginPath();
      ctx.arc(cx, cy, diskR, 0, Math.PI * 2);
      ctx.fill();

      // crisp accent ring outline
      ctx.strokeStyle = hexToRgba(accentHex, 0.55 + smoothE * 0.25);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, diskR, 0, Math.PI * 2);
      ctx.stroke();

      // tiny center highlight — “lens”
      const lens = ctx.createRadialGradient(
        cx - diskR * 0.3, cy - diskR * 0.35, 0,
        cx - diskR * 0.3, cy - diskR * 0.35, diskR * 0.7
      );
      lens.addColorStop(0, "rgba(255,255,255,0.9)");
      lens.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lens;
      ctx.beginPath();
      ctx.arc(cx, cy, diskR, 0, Math.PI * 2);
      ctx.fill();

      // thinking: three orbiting dots
      if (status === "thinking") {
        const dotR = diskR + 18;
        for (let i = 0; i < 3; i++) {
          const a = time * 1.6 + (i * Math.PI * 2 / 3);
          const x = cx + Math.cos(a) * dotR;
          const y = cy + Math.sin(a) * dotR;
          const op = 0.35 + 0.45 * Math.sin(time * 4 + i * 1.3);
          ctx.fillStyle = hexToRgba(accentHex, Math.max(0.2, op));
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return <canvas ref={canvasRef} style={{width: "100%", height: "100%", display: "block"}}></canvas>;
}

// ── live mm:ss timer ────────────────────────────────────────────────────
function useTimer(running) {
  const [secs, setSecs] = useSV(0);
  useEV(() => {
    if (!running) { setSecs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(id);
  }, [running]);
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ── word-by-word reveal hook ────────────────────────────────────────────
function useTypewriter(text, speed) {
  const [shown, setShown] = useSV("");
  useEV(() => {
    if (!text) { setShown(""); return; }
    const words = text.split(/(\s+)/);
    let i = 0, acc = "";
    setShown("");
    const id = setInterval(() => {
      acc += words[i++] || "";
      setShown(acc);
      if (i >= words.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return shown;
}

// ── status line ─────────────────────────────────────────────────────────
function StatusLine({ status, micState, timer }) {
  const label = (
    status === "idle"      ? "Ready" :
    status === "listening" ? "Listening" :
    status === "thinking"  ? "Processing" :
    status === "speaking"  ? "Speaking" :
    "Error"
  );
  const dim = status === "idle";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 14,
      fontFamily: "var(--f-body)",
    }}>
      <span style={{
        position: "relative",
        width: 7, height: 7, borderRadius: "50%",
        background: dim ? "var(--ink-4)" : "var(--accent)",
        boxShadow: dim ? "none" : "0 0 0 4px color-mix(in oklch, var(--accent) 16%, transparent)",
        animation: !dim ? "voicedot 1.6s ease-in-out infinite" : "none",
      }}></span>
      <span style={{
        fontSize: 11.5, fontWeight: 600, letterSpacing: 0.08,
        color: dim ? "var(--ink-3)" : "var(--ink-2)",
        textTransform: "uppercase",
      }}>{label}</span>
      <span style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11.5, fontWeight: 500,
        color: "var(--ink-4)",
        letterSpacing: 0.04,
        fontVariantNumeric: "tabular-nums",
      }}>{timer}</span>
      {micState === "denied" && status !== "idle" && (
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: 0.08,
          color: "var(--ink-4)", textTransform: "uppercase",
          padding: "3px 7px",
          border: "1px solid var(--hairline)",
          borderRadius: 100,
        }}>Demo</span>
      )}
    </div>
  );
}

// ── voice select (sleek segmented) ──────────────────────────────────────
const VOICES = [
  { id: "Aria",  desc: "Warm · contralto" },
  { id: "Ben",   desc: "Calm · baritone" },
  { id: "Nova",  desc: "Bright · soprano" },
];
function VoicePicker({ value, onChange }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      padding: 3,
      background: "var(--paper-2)",
      border: "1px solid var(--hairline)",
      borderRadius: 100,
    }}>
      {VOICES.map(v => {
        const on = value === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            style={{
              border: 0, cursor: "pointer",
              padding: "6px 12px", borderRadius: 100,
              fontSize: 11.5, fontWeight: 600, letterSpacing: 0.01,
              background: on ? "var(--card)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-3)",
              boxShadow: on ? "0 1px 2px rgba(15,23,42,0.06), 0 0 0 1px var(--hairline)" : "none",
              transition: "all 0.15s var(--ease)",
            }}
          >{v.id}</button>
        );
      })}
    </div>
  );
}

// ── main screen ─────────────────────────────────────────────────────────
function ScreenVoiceChat() {
  const [status, setStatus] = useSV("idle");
  const [transcript, setTranscript] = useSV("");
  const [reply, setReply] = useSV("");
  const [micState, setMicState] = useSV("idle"); // idle | granted | denied
  const [muted, setMuted] = useSV(false);
  const [captions, setCaptions] = useSV(true);
  const [voice, setVoice] = useSV("Aria");

  const energyRef = useRV(0);
  const beatRef = useRV(0);
  const freqRef = useRV(null);
  const audioCtxRef = useRV(null);
  const analyserRef = useRV(null);
  const streamRef = useRV(null);
  const rafRef = useRV(0);
  const simRef = useRV(0);
  const timeoutsRef = useRV([]);
  const prevEnergyRef = useRV(0);

  const transcriptShown = useTypewriter(transcript, 42);
  const replyShown = useTypewriter(reply, 28);
  const timer = useTimer(status !== "idle");

  function clearTimers() {
    timeoutsRef.current.forEach(id => clearTimeout(id));
    timeoutsRef.current = [];
  }
  function pushTimer(fn, ms) {
    const id = setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  }

  async function startMic() {
    if (streamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      streamRef.current = stream;
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      freqRef.current = new Uint8Array(analyser.frequencyBinCount);
      setMicState("granted");
      return true;
    } catch (e) {
      setMicState("denied");
      return false;
    }
  }

  function stopMic() {
    try { streamRef.current && streamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
    try { audioCtxRef.current && audioCtxRef.current.close(); } catch (e) {}
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    freqRef.current = null;
  }

  // analyse loop while listening
  useEV(() => {
    if (status !== "listening" || !analyserRef.current) return;
    const a = analyserRef.current;
    const data = freqRef.current;
    let last = 0;
    const tick = () => {
      a.getByteFrequencyData(data);
      let sum = 0, w = 0;
      const maxBin = Math.min(data.length, 32);
      for (let i = 1; i < maxBin; i++) {
        const weight = 1 - (i / maxBin) * 0.75;
        sum += data[i] * weight;
        w += weight;
      }
      const avg = (sum / w) / 255;
      const energy = muted ? 0 : Math.min(1, Math.pow(avg, 0.85) * 1.7);
      last = last * 0.65 + energy * 0.35;
      energyRef.current = last;
      const delta = last - prevEnergyRef.current;
      if (delta > 0.14) beatRef.current = Math.min(1, delta * 4);
      else beatRef.current *= 0.85;
      prevEnergyRef.current = last;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, muted]);

  // simulate speaking energy + fake freq data when no mic / TTS playback
  useEV(() => {
    if (status !== "speaking") return;
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    const arr = freqRef.current;
    let i = 0;
    simRef.current = setInterval(() => {
      const t = i++ * 0.07;
      const env =
        (Math.sin(t * 5.4) * 0.5 + 0.5) *
        (Math.sin(t * 1.6) * 0.5 + 0.5) *
        (0.7 + 0.3 * Math.sin(t * 0.55));
      const e = 0.28 + env * 0.6;
      energyRef.current = energyRef.current * 0.45 + e * 0.55;
      if (env > 0.78 && Math.random() < 0.3) beatRef.current = 0.6 + Math.random() * 0.4;
      else beatRef.current *= 0.82;
      for (let k = 0; k < arr.length; k++) {
        const decay = Math.exp(-k * 0.045);
        const wiggle = (Math.sin(t * 7 + k * 0.5) * 0.5 + 0.5);
        const val = 255 * e * decay * (0.5 + 0.5 * wiggle);
        arr[k] = Math.max(0, Math.min(255, val));
      }
    }, 60);
    return () => clearInterval(simRef.current);
  }, [status]);

  // thinking: gentle breath
  useEV(() => {
    if (status !== "thinking") return;
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    const arr = freqRef.current;
    let i = 0;
    const id = setInterval(() => {
      const t = i++ * 0.1;
      const breath = 0.16 + (Math.sin(t * 1.2) * 0.5 + 0.5) * 0.14;
      energyRef.current = energyRef.current * 0.7 + breath * 0.3;
      beatRef.current *= 0.7;
      for (let k = 0; k < arr.length; k++) {
        const decay = Math.exp(-k * 0.07);
        const v = 255 * breath * decay * (0.6 + 0.4 * Math.sin(t * 2 + k * 0.3));
        arr[k] = Math.max(0, Math.min(255, v));
      }
    }, 80);
    return () => clearInterval(id);
  }, [status]);

  // idle: drift to zero
  useEV(() => {
    if (status !== "idle") return;
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    const arr = freqRef.current;
    let i = 0;
    const id = setInterval(() => {
      const t = i++ * 0.12;
      energyRef.current = energyRef.current * 0.88;
      beatRef.current *= 0.7;
      for (let k = 0; k < arr.length; k++) {
        arr[k] = 8 + Math.sin(t * 0.6 + k * 0.4) * 4;
      }
    }, 120);
    return () => clearInterval(id);
  }, [status]);

  useEV(() => () => { clearTimers(); stopMic(); }, []);

  async function startTurn() {
    if (status !== "idle") return;
    setTranscript("");
    setReply("");
    energyRef.current = 0;
    beatRef.current = 0;
    const ok = await startMic();
    setStatus("listening");
    pushTimer(() => {
      setTranscript("Explain entropy like I'm a curious student.");
      setStatus("thinking");
    }, ok ? 3200 : 2400);
    pushTimer(() => {
      setReply("Entropy measures how many microscopic arrangements give the same overall picture. A messy room has many possible layouts, a tidy one has few — so the messy room has higher entropy. Heat naturally spreads because spread-out states are far more numerous than concentrated ones, and the universe tends toward the more numerous.");
      setStatus("speaking");
    }, ok ? 4800 : 4000);
    pushTimer(() => setStatus("idle"), ok ? 14500 : 13500);
  }

  function endTurn() {
    clearTimers();
    setStatus("idle");
    energyRef.current = 0;
    beatRef.current = 0;
    stopMic();
  }

  const showCaptions = captions && (transcript || reply);

  return (
    <div className="col" style={{
      gap: 0, height: "100%",
      padding: "20px 28px 28px",
      position: "relative",
      fontFamily: "var(--f-body)",
    }}>
      {/* ── top strip ─────────────────────────────────────────── */}
      <div className="row" style={{
        justifyContent: "space-between", alignItems: "center",
        paddingBottom: 18,
        borderBottom: "1px solid var(--hairline-2)",
      }}>
        <StatusLine status={status} micState={micState} timer={timer} />
        <div className="row" style={{gap: 10, alignItems: "center"}}>
          <span style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: 0.1,
            color: "var(--ink-4)", textTransform: "uppercase",
          }}>Voice</span>
          <VoicePicker value={voice} onChange={setVoice} />
        </div>
      </div>

      {/* ── viz zone ──────────────────────────────────────────── */}
      <div style={{
        flex: "1 1 auto",
        display: "grid",
        gridTemplateRows: "1fr auto",
        minHeight: 0,
        gap: 0,
      }}>
        <div style={{
          position: "relative",
          display: "grid", placeItems: "center",
          minHeight: 0,
          overflow: "hidden",
        }}>
          <div
            onClick={status === "idle" ? startTurn : endTurn}
            className="voice-orb-wrap"
            style={{
              position: "relative",
              cursor: "pointer",
              borderRadius: "50%",
            }}
            title={status === "idle" ? "Start a turn" : "Tap to stop"}
          >
            <StudioOrb status={status} energyRef={energyRef} freqRef={freqRef} beatRef={beatRef} />

            {/* idle CTA — appears inside disk */}
            <div style={{
              position: "absolute", inset: 0,
              display: "grid", placeItems: "center",
              pointerEvents: "none",
              opacity: status === "idle" ? 1 : 0,
              transition: "opacity 0.3s var(--ease)",
            }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{color: "var(--accent)"}}>
                  <rect x="9" y="3" width="6" height="12" rx="3"/>
                  <path d="M5 11a7 7 0 0 0 14 0"/>
                  <path d="M12 18v3"/>
                </svg>
                <div style={{fontSize: 9.5, fontWeight: 600, color: "var(--ink-4)", letterSpacing: 0.16, textTransform: "uppercase"}}>Tap</div>
              </div>
            </div>
          </div>

          {/* hint line */}
          <div style={{
            position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
            fontSize: 11, fontWeight: 500, color: "var(--ink-4)",
            letterSpacing: 0.02, whiteSpace: "nowrap",
            opacity: status === "idle" ? 1 : 0.5,
          }}>
            {status === "idle"
              ? "Tap the orb or press " 
              : "Tap the orb to end"}
            {status === "idle" && (
              <kbd style={{
                display: "inline-block",
                padding: "1px 6px", marginLeft: 2,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 10, fontWeight: 600,
                color: "var(--ink-3)",
                background: "var(--paper-2)",
                border: "1px solid var(--hairline)",
                borderBottomWidth: 2,
                borderRadius: 4,
                lineHeight: 1.4,
              }}>Space</kbd>
            )}
          </div>
        </div>

        {/* ── transcript zone ─────────────────────────────────── */}
        <div style={{
          minHeight: 132,
          maxWidth: 680,
          margin: "0 auto",
          width: "100%",
          padding: "20px 8px 4px",
          display: "flex", flexDirection: "column", gap: 14,
          opacity: showCaptions ? 1 : 0,
          transition: "opacity 0.4s var(--ease)",
        }}>
          {(transcriptShown || transcript) && (
            <CaptionLine
              speaker="You"
              text={transcriptShown}
              full={transcript}
              tone="user"
            />
          )}
          {(replyShown || reply) && (
            <CaptionLine
              speaker={`DocMind · ${voice}`}
              text={replyShown}
              full={reply}
              tone="ai"
            />
          )}
        </div>
      </div>

      {/* ── control rail ──────────────────────────────────────── */}
      <div className="row" style={{
        justifyContent: "center", alignItems: "center",
        gap: 8,
        paddingTop: 18,
        borderTop: "1px solid var(--hairline-2)",
      }}>
        <RailBtn
          active={!muted}
          onClick={() => setMuted(m => !m)}
          label={muted ? "Unmute" : "Mute"}
          danger={muted}
        >
          {muted ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="2" x2="22" y2="22"/>
              <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
              <path d="M15 9.34V4a3 3 0 0 0-5.94-.6"/>
              <path d="M17 16.95A7 7 0 0 1 5 12v-2"/>
              <path d="M19 10v2a7 7 0 0 1-.11 1.23"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="3" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0"/>
              <path d="M12 18v3"/>
            </svg>
          )}
        </RailBtn>

        <RailBtn
          active={captions}
          onClick={() => setCaptions(c => !c)}
          label={captions ? "Captions" : "Hidden"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2"/>
            <path d="M7 13a2 2 0 0 0 3 1.5"/>
            <path d="M14 13a2 2 0 0 0 3 1.5"/>
          </svg>
        </RailBtn>

        <div style={{width: 1, height: 22, background: "var(--hairline)", margin: "0 6px"}}></div>

        {status === "idle" ? (
          <button
            onClick={startTurn}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 38, padding: "0 18px",
              background: "var(--ink)", color: "white",
              border: "1px solid var(--ink)",
              borderRadius: 100,
              fontSize: 12.5, fontWeight: 600, letterSpacing: 0.01,
              cursor: "pointer",
              boxShadow: "0 4px 14px color-mix(in oklch, var(--ink) 14%, transparent)",
              transition: "transform 0.15s var(--ease), background 0.15s var(--ease)",
            }}
          >
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 0 3px color-mix(in oklch, var(--accent) 30%, transparent)",
            }}></span>
            Start session
          </button>
        ) : (
          <button
            onClick={endTurn}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 38, padding: "0 18px",
              background: "oklch(58% 0.18 25)", color: "white",
              border: "1px solid oklch(58% 0.18 25)",
              borderRadius: 100,
              fontSize: 12.5, fontWeight: 600, letterSpacing: 0.01,
              cursor: "pointer",
              boxShadow: "0 4px 14px color-mix(in oklch, oklch(58% 0.18 25) 22%, transparent)",
              transition: "transform 0.15s var(--ease), background 0.15s var(--ease)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1.5"/>
            </svg>
            End session
          </button>
        )}
      </div>

      <style>{`
        @keyframes voicedot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%      { transform: scale(0.7); opacity: 0.7; }
        }
        @keyframes voicecaret {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0; }
        }
        @keyframes captionin {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

// ── caption line (speaker label + revealed text) ────────────────────────
function CaptionLine({ speaker, text, full, tone }) {
  const isAI = tone === "ai";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "auto 1fr",
      gap: 14,
      alignItems: "baseline",
      animation: "captionin 0.4s var(--ease) backwards",
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: 0.14,
        color: "var(--ink-4)",
        textTransform: "uppercase",
        padding: "3px 0",
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        whiteSpace: "nowrap",
        textAlign: "right",
        minWidth: 80,
      }}>
        {isAI ? speaker.split(" · ")[0] : "You"}
        {isAI && <div style={{
          fontWeight: 500, color: "var(--ink-4)",
          fontSize: 9, letterSpacing: 0.08, marginTop: 1,
        }}>{speaker.split(" · ")[1]}</div>}
      </div>
      <div style={{
        fontFamily: "var(--f-display)",
        fontSize: isAI ? 17 : 19,
        fontWeight: isAI ? 400 : 500,
        lineHeight: 1.5,
        color: isAI ? "var(--ink-2)" : "var(--ink)",
        letterSpacing: -0.005,
        textWrap: "pretty",
      }}>
        {text}
        {text && text.length < full.length && (
          <span style={{
            display: "inline-block", width: 2, height: "0.9em",
            marginLeft: 2, marginBottom: -2,
            background: "var(--accent)",
            verticalAlign: "middle",
            animation: "voicecaret 0.8s steps(2) infinite",
          }}></span>
        )}
      </div>
    </div>
  );
}

// ── small icon rail button ──────────────────────────────────────────────
function RailBtn({ children, label, onClick, active, danger }) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        height: 38, padding: "0 14px",
        background: active ? "var(--card)" : "var(--paper-2)",
        color: danger ? "oklch(58% 0.18 25)" : (active ? "var(--ink)" : "var(--ink-3)"),
        border: "1px solid " + (active ? "var(--hairline)" : "var(--hairline-2)"),
        borderRadius: 100,
        fontSize: 12.5, fontWeight: 500,
        cursor: "pointer",
        transition: "all 0.15s var(--ease)",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--ink-4)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = active ? "var(--hairline)" : "var(--hairline-2)"; }}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

// ── keyboard shortcut: spacebar to toggle ───────────────────────────────
(function attachSpacebar(){
  // attach once per host page; component will read no-op when nothing matches
})();

window.ScreenVoiceChat = ScreenVoiceChat;
