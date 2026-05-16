function ScreenSettings({ state, dispatch }) {
  const { settings } = state;

  function patch(key, value) {
    dispatch({ type: 'set-settings', patch: { [key]: value } });
  }

  return (
    <div className="content-inner">
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>Configure</div>
      <h1 className="t-display" style={{ fontSize: 36, marginBottom: 32 }}>Settings</h1>
      <div className="card" style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: 20, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Notifications</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Study reminders and session alerts</div>
          </div>
          <input type="checkbox" checked={settings.notifications}
                 onChange={e => patch('notifications', e.target.checked)} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Auto-save</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Automatically save notes while editing</div>
          </div>
          <input type="checkbox" checked={settings.autoSave}
                 onChange={e => patch('autoSave', e.target.checked)} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600 }}>Study reminders</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>Daily nudges to keep your streak</div>
          </div>
          <input type="checkbox" checked={settings.studyReminders}
                 onChange={e => patch('studyReminders', e.target.checked)} />
        </div>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>AI Provider</div>
          <select className="input" value={settings.aiProvider}
                  onChange={e => patch('aiProvider', e.target.value)}>
            <option value="gemini">Gemini</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>
        {settings.aiProvider === 'ollama' && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Ollama Endpoint</div>
            <input className="input" value={settings.ollamaEndpoint}
                   onChange={e => patch('ollamaEndpoint', e.target.value)}
                   placeholder="http://localhost:11434" />
          </div>
        )}
      </div>
    </div>
  );
}

export default ScreenSettings;
