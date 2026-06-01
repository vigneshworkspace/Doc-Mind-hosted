import { useState, useEffect } from 'react';
import { Icon } from '../components/Shell.jsx';
import { notes as notesApi } from '../api/index.js';

export default function Notes({ state, dispatch }) {
  const [activeId, setActiveId] = useState(state.notes[0]?.id);
  const note = state.notes.find(n => n.id === activeId);
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');

  // Mount: load notes (fallback: keep mock notes)
  useEffect(() => {
    notesApi.list()
      .then(ns => dispatch({ type: 'set-notes', notes: ns }))
      .catch(() => { /* keep mock notes */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTitle(note?.title || '');
    setContent(note?.content || '');
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!note) return;
    try {
      await notesApi.update(note.id, { title, content });
      dispatch({ type: 'update-note', id: note.id, title, content });
    } catch {
      // Keep local state — will retry on next save
      dispatch({ type: 'update-note', id: note.id, title, content });
    }
  }

  async function add() {
    const n = { title: 'Untitled', content: '', subject: 'General', date: new Date().toISOString().slice(0, 10) };
    try {
      const created = await notesApi.create(n);
      dispatch({ type: 'add-note', note: created });
      setActiveId(created.id);
    } catch {
      const local = { ...n, id: Date.now() };
      dispatch({ type: 'add-note', note: local });
      setActiveId(local.id);
    }
  }

  async function handleDelete(noteId) {
    try {
      await notesApi.delete(noteId);
    } catch (err) {
      console.error('Delete failed:', err.message);
    }
    dispatch({ type: 'delete-note', id: noteId });
    if (activeId === noteId) {
      const remaining = state.notes.filter(n => n.id !== noteId);
      setActiveId(remaining[0]?.id);
    }
  }

  return (
    <div className="grid" style={{ gridTemplateColumns: '260px 1fr', gap: 18, height: 'calc(100vh - var(--top-h) - 56px)' }}>
      <div className="card card-flush" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="row" style={{ padding: '14px 14px 10px', justifyContent: 'space-between' }}>
          <h1 className="t-eyebrow" style={{ margin: 0 }}>Notes</h1>
          <button className="btn is-quiet is-sm" onClick={add}><Icon name="plus" size={12} className="" /></button>
        </div>
        <div className="scroll-area" style={{ flex: 1, padding: '0 8px 12px' }}>
          {state.notes.map(n => (
            <button
              key={n.id}
              className="lift"
              style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, background: n.id === activeId ? 'var(--paper-2)' : 'transparent', border: 0, marginBottom: 2, cursor: 'default' }}
              onClick={() => { save(); setActiveId(n.id); }}
            >
              <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</div>
              <div className="muted" style={{ fontSize: 11.5, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.subject} · {n.date}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {note ? (
          <>
            <input
              className="input"
              aria-label="Note title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={save}
              style={{ border: 0, background: 'transparent', fontFamily: 'var(--f-display)', fontSize: 36, padding: 0, height: 'auto', letterSpacing: '-0.02em' }}
            />
            <div className="row" style={{ gap: 8, marginTop: 6, marginBottom: 14 }}>
              <span className="chip">{note.subject}</span>
              <span className="muted" style={{ fontSize: 12 }}>{note.date}</span>
              <div className="spacer" />
              <span className="muted" style={{ fontSize: 12 }}>{content.trim().split(/\s+/).filter(Boolean).length} words</span>
              <button className="btn is-quiet is-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(note.id)}>Delete</button>
            </div>
            <textarea
              className="input scroll-area"
              value={content}
              onChange={e => setContent(e.target.value)}
              onBlur={save}
              aria-label="Note content"
              placeholder="Start writing…"
              style={{ flex: 1, border: 0, background: 'transparent', padding: 0, fontFamily: 'var(--f-body)', fontSize: 15, lineHeight: 1.7, resize: 'none' }}
            />
          </>
        ) : (
          <div className="muted" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>No note selected.</div>
        )}
      </div>
    </div>
  );
}
