function ScreenHistory({ state, setTab }) {
  return (
    <div className="content-inner">
      <div className="t-eyebrow" style={{ marginBottom: 8 }}>Past</div>
      <h1 className="t-display" style={{ fontSize: 36, marginBottom: 24 }}>History</h1>
      <p style={{ color: "var(--ink-3)" }}>Everything you've made, in reverse chronological order.</p>
    </div>
  );
}

export default ScreenHistory;
