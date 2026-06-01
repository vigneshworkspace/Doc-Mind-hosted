import { useMemo } from 'react';

// LoaderHelix — Vite-JSX port of @elements/loader-helix.
// DNA double-helix: two strands of dots travel sinusoidally (offset by half a
// period) creating a 3D twist illusion. CSS-only animation.
//
// Props:
//   dots     number of rungs           default 12
//   speed    seconds per full cycle     default 2
//   variant  "dna" | "ribbon" | "minimal"  default "dna"
//   color    dot colour (any CSS color) default var(--accent)
//   className/style passthrough on the container

const MAX_DISP = 12;      // px sinusoidal swing
const DOT_SPACING = 6;    // px vertical gap per rung
const DOT = 5;            // px dot diameter

export default function LoaderHelix({
  dots = 12,
  speed = 2,
  variant = 'dna',
  color = 'var(--accent)',
  width = 48,
  className = '',
  style,
  ...rest
}) {
  const containerHeight = dots * DOT_SPACING;

  const dotPairs = useMemo(
    () =>
      Array.from({ length: dots }, (_, i) => ({
        index: i,
        delayA: (i / dots) * speed,
        delayB: (i / dots) * speed + speed / 2,
      })),
    [dots, speed],
  );

  const dotBase = {
    position: 'absolute',
    width: DOT,
    height: DOT,
    borderRadius: '50%',
    background: color,
    willChange: 'transform',
  };

  return (
    <output
      data-slot="loader-helix"
      aria-live="polite"
      aria-label="Loading"
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        width,
        height: containerHeight,
        gap: DOT_SPACING,
        color,
        ...style,
      }}
      {...rest}
    >
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Loading
      </span>

      {variant === 'ribbon' ? (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {dotPairs.map((pair) => (
            <div
              key={pair.index}
              style={{
                ...dotBase,
                left: '50%',
                top: pair.index * DOT_SPACING,
                opacity: 0.3 + (pair.index / dots) * 0.7,
                animation: `helix-ribbon ${speed}s ease-in-out infinite`,
                animationDelay: `${pair.delayA}s`,
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
          {dotPairs.map((pair) => (
            <div
              key={pair.index}
              style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', height: DOT_SPACING }}
            >
              <div style={{ ...dotBase, left: 'calc(50% - 12px)', animation: `helix-strand ${speed}s ease-in-out infinite`, animationDelay: `${pair.delayA}s` }} />
              <div style={{ ...dotBase, left: 'calc(50% - 12px)', animation: `helix-strand ${speed}s ease-in-out infinite`, animationDelay: `${pair.delayB}s` }} />
              {variant === 'dna' && (
                <span
                  style={{
                    position: 'absolute',
                    height: 1,
                    width: MAX_DISP * 2,
                    background: `color-mix(in oklch, ${color} 25%, transparent)`,
                    willChange: 'transform',
                    animation: `helix-rung ${speed}s ease-in-out infinite`,
                    animationDelay: `${pair.delayA}s`,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </output>
  );
}
