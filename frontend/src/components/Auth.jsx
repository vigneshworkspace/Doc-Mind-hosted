import { useState } from 'react';
import { Icon } from './Shell';
import { auth as authApi } from '../api/index.js';
import { setToken } from '../api/client.js';

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [notice, setNotice] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.email || !form.password) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      return;
    }

    setLoading(true);
    try {
      let data;
      if (mode === 'login') {
        data = await authApi.login(form.email, form.password);
      } else {
        if (!form.name) {
          setError('Name is required for signup.');
          setLoading(false);
          return;
        }
        data = await authApi.signup(form.name, form.email, form.password);
      }

      // Store JWT and hand off to App ("Remember me" → persistent storage).
      // The API layer runs every response through `normalize` (snake→camel), so
      // the OAuth `access_token` arrives as `accessToken`. Read both shapes so a
      // missing token never gets stored as the string "undefined" (which causes
      // a "Bearer undefined" 401 on the next call → instant bounce to login).
      const token = data.accessToken || data.access_token;
      if (!token) throw new Error('Login succeeded but no token was returned. Please retry.');
      setToken(token, remember);
      onAuth({ name: data.name || form.name || form.email.split('@')[0], email: form.email });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60, maxWidth: 980, width: '100%', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingRight: 20 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="side-logo" style={{ width: 36, height: 36, fontSize: 22 }}>D</div>
            <div className="t-display" style={{ fontSize: 28 }}>Doc<em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>Mind</em></div>
          </div>
          <h1 className="t-display" style={{ fontSize: 64, lineHeight: 1, letterSpacing: '-0.025em' }}>
            Read less.<br /><em className="t-italic">Understand more.</em>
          </h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 16, lineHeight: 1.55, maxWidth: 420 }}>
            A calm, considered study companion. Drop in a document and turn it into questions, cards, maps, and audio — without the noise.
          </p>
          <div className="col" style={{ gap: 12, marginTop: 6 }}>
            {[
              'Talk to any document — with citations.',
              'Generate quizzes, mind maps, and audio recaps in seconds.',
              'Track streaks. Build the habit. Quietly.',
            ].map(t => (
              <div key={t} className="row" style={{ gap: 10 }}>
                <div style={{ width: 18, height: 18, borderRadius: 50, background: 'var(--accent-soft)', color: 'var(--accent-ink)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name="check" size={11} className="" />
                </div>
                <span style={{ fontSize: 14, color: 'var(--ink-2)' }}>{t}</span>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="auth-card" style={{ animation: shake ? 'shake 0.4s' : 'none' }}>
          <div className="t-eyebrow" style={{ marginBottom: 8 }}>{mode === 'login' ? 'Welcome back' : 'Welcome aboard'}</div>
          <h2 className="t-display" style={{ fontSize: 32, marginBottom: 24 }}>
            {mode === 'login' ? <>Sign <em className="t-italic">in</em>.</> : <>Create your <em className="t-italic">account</em>.</>}
          </h2>

          {/* Error banner */}
          {error && (
            <div style={{
              padding: '10px 14px',
              marginBottom: 16,
              background: 'color-mix(in oklch, var(--err, #dc2626) 10%, var(--card))',
              border: '1px solid color-mix(in oklch, var(--err, #dc2626) 30%, var(--hairline))',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--err, #dc2626)',
              lineHeight: 1.4,
            }}>
              {error}
            </div>
          )}

          <div className="col" style={{ gap: 14 }}>
            {mode === 'signup' && (
              <div>
                <label className="field-label">Name</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Sam Reyes"
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            )}
            <div>
              <label className="field-label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                autoComplete="email"
                disabled={loading}
              />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
                disabled={loading}
              />
            </div>
            {mode === 'login' && (
              <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <label className="row" style={{ gap: 6, color: 'var(--ink-2)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
                </label>
                <a
                  style={{ color: 'var(--accent)', textDecoration: 'none' }}
                  href="#"
                  onClick={(e) => { e.preventDefault(); setNotice('Password reset isn’t available yet. Contact your administrator to reset it.'); }}
                >Forgot?</a>
              </div>
            )}
            {notice && (
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)', background: 'var(--paper-2)', border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 12px', lineHeight: 1.45 }}>
                {notice}
              </div>
            )}
            <button className="btn is-accent is-lg is-block" type="submit" disabled={loading}>
              {loading
                ? 'Please wait…'
                : mode === 'login'
                  ? 'Sign in'
                  : 'Create account'}{' '}
              {!loading && <Icon name="chevR" size={14} className="" />}
            </button>
            <div style={{ textAlign: 'center', fontSize: 13, marginTop: 4, color: 'var(--ink-3)' }}>
              {mode === 'login' ? 'New here?' : 'Already have an account?'}{' '}
              <a
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
                href="#"
                onClick={(e) => { e.preventDefault(); setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              >
                {mode === 'login' ? 'Create an account' : 'Sign in'}
              </a>
            </div>
          </div>
        </form>
      </div>
      <style>{`@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }`}</style>
    </div>
  );
}

export default AuthScreen;
