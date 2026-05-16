// screens-voice.jsx — Enhanced voice chat
// Three-layer Three.js viz: bright core + plasma shell + wire halo,
// orbited by a 96-bar audio-reactive frequency ring.
// Real mic capture via getUserMedia, simulated envelope while "speaking".

const { useState: useSV, useEffect: useEV, useRef: useRV } = React;

// ── shaders ─────────────────────────────────────────────────────────────
// Common simplex noise prelude shared by both vertex + fragment shaders.
const SIMPLEX = /* glsl */`
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289v(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289v(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){
    float v=0.0, a=0.55, f=1.4;
    for(int i=0;i<5;i++){ v += a*snoise(p*f); a *= 0.5; f *= 2.05; }
    return v;
  }
`;

// — Plasma shell —
const PLASMA_VERT = /* glsl */`
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uState;
  varying vec3  vNormal;
  varying float vDisp;
  ${SIMPLEX}
  void main(){
    vNormal = normal;
    float speed = 0.35 + uState * 0.22 + uEnergy * 0.5;
    float freq  = 1.7 + uState * 0.55;
    float baseDisp = snoise(normal * freq + uTime * speed) * 0.075;
    float audio    = snoise(normal * 3.4 + uTime * 0.8) * 0.22 * uEnergy;
    float beat     = uBeat * 0.05 * (1.0 + 0.5 * snoise(normal * 5.0));
    float think    = (uState > 1.5 && uState < 2.5)
      ? sin(uTime * 2.6 + snoise(normal * 4.5) * 6.28) * 0.028
      : 0.0;
    float disp = baseDisp + audio + beat + think;
    vDisp = disp;
    vec3 p = position + normal * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const PLASMA_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  uniform float uState;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;
  uniform vec3  uColorD;
  varying vec3  vNormal;
  varying float vDisp;
  ${SIMPLEX}
  void main(){
    float t = uTime * 0.22;
    vec3 n3 = vNormal;
    float n = fbm(n3 * 1.9 + vec3(0.0, 0.0, t * (1.0 + uEnergy * 1.4)));
    n = n * 0.5 + 0.5;

    float blendAB = clamp(uEnergy * 1.8 + uState * 0.2, 0.0, 1.0);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 1.0, blendAB));
    col = mix(col, uColorC, smoothstep(0.5, 1.0, n) * (0.55 + uEnergy * 0.35));

    // iridescent shimmer on normal — soft hue tilt at glancing angles
    float ndv = dot(normalize(vNormal), vec3(0.0, 0.0, 1.0));
    float fres = pow(1.0 - max(ndv, 0.0), 2.0);
    col = mix(col, uColorD, fres * (0.65 + uEnergy * 0.25 + uBeat * 0.15));

    // overall brightness — kept airy for the white-finish look
    float bright = 0.94 + uEnergy * 0.28 + n * 0.07 + uBeat * 0.18;
    col *= bright;

    // inner highlight along ridge displacement
    col += vec3(1.0) * smoothstep(0.05, 0.20, vDisp) * (0.14 + uEnergy * 0.15);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// — Bright inner core —
const CORE_VERT = /* glsl */`
  uniform float uTime;
  uniform float uEnergy;
  uniform float uBeat;
  varying float vIntensity;
  ${SIMPLEX}
  void main(){
    float n = snoise(normal * 2.2 + uTime * 0.7);
    float disp = 0.05 + n * 0.04 + uEnergy * 0.12 + uBeat * 0.08;
    vec3 p = position + normal * disp;
    // approximate inner glow falloff (more glow where outer shell is)
    vIntensity = 0.55 + 0.45 * n + uEnergy * 0.3 + uBeat * 0.25;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const CORE_FRAG = /* glsl */`
  precision highp float;
  uniform vec3  uHot;
  uniform vec3  uCool;
  varying float vIntensity;
  void main(){
    vec3 col = mix(uCool, uHot, clamp(vIntensity, 0.0, 1.0));
    col *= 1.15;
    gl_FragColor = vec4(col, 0.85);
  }
`;

// ── helper: CSS var → THREE.Color (cached lookup) ───────────────────────
function cssColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return new THREE.Color(fallback);
    const c = new THREE.Color();
    c.set(v);
    return c;
  } catch (e) { return new THREE.Color(fallback); }
}

