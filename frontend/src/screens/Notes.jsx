function ScreenNotes({ state, dispatch }) {
  return (
    <div className="content-inner">
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>Write</div>
      <h1 className="t-display" style={{ fontSize: 36, marginBottom: 24 }}>Notes</h1>
      <p style={{ color: "var(--ink-3)" }}>Your personal study notes, with Markdown support.</p>
    </div>
  );
}

export default ScreenNotes;
