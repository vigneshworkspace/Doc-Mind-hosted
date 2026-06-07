// Shared generation-state UI for the honesty contract.
//
//   <DemoBadge/>                       — small "Demo data" pill. Render ONLY when
//                                        a response came back with isDemo === true
//                                        (i.e. no AI provider configured, demo path).
//   <ErrorRetry message onRetry/>      — inline failed state with a Retry button.
//                                        Shown when a generation call throws.
//
// Feature agents IMPORT these — never redefine them. Plain styling that matches
// the app's chip / button conventions (CSS custom properties from styles.css).

// Hoisted static styles — created once, not per render.
const badgeStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '2px 8px',
  fontSize: 11,
  fontWeight: 500,
  lineHeight: 1.4,
  letterSpacing: 0.02,
  borderRadius: 999,
  color: 'oklch(45% 0.13 75)',
  background: 'color-mix(in oklch, var(--warn), white 84%)',
  border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
  whiteSpace: 'nowrap',
};

const dotStyle = {
  width: 5,
  height: 5,
  borderRadius: '50%',
  background: 'var(--warn)',
  flexShrink: 0,
};

const errorWrapStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
  padding: '12px 14px',
  borderRadius: 'var(--radius-sm, 8px)',
  border: '1px solid color-mix(in oklch, var(--danger) 32%, var(--hairline))',
  background: 'color-mix(in oklch, var(--danger), var(--paper) 90%)',
  color: 'var(--ink)',
  fontSize: 13,
};

const errorMsgStyle = { flex: 1, minWidth: 160, color: 'color-mix(in oklch, var(--danger) 60%, var(--ink))' };

const retryBtnStyle = {
  flexShrink: 0,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 'var(--radius-sm, 8px)',
  border: '1px solid var(--hairline)',
  background: 'var(--card, var(--paper))',
  color: 'var(--ink)',
  cursor: 'pointer',
};

export function DemoBadge({ title = 'Showing built-in sample data — no AI provider configured' }) {
  return (
    <span style={badgeStyle} title={title} aria-label="Demo data">
      <span style={dotStyle} aria-hidden="true" />
      Demo data
    </span>
  );
}

export function ErrorRetry({ message = 'Generation failed — please retry.', onRetry }) {
  return (
    <div role="alert" style={errorWrapStyle}>
      <span style={errorMsgStyle}>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} style={retryBtnStyle}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default { DemoBadge, ErrorRetry };
