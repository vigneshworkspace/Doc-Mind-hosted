import { useState } from 'react';
import { Icon } from '../components/Shell.jsx';

export default function VoiceChat() {
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');

  function start() {
    if (status !== 'idle') return;
    setStatus('listening');
    setTranscript('');
    setReply('');
    setTimeout(() => { setTranscript('Explain entropy in one paragraph.'); setStatus('thinking'); }, 1600);
    setTimeout(() => {
      setReply('Entropy is a measure of disorder — or more precisely, the number of microscopic configurations that yield the same macroscopic state. A messy desk has more arrangements than a tidy one, so it has higher entropy.');
      setStatus('speaking');
    }, 2900);
    setTimeout(() => setStatus('idle'), 7000);
  }

  const colors = status === 'listening' ? 'var(--accent)' : status === 'speaking' ? 'var(--ok)' : 'var(--ink-3)';
  const label = status === 'idle' ? 'Hold to talk' : status === 'listening' ? 'Listening' : status === 'thinking' ? 'Thinking' : 'Speaking';

  return (
    <div className="col" style={{ gap: 32, height: '100%', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
      <div className="t-eyebrow">{label}</div>

      <div
        onClick={start}
        style={{ position: 'relative', width: 280, height: 280, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
      >
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `1.5px solid ${colors}`,
              opacity: status === 'idle' ? 0.2 + i * 0.1 : 0.4 - i * 0.1,
              transform: `scale(${0.6 + i * 0.2})`,
              animation: status !== 'idle' ? `voicepulse ${1.6 + i * 0.4}s ${i * 0.2}s ease-in-out infinite` : 'none',
            }}
          />
        ))}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: status === 'idle' ? 'var(--ink)' : 'var(--accent)',
            display: 'grid',
            placeItems: 'center',
            color: status === 'idle' ? 'var(--paper)' : 'white',
            transition: 'background 0.3s var(--ease)',
          }}
        >
          <Icon name="mic" size={36} className="" />
        </div>
      </div>

      {transcript && (
        <div className="card" style={{ maxWidth: 480, padding: '14px 18px' }}>
          <div className="t-eyebrow" style={{ marginBottom: 4 }}>You said</div>
          <div style={{ fontSize: 16, fontFamily: 'var(--f-display)' }}>{transcript}</div>
        </div>
      )}
      {reply && (
        <div className="card" style={{ maxWidth: 520, padding: '14px 18px', background: 'var(--ink)', color: 'var(--paper)', border: 0 }}>
          <div className="t-eyebrow" style={{ color: 'var(--ink-4)', marginBottom: 4 }}>DocMind</div>
          <div style={{ fontSize: 15, lineHeight: 1.55 }}>{reply}</div>
        </div>
      )}

      <style>{`@keyframes voicepulse { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.15); } }`}</style>
    </div>
  );
}
