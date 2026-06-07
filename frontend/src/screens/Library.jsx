import { useState, useEffect } from 'react';
import { Icon } from '../components/Shell';
import { DocIcon } from './Dashboard';
import { documents as docsApi } from '../api/index.js';

function ScreenDocuments({ state, dispatch, setTab }) {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState("grid");
  const [uploadError, setUploadError] = useState('');
  const [pollIds, setPollIds] = useState([]); // doc ids being polled for processing

  // Mount: load real document list (fallback: mock data already in state)
  useEffect(() => {
    docsApi.list()
      .then(docs => dispatch({ type: 'set-documents', documents: docs }))
      .catch(() => { /* keep mock data as fallback */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll processing status for newly uploaded docs
  useEffect(() => {
    if (pollIds.length === 0) return;
    const id = setInterval(async () => {
      const remaining = [];
      for (const docId of pollIds) {
        try {
          const res = await docsApi.status(docId); // GET /documents/:id/status → { status }
          if (res.status !== 'ready') {
            remaining.push(docId);
          } else {
            // Refresh full list once doc is ready
            docsApi.list().then(docs => dispatch({ type: 'set-documents', documents: docs })).catch(() => {});
          }
        } catch {
          remaining.push(docId); // keep polling on transient error
        }
      }
      setPollIds(remaining);
    }, 3000);
    return () => clearInterval(id);
  }, [pollIds]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpload(file) {
    if (!file) return;
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const newDoc = await docsApi.upload(formData);
      dispatch({ type: 'set-documents', documents: [newDoc, ...state.documents] });
      if (newDoc.processing_status !== 'ready' && newDoc.status !== 'ready') {
        setPollIds(ids => [...ids, newDoc.id]);
      }
    } catch (err) {
      setUploadError(err.message || 'Upload failed.');
    }
  }

  function openFilePicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx,.txt';
    input.onchange = e => handleUpload(e.target.files[0]);
    input.click();
  }

  async function handleDelete(docId) {
    try {
      await docsApi.delete(docId);
      dispatch({ type: 'set-documents', documents: state.documents.filter(d => d.id !== docId) });
    } catch (err) {
      console.error('Delete failed:', err.message);
    }
  }
  const tags = ["all", ...new Set(state.documents.flatMap(d => d.tags))];
  const docs = state.documents.filter(d => {
    if (filter !== "all" && !d.tags.includes(filter)) return false;
    if (q && !d.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  // Upload entry point — opens the native file picker (real multipart POST).
  const addSample = openFilePicker;

  return (
    <div className="col" style={{gap: 24}}>
      <div className="masthead">
        <span>Library <em style={{fontStyle: "italic", textTransform: "none", letterSpacing: 0, color: "var(--ink-3)", marginLeft: 6, fontFamily: "var(--f-display)", fontSize: 14}}>Index</em></span>
        <span style={{display: "flex", gap: 22}}>
          <span>{state.documents.length} items</span>
          <span>{tags.length - 1} tags</span>
          <span>updated {state.documents[0]?.uploadDate}</span>
        </span>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "flex-end", paddingBottom: 18, borderBottom: "1px solid var(--hairline)", marginBottom: 8}}>
        <div>
          <h1 className="t-display" style={{fontSize: 56, lineHeight: 1.05, letterSpacing: "-0.025em"}}>Your <em className="t-italic">library</em>.</h1>
          <p style={{color: "var(--ink-3)", maxWidth: "56ch", marginTop: 12, fontSize: 14.5}}>Every document is searchable, summarizable, and ready to become a quiz, flashcard set, or mind map.</p>
        </div>
        <div className="marg" style={{maxWidth: 220}}>Tip<span className="fn">†</span> — drag a PDF anywhere on this page to upload.</div>
      </div>

      <div className="row" style={{gap: 10, flexWrap: "wrap"}}>
        <div className="topbar-search" style={{width: 280, height: 36, background: "var(--card)"}}>
          <Icon name="search" size={14} className="" />
          <input aria-label="Search documents" value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" style={{border: 0, outline: 0, background: "transparent", flex: 1, font: "inherit", fontSize: 13, color: "var(--ink)"}} />
        </div>
        <div className="row" style={{gap: 6, padding: 3, background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 9}}>
          {tags.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`btn is-sm ${filter === t ? "" : "is-quiet"}`} style={{height: 26, fontSize: 12, padding: "0 10px"}}>
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>
        <div className="spacer"></div>
        <div className="row" style={{gap: 2, padding: 2, background: "var(--paper-2)", border: "1px solid var(--hairline)", borderRadius: 8}}>
          <button onClick={() => setView("grid")} className={`btn is-sm ${view === "grid" ? "" : "is-quiet"}`} style={{height: 28, padding: "0 10px"}}>Grid</button>
          <button onClick={() => setView("list")} className={`btn is-sm ${view === "list" ? "" : "is-quiet"}`} style={{height: 28, padding: "0 10px"}}>List</button>
        </div>
        <button className="btn is-accent" onClick={openFilePicker}><Icon name="upload" size={14} className="" /> Upload</button>
      </div>

      {uploadError && (
        <div style={{ color: 'var(--err, #dc2626)', fontSize: 13, marginTop: -12 }}>{uploadError}</div>
      )}

      {view === "grid" ? (
        <div className="grid grid-3">
          {docs.map(d => (
            <div key={d.id} className="card lift" style={{display: "flex", flexDirection: "column", gap: 14, cursor: "default"}} onClick={() => setTab("ai-chat")}>
              <div style={{aspectRatio: "4/3", borderRadius: 10, background: "var(--paper-2)", border: "1px solid var(--hairline)", display: "grid", placeItems: "center", position: "relative"}}>
                <DocIcon ext={d.type} />
                <div style={{position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg, transparent 0, transparent 6px, color-mix(in oklch, var(--hairline) 50%, transparent) 6px, color-mix(in oklch, var(--hairline) 50%, transparent) 7px)", borderRadius: 10, pointerEvents: "none"}}></div>
              </div>
              <div>
                <div style={{fontWeight: 500, marginBottom: 4}}>{d.name}</div>
                <div className="muted" style={{fontSize: 12}}>{d.uploadDate} · {d.size}</div>
              </div>
              <div className="row" style={{gap: 6, flexWrap: "wrap"}}>{d.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
              <div className="row" style={{gap: 6, marginTop: 4}}>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("ai-chat"); }}>Ask</button>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("quiz-generator"); }}>Quiz</button>
                <button className="btn is-ghost is-sm" onClick={(e) => { e.stopPropagation(); setTab("flashcards"); }}>Cards</button>
                <button className="btn is-ghost is-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}>Delete</button>
              </div>
            </div>
          ))}
          <button className="card lift" onClick={addSample} style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "default", color: "var(--ink-3)", borderStyle: "dashed", minHeight: 200}}>
            <Icon name="plus" size={22} className="" />
            <div style={{fontFamily: "var(--f-display)", fontSize: 18}}>Add a document</div>
            <div className="muted" style={{fontSize: 12}}>PDF · DOCX · TXT</div>
          </button>
        </div>
      ) : (
        <div className="card card-flush">
          {docs.map((d, i) => (
            <div key={d.id} style={{display: "grid", gridTemplateColumns: "auto 1fr auto auto auto", gap: 16, alignItems: "center", padding: "14px 18px", borderBottom: i === docs.length - 1 ? 0 : "1px solid var(--hairline)"}}>
              <DocIcon ext={d.type} />
              <div>
                <div style={{fontWeight: 500}}>{d.name}</div>
                <div className="muted" style={{fontSize: 12}}>{d.uploadDate} · {d.size}</div>
              </div>
              <div className="row" style={{gap: 6}}>{d.tags.map(t => <span key={t} className="chip">{t}</span>)}</div>
              <button className="btn is-quiet is-sm" onClick={() => setTab("ai-chat")}>Ask →</button>
              <Icon name="chevR" size={14} className="" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScreenDocuments;
