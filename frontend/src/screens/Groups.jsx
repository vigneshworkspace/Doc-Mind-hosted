import { useState, useEffect } from 'react';
import { Icon } from '../components/Shell.jsx';
import { groups as groupsApi } from '../api/index.js';

export default function Groups({ state, dispatch }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', subject: '', description: '' });

  // Mount: load groups (fallback: keep mock groups)
  useEffect(() => {
    groupsApi.list()
      .then(gs => dispatch({ type: 'set-groups', studyGroups: gs }))
      .catch(() => { /* keep mock groups */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    const groupData = { name: draft.name || 'New group', subject: draft.subject || 'General', description: draft.description };
    try {
      const created = await groupsApi.create(groupData);
      dispatch({ type: 'add-group', group: created });
    } catch {
      dispatch({ type: 'add-group', group: { id: Date.now(), ...groupData, members: 1, nextSession: '' } });
    }
    setCreating(false);
    setDraft({ name: '', subject: '', description: '' });
  }

  async function handleJoin(groupId) {
    try {
      await groupsApi.join(groupId);
      const gs = await groupsApi.list();
      dispatch({ type: 'set-groups', studyGroups: gs });
    } catch (err) {
      console.error('Join group failed:', err.message);
    }
  }

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="page-hero">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1>Study, <em className="t-italic">together.</em></h1>
            <p>Form groups around a subject, schedule sessions, share notes.</p>
          </div>
          <button className="btn is-accent" onClick={() => setCreating(c => !c)}>
            <Icon name="plus" size={14} className="" /> New group
          </button>
        </div>
      </div>

      {creating && (
        <div className="card">
          <div className="grid grid-2" style={{ gap: 14, marginBottom: 14 }}>
            <div>
              <label className="field-label">Name</label>
              <input className="input" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Calculus Crew" />
            </div>
            <div>
              <label className="field-label">Subject</label>
              <input className="input" value={draft.subject} onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))} placeholder="Mathematics" />
            </div>
          </div>
          <label className="field-label">Description</label>
          <textarea className="input" value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="What will you focus on?" />
          <div className="row" style={{ gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn is-quiet" onClick={() => setCreating(false)}>Cancel</button>
            <button className="btn is-accent" onClick={create}>Create</button>
          </div>
        </div>
      )}

      <div className="grid grid-2">
        {state.studyGroups.map(g => (
          <div key={g.id} className="card lift" style={{ display: 'flex', flexDirection: 'column', gap: 14, cursor: 'default' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="chip is-accent">{g.subject}</span>
              <span className="muted" style={{ fontSize: 12 }}>{g.members} members</span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, lineHeight: 1.1 }}>{g.name}</div>
              <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{g.description}</p>
            </div>
            <div className="hairline" style={{ margin: '4px 0' }} />
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row" style={{ gap: -8 }}>
                {[...Array(Math.min(4, g.members))].map((_, i) => (
                  <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: `oklch(${60 + i * 5}% 0.06 ${50 + i * 60})`, border: '2px solid var(--card)', marginLeft: i === 0 ? 0 : -8, color: 'white', display: 'grid', placeItems: 'center', fontSize: 10, fontFamily: 'var(--f-display)', fontStyle: 'italic' }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
                {g.members > 4 && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--paper-2)', border: '2px solid var(--card)', marginLeft: -8, color: 'var(--ink-3)', display: 'grid', placeItems: 'center', fontSize: 10 }}>
                    +{g.members - 4}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn is-ghost is-sm">View</button>
                <button className="btn is-accent is-sm" onClick={() => handleJoin(g.id)}>Join</button>
              </div>
            </div>
            {g.nextSession && (
              <div className="card-tight" style={{ background: 'var(--paper-2)', padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: 'var(--ink-2)' }}>
                <span className="t-eyebrow" style={{ marginRight: 6 }}>Next</span> {g.nextSession}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
