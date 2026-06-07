import { useState, useEffect, useReducer, useMemo } from 'react';
import { initialState, reducer } from './data/index.js';
import useTweaks from './hooks/useTweaks.js';
import TweaksPanel, { TweakSection, TweakToggle, TweakColor, TweakRadio } from './components/TweaksPanel.jsx';
import { Sidebar, TopBar, CommandPalette } from './components/Shell.jsx';
import FoxCompanion from './components/Fox.jsx';
import LoaderHelix from './components/LoaderHelix.jsx';
import AuthScreen from './components/Auth.jsx';
import { getToken, clearToken } from './api/client.js';
import { auth as authApi } from './api/index.js';

// Dashboard is the landing screen — keep it static so first paint needs no
// extra round-trip. Every other screen (including the heavy AIChat) is loaded
// on demand via useScreen below.
import Dashboard from './screens/Dashboard.jsx';

const TWEAK_DEFAULTS = {
  accentPalette: ["#4F6BED", "#2DB48A", "#E8B43E", "#ffffff", "#18181b"],
  typePair: "serif-sans",
  density: "regular",
  sidebar: "expanded",
  fox: true,
  dark: false,
};

const PALETTES = [
  ["#4F6BED", "#2DB48A", "#E8B43E", "#ffffff", "#18181b"],
  ["#FF6B35", "#2EC4B6", "#FFC233", "#ffffff", "#1A1A2E"],
  ["#E5006D", "#2D6CDF", "#C7F65A", "#ffffff", "#0A0A1E"],
  ["#2A9D8F", "#E76F51", "#E9C46A", "#ffffff", "#264653"],
  ["#FF5E5B", "#9D4EDD", "#FFB400", "#ffffff", "#2A1B3D"],
  ["#1E40AF", "#DC2626", "#F59E0B", "#ffffff", "#1C1917"],
  ["#7C3AED", "#06B6D4", "#F472B6", "#ffffff", "#1E1B3A"],
  ["#16A34A", "#0891B2", "#CA8A04", "#ffffff", "#14532d"],
  ["#C2410C", "#B45309", "#15803D", "#ffffff", "#1c0a00"],
  ["#0F172A", "#E5006D", "#F59E0B", "#ffffff", "#0F172A"],
];

const TYPE_PAIRS = {
  "serif-sans":         { display: '"Instrument Serif", Georgia, serif', body: '"Inter Tight", -apple-system, sans-serif' },
  "sans-only":          { display: '"Inter Tight", -apple-system, sans-serif', body: '"Inter Tight", -apple-system, sans-serif' },
  "fraunces-newsreader":{ display: '"Newsreader", Georgia, serif', body: '"Inter Tight", sans-serif' },
  "mono-led":           { display: '"JetBrains Mono", monospace', body: '"Inter Tight", sans-serif' },
};

// Static loader map, hoisted to module scope so it isn't rebuilt every effect.
const SCREEN_LOADERS = {
  documents:      () => import('./screens/Library.jsx'),
  'ai-chat':      () => import('./screens/AIChat.jsx'),
  'quiz-generator': () => import('./screens/Quiz.jsx'),
  flashcards:     () => import('./screens/Flashcards.jsx'),
  'mind-map':     () => import('./screens/MindMap.jsx'),
  // Merged Diagram Maker + Concept Visualizer -> single Visualize screen.
  visualize:      () => import('./screens/Visualize.jsx'),
  'audio-recap':  () => import('./screens/AudioRecap.jsx'),
  'visual-ai':    () => import('./screens/VisualAI.jsx'),
  'voice-chat':   () => import('./screens/VoiceChat.jsx'),
  'study-notes':  () => import('./screens/Notes.jsx'),
  pomodoro:       () => import('./screens/Pomodoro.jsx'),
  settings:       () => import('./screens/Settings.jsx'),
  youtube:        () => import('./screens/YouTube.jsx'),
};

