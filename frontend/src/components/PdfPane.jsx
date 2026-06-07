import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { documents as docsApi } from '../api/index.js';
import { ErrorRetry } from './GenState.jsx';
import LoaderHelix from './LoaderHelix.jsx';

// PDF.js runs its parser in a Web Worker; Vite bundles the worker via the ?url
// import and hands us a hashed asset path. Set once at module load.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Collapse whitespace + lowercase so a chunk snippet (extracted by pypdf) has a
// fighting chance of matching PDF.js's own text extraction, which spaces things
// differently. Exact match is best-effort — the snippet ribbon is the guarantee.
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// Wrap the run of text-layer spans covering `snippet` with the highlight class.
// Returns the first highlighted span (for scroll-into-view), or null on no match.
function highlightSnippet(container, snippet) {
  const needle = norm(snippet);
  if (!container || needle.length < 4) return null;

  const spans = Array.from(container.querySelectorAll('span'));
  // Build the page's full normalized text + a map back to each span's range.
  let full = '';
  const ranges = [];
  for (const s of spans) {
    const t = norm(s.textContent);
    if (!t) continue;
    const start = full.length ? full.length + 1 : 0;
    if (full.length) full += ' ';
    full += t;
    ranges.push([start, full.length, s]);
  }

  let idx = full.indexOf(needle);
  let len = needle.length;
  // Long snippets rarely match end-to-end; fall back to the opening clause.
  if (idx === -1 && needle.length > 48) {
    const head = needle.slice(0, 48);
    idx = full.indexOf(head);
    len = head.length;
  }
  if (idx === -1) return null;

  const end = idx + len;
  let first = null;
  for (const [a, b, s] of ranges) {
    if (a < end && b > idx) {
      s.classList.add('pdfpane-hl');
      if (!first) first = s;
    }
  }
  return first;
}

