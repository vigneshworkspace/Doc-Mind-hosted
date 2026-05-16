import React from 'react';

const voiceChatHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini Voice Chat - Plasma Visualizer</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700&family=Rajdhani:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-glow: #0ea5e9;
            --secondary-glow: #f59e0b;
            --accent-glow: #10b981;
            --danger-glow: #f43f5e;
            --purple-glow: #a855f7;
            --gold-glow: #facc15;
            --background-start: #020617;
            --background-end: #1e293b;
            --text-primary: #e2e8f0;
            --glass-primary: rgba(15, 23, 42, 0.7);
            --glass-secondary: rgba(30, 41, 59, 0.5);
        }
        
        body.light-theme {
            --primary-glow: #93c5fd;
            --secondary-glow: #f9a8d4;
            --accent-glow: #86efac;
            --danger-glow: #ef4444;
            --purple-glow: #c4b5fd;
            --gold-glow: #eab308;
            --background-start: #f1f5f9;
            --background-end: #e2e8f0;
            --text-primary: #1e293b;
            --glass-primary: rgba(255, 255, 255, 0.6);
            --glass-secondary: rgba(226, 232, 240, 0.7);
        }

        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Rajdhani', sans-serif;
            background: linear-gradient(135deg, var(--background-start) 0%, var(--background-end) 100%);
            overflow: hidden;
            color: var(--text-primary);
            position: relative;
            margin: 0;
            padding: 0;
            height: 100vh;
            transition: background 0.5s ease, color 0.5s ease;
        }

        /* --- Background Effects --- */
        .background-effects {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: -2;
        }
        .neural-bg {
            position: absolute; inset: 0; opacity: 0.05;
        }
        .neural-node {
            position: absolute; width: 3px; height: 3px; background: var(--primary-glow); border-radius: 50%; animation: pulse-node 5s ease-in-out infinite;
        }
        .neural-connection {
            position: absolute; height: 1px; background: linear-gradient(90deg, transparent, var(--primary-glow), transparent); animation: flow 4s linear infinite; opacity: 0.2;
        }
        .stars-bg {
             position: absolute; inset: 0;
        }
        .star {
            position: absolute; width: 2px; height: 2px; background: var(--text-primary); border-radius: 50%; animation: twinkle 4s infinite;
        }
        .floating-particles {
            position: absolute; inset: 0;
        }
        .particle {
            position: absolute; width: 2px; height: 2px; background: var(--accent-glow); border-radius: 50%; animation: float 20s linear infinite; opacity: 0.3;
        }

        .shooting-star {
            position: absolute;
            width: 2px;
            height: 80px;
            background: linear-gradient(to top, transparent, rgba(255, 255, 255, 0.7));
            border-radius: 50%;
            filter: drop-shadow(0 0 6px white);
            animation: shoot linear infinite;
        }
        body.light-theme .shooting-star {
             background: linear-gradient(to top, transparent, rgba(51, 65, 85, 0.5));
             filter: drop-shadow(0 0 6px #334155);
        }

        @keyframes shoot {
            from {
                transform: translateY(-100px) translateX(-100px) rotate(45deg);
                opacity: 1;
            }
            to {
                transform: translateY(calc(100vh + 100px)) translateX(calc(100vw + 100px)) rotate(45deg);
                opacity: 0;
            }
        }


        @keyframes pulse-node { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes flow { 0% { transform: scaleX(0); } 50% { transform: scaleX(1); opacity: 0.8; } 100% { transform: scaleX(0); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
        @keyframes float { 0% { transform: translateY(100vh); opacity: 0; } 10% { opacity: 0.3; } 90% { opacity: 0.3; } 100% { transform: translateY(-20px); opacity: 0; } }

        /* --- Visualizer --- */
        #visualizer-container {
            position: relative;
            width: min(90vw, 400px);
            height: min(90vw, 400px);
            max-width: 400px;
            max-height: 400px;
            cursor: grab;
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        #visualizer-container:active { cursor: grabbing; }
        #visualizer-container.listening {
            animation: neural-pulse 1.5s ease-in-out infinite;
        }
        @keyframes neural-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        #visualizer-container canvas { display: block; width: 100%; height: 100%; }

        /* --- UI Overlay --- */
        #ui-overlay {
            position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; border-radius: 50%; z-index: 10;
        }
        #ui-overlay.connecting::before {
            content: ''; position: absolute; width: 150px; height: 150px; border-radius: 50%; border: 3px solid transparent; border-top-color: var(--primary-glow); border-right-color: rgba(14, 165, 233, 0.3); animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        #ui-icon {
            width: 70px; height: 70px; color: var(--text-primary); transition: all 0.3s ease; z-index: 15; pointer-events: auto; cursor: pointer; filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
        }
        body.light-theme #ui-icon {
            filter: drop-shadow(0 0 10px rgba(0,0,0,0.2));
        }
        #ui-icon:hover { transform: scale(1.1); filter: drop-shadow(0 0 15px var(--primary-glow)); }
        #ui-text {
            position: absolute; bottom: 18%; font-family: 'Orbitron', sans-serif; font-size: 1rem; text-shadow: 0 0 5px rgba(255, 255, 255, 0.7); opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
        }
        body.light-theme #ui-text {
             text-shadow: 0 0 5px rgba(0,0,0,0.3);
        }
        #ui-icon:hover + #ui-text { opacity: 1; }

        /* --- Glass Panels & Controls --- */
        .glass-panel {
            background: var(--glass-primary); backdrop-filter: blur(15px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1.5rem; box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.4);
            transition: background 0.5s ease;
        }
        body.light-theme .glass-panel {
            border-color: rgba(0,0,0,0.05);
            box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
        }
        .control-button {
            width: 44px; height: 44px; background: var(--glass-secondary); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 50%; cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center;
        }
        body.light-theme .control-button {
             border-color: rgba(0,0,0,0.1);
        }
        .control-button:hover { background: rgba(30, 41, 59, 0.8); transform: translateY(-2px); }
        body.light-theme .control-button:hover { background: rgba(203, 213, 225, 0.8); }
        .control-button.active { box-shadow: 0 0 15px var(--accent-glow); }
        .control-button.danger { box-shadow: 0 0 15px var(--danger-glow); }
        .control-button svg { width: 55%; height: 55%; }

        /* --- Audio & Status --- */
        .audio-levels { display: flex; gap: 4px; align-items: end; height: 20px; }
        .audio-bar { width: 3px; background: linear-gradient(to top, var(--primary-glow), var(--secondary-glow)); border-radius: 2px; transition: height 0.1s ease; min-height: 2px; }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; position: relative; }
        .status-dot::before { content: ''; position: absolute; inset: -2px; border-radius: 50%; background: inherit; opacity: 0.3; animation: status-pulse 2s ease-in-out infinite; }
        .status-dot.connected { background: var(--accent-glow); }
        .status-dot.simulated { background: var(--gold-glow); }
        .status-dot.disconnected { background: #64748b; }
        @keyframes status-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }

        /* --- Settings Panel --- */
        .settings-panel {
            position: fixed; top: 20px; right: 20px; width: 300px; max-height: 80vh; overflow-y: auto; transform: translateX(110%); transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1); z-index: 1000;
        }
        .settings-panel.open { transform: translateX(0); }
        .setting-group { margin-bottom: 20px; }
        .setting-group h4 { margin: 0 0 10px 0; font-size: 0.9rem; color: var(--primary-glow); font-weight: 600; letter-spacing: 1px; }
        .setting-item { margin-bottom: 12px; }
        .setting-label { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 6px; }
        .setting-value { font-size: 0.8rem; color: var(--accent-glow); font-weight: 600; }
        .setting-range { width: 100%; height: 5px; border-radius: 2px; background: rgba(0,0,0, 0.1); outline: none; cursor: pointer; }
        .setting-select { width: 100%; padding: 8px; background: var(--glass-secondary); border: 1px solid rgba(0,0,0, 0.1); border-radius: 8px; color: var(--text-primary); font-size: 0.9rem; }

        /* --- Toast Notifications --- */
        .toast {
            position: fixed; top: 80px; left: 50%; transform: translateX(-50%) translateY(-120px); padding: 1rem 1.5rem; border-radius: 0.75rem; font-size: 0.95rem; z-index: 2000; display: none; backdrop-filter: blur(15px); border: 1px solid; font-family: 'Orbitron', sans-serif; box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3); transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toast.show { transform: translateX(-50%) translateY(0); display: block; }
        .toast.error { background: rgba(244, 63, 94, 0.8); color: white; border-color: var(--danger-glow); }
        .toast.warning { background: rgba(245, 158, 11, 0.8); color: white; border-color: var(--secondary-glow); }
        .toast.success { background: rgba(16, 185, 129, 0.8); color: white; border-color: var(--accent-glow); }
        .toast.info { background: rgba(14, 165, 233, 0.8); color: white; border-color: var(--primary-glow); }

        /* Responsive Design */
        @media (max-width: 768px) {
            .settings-panel { width: calc(100vw - 40px); }
            #visualizer-container { width: min(85vw, 350px); height: min(85vw, 350px); }
        }
    </style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen p-4">
    <!-- Background Effects -->
    <div class="background-effects">
        <div class="neural-bg" id="neural-bg"></div>
        <div class="stars-bg" id="stars-container"></div>
        <div class="floating-particles" id="floating-particles"></div>
    </div>
    
    <!-- Settings Panel -->
    <div id="settings-panel" class="settings-panel glass-panel p-5">
        <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-bold text-white flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8.21 5.15a1.5 1.5 0 00-1.01.39l-1.42-1.42a2.12 2.12 0 00-3 3L4.2 8.54a1.5 1.5 0 00-.4 1.01l-1.92.3a2.12 2.12 0 000 3.98l1.92.3a1.5 1.5 0 00.4 1.01l-1.42 1.42a2.12 2.12 0 003 3l1.42-1.42a1.5 1.5 0 001.01.39l.3 1.98c.38 1.56 2.6 1.56 2.98 0l.3-1.98a1.5 1.5 0 001.01-.39l1.42 1.42a2.12 2.12 0 003-3l-1.42-1.42a1.5 1.5 0 00.39-1.01l1.98-.3a2.12 2.12 0 000-3.98l-1.98-.3a1.5 1.5 0 00-.39-1.01l1.42-1.42a2.12 2.12 0 00-3-3l-1.42 1.42a1.5 1.5 0 00-1.01-.39L11.49 3.17zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>
                Settings
            </h3>
            <button id="close-settings" class="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>
        <div class="setting-group">
            <h4>Audio</h4>
            <div class="setting-item">
                <label class="setting-label"><span>Sensitivity</span><span class="setting-value" id="audio-sensitivity-value">1.5</span></label>
                <input type="range" id="audio-sensitivity" class="setting-range" min="0.1" max="5.0" value="1.5" step="0.1">
            </div>
             <div class="setting-item">
                <label class="setting-label"><span>Smoothing</span><span class="setting-value" id="smoothing-value">0.8</span></label>
                <input type="range" id="smoothing" class="setting-range" min="0.1" max="0.95" value="0.8" step="0.05">
            </div>
        </div>
    </div>
    
    <!-- Main Content -->
    <div class="flex flex-col items-center justify-center flex-grow w-full">
        <div id="visualizer-container">
            <div id="ui-overlay">
                <div id="ui-icon"></div>
                <span id="ui-text">Initialize</span>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <footer class="w-full max-w-md mx-auto py-4">
        <div class="glass-panel p-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div id="connection-status" class="status-dot disconnected"></div>
                <div class="text-xs sm:text-sm text-slate-400">
                    <div id="connection-text">Link Inactive</div>
                    <div class="audio-levels mt-1" id="audio-levels">
                        <div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div><div class="audio-bar"></div>
                    </div>
                </div>
            </div>
            <div class="flex gap-2">
                <div id="theme-toggle" class="control-button" title="Toggle Theme"></div>
                <div id="mute-toggle" class="control-button" title="Mute/Unmute (M)"></div>
                <div id="settings-toggle" class="control-button" title="Settings">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </div>
            </div>
        </div>
        <p class="text-center text-slate-500 text-xs mt-3">
            Press <kbd class="px-2 py-1 text-xs font-semibold text-gray-300 bg-gray-600 border border-gray-500 rounded-lg">Space</kbd> to connect.
        </p>
    </footer>

    <!-- Toast Notifications -->
    <div id="toast" class="toast"></div>
    <audio id="audio-output" style="display: none;"></audio>
    
    <script>
        // --- Configuration & State ---
        const CONFIG = {
            audio: { sensitivity: 1.5, smoothing: 0.8, fftSize: 512 },
        };
        const STATE = {
            audio: { smoothedEnergy: 0, frequencyBands: new Array(5).fill(0), isMuted: false },
            connection: { status: 'disconnected', peerConnection: null, dataChannel: null, webrtc_id: null },
            ui: { isConnecting: false, theme: 'dark' },
        };
        let audioContext;
        let analyser_input, dataArray_input, analyser_output, dataArray_output;
        let analyser, dataArray;
        let source_input = null, source_output = null;
        let analysisAnimationId;
        let peerConnection = null;
        let dataChannel;
        let webrtc_id;
        const audioOutput = document.getElementById('audio-output');

        // --- Background Effects ---
        function createBackgrounds() {
            const bgContainer = document.querySelector('.background-effects');
            const neuralContainer = document.getElementById('neural-bg');
            for (let i = 0; i < 30; i++) {
                const node = document.createElement('div'); node.className = 'neural-node';
                node.style.left = \`\${Math.random()*100}%\`; node.style.top = \`\${Math.random()*100}%\`;
                node.style.animationDelay = \`\${Math.random()*5}s\`; neuralContainer.appendChild(node);
            }
            for (let i = 0; i < 50; i++) {
                const conn = document.createElement('div'); conn.className = 'neural-connection';
                conn.style.left = \`\${Math.random()*100}%\`; conn.style.top = \`\${Math.random()*100}%\`;
                conn.style.width = \`\${Math.random()*150+50}px\`; conn.style.transform = \`rotate(\${Math.random()*360}deg)\`;
                conn.style.animationDelay = \`\${Math.random()*4}s\`; neuralContainer.appendChild(conn);
            }
            const starsContainer = document.getElementById('stars-container');
            for (let i = 0; i < 100; i++) {
                const star = document.createElement('div'); star.className = 'star';
                star.style.left = \`\${Math.random()*100}%\`; star.style.top = \`\${Math.random()*100}%\`;
                star.style.animationDelay = \`\${Math.random()*4}s\`; starsContainer.appendChild(star);
            }
            const particleContainer = document.getElementById('floating-particles');
            setInterval(() => {
                if (particleContainer.children.length < 15) {
                    const p = document.createElement('div'); p.className = 'particle';
                    p.style.left = \`\${Math.random()*100}%\`; p.style.animationDuration = \`\${Math.random()*15+10}s\`;
                    particleContainer.appendChild(p); setTimeout(() => p.remove(), 25000);
                }
            }, 1500);
        }

        // --- 3D Visualizer System ---
        const visualizerContainer = document.getElementById('visualizer-container');
        let scene, camera, renderer, plasmaSphere, uniforms;
        const mouse = new THREE.Vector2(-10, -10);

        function initVisualizer() {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
            camera.position.z = 2.5;
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(visualizerContainer.clientWidth, visualizerContainer.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            visualizerContainer.insertBefore(renderer.domElement, visualizerContainer.firstChild);
            
            createPlasmaSphere();
            startRenderLoop();
        }

        function createPlasmaSphere() {
            const geometry = new THREE.SphereGeometry(1.2, 64, 64);
            
            uniforms = {
                uTime: { value: 0.0 },
                uAudioEnergy: { value: 0.0 },
                uFrequencyData: { value: STATE.audio.frequencyBands },
                uColor1: { value: new THREE.Color() },
                uColor2: { value: new THREE.Color() },
                uColor3: { value: new THREE.Color() },
            };
            updateThemeColors();

            const material = new THREE.ShaderMaterial({
                uniforms,
                vertexShader: getPlasmaVertexShader(),
                fragmentShader: getPlasmaFragmentShader(),
            });

            plasmaSphere = new THREE.Mesh(geometry, material);
            scene.add(plasmaSphere);
        }

        function getPlasmaVertexShader() {
            return \`
                uniform float uTime;
                uniform float uAudioEnergy;
                varying vec3 vNormal;
                
                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - 0.5;
                    i = mod289(i);
                    vec4 p = vec4( dot(i, vec3(1.0, 57.0, 21.0)) + vec4(0.0, 57.0, 21.0, 78.0) );
                    p = fract(sin(p) * 43758.5453);
                    vec4 j = p - 49.0 * floor(p / 49.0);
                    vec4 x_ = floor(j / 7.0);
                    vec4 y_ = floor(j - 7.0 * x_);
                    vec4 x = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
                    vec4 y = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }

                void main() {
                    vNormal = normal;
                    float displacement = snoise(normal * 3.0 + uTime * 0.5) * 0.08 * (1.0 + uAudioEnergy * 2.5);
                    vec3 newPosition = position + normal * displacement;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            \`;
        }

        function getPlasmaFragmentShader() {
            return \`
                uniform float uTime;
                uniform float uAudioEnergy;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                varying vec3 vNormal;

                vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
                float snoise(vec3 v) {
                    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
                    vec3 i  = floor(v + dot(v, C.yyy) );
                    vec3 x0 = v - i + dot(i, C.xxx) ;
                    vec3 g = step(x0.yzx, x0.xyz);
                    vec3 l = 1.0 - g;
                    vec3 i1 = min( g.xyz, l.zxy );
                    vec3 i2 = max( g.xyz, l.zxy );
                    vec3 x1 = x0 - i1 + C.xxx;
                    vec3 x2 = x0 - i2 + C.yyy;
                    vec3 x3 = x0 - 0.5;
                    i = mod289(i);
                    vec4 p = vec4( dot(i, vec3(1.0, 57.0, 21.0)) + vec4(0.0, 57.0, 21.0, 78.0) );
                    p = fract(sin(p) * 43758.5453);
                    vec4 j = p - 49.0 * floor(p / 49.0);
                    vec4 x_ = floor(j / 7.0);
                    vec4 y_ = floor(j - 7.0 * x_);
                    vec4 x = (x_ * 2.0 + 0.5) / 7.0 - 1.0;
                    vec4 y = (y_ * 2.0 + 0.5) / 7.0 - 1.0;
                    vec4 h = 1.0 - abs(x) - abs(y);
                    vec4 b0 = vec4( x.xy, y.xy );
                    vec4 b1 = vec4( x.zw, y.zw );
                    vec4 s0 = floor(b0)*2.0 + 1.0;
                    vec4 s1 = floor(b1)*2.0 + 1.0;
                    vec4 sh = -step(h, vec4(0.0));
                    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
                    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
                    vec3 p0 = vec3(a0.xy,h.x);
                    vec3 p1 = vec3(a0.zw,h.y);
                    vec3 p2 = vec3(a1.xy,h.z);
                    vec3 p3 = vec3(a1.zw,h.w);
                    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
                    m = m * m;
                    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
                }

                float fbm(vec3 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 2.0;
                    for (int i = 0; i < 5; i++) {
                        value += amplitude * snoise(p * frequency);
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    return value;
                }

                void main() {
                    float noise = fbm(vNormal * 2.0 + uTime * 0.3 * (1.0 + uAudioEnergy * 3.0));
                    
                    vec3 color = mix(uColor1, uColor2, smoothstep(0.0, 0.8, uAudioEnergy));
                    color = mix(color, uColor3, noise);
                    
                    float intensity = 0.4 + uAudioEnergy * 0.8 + pow(noise, 2.0) * 0.3;
                    
                    float fresnel = 1.0 - dot(vNormal, vec3(0.0, 0.0, 1.0));
                    fresnel = pow(fresnel, 2.0);
                    
                    vec3 finalColor = color * intensity + fresnel * uColor1 * 0.5;
                    
                    gl_FragColor = vec4(finalColor, 1.0);
                }
            \`;
        }

        const clock = new THREE.Clock();
        function startRenderLoop() {
            function animate() {
                const elapsedTime = clock.getElapsedTime();
                if (uniforms) {
                    uniforms.uTime.value = elapsedTime;
                    uniforms.uAudioEnergy.value = STATE.audio.smoothedEnergy;
                    uniforms.uFrequencyData.value = STATE.audio.frequencyBands;
                }
                if (plasmaSphere) { plasmaSphere.rotation.y += 0.0005; }
                
                renderer.render(scene, camera);
                requestAnimationFrame(animate);
            }
            animate();
        }

        // --- Audio Analysis ---
        // Audio analysis is now handled by updateVisualization() and updateAudioLevel() functions

        // --- UI & Connection Management ---
        const uiElements = {
            icon: document.getElementById('ui-icon'), text: document.getElementById('ui-text'),
            muteToggle: document.getElementById('mute-toggle'),
            themeToggle: document.getElementById('theme-toggle'),
            connectionStatus: document.getElementById('connection-status'),
            connectionText: document.getElementById('connection-text'),
        };
        const icons = {
            mic: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>\`,
            stop: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>\`,
            volumeOn: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>\`,
            volumeOff: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>\`,
            sun: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>\`,
            moon: \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>\`,
        };

        function updateUI() {
            const overlay = document.getElementById('ui-overlay');
            overlay.classList.remove('connecting');
            uiElements.icon.style.opacity = 1;

            if (STATE.ui.isConnecting || (peerConnection && ['connecting', 'new'].includes(peerConnection.connectionState))) {
                overlay.classList.add('connecting');
                uiElements.icon.innerHTML = ''; 
                uiElements.text.textContent = 'Connecting...';
            } else if (STATE.connection.status === 'connected' || (peerConnection && peerConnection.connectionState === 'connected')) {
                uiElements.icon.innerHTML = icons.stop; 
                uiElements.text.textContent = 'Disconnect';
                uiElements.icon.onclick = stopWebRTC;
                STATE.connection.status = 'connected';
            } else {
                uiElements.icon.innerHTML = icons.mic; 
                uiElements.text.textContent = 'Initialize';
                uiElements.icon.onclick = setupWebRTC;
                STATE.connection.status = 'disconnected';
            }
            uiElements.connectionStatus.className = \`status-dot \${STATE.connection.status}\`;
            uiElements.connectionText.textContent = STATE.connection.status === 'connected' ? 'Link Active' : 'Link Inactive';
            uiElements.muteToggle.innerHTML = STATE.audio.isMuted ? icons.volumeOff : icons.volumeOn;
            uiElements.muteToggle.classList.toggle('danger', STATE.audio.isMuted);
            uiElements.muteToggle.classList.toggle('active', !STATE.audio.isMuted && STATE.connection.status === 'connected');
            uiElements.themeToggle.innerHTML = STATE.ui.theme === 'dark' ? icons.sun : icons.moon;
        }

        function showToast(message, type = 'info', duration = 4000) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.className = \`toast \${type} show\`;
            setTimeout(() => toast.classList.remove('show'), duration);
        }

        async function setupWebRTC() {
            if (STATE.connection.status === 'connected') return;
            
            STATE.ui.isConnecting = true;
            updateUI();
            
            const config = __RTC_CONFIGURATION__;
            peerConnection = new RTCPeerConnection(config);
            webrtc_id = Math.random().toString(36).substring(7);
            const timeoutId = setTimeout(() => {
                showToast("Connection is taking longer than usual. Are you on a VPN?", 'warning');
            }, 5000);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
                if (!audioContext || audioContext.state === 'closed') {
                    audioContext = new AudioContext();
                }
                if (source_input) {
                    try { source_input.disconnect(); } catch (e) { console.warn("Error disconnecting previous input source:", e); }
                    source_input = null;
                }
                source_input = audioContext.createMediaStreamSource(stream);
                analyser_input = audioContext.createAnalyser();
                source_input.connect(analyser_input);
                analyser_input.fftSize = 64;
                dataArray_input = new Uint8Array(analyser_input.frequencyBinCount);
                updateAudioLevel();
                peerConnection.addEventListener('connectionstatechange', () => {
                    console.log('connectionstatechange', peerConnection.connectionState);
                    if (peerConnection.connectionState === 'connected') {
                        clearTimeout(timeoutId);
                        const toast = document.getElementById('error-toast');
                        if (toast) toast.style.display = 'none';
                        STATE.connection.status = 'connected';
                        showToast('Connected to Gemini AI!', 'warning');
                        
                        // Start audio analysis for visualizer
                        if (analyser_input) updateAudioLevel();
                        if (analyser) updateVisualization();
                    } else if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
                        // Explicitly stop animations if connection drops unexpectedly
                        // Note: stopWebRTC() handles the normal stop case
                    }
                    updateUI();
                });
                peerConnection.onicecandidate = ({ candidate }) => {
                    if (candidate) {
                        console.debug("Sending ICE candidate", candidate);
                        fetch('/webrtc/offer', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                candidate: candidate.toJSON(),
                                webrtc_id: webrtc_id,
                                type: "ice-candidate",
                            })
                        })
                    }
                };
                peerConnection.addEventListener('track', (evt) => {
                    if (evt.track.kind === 'audio' && audioOutput) {
                        if (audioOutput.srcObject !== evt.streams[0]) {
                            audioOutput.srcObject = evt.streams[0];
                            audioOutput.play().catch(e => console.error("Audio play failed:", e));
                            if (!audioContext || audioContext.state === 'closed') {
                                console.warn("AudioContext not ready for output track analysis.");
                                return;
                            }
                            if (source_output) {
                                try { source_output.disconnect(); } catch (e) { console.warn("Error disconnecting previous output source:", e); }
                                source_output = null;
                            }
                            source_output = audioContext.createMediaStreamSource(evt.streams[0]);
                            analyser = audioContext.createAnalyser();
                            source_output.connect(analyser);
                            analyser.fftSize = 2048;
                            dataArray = new Uint8Array(analyser.frequencyBinCount);
                            updateVisualization();
                        }
                    }
                });
                dataChannel = peerConnection.createDataChannel('text');
                dataChannel.onmessage = (event) => {
                    const eventJson = JSON.parse(event.data);
                    if (eventJson.type === "error") {
                        showToast(eventJson.message, 'error');
                    } else if (eventJson.type === "send_input") {
                        fetch('/input_hook', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                webrtc_id: webrtc_id,
                                api_key: "",
                                voice_name: ""
                            })
                        });
                    }
                };
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                const response = await fetch('/webrtc/offer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sdp: peerConnection.localDescription.sdp,
                        type: peerConnection.localDescription.type,
                        webrtc_id: webrtc_id,
                    })
                });
                const serverResponse = await response.json();
                if (serverResponse.status === 'failed') {
                    showToast(serverResponse.meta.error === 'concurrency_limit_reached'
                        ? \`Too many connections. Maximum limit is \${serverResponse.meta.limit}\`
                        : serverResponse.meta.error, 'error');
                    stopWebRTC();
                    return;
                }
                await peerConnection.setRemoteDescription(serverResponse);
            } catch (err) {
                clearTimeout(timeoutId);
                console.error('Error setting up WebRTC:', err);
                showToast('Failed to establish connection. Please try again.', 'error');
                stopWebRTC();
            }
            
            STATE.ui.isConnecting = false;
            updateUI();
        }
        


        function stopWebRTC() {
            console.log("Running stopWebRTC");
            if (peerConnection) {
                peerConnection.getSenders().forEach(sender => {
                    if (sender.track) {
                        sender.track.stop();
                    }
                });
                peerConnection.ontrack = null;
                peerConnection.onicegatheringstatechange = null;
                peerConnection.onconnectionstatechange = null;
                if (dataChannel) {
                    dataChannel.onmessage = null;
                    try { dataChannel.close(); } catch (e) { console.warn("Error closing data channel:", e); }
                    dataChannel = null;
                }
                try { peerConnection.close(); } catch (e) { console.warn("Error closing peer connection:", e); }
                peerConnection = null;
            }
            if (audioOutput) {
                audioOutput.pause();
                audioOutput.srcObject = null;
            }
            if (source_input) {
                try { source_input.disconnect(); } catch (e) { console.warn("Error disconnecting input source:", e); }
                source_input = null;
            }
            if (source_output) {
                try { source_output.disconnect(); } catch (e) { console.warn("Error disconnecting output source:", e); }
                source_output = null;
            }
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().then(() => {
                    console.log("AudioContext closed successfully.");
                    audioContext = null;
                }).catch(e => {
                    console.error("Error closing AudioContext:", e);
                    audioContext = null;
                });
            } else {
                audioContext = null;
            }
            analyser_input = null;
            dataArray_input = null;
            analyser = null;
            dataArray = null;
            STATE.connection.status = 'disconnected';
            STATE.audio.isMuted = false;
            STATE.audio.smoothedEnergy = 0;
            STATE.audio.frequencyBands.fill(0);
            updateUI();
            
            // Reset visualizer state
            visualizerContainer.classList.remove('listening');
            const bars = document.querySelectorAll('.audio-bar');
            bars.forEach(bar => bar.style.height = '2px');
        }

        function toggleMute(event) {
            event.stopPropagation();
            if (STATE.connection.status !== 'connected' || !peerConnection) return;
            
            STATE.audio.isMuted = !STATE.audio.isMuted;
            // Control the actual audio track
            peerConnection.getSenders().forEach(sender => {
                if (sender.track?.kind === 'audio') {
                    sender.track.enabled = !STATE.audio.isMuted;
                }
            });
            updateUI();
        }
        
        function toggleTheme() {
            STATE.ui.theme = STATE.ui.theme === 'dark' ? 'light' : 'dark';
            document.body.classList.toggle('light-theme', STATE.ui.theme === 'light');
            localStorage.setItem('plasmaTheme', STATE.ui.theme);
            updateThemeColors();
            updateUI();
        }

        function updateThemeColors() {
            if (!uniforms) return;
            const style = getComputedStyle(document.body);
            uniforms.uColor1.value.set(style.getPropertyValue('--primary-glow'));
            uniforms.uColor2.value.set(style.getPropertyValue('--secondary-glow'));
            uniforms.uColor3.value.set(style.getPropertyValue('--purple-glow'));
        }

        // --- Settings Management ---
        function initSettings() {
            const settingsPanel = document.getElementById('settings-panel');
            document.getElementById('settings-toggle').addEventListener('click', () => settingsPanel.classList.toggle('open'));
            document.getElementById('close-settings').addEventListener('click', () => settingsPanel.classList.remove('open'));
            
            document.getElementById('audio-sensitivity').addEventListener('input', e => {
                CONFIG.audio.sensitivity = parseFloat(e.target.value);
                document.getElementById('audio-sensitivity-value').textContent = CONFIG.audio.sensitivity.toFixed(1);
            });
            document.getElementById('smoothing').addEventListener('input', e => {
                CONFIG.audio.smoothing = parseFloat(e.target.value);
                document.getElementById('smoothing-value').textContent = CONFIG.audio.smoothing.toFixed(2);
            });
        }

        // --- Event Listeners & Initialization ---
        function initialize() {
            const savedTheme = localStorage.getItem('plasmaTheme');
            if (savedTheme) {
                STATE.ui.theme = savedTheme;
                document.body.classList.toggle('light-theme', savedTheme === 'light');
            }

            createBackgrounds();
            initVisualizer();
            initSettings();
            updateUI();
            
            uiElements.muteToggle.addEventListener('click', toggleMute);
            uiElements.themeToggle.addEventListener('click', toggleTheme);
            window.addEventListener('resize', () => {
                if (!renderer || !camera) return;
                const width = visualizerContainer.clientWidth; const height = visualizerContainer.clientHeight;
                camera.aspect = width / height; camera.updateProjectionMatrix();
                renderer.setSize(width, height);
            });
            document.addEventListener('keydown', (e) => {
                if (e.code === 'Space') { e.preventDefault(); (STATE.connection.status === 'connected') ? stopWebRTC() : setupWebRTC(); }
                if (e.code === 'KeyM') { e.preventDefault(); toggleMute(new Event('click')); }
                if (e.code === 'Escape') { document.getElementById('settings-panel').classList.remove('open'); }
            });
            
            setTimeout(() => showToast('Interface Ready • Press Space to Initialize', 'info', 6000), 1000);
        }

        function updateVisualization() {
            if (!analyser || !peerConnection || !['connected', 'connecting'].includes(peerConnection.connectionState)) {
                // Reset audio energy when not connected
                STATE.audio.smoothedEnergy = 0;
                return;
            }
            analyser.getByteFrequencyData(dataArray);
            
            // Calculate audio energy from output audio (Gemini's voice)
            const outputAvg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            const outputEnergy = (outputAvg / 255) * CONFIG.audio.sensitivity;
            
            // Update the smoothed energy for the 3D visualizer
            STATE.audio.smoothedEnergy = STATE.audio.smoothedEnergy * CONFIG.audio.smoothing + outputEnergy * (1 - CONFIG.audio.smoothing);
            
            // Update frequency bands for the visualizer
            const bandCount = STATE.audio.frequencyBands.length;
            for (let i = 0; i < bandCount; i++) {
                const startIndex = Math.floor((i / bandCount) * dataArray.length);
                const endIndex = Math.floor(((i + 1) / bandCount) * dataArray.length);
                const bandData = dataArray.slice(startIndex, endIndex);
                const bandAvg = bandData.reduce((a, b) => a + b, 0) / bandData.length;
                STATE.audio.frequencyBands[i] = (bandAvg / 255) * CONFIG.audio.sensitivity;
            }
            
            requestAnimationFrame(updateVisualization);
        }
        
        function updateAudioLevel() {
            if (!analyser_input || !peerConnection || !['connected', 'connecting'].includes(peerConnection.connectionState)) {
                // Reset input audio level when not connected
                return;
            }
            analyser_input.getByteFrequencyData(dataArray_input);
            
            // Calculate input audio level for UI feedback
            const inputAvg = dataArray_input.reduce((a, b) => a + b, 0) / dataArray_input.length;
            const inputEnergy = (inputAvg / 255) * CONFIG.audio.sensitivity;
            
            // Update audio bars in the footer
            const bars = document.querySelectorAll('.audio-bar');
            bars.forEach((bar, index) => {
                const height = Math.max(2, (dataArray_input[index] / 255) * 18);
                bar.style.height = \`\${height}px\`;
            });
            
            // Update visualizer container class for listening state
            visualizerContainer.classList.toggle('listening', inputEnergy > 0.02);
            
            requestAnimationFrame(updateAudioLevel);
        }

        initialize();
    </script>
</body>
</html>
`;

const VoiceChatVisualizer: React.FC = () => {
  return (
    <div className="w-full h-full bg-dark-bg rounded-2xl overflow-hidden animate-fadeIn">
      <iframe
        srcDoc={voiceChatHtml}
        title="Gemini Voice Chat Visualizer"
        className="w-full h-full border-0"
        allow="microphone"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
};

export default VoiceChatVisualizer;
