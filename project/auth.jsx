// auth.jsx — Login & Signup

const { useState: useS5 } = React;

function AuthScreen({ onAuth, accent }) {
  const [mode, setMode] = useS5("login");
  const [form, setForm] = useS5({ name: "", email: "sam@school.edu", password: "••••••••" });
  const [shake, setShake] = useS5(false);

  function submit(e) {
    e.preventDefault();
    if (!form.email || !form.password) { setShake(true); setTimeout(() => setShake(false), 400); return; }
    onAuth({ name: form.name || form.email.split("@")[0], email: form.email });
  }

  return (
    <div className="auth-shell">
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, maxWidth: 980, width: "100%", alignItems: "center"}}>
        <div style={{display: "flex", flexDirection: "column", gap: 28, paddingRight: 20}}>
          <div className="row" style={{gap: 12}}>
            <div className="side-logo" style={{width: 36, height: 36, fontSize: 22}}>D</div>
            <div className="t-display" style={{fontSize: 28}}>Doc<em style={{color: "var(--accent)", fontStyle: "italic"}}>Mind</em></div>
          </div>
          <h1 className="t-display" style={{fontSize: 64, lineHeight: 1, letterSpacing: "-0.025em"}}>
            Read less.<br /><em className="t-italic">Understand more.</em>
          </h1>
          <p style={{color: "var(--ink-3)", fontSize: 16, lineHeight: 1.55, maxWidth: 420}}>
            A calm, considered study companion. Drop in a document and turn it into questions, cards, maps, and audio — without the noise.
          </p>
          <div className="col" style={{gap: 12, marginTop: 6}}>
            {["Talk to any document — with citations.", "Generate quizzes, mind maps, and audio recaps in seconds.", "Track streaks. Build the habit. Quietly."].map(t => (
              <div key={t} className="row" style={{gap: 10}}>
                <div style={{width: 18, height: 18, borderRadius: 50, background: "var(--accent-soft)", color: "var(--accent-ink)", display: "grid", placeItems: "center", flexShrink: 0}}>
                  <Icon name="check" size={11} className="" />
                </div>
                <span style={{fontSize: 14, color: "var(--ink-2)"}}>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <form onSubmit={submit} className="auth-card" style={{animation: shake ? "shake 0.4s" : "none"}}>
          <div className="t-eyebrow" style={{marginBottom: 8}}>{mode === "login" ? "Welcome back" : "Welcome aboard"}</div>
          <h2 className="t-display" style={{fontSize: 32, marginBottom: 24}}>{mode === "login" ? <>Sign <em className="t-italic">in</em>.</> : <>Create your <em className="t-italic">account</em>.</>}</h2>
          <div className="col" style={{gap: 14}}>
            {mode === "signup" && (
              <div><label className="field-label">Name</label><input className="input" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Sam Reyes" autoComplete="name" /></div>
            )}
            <div><label className="field-label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} autoComplete="email" /></div>
            <div><label className="field-label">Password</label><input className="input" type="password" value={form.password} onChange={e => setForm(f => ({...f, password: e.target.value}))} autoComplete="current-password" /></div>
            {mode === "login" && (
              <div className="row" style={{justifyContent: "space-between", fontSize: 13}}>
                <label className="row" style={{gap: 6, color: "var(--ink-2)"}}><input type="checkbox" defaultChecked /> Remember me</label>
                <a style={{color: "var(--accent)", textDecoration: "none"}} href="#">Forgot?</a>
              </div>
            )}
            <button className="btn is-accent is-lg is-block" type="submit">{mode === "login" ? "Sign in" : "Create account"} <Icon name="chevR" size={14} className="" /></button>
            <div className="row" style={{gap: 10, alignItems: "center", margin: "6px 0"}}>
              <div className="div-v" style={{flex: 1, height: 1, width: "auto"}}></div>
              <span className="muted" style={{fontSize: 11, letterSpacing: 0.1, textTransform: "uppercase"}}>or</span>
              <div className="div-v" style={{flex: 1, height: 1, width: "auto"}}></div>
            </div>
            <button type="button" className="btn is-ghost is-block">Continue with Google</button>
            <div style={{textAlign: "center", fontSize: 13, marginTop: 4, color: "var(--ink-3)"}}>
              {mode === "login" ? "New here?" : "Already have an account?"}{" "}
              <a style={{color: "var(--accent)", textDecoration: "none"}} href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "signup" : "login"); }}>
                {mode === "login" ? "Create an account" : "Sign in"}
              </a>
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
    </div>
  );
}
window.AuthScreen = AuthScreen;