// Deferred screen loader — avoids a massive static import list at top
function useScreen(tab) {
  const [screens, setScreens] = useState({});
  useEffect(() => {
    if (SCREEN_LOADERS[tab] && !screens[tab]) {
      SCREEN_LOADERS[tab]().then(m => setScreens(s => ({ ...s, [tab]: m.default })));
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  return screens;
}

export default function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [state, dispatch] = useReducer(reducer, initialState);
  const screens = useScreen(tab);

  const [pomodoro, setPomodoro] = useState({
    mode: 'focus', running: false, seconds: 25 * 60,
    focusMin: 25, breakMin: 5, cycle: 1, todayCycles: 2,
  });

  useEffect(() => {
    if (!pomodoro.running) return;
    const id = setInterval(() => {
      setPomodoro(p => {
        if (p.seconds <= 1) {
          const nextMode = p.mode === 'focus' ? 'break' : 'focus';
          return { ...p, mode: nextMode, seconds: (nextMode === 'focus' ? p.focusMin : p.breakMin) * 60, cycle: nextMode === 'focus' ? p.cycle + 1 : p.cycle, todayCycles: nextMode === 'focus' ? p.todayCycles + 1 : p.todayCycles };
        }
        return { ...p, seconds: p.seconds - 1 };
      });
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoro.running]);

  // Apply tweaks → CSS custom properties
  useEffect(() => {
    const r = document.documentElement;
    const imp = 'important';
    const p = t.accentPalette || PALETTES[0];
    const [a1, a2, a3, paper, ink] = p;

    r.style.setProperty('--accent', a1, imp);
    r.style.setProperty('--accent-ink', `color-mix(in oklch, ${a1} 78%, black 22%)`, imp);
    r.style.setProperty('--accent-soft', `color-mix(in oklch, ${a1} 14%, white)`, imp);
    r.style.setProperty('--accent-2', a2 || '#2DB48A', imp);
    r.style.setProperty('--accent-2-soft', `color-mix(in oklch, ${a2 || '#2DB48A'} 14%, white)`, imp);
    r.style.setProperty('--accent-3', a3 || '#E8B43E', imp);
    r.style.setProperty('--accent-3-soft', `color-mix(in oklch, ${a3 || '#E8B43E'} 18%, white)`, imp);

    if (!t.dark) {
      r.style.setProperty('--paper', paper || '#ffffff', imp);
      r.style.setProperty('--paper-2', paper ? `color-mix(in oklch, ${paper} 88%, ${a1} 12%)` : 'oklch(98% 0.002 250)', imp);
      r.style.setProperty('--ink', ink || 'oklch(20% 0.012 260)', imp);
      r.style.setProperty('--card', paper || '#ffffff', imp);
    } else {
      r.style.removeProperty('--paper');
      r.style.removeProperty('--paper-2');
      r.style.removeProperty('--ink');
      r.style.removeProperty('--card');
    }

    const pair = TYPE_PAIRS[t.typePair] || TYPE_PAIRS['serif-sans'];
    r.style.setProperty('--f-display', pair.display, imp);
    r.style.setProperty('--f-body', pair.body, imp);

    document.body.classList.toggle('is-dark', !!t.dark);
    document.body.classList.toggle('is-compact', t.density === 'compact');
    document.body.classList.toggle('is-comfy', t.density === 'comfy');
    document.body.classList.toggle('is-regular', !t.density || t.density === 'regular');
  }, [t]);

  // Session restore on mount — if a stored JWT validates, skip the login screen
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authApi.me()
      .then(user => {
        dispatch({ type: 'set-user', patch: user });
        setLoggedIn(true);
      })
      .catch(() => {
        // Token expired or invalid — stay on login screen
        clearToken();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAuth(user) {
    dispatch({ type: 'set-user', patch: user });
    setLoggedIn(true);
  }

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
    dispatch({ type: 'set-user', patch: { name: '', email: '' } });
  }

  // A 401 from any API call (expired/invalid token) fires this event from
  // client.js. Drop to the login screen cleanly — NO window.location.reload(),
  // which caused the "flash in and bounce out" symptom.
  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Must run before any early return — hooks can't be conditional.
  const screenProps = useMemo(
    () => ({ state, dispatch, setTab, pomodoro, setPomodoro }),
    [state, pomodoro],
  );

  if (!loggedIn) {
    return (
      <>
        <AuthScreen onAuth={handleAuth} />
        <TweaksPanel />
      </>
    );
  }

  function renderScreen() {
    if (tab === 'dashboard') return <Dashboard {...screenProps} />;
    const Screen = screens[tab];
    if (!Screen) return (
      <div className="col" style={{ display: 'grid', placeItems: 'center', padding: 80, gap: 16 }}>
        <LoaderHelix dots={8} speed={1.8} variant="dna" />
        <span style={{ color: 'var(--ink-4)', fontSize: 12, letterSpacing: 0.12, textTransform: 'uppercase', fontFamily: "'JetBrains Mono', monospace" }}>Loading</span>
      </div>
    );
    return <Screen {...screenProps} />;
  }

  const flushTabs = ['ai-chat'];

  return (
    <div className={`app${t.sidebar === 'rail' ? ' is-rail' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}>
      <Sidebar
        tab={tab}
        setTab={x => { setTab(x); setMobileOpen(false); }}
        onLogout={handleLogout}
        user={state.user}
      />
      <div className="main">
        <TopBar
          tab={tab}
          dark={t.dark}
          onToggleDark={() => setTweak('dark', !t.dark)}
          onOpenSearch={() => setPaletteOpen(true)}
          onOpenMenu={() => setMobileOpen(true)}
          pomodoro={pomodoro}
          setPomodoro={setPomodoro}
          setTab={setTab}
          user={state.user}
          onLogout={handleLogout}
        />
        <main className={`content${flushTabs.includes(tab) ? ' is-flush' : ''}`} key={tab}>
          {renderScreen()}
        </main>
      </div>

      <FoxCompanion tab={tab} accent={(t.accentPalette || PALETTES[0])[0]} hidden={!t.fox} />

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} setTab={setTab} documents={state.documents} />

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakToggle label="Dark mode" value={t.dark} onChange={v => setTweak('dark', v)} />
        <TweakColor label="Palette" value={t.accentPalette} options={PALETTES} onChange={v => setTweak('accentPalette', v)} />
        <TweakSection label="Typography" />
        <TweakRadio label="Pairing" value={t.typePair} options={Object.keys(TYPE_PAIRS)} onChange={v => setTweak('typePair', v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={['compact', 'regular', 'comfy']} onChange={v => setTweak('density', v)} />
        <TweakRadio label="Sidebar" value={t.sidebar} options={['rail', 'expanded']} onChange={v => setTweak('sidebar', v)} />
        <TweakSection label="Companion" />
        <TweakToggle label="Fox mascot" value={t.fox} onChange={v => setTweak('fox', v)} />
      </TweaksPanel>
    </div>
  );
}
