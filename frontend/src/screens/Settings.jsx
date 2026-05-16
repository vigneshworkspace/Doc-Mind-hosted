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

export default function Settings({ state, dispatch }) {
  const s = state.settings;
  function set(k, v) { dispatch({ type: 'set-settings', patch: { [k]: v } }); }

  return (
    <div className="col" style={{ gap: 24, maxWidth: 720, margin: '0 auto', width: '100%' }}>
      <div className="page-hero">
        <h1>Make it <em className="t-italic">yours.</em></h1>
        <p>Tune defaults. Toggle the things that get in your way.</p>
      </div>

      <SettingsGroup title="Account">
        <SettingsRow label="Name" sub={state.user.email}>
          <input className="input" style={{ width: 240 }} value={state.user.name} onChange={e => dispatch({ type: 'set-user', patch: { name: e.target.value } })} />
        </SettingsRow>
        <SettingsRow label="Email">
          <input className="input" style={{ width: 240 }} value={state.user.email} onChange={e => dispatch({ type: 'set-user', patch: { email: e.target.value } })} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="AI">
        <SettingsRow label="Provider" sub="Where AI inference happens">
          <select className="input" style={{ width: 240 }} value={s.aiProvider} onChange={e => set('aiProvider', e.target.value)}>
            <option value="gemini">Gemini · cloud</option>
            <option value="ollama">Ollama · local</option>
          </select>
        </SettingsRow>
        {s.aiProvider === 'ollama' && (
          <SettingsRow label="Endpoint">
            <input className="input" style={{ width: 240 }} value={s.ollamaEndpoint} onChange={e => set('ollamaEndpoint', e.target.value)} />
          </SettingsRow>
        )}
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
        <SettingsRow label="Reset all data" sub="Clears documents, quizzes, flashcards, notes, and history">
          <button className="btn is-ghost is-sm" style={{ color: 'var(--danger)' }}>Reset</button>
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}