// ── frequency ring (XY plane, facing camera; bars grow radially outward) ─
function buildFrequencyRing(scene, count, baseRadius, accentColor) {
  const group = new THREE.Group();
  // Shared geometry: a thin box; pivot at base so scale.y grows outward.
  const barGeo = new THREE.BoxGeometry(0.018, 0.06, 0.018);
  barGeo.translate(0, 0.03, 0);
  const baseMat = new THREE.MeshBasicMaterial({
    color: accentColor,
    transparent: true,
    opacity: 0.6,
  });
  const bars = [];
  const up = new THREE.Vector3(0, 1, 0);
  const radial = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * baseRadius;
    const y = Math.sin(angle) * baseRadius;
    const bar = new THREE.Mesh(barGeo, baseMat.clone());
    bar.position.set(x, y, 0);
    // rotate local +Y to point radially outward in the XY plane
    radial.set(x, y, 0).normalize();
    bar.quaternion.setFromUnitVectors(up, radial);
    bars.push(bar);
    group.add(bar);
  }
  scene.add(group);
  return { group, bars, sharedGeo: barGeo, protoMat: baseMat };
}

// ── 3D viz component ────────────────────────────────────────────────────
function PlasmaSphere({ status, energyRef, beatRef, freqRef }) {
  const mountRef = useRV(null);
  const stateRef = useRV(0);
  const colorTickRef = useRV(0);

  useEV(() => {
    stateRef.current = (
      status === "listening" ? 1 :
      status === "thinking"  ? 2 :
      status === "speaking"  ? 3 : 0
    );
  }, [status]);

  useEV(() => {
    const mount = mountRef.current;
    if (!mount || typeof THREE === "undefined") return;

    const w = mount.clientWidth || 440;
    const h = mount.clientHeight || 440;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // — Plasma shell
    const shellGeo = new THREE.IcosahedronGeometry(1.0, 48);
    const shellUniforms = {
      uTime:    { value: 0 },
      uEnergy:  { value: 0 },
      uBeat:    { value: 0 },
      uState:   { value: 0 },
      uColorA:  { value: cssColor("--paper", "#ffffff") },
      uColorB:  { value: cssColor("--accent", "#4F6BED") },
      uColorC:  { value: cssColor("--accent-2", "#2DB48A") },
      uColorD:  { value: cssColor("--accent", "#4F6BED") },
    };
    const shellMat = new THREE.ShaderMaterial({
      uniforms: shellUniforms,
      vertexShader: PLASMA_VERT,
      fragmentShader: PLASMA_FRAG,
    });
    const shell = new THREE.Mesh(shellGeo, shellMat);
    scene.add(shell);

    // — Bright core
    const coreGeo = new THREE.IcosahedronGeometry(0.55, 16);
    const coreUniforms = {
      uTime:   { value: 0 },
      uEnergy: { value: 0 },
      uBeat:   { value: 0 },
      uHot:    { value: cssColor("--accent-3", "#E8B43E") },
      uCool:   { value: cssColor("--accent", "#4F6BED") },
    };
    const coreMat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // — Outer wireframe halo (sits between plasma shell and the bar ring)
    const wireGeo = new THREE.IcosahedronGeometry(1.32, 2);
    const wireMat = new THREE.MeshBasicMaterial({
      color: cssColor("--accent", "#4F6BED"),
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // — Additive ring (subtle bloom-y halo)
    const ringGeo = new THREE.RingGeometry(1.26, 1.32, 96);
    const ringMat = new THREE.MeshBasicMaterial({
      color: cssColor("--accent", "#4F6BED"),
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    scene.add(ring);

    // — Frequency bar ring (96 bars at r=1.55, max growth ≈ 0.55 → extent ≈ 2.10;
    //   safely inside camera frustum at fov 50, z 5.2)
    const BAR_COUNT = 96;
    const { group: barRing, bars, sharedGeo: barGeoShared, protoMat: barProtoMat } = buildFrequencyRing(
      scene, BAR_COUNT, 1.55, cssColor("--accent", "#4F6BED")
    );

    // — Particle dust orbit
    const PARTICLE_N = 280;
    const partGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_N * 3);
    for (let i = 0; i < PARTICLE_N; i++) {
      const phi   = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const r     = 1.65 + Math.random() * 0.45;
      positions[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      positions[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i*3+2] = r * Math.cos(phi);
    }
    partGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const partMat = new THREE.PointsMaterial({
      color: cssColor("--accent", "#4F6BED"),
      size: 0.02,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(partGeo, partMat);
    scene.add(particles);

    let rafId;
    const clock = new THREE.Clock();
    let smoothEnergy = 0;
    let smoothBeat = 0;

    function tick() {
      const t = clock.getElapsedTime();
      const dt = clock.getDelta();

      const targetEnergy = Math.max(0, Math.min(1, energyRef.current || 0));
      smoothEnergy += (targetEnergy - smoothEnergy) * Math.min(1, dt * 7.5);
      smoothBeat += (Math.max(0, beatRef.current || 0) - smoothBeat) * Math.min(1, dt * 14);

      // shell uniforms
      shellUniforms.uTime.value = t;
      shellUniforms.uEnergy.value = smoothEnergy;
      shellUniforms.uBeat.value = smoothBeat;
      shellUniforms.uState.value = stateRef.current;

      coreUniforms.uTime.value = t;
      coreUniforms.uEnergy.value = smoothEnergy;
      coreUniforms.uBeat.value = smoothBeat;

      // refresh colors periodically (theme/palette changes)
      colorTickRef.current = (colorTickRef.current + 1) % 30;
      if (colorTickRef.current === 0) {
        const cA = cssColor("--paper", "#ffffff");
        const cB = cssColor("--accent", "#4F6BED");
        const cC = cssColor("--accent-2", "#2DB48A");
        const cD = cssColor("--accent", "#4F6BED");
        const cE = cssColor("--accent-3", "#E8B43E");
        shellUniforms.uColorA.value = cA;
        shellUniforms.uColorB.value = cB;
        shellUniforms.uColorC.value = cC;
        shellUniforms.uColorD.value = cD;
        coreUniforms.uHot.value = cE;
        coreUniforms.uCool.value = cB;
        wireMat.color = cB;
        ringMat.color = cB;
        partMat.color = cB;
        for (const b of bars) b.material.color = cB;
      }

      // rotation per state
      const spin = 0.05 + stateRef.current * 0.05 + smoothEnergy * 0.45;
      shell.rotation.y += spin * dt;
      shell.rotation.x += 0.022 * dt;
      core.rotation.y -= (spin + 0.05) * dt;
      core.rotation.z += 0.04 * dt;
      wire.rotation.y += 0.12 * dt;
      wire.rotation.x -= 0.04 * dt;
      particles.rotation.y -= 0.2 * dt;
      barRing.rotation.y += 0.06 * dt + smoothEnergy * 0.4 * dt;

      // ring breathing
      const breath = 1 + Math.sin(t * 1.4) * 0.02 + smoothEnergy * 0.06 + smoothBeat * 0.04;
      ring.scale.setScalar(breath);
      ringMat.opacity = 0.10 + smoothEnergy * 0.22 + (stateRef.current > 0 ? 0.08 : 0);
      wireMat.opacity = 0.10 + smoothEnergy * 0.18 + (stateRef.current === 3 ? 0.06 : 0);

      // particles size/opacity react
      partMat.opacity = 0.30 + smoothEnergy * 0.55;
      partMat.size = 0.018 + smoothEnergy * 0.024;

      // ── frequency bars: scale.y maps to amplitude. Base height 0.06; max scale ~9
      //    → max length ≈ 0.54 outward from baseRadius 1.55 → ends at ≈ 2.10.
      const freqs = freqRef.current; // Uint8Array(64) or null
      const activeViz = stateRef.current > 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        let v = 0;
        if (freqs && freqs.length) {
          // mild low-end emphasis (voice band)
          const norm = i / BAR_COUNT;
          const bin = Math.floor(Math.pow(norm, 1.4) * Math.min(freqs.length, 40)) + 1;
          v = freqs[bin] / 255;
        } else if (activeViz) {
          v = (Math.sin(t * 3.2 + i * 0.18) * 0.5 + 0.5) * (0.3 + smoothEnergy * 0.5);
        } else {
          v = 0.06 + Math.sin(t * 0.7 + i * 0.12) * 0.03;
        }
        const bar = bars[i];
        const targetScale = 1 + v * 8.0;
        bar.scale.y += (targetScale - bar.scale.y) * Math.min(1, dt * 16);
        bar.material.opacity = activeViz ? (0.35 + v * 0.55) : 0.20;
      }

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    tick();

    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      const W = e.contentRect.width, H = e.contentRect.height;
      if (!W || !H) return;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      try { mount.removeChild(renderer.domElement); } catch (e) {}
      shellGeo.dispose(); shellMat.dispose();
      coreGeo.dispose();  coreMat.dispose();
      wireGeo.dispose();  wireMat.dispose();
      ringGeo.dispose();  ringMat.dispose();
      partGeo.dispose();  partMat.dispose();
      for (const b of bars) b.material.dispose();
      barGeoShared.dispose();
      barProtoMat.dispose();
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{width: "100%", height: "100%"}}></div>;
}

// ── status pill ─────────────────────────────────────────────────────────
function StatusPill({ status, micState }) {
  const label = (
    status === "idle"      ? "Tap to talk" :
    status === "listening" ? "Listening" :
    status === "thinking"  ? "Thinking" :
    status === "speaking"  ? "Speaking" :
    "Error"
  );
  const subtle = status === "idle" || micState === "denied";
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 9,
      padding: "7px 14px 7px 12px",
      borderRadius: 100,
      background: status === "idle" ? "var(--paper-2)" : "var(--card)",
      border: "1px solid " + (status === "idle" ? "var(--hairline)" : "color-mix(in oklch, var(--accent) 30%, var(--hairline))"),
      fontSize: 12.5,
      fontWeight: 600,
      color: "var(--ink)",
      letterSpacing: -0.005,
      transition: "all 0.25s var(--ease)",
      boxShadow: status !== "idle" ? "0 6px 18px color-mix(in oklch, var(--accent) 14%, transparent)" : "none",
    }}>
      <span style={{
        position: "relative", width: 8, height: 8, borderRadius: "50%",
        background: subtle ? "var(--ink-4)" : "var(--accent)",
        boxShadow: subtle ? "none" : "0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent)",
        animation: !subtle ? "voicedot 1.4s ease-in-out infinite" : "none",
      }}></span>
      <span>{label}</span>
      {micState === "denied" && status !== "idle" && (
        <span style={{color: "var(--ink-4)", fontWeight: 500, marginLeft: 2}}>· demo</span>
      )}
    </div>
  );
}

// ── word-by-word reveal hook ────────────────────────────────────────────
function useTypewriter(text, speed) {
  const [shown, setShown] = useSV("");
  useEV(() => {
    if (!text) { setShown(""); return; }
    const words = text.split(/(\s+)/);
    let i = 0;
    let acc = "";
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

// ── main screen ─────────────────────────────────────────────────────────
function ScreenVoiceChat() {
  const [status, setStatus] = useSV("idle");
  const [transcript, setTranscript] = useSV("");
  const [reply, setReply] = useSV("");
  const [micState, setMicState] = useSV("idle"); // idle | granted | denied
  const [muted, setMuted] = useSV(false);
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

  const transcriptShown = useTypewriter(transcript, 38);
  const replyShown = useTypewriter(reply, 28);

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
      analyser.fftSize = 128;            // bins = 64 — fine grain for voice band
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
      // weighted low-mid voice band
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

      // beat detect — spike above smoothed by >0.18
      const delta = last - prevEnergyRef.current;
      if (delta > 0.14) beatRef.current = Math.min(1, delta * 4);
      else beatRef.current *= 0.85;
      prevEnergyRef.current = last;

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, muted]);

  // simulate speaking energy + fake freq data when no mic
  useEV(() => {
    if (status !== "speaking") return;
    // Create or reuse a synthetic freq array so the bars still animate
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    const fakeFreqs = freqRef.current;
    let i = 0;
    simRef.current = setInterval(() => {
      const t = i++ * 0.07;
      // word-rhythm envelope: combine slow + fast waves
      const env =
        (Math.sin(t * 5.4) * 0.5 + 0.5) *
        (Math.sin(t * 1.6) * 0.5 + 0.5) *
        (0.7 + 0.3 * Math.sin(t * 0.55));
      const e = 0.28 + env * 0.6;
      energyRef.current = energyRef.current * 0.45 + e * 0.55;
      // bump beat on big peaks
      if (env > 0.78 && Math.random() < 0.3) beatRef.current = 0.6 + Math.random() * 0.4;
      else beatRef.current *= 0.82;
      // synthesize a freq distribution: low bins louder during vowels
      for (let k = 0; k < fakeFreqs.length; k++) {
        const decay = Math.exp(-k * 0.045);
        const wiggle = (Math.sin(t * 7 + k * 0.5) * 0.5 + 0.5);
        const val = 255 * e * decay * (0.5 + 0.5 * wiggle);
        fakeFreqs[k] = Math.max(0, Math.min(255, val));
      }
    }, 60);
    return () => clearInterval(simRef.current);
  }, [status]);

  // thinking: gentle steady "breath" with no beat
  useEV(() => {
    if (status !== "thinking") return;
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    let i = 0;
    const id = setInterval(() => {
      const t = i++ * 0.1;
      const breath = 0.18 + (Math.sin(t * 1.2) * 0.5 + 0.5) * 0.18;
      energyRef.current = energyRef.current * 0.7 + breath * 0.3;
      beatRef.current *= 0.7;
      const arr = freqRef.current;
      for (let k = 0; k < arr.length; k++) {
        const decay = Math.exp(-k * 0.07);
        const v = 255 * breath * decay * (0.6 + 0.4 * Math.sin(t * 2 + k * 0.3));
        arr[k] = Math.max(0, Math.min(255, v));
      }
    }, 80);
    return () => clearInterval(id);
  }, [status]);

  // idle: drift to zero, very subtle low-freq
  useEV(() => {
    if (status !== "idle") return;
    if (!freqRef.current) freqRef.current = new Uint8Array(64);
    let i = 0;
    const id = setInterval(() => {
      const t = i++ * 0.12;
      energyRef.current = energyRef.current * 0.88;
      beatRef.current *= 0.7;
      const arr = freqRef.current;
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

  return (
    <div className="col" style={{
      gap: 22, height: "100%",
      justifyContent: "center", alignItems: "center",
      padding: "24px 20px 56px",
      position: "relative",
    }}>
      <StatusPill status={status} micState={micState} />

      <div
        onClick={status === "idle" ? startTurn : endTurn}
        style={{
          position: "relative",
          width: 440, height: 440,
          maxWidth: "min(82vw, 460px)",
          maxHeight: "min(82vw, 460px)",
          cursor: "pointer",
          borderRadius: "50%",
        }}
        title={status === "idle" ? "Start a turn" : "Tap to stop"}
      >
        {/* outer radial glow */}
        <div style={{
          position: "absolute", inset: -32, borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--accent) 18%, transparent) 0%, color-mix(in oklch, var(--accent-2) 8%, transparent) 35%, transparent 70%)",
          opacity: status === "idle" ? 0.55 : 1,
          filter: "blur(12px)",
          transition: "opacity 0.5s var(--ease)",
          pointerEvents: "none",
        }}></div>

        <PlasmaSphere
          status={status}
          energyRef={energyRef}
          beatRef={beatRef}
          freqRef={freqRef}
        />

        {/* idle hint */}
        <div style={{
          position: "absolute", inset: 0,
          display: "grid", placeItems: "center",
          pointerEvents: "none",
          opacity: status === "idle" ? 1 : 0,
          transition: "opacity 0.3s var(--ease)",
        }}>
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            padding: "12px 14px",
            background: "color-mix(in oklch, var(--paper) 85%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: 14,
            border: "1px solid var(--hairline-2)",
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{color: "var(--ink-2)"}}>
              <rect x="9" y="3" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0"/>
              <path d="M12 18v3"/>
            </svg>
            <div style={{fontSize: 11, fontWeight: 600, color: "var(--ink-3)", letterSpacing: 0.04, textTransform: "uppercase"}}>Tap to talk</div>
          </div>
        </div>

        {/* active hint */}
        {status !== "idle" && (
          <div style={{
            position: "absolute", left: "50%", bottom: -22, transform: "translateX(-50%)",
            fontSize: 11, fontWeight: 500, color: "var(--ink-4)",
            letterSpacing: 0.04, whiteSpace: "nowrap",
          }}>tap orb to stop</div>
        )}
      </div>

      {/* transcript & reply */}
      <div className="col" style={{gap: 10, width: "100%", maxWidth: 580, alignItems: "stretch", marginTop: 14}}>
        {(transcriptShown || transcript) && (
          <div className="card" style={{padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start", borderRadius: 14}}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--paper-2)", border: "1px solid var(--hairline)",
              display: "grid", placeItems: "center",
              fontSize: 10, fontWeight: 700, color: "var(--ink-3)",
              flexShrink: 0,
            }}>You</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div className="t-eyebrow" style={{marginBottom: 4, fontSize: 10, color: "var(--ink-4)"}}>Transcript</div>
              <div style={{fontSize: 14.5, color: "var(--ink)", lineHeight: 1.5, textWrap: "pretty"}}>
                {transcriptShown}
                {transcriptShown && transcriptShown.length < transcript.length && (
                  <span style={{
                    display: "inline-block", width: 6, height: 14, marginLeft: 1, marginBottom: -2,
                    background: "var(--accent)", verticalAlign: "middle",
                    animation: "voicecaret 0.8s steps(2) infinite",
                  }}></span>
                )}
              </div>
            </div>
          </div>
        )}
        {(replyShown || reply) && (
          <div className="card" style={{
            padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start",
            background: "color-mix(in oklch, var(--accent) 4%, var(--card))",
            borderColor: "color-mix(in oklch, var(--accent) 14%, var(--hairline))",
            borderRadius: 14,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "var(--accent)",
              display: "grid", placeItems: "center",
              fontSize: 10, fontWeight: 700, color: "white",
              flexShrink: 0,
              boxShadow: "0 2px 6px color-mix(in oklch, var(--accent) 30%, transparent)",
            }}>D</div>
            <div style={{flex: 1, minWidth: 0}}>
              <div className="t-eyebrow" style={{marginBottom: 4, fontSize: 10, color: "var(--ink-4)"}}>DocMind · {voice}</div>
              <div style={{fontSize: 14.5, color: "var(--ink)", lineHeight: 1.55, textWrap: "pretty"}}>
                {replyShown}
                {replyShown && replyShown.length < reply.length && (
                  <span style={{
                    display: "inline-block", width: 6, height: 14, marginLeft: 1, marginBottom: -2,
                    background: "var(--accent)", verticalAlign: "middle",
                    animation: "voicecaret 0.8s steps(2) infinite",
                  }}></span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* control row */}
      <div className="row" style={{gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 6}}>
        <button
          className="btn is-ghost is-sm"
          onClick={() => setMuted(m => !m)}
          style={{height: 36, padding: "0 12px", color: muted ? "oklch(58% 0.18 25)" : "var(--ink-2)"}}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}>
            {muted ? (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </>
            ) : (
              <>
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </>
            )}
          </svg>
          {muted ? "Unmute" : "Mute"}
        </button>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          height: 36, padding: "0 6px 0 12px",
          background: "var(--card)", border: "1px solid var(--hairline)", borderRadius: 100,
          fontSize: 12, fontWeight: 500, color: "var(--ink-2)",
        }}>
          <span style={{color: "var(--ink-4)", marginRight: 4}}>Voice</span>
          {["Aria", "Ben", "Nova"].map(name => (
            <button
              key={name}
              onClick={() => setVoice(name)}
              style={{
                border: 0, background: voice === name ? "var(--accent)" : "transparent",
                color: voice === name ? "white" : "var(--ink-2)",
                fontSize: 11.5, fontWeight: 600, padding: "5px 10px",
                borderRadius: 100, cursor: "pointer", lineHeight: 1,
              }}
            >{name}</button>
          ))}
        </div>

        {status !== "idle" ? (
          <button className="btn is-ghost is-sm" onClick={endTurn} style={{height: 36, padding: "0 16px"}}>End</button>
        ) : (
          <button className="btn is-accent is-sm" onClick={startTurn} style={{height: 36, padding: "0 16px"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}>
              <rect x="9" y="3" width="6" height="12" rx="3"/>
              <path d="M5 11a7 7 0 0 0 14 0"/>
              <path d="M12 18v3"/>
            </svg>
            Start talking
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
      `}</style>
    </div>
  );
}

window.ScreenVoiceChat = ScreenVoiceChat;
