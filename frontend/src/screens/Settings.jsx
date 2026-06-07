function Switch({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 13, background: on ? 'var(--accent)' : 'var(--hairline)', border: 0, position: 'relative', cursor: 'pointer', transition: 'background 0.2s var(--ease)' }}
    >
      <div style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,.15)', transition: 'left 0.2s var(--ease)' }} />
    </button>
  );
}

function SettingsRow({ label, sub, children }) {
  return (
    <div className="row" style={{ padding: '14px 18px', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--hairline)', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 500, fontSize: 14 }}>{label}</div>
        {sub && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsGroup({ title, children }) {
  return (
    <div>
      <div className="t-eyebrow" style={{ marginBottom: 12 }}>{title}</div>
      <div className="card card-flush">{children}</div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { settings as settingsApi } from '../api/index.js';
import { api } from '../api/client.js';
import { ErrorRetry } from '../components/GenState.jsx';

// The UI state is camelCase (aiProvider, autoSave, …) but the backend PATCH body
// is snake_case. api/index.js normalizes snake -> camel on the way IN, but does
// NOT denormalize on the way OUT, so we map the camelCase keys back to snake_case
// here before sending the patch — otherwise the multi-word settings silently fail
// to persist. Keys without an underscore (language, notifications) pass through.
const SETTING_KEY_TO_SNAKE = {
  autoSave: 'auto_save',
  studyReminders: 'study_reminders',
  aiProvider: 'ai_provider',
  ollamaEndpoint: 'ollama_endpoint',
};

// The RAG/generation pipeline ignores the per-user ai_provider setting entirely:
// every call site hardcodes get_provider_with_fallback("gemini", ["groq",
// "nvidia", "ollama"]). Surface that real cascade read-only rather than a fake
// picker.
const ACTIVE_PROVIDER_CASCADE = 'Gemini → Groq → Nvidia';

export default function Settings({ state, dispatch }) {
  const s = state.settings;
  const [resetting, setResetting] = useState(false);
  // Honesty contract: on a failed get() we show an error + Retry rather than
  // silently presenting fabricated/default settings as if they were saved.
  const [loadError, setLoadError] = useState("");

  // Mount: load the real settings. On failure we surface ErrorRetry instead of
  // pretending the seeded defaults are the user's persisted settings.
  const reloadSettings = useCallback(() => {
    setLoadError("");
    settingsApi.get()
      .then(full => dispatch({ type: 'set-settings-full', settings: full }))
      .catch(e => setLoadError(e.message || "Couldn't load your settings — please retry."));
  }, [dispatch]);

  useEffect(() => { reloadSettings(); }, [reloadSettings]);

  function set(k, v) {
    dispatch({ type: 'set-settings', patch: { [k]: v } }); // optimistic
    const wireKey = SETTING_KEY_TO_SNAKE[k] || k;
    settingsApi.update({ [wireKey]: v }).catch(() => { /* optimistic update stays */ });
  }

  async function resetAll() {
    const ok = window.confirm('Reset all data? This permanently deletes your documents, quizzes, flashcards, mind maps, recaps, notes, groups, and history from the server. Your account and settings stay. This cannot be undone.');
    if (!ok) return;
    setResetting(true);
    try {
      await api.post('/settings/reset');
      dispatch({ type: 'reset-data' });
    } catch (e) {
      window.alert(`Reset failed: ${e.message}`);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="col" style={{ gap: 24, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div className="page-hero">
        <h1>Make it <em className="t-italic">yours.</em></h1>
        <p>Tune defaults. Toggle the things that get in your way.</p>
      </div>

      {loadError && <ErrorRetry message={loadError} onRetry={reloadSettings} />}

      <SettingsGroup title="Account">
        <SettingsRow label="Name" sub={state.user.email}>
          <input className="input" style={{ width: 240 }} value={state.user.name} onChange={e => dispatch({ type: 'set-user', patch: { name: e.target.value } })} />
        </SettingsRow>
        <SettingsRow label="Email">
          <input className="input" style={{ width: 240 }} value={state.user.email} onChange={e => dispatch({ type: 'set-user', patch: { email: e.target.value } })} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="AI">
        <SettingsRow label="Provider" sub="Inference runs through a fixed fallback cascade — not user-selectable">
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>{ACTIVE_PROVIDER_CASCADE}</span>
        </SettingsRow>
        <SettingsRow label="Language">
          <select className="input" style={{ width: 240 }} value={s.language} onChange={e => set('language', e.target.value)}>
            <option>English</option>
            <option>French</option>
            <option>Spanish</option>
            <option>German</option>
            <option>Hindi</option>
          </select>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Study">
        <SettingsRow label="Notifications" sub="Quiz reminders, group sessions, and study streaks">
          <Switch on={s.notifications} onChange={v => set('notifications', v)} />
        </SettingsRow>
        <SettingsRow label="Auto-save notes">
          <Switch on={s.autoSave} onChange={v => set('autoSave', v)} />
        </SettingsRow>
        <SettingsRow label="Study reminders" sub="Nudge me if I haven't opened a doc in a few days">
          <Switch on={s.studyReminders} onChange={v => set('studyReminders', v)} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Danger">
        <SettingsRow label="Reset all data" sub="Permanently deletes your documents, quizzes, flashcards, notes, and history from the server">
          <button className="btn is-ghost is-sm" style={{ color: 'var(--danger)' }} onClick={resetAll} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Reset'}
          </button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