export default function PdfPane({
  doc,            // { id, name, type } or null (snippet-only mode)
  page = 1,       // 1-based page to open to
  snippet = '',   // cited text to highlight
  onClose,
  asDrawer = false,   // true → fixed slide-over (narrow screens); false → in-flow split pane
}) {
  const isPdf = (doc?.type || '').toLowerCase().replace(/^\./, '') === 'pdf';
  const docId = doc?.id ?? null;
  const displayName = (doc?.name || '').replace(/\.[a-z0-9]+$/i, '') || (docId != null ? `Document ${docId}` : 'Source');

  // ── PDF state ──────────────────────────────────────────────
  const [pdf, setPdf] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [curPage, setCurPage] = useState(page || 1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errMsg, setErrMsg] = useState('');

  // ── Text-fallback state (non-PDF docs / snippet-only) ──────
  const [text, setText] = useState(null);

  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const bodyRef = useRef(null);
  const renderTaskRef = useRef(null);
  const unscaledWRef = useRef(0);

  // Reset to the requested page whenever the citation/doc changes.
  useEffect(() => { setCurPage(page || 1); }, [page, docId]);

  // ── Load the document ──────────────────────────────────────
  const load = useCallback(() => {
    setStatus('loading');
    setErrMsg('');
    setText(null);
    setPdf(null);

    // Snippet-only (no resolvable document) — just show the cited excerpt.
    if (docId == null) {
      setStatus('ready');
      return;
    }

    if (isPdf) {
      let cancelled = false;
      docsApi.file(docId)
        .then(async ({ blob }) => {
          const buf = await blob.arrayBuffer();
          if (cancelled) return;
          const task = pdfjsLib.getDocument({ data: buf });
          const _pdf = await task.promise;
          if (cancelled) { _pdf.destroy?.(); return; }
          setPdf(_pdf);
          setNumPages(_pdf.numPages);
          setCurPage((p) => clamp(p || 1, 1, _pdf.numPages));
          setStatus('ready');
        })
        .catch((e) => {
          if (!cancelled) { setErrMsg(e?.message || 'Could not load this PDF.'); setStatus('error'); }
        });
      return () => { cancelled = true; };
    }

    // Non-PDF (txt/docx/md) — browsers can't render these; show extracted text.
    docsApi.get(docId)
      .then((d) => { setText(d.parsedMd || d.content || ''); setStatus('ready'); })
      .catch((e) => { setErrMsg(e?.message || 'Could not load the document text.'); setStatus('error'); });
  }, [docId, isPdf]);

  useEffect(() => {
    const cleanup = load();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [load]);

  // Destroy the PDF worker doc on unmount / swap.
  useEffect(() => () => { try { pdf?.destroy?.(); } catch { /* noop */ } }, [pdf]);

  // ── Render the current page ────────────────────────────────
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return;
    try { renderTaskRef.current?.cancel(); } catch { /* noop */ }

    const pageObj = await pdf.getPage(clamp(curPage, 1, pdf.numPages));
    const unscaled = pageObj.getViewport({ scale: 1 });
    unscaledWRef.current = unscaled.width;

    // Fit-width: scale so the page fills the body (minus padding). User zoom
    // (fitWidth=false) wins.
    let useScale = scale;
    if (fitWidth && bodyRef.current) {
      const avail = bodyRef.current.clientWidth - 48; // 24px padding each side
      if (avail > 0) useScale = clamp(avail / unscaled.width, 0.4, 3);
    }

    const viewport = pageObj.getViewport({ scale: useScale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const task = pageObj.render({
      canvasContext: ctx,
      viewport,
      transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
    });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (e) {
      if (e?.name === 'RenderingCancelledException') return;
      throw e;
    }

    // Text layer (for snippet highlight). Positioned over the canvas; PDF.js
    // needs --scale-factor on the container to place spans correctly.
    const tl = textLayerRef.current;
    if (tl) {
      tl.innerHTML = '';
      tl.style.width = `${Math.floor(viewport.width)}px`;
      tl.style.height = `${Math.floor(viewport.height)}px`;
      tl.style.setProperty('--scale-factor', String(useScale));
      try {
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: pageObj.streamTextContent(),
          container: tl,
          viewport,
        });
        await textLayer.render();
        if (snippet) {
          const first = highlightSnippet(tl, snippet);
          if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      } catch { /* text layer is best-effort; canvas still renders */ }
    }
  }, [pdf, curPage, scale, fitWidth, snippet]);

  useEffect(() => { if (status === 'ready' && isPdf) renderPage(); }, [status, isPdf, renderPage]);

  // Re-fit on pane resize.
  useEffect(() => {
    if (!fitWidth || !bodyRef.current) return;
    const ro = new ResizeObserver(() => { if (fitWidth) renderPage(); });
    ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [fitWidth, renderPage]);

  // ── Controls ───────────────────────────────────────────────
  const go = (p) => setCurPage((c) => clamp(p, 1, numPages || 1));
  const zoom = (factor) => { setFitWidth(false); setScale((s) => clamp((s || 1) * factor, 0.4, 3)); };
  const zoomPct = useMemo(() => {
    if (!fitWidth) return Math.round(scale * 100);
    if (bodyRef.current && unscaledWRef.current) {
      return Math.round(clamp((bodyRef.current.clientWidth - 48) / unscaledWRef.current, 0.4, 3) * 100);
    }
    return 100;
  }, [scale, fitWidth, status, curPage]);

  // Text-fallback: split body around the snippet to highlight it (mirrors the
  // original SourceViewer behaviour).
  const textSegments = useMemo(() => {
    const snip = (snippet || '').trim();
    if (!text || !snip) return null;
    const idx = text.indexOf(snip);
    if (idx === -1) return null;
    return [text.slice(0, idx), snip, text.slice(idx + snip.length)];
  }, [text, snippet]);

  // ── Chrome ─────────────────────────────────────────────────
  const wrapStyle = asDrawer
    ? { position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end',
        background: 'color-mix(in oklch, var(--ink) 22%, transparent)' }
    : { display: 'flex', height: '100%', minWidth: 0 };

  const panelStyle = asDrawer
    ? { width: 'min(560px, 92vw)', height: '100%', background: 'var(--paper)',
        borderLeft: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(15,23,42,0.16)' }
    : { flex: '1 1 0', minWidth: 0, height: '100%', background: 'var(--paper)',
        display: 'flex', flexDirection: 'column' };

  const inner = (
    <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '18px 22px', borderBottom: '1px solid var(--hairline-2)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.12, color: 'var(--ink-4)',
            textTransform: 'uppercase', fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 4,
          }}>
            Source{isPdf && numPages ? ` · p. ${curPage} / ${numPages}` : ''}
          </div>
          <div style={{
            fontFamily: 'var(--f-display)', fontSize: 19, fontWeight: 600, color: 'var(--ink)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{displayName}</div>
        </div>
        <button
          type="button" onClick={onClose} aria-label="Close PDF pane"
          style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: 9,
            border: '1px solid var(--hairline)', background: 'var(--card)',
            display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--ink-3)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Snippet ribbon — always-correct view of what was cited */}
      {snippet && (
        <div style={{
          flexShrink: 0, padding: '10px 22px',
          borderBottom: '1px solid var(--hairline-2)',
          background: 'color-mix(in oklch, var(--accent-3, #E8B43E) 9%, var(--paper))',
          fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          <span style={{
            fontSize: 9.5, fontWeight: 700, letterSpacing: 0.1, color: 'var(--ink-4)',
            textTransform: 'uppercase', fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginRight: 8,
          }}>Cited</span>
          {snippet}
        </div>
      )}

      {/* Body */}
      <div ref={bodyRef} style={{
        flex: '1 1 auto', overflow: 'auto',
        background: isPdf ? 'var(--paper-2)' : 'var(--paper)',
        padding: isPdf ? '24px' : '20px 22px',
        display: isPdf ? 'flex' : 'block',
        justifyContent: 'center', alignItems: 'flex-start',
      }}>
        {status === 'loading' ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 40, margin: 'auto' }}>
            <LoaderHelix dots={6} speed={1.6} variant="dna" />
          </div>
        ) : status === 'error' ? (
          <div style={{ width: '100%', maxWidth: 420, margin: 'auto' }}>
            <ErrorRetry message={errMsg} onRetry={load} />
          </div>
        ) : isPdf ? (
          // Canvas "sheet"
          <div style={{
            position: 'relative', borderRadius: 10, overflow: 'hidden',
            background: 'var(--card)', boxShadow: '0 4px 18px rgba(15,23,42,0.10)',
            flexShrink: 0,
          }}>
            <canvas ref={canvasRef} style={{ display: 'block' }} />
            <div ref={textLayerRef} className="pdfpane-textlayer" />
          </div>
        ) : textSegments ? (
          <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', textWrap: 'pretty' }}>
            {textSegments[0]}
            <mark style={{
              background: 'color-mix(in oklch, var(--accent-3, #E8B43E) 38%, transparent)',
              color: 'var(--ink)', borderRadius: 3, padding: '1px 2px',
            }}>{textSegments[1]}</mark>
            {textSegments[2]}
          </div>
        ) : (text || docId == null) ? (
          // Non-PDF doc shown as text, or snippet-only mode.
          <div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginBottom: 10, fontStyle: 'italic' }}>
              {docId == null
                ? 'Showing the cited excerpt.'
                : `Preview unavailable for .${(doc?.type || 'file')} — showing extracted text.`}
            </div>
            <div style={{
              fontSize: 14, lineHeight: 1.72, color: 'var(--ink)', whiteSpace: 'pre-wrap', textWrap: 'pretty',
            }}>{text || snippet}</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', margin: 'auto', textAlign: 'center', maxWidth: 320 }}>
            Pick a document or tap a source to read it here.
          </div>
        )}
      </div>

      {/* Footer pager — PDF only */}
      {isPdf && status === 'ready' && (
        <div style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          padding: '12px 16px', borderTop: '1px solid var(--hairline-2)', background: 'var(--card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PagerBtn label="Previous page" disabled={curPage <= 1} onClick={() => go(curPage - 1)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18 9 12l6-6"/></svg>
            </PagerBtn>
            <span style={{
              fontSize: 11.5, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              minWidth: 78, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            }}>p. {curPage} / {numPages}</span>
            <PagerBtn label="Next page" disabled={curPage >= numPages} onClick={() => go(curPage + 1)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </PagerBtn>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PagerBtn label="Zoom out" onClick={() => zoom(1 / 1.2)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14"/></svg>
            </PagerBtn>
            <span style={{
              fontSize: 11, color: 'var(--ink-3)', fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              minWidth: 40, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
            }}>{zoomPct}%</span>
            <PagerBtn label="Zoom in" onClick={() => zoom(1.2)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            </PagerBtn>
            <button
              type="button" onClick={() => { setFitWidth(true); }} title="Fit width"
              style={{
                height: 28, padding: '0 10px', borderRadius: 100,
                border: `1px solid ${fitWidth ? 'color-mix(in oklch, var(--accent) 40%, var(--hairline))' : 'var(--hairline)'}`,
                background: fitWidth ? 'color-mix(in oklch, var(--accent) 10%, var(--card))' : 'var(--card)',
                color: fitWidth ? 'var(--accent-ink)' : 'var(--ink-3)',
                fontSize: 11, fontWeight: 500, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M21 16v3a2 2 0 0 1-2 2h-3"/></svg>
              Fit
            </button>
          </div>
        </div>
      )}

      <style>{`
        .pdfpane-textlayer { position: absolute; inset: 0; overflow: hidden; line-height: 1; text-align: initial; }
        .pdfpane-textlayer :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0 0; }
        .pdfpane-textlayer span.pdfpane-hl {
          background: color-mix(in oklch, var(--accent-3, #E8B43E) 42%, transparent);
          border-radius: 2px;
          box-shadow: 0 0 0 1px color-mix(in oklch, var(--accent-3, #E8B43E) 55%, transparent);
        }
      `}</style>
    </div>
  );

  if (asDrawer) {
    return <div role="dialog" aria-label="Document viewer" style={wrapStyle} onClick={onClose}>{inner}</div>;
  }
  return inner;
}

function PagerBtn({ children, onClick, disabled, label }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      style={{
        width: 28, height: 28, borderRadius: 100,
        border: '1px solid var(--hairline)', background: 'var(--card)',
        display: 'grid', placeItems: 'center',
        color: disabled ? 'var(--ink-4)' : 'var(--ink-2)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.12s, color 0.12s',
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--accent) 40%, var(--hairline))'; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--hairline)'; }}
    >{children}</button>
  );
}
