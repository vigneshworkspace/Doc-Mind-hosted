import { useState } from 'react';
import { Icon } from '../components/Shell';
import MermaidView from '../components/MermaidView.jsx';
import { DemoBadge, ErrorRetry } from '../components/GenState.jsx';
import { visualize as visualizeApi } from '../api/index.js';

// Merged surface: the old Diagram Maker + Concept Visualizer in one screen.
// A mode toggle picks the `kind` sent to POST /visualize/generate:
//   diagram  -> prompt + style -> Mermaid source
//   concept  -> a concept      -> Mermaid graph + short explanation
// No seeded mock state: inputs start empty and nothing renders until generate.

const DIAGRAM_STYLES = [
  { label: 'Flow', value: 'flowchart' },
  { label: 'Sequence', value: 'sequenceDiagram' },
  { label: 'Class', value: 'classDiagram' },
  { label: 'State', value: 'stateDiagram-v2' },
];

const SUGGESTIONS = {
  diagram: ['How the HTTPS handshake works', 'A compiler pipeline', 'CI/CD deployment flow', 'OSI network model'],
  concept: ['Photosynthesis', 'Black holes', 'DNA replication', 'The Krebs cycle'],
};

const MODES = [
  { id: 'diagram', label: 'Diagram', hint: 'Describe a process or system — get boxes and arrows.' },
  { id: 'concept', label: 'Concept', hint: 'Drop a topic — get a labelled schematic and a short explanation.' },
];

function ScreenVisualize() {
  const [mode, setMode] = useState('diagram');
  const [input, setInput] = useState('');
  const [styleVal, setStyleVal] = useState('flowchart');

  const [mermaid, setMermaid] = useState('');
  const [explanation, setExplanation] = useState('');
  const [title, setTitle] = useState('');
  const [isDemo, setIsDemo] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const activeMode = MODES.find((m) => m.id === mode);

  function switchMode(next) {
    if (next === mode) return;
    setMode(next);
    // Clear the canvas — a diagram and a concept map are different artifacts.
    setMermaid('');
    setExplanation('');
    setTitle('');
    setError('');
    setIsDemo(false);
  }

  async function generate(override) {
    const value = (override ?? input).trim();
    if (!value || generating) return;
    if (override != null) setInput(override);

    setGenerating(true);
    setError('');
    setIsDemo(false);
    try {
      const r =
        mode === 'concept'
          ? await visualizeApi.generate(value, 'concept')
          : await visualizeApi.generate(value, 'diagram', { style: styleVal });
      setMermaid(r.mermaid || '');
      setExplanation(r.explanation || '');
      setTitle(value);
      setIsDemo(Boolean(r.isDemo));
    } catch (err) {
      setError(err.message || 'Could not generate this visualization.');
      setMermaid('');
      setExplanation('');
    } finally {
      setGenerating(false);
    }
  }

  const lastValue = (input || '').trim();
  const hasResult = Boolean(mermaid) && !generating;

  return (
    <div className="col" style={{ gap: 24 }}>
      <div className="page-hero">
        <h1>
          Visualize <em className="t-italic">anything.</em>
        </h1>
        <p>{activeMode.hint}</p>
      </div>

      {/* Mode toggle */}
      <div
        className="row"
        role="tablist"
        aria-label="Visualize mode"
        style={{
          gap: 4,
          padding: 4,
          alignSelf: 'flex-start',
          background: 'var(--paper-2)',
          border: '1px solid var(--hairline)',
          borderRadius: 999,
        }}
      >
        {MODES.map((m) => {
          const on = m.id === mode;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={on}
              onClick={() => switchMode(m.id)}
              className="row"
              style={{
                gap: 7,
                padding: '8px 18px',
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: 0.01,
                color: on ? 'var(--paper)' : 'var(--ink-2)',
                background: on ? 'var(--ink)' : 'transparent',
                transition: 'background .18s ease, color .18s ease',
              }}
            >
              <Icon name={m.id === 'concept' ? 'concept-visualizer' : 'visualize'} size={14} className="" />
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 18 }}>
        {/* Controls */}
        <div className="card">
          <div className="t-eyebrow" style={{ marginBottom: 14 }}>
            {mode === 'concept' ? 'Concept' : 'Prompt'}
          </div>
          <textarea
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'concept' ? 'A concept, equation, or process…' : 'Describe a process, system, or relationship…'}
            aria-label={mode === 'concept' ? 'Concept to visualize' : 'Diagram prompt'}
            style={{ minHeight: 110 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generate();
            }}
          />

          {mode === 'diagram' && (
            <div className="col" style={{ marginTop: 14, gap: 10 }}>
              <label className="field-label">Style</label>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {DIAGRAM_STYLES.map((s) => (
                  <button
                    key={s.value}
                    className={`btn is-sm ${styleVal === s.value ? '' : 'is-ghost'}`}
                    onClick={() => setStyleVal(s.value)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            className="btn is-accent"
            disabled={generating || !lastValue}
            onClick={() => generate()}
            style={{ marginTop: 16, width: '100%' }}
          >
            {generating ? (
              'Drawing…'
            ) : (
              <>
                <Icon name="sparkles" size={14} className="" /> {mode === 'concept' ? 'Visualize' : 'Generate'}
              </>
            )}
          </button>

          <div className="t-eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>
            Try
          </div>
          <div className="col" style={{ gap: 6 }}>
            {SUGGESTIONS[mode].map((s) => (
              <button
                key={s}
                onClick={() => generate(s)}
                disabled={generating}
                className="row"
                style={{
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'var(--paper-2)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 8,
                  cursor: generating ? 'default' : 'pointer',
                  color: 'var(--ink-2)',
                  fontSize: 13,
                  textAlign: 'left',
                }}
              >
                <span>{s}</span>
                <Icon name="chevR" size={12} className="" />
              </button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="card card-flush" style={{ minHeight: 460 }}>
          <div
            className="row"
            style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--hairline)',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div>
              <div className="t-eyebrow">{mode === 'concept' ? 'Schematic' : 'Result'}</div>
              <div style={{ fontFamily: 'var(--f-display)', fontSize: 18, marginTop: 2 }}>
                {title || (mode === 'concept' ? 'Concept map' : 'Diagram')}
              </div>
            </div>
            {isDemo && hasResult ? <DemoBadge /> : null}
          </div>

          <div
            style={{
              padding: 30,
              background: 'var(--paper-2)',
              backgroundImage: 'radial-gradient(circle, var(--hairline-2) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              minHeight: 380,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            {generating ? (
              <div className="t-eyebrow" style={{ color: 'var(--ink-3)' }}>
                Drawing…
              </div>
            ) : error ? (
              <ErrorRetry message={error} onRetry={() => generate()} />
            ) : mermaid ? (
              <MermaidView code={mermaid} />
            ) : (
              <div className="muted" style={{ fontSize: 13 }}>
                {mode === 'concept'
                  ? 'Enter a concept and hit Visualize.'
                  : 'Describe something and hit Generate.'}
              </div>
            )}
          </div>

          {mode === 'concept' && hasResult && explanation ? (
            <div style={{ padding: '20px 22px', borderTop: '1px solid var(--hairline)' }}>
              <div className="t-eyebrow" style={{ marginBottom: 8 }}>
                Explanation
              </div>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink-2)', maxWidth: 620 }}>{explanation}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default ScreenVisualize;
