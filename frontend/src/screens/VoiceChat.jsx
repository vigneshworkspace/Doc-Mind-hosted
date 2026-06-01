import { useState, useRef, useEffect } from 'react';
import { Icon } from '../components/Shell.jsx';
import { getToken } from '../api/client.js';

export default function VoiceChat() {
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const wsRef = useRef(null);
  const mediaRef = useRef(null);
  const audioCtxRef = useRef(null);
  const statusRef = useRef('idle');

  // keep a ref in sync so ws.onclose can read the latest status
  useEffect(() => { statusRef.current = status; }, [status]);

  // Stop mic capture but KEEP the WebSocket open so the server can reply.
  function stopCapture() {
    try { mediaRef.current?.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    mediaRef.current = null;
    audioCtxRef.current = null;
  }

  // Full teardown — also closes the socket (used on unmount / abort).
  function teardown() {
    stopCapture();
    try { wsRef.current?.close(); } catch { /* noop */ }
    wsRef.current = null;
  }

  // Cleanup on unmount
  useEffect(() => () => teardown(), []);

  async function start() {
    if (status !== 'idle') {
      // Active session — signal end of utterance, stop the mic, but wait for the
      // reply. The socket is closed later, after audio plays (or on error/silence).
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send('END');
        stopCapture();
        setStatus('thinking');
      } else {
        teardown();
        setStatus('idle');
      }
      return;
    }

    setError('');
    setTranscript('');
    setReply('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRef.current = stream;
      setStatus('listening');

      const token = getToken();
      const wsUrl = `ws://localhost:8000/api/v1/voice/ws${token ? `?token=${token}` : ''}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'blob';
      wsRef.current = ws;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const pcm = e.inputBuffer.getChannelData(0);
        const buf = new Int16Array(pcm.length);
        for (let i = 0; i < pcm.length; i++) {
          buf[i] = Math.max(-32768, Math.min(32767, pcm[i] * 32768));
        }
        ws.send(buf.buffer);
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Backend sends PLAIN-TEXT prefixed messages + binary WAV Blob
      // (CORRECTIONS P6 issue 4) — NOT JSON.
      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const data = event.data;
          if (data.startsWith('TRANSCRIPT:')) {
            setTranscript(data.slice(11));
            setStatus('thinking');
          } else if (data.startsWith('REPLY:')) {
            setReply(data.slice(6));
            setStatus('speaking');
          } else if (data === 'PROCESSING') {
            setStatus('thinking');
          } else if (data === 'SILENCE') {
            setStatus('idle');
            teardown();
          } else if (data.startsWith('ERROR:')) {
            setError(data.slice(6));
            setStatus('idle');
            teardown();
          }
        } else if (event.data instanceof Blob) {
          // Binary WAV — final message of a turn. Play it, then close the socket.
          const audio = new Audio(URL.createObjectURL(event.data));
          audio.onended = () => { setStatus('idle'); teardown(); };
          audio.onerror = () => { setStatus('idle'); teardown(); };
          audio.play().catch(() => { setStatus('idle'); teardown(); });
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed. Is the backend running?');
        setStatus('idle');
      };

      ws.onclose = () => {
        try { source.disconnect(); } catch { /* noop */ }
        try { processor.disconnect(); } catch { /* noop */ }
        try { audioCtx.close(); } catch { /* noop */ }
        try { stream.getTracks().forEach(t => t.stop()); } catch { /* noop */ }
        if (statusRef.current !== 'idle') setStatus('idle');
      };
    } catch (err) {
      setError(err.message || 'Microphone access denied.');
      setStatus('idle');
    }
  }

  const colors = status === 'listening' ? 'var(--accent)' : status === 'speaking' ? 'var(--ok)' : 'var(--ink-3)';
  const label = status === 'idle' ? 'Tap to talk' : status === 'listening' ? 'Listening' : status === 'thinking' ? 'Thinking' : 'Speaking';

  return (
    <div className="col" style={{ gap: 32, height: '100%', justifyContent: 'center', alignItems: 'center', padding: '40px 20px' }}>
      <div className="t-eyebrow">{label}</div>

      {error && (
        <div style={{ color: 'var(--err, #dc2626)', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>{error}</div>
      )}

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
