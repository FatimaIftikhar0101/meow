'use client';

/**
 * Constellation cat — a celestial line-drawing of a sitting cat in profile.
 * Bright "named" stars at every anatomy point are connected by thin faint
 * gold lines (like Big Dipper diagrams), surrounded by a sparse field of
 * scattered pinprick stars and a single dashed celestial ring.
 *
 * Reads as artistic and ethereal — the launcher's background flourish,
 * sitting just above the globe.
 */

type StarId =
  | 'ear-l' | 'ear-r' | 'crown'
  | 'eye-l' | 'eye-r' | 'nose' | 'chin' | 'neck'
  | 'shoulder' | 'back-top' | 'back-mid' | 'hip'
  | 'tail-base' | 'tail-mid' | 'tail-tip'
  | 'paw-fl' | 'paw-fr' | 'paw-h';

interface Star { id: StarId; x: number; y: number; r: number; spike?: boolean; pulse?: boolean }

const STARS: Star[] = [
  // Head
  { id: 'ear-l', x: -48, y: -130, r: 2.6, spike: true },
  { id: 'ear-r', x:  -2, y: -130, r: 2.6, spike: true },
  { id: 'crown', x: -25, y: -110, r: 1.5 },
  { id: 'eye-l', x: -38, y:  -82, r: 2.4, spike: true, pulse: true },
  { id: 'eye-r', x: -12, y:  -82, r: 2.4, spike: true, pulse: true },
  { id: 'nose',  x: -25, y:  -58, r: 1.8 },
  { id: 'chin',  x: -25, y:  -42, r: 1.2 },
  { id: 'neck',  x: -25, y:  -25, r: 1.6 },
  // Body
  { id: 'shoulder', x: -10, y: -10, r: 1.6 },
  { id: 'back-top', x:  30, y: -22, r: 2.0 },
  { id: 'back-mid', x:  62, y:  -2, r: 1.6 },
  { id: 'hip',      x:  85, y:  30, r: 2.6, spike: true },
  // Tail (curled back up over the body)
  { id: 'tail-base', x:  98, y:  18, r: 1.4 },
  { id: 'tail-mid',  x: 120, y: -12, r: 1.8 },
  { id: 'tail-tip',  x:  98, y: -38, r: 2.4, spike: true, pulse: true },
  // Legs (front + back paws on the ground)
  { id: 'paw-fl', x: -28, y: 60, r: 1.6 },
  { id: 'paw-fr', x:   2, y: 60, r: 1.6 },
  { id: 'paw-h',  x:  78, y: 70, r: 1.8 },
];

const LINES: [StarId, StarId][] = [
  ['ear-l', 'crown'], ['ear-r', 'crown'],
  ['crown', 'eye-l'], ['crown', 'eye-r'],
  ['eye-l', 'eye-r'],
  ['eye-l', 'nose'], ['eye-r', 'nose'],
  ['nose', 'chin'], ['chin', 'neck'],
  ['neck', 'shoulder'],
  ['shoulder', 'back-top'], ['back-top', 'back-mid'], ['back-mid', 'hip'],
  ['hip', 'tail-base'], ['tail-base', 'tail-mid'], ['tail-mid', 'tail-tip'],
  ['shoulder', 'paw-fl'], ['shoulder', 'paw-fr'],
  ['hip', 'paw-h'],
];

// Hand-placed scatter stars for atmosphere — deterministic so SSR matches.
const SPARKLES: { x: number; y: number; r: number; o: number }[] = [
  { x: -185, y: -150, r: 0.9, o: 0.55 },
  { x: -160, y:   30, r: 0.7, o: 0.4  },
  { x: -130, y:  150, r: 1.0, o: 0.65 },
  { x:  -80, y: -170, r: 0.8, o: 0.5  },
  { x:  -55, y:  140, r: 0.6, o: 0.4  },
  { x:   45, y:  150, r: 1.0, o: 0.6  },
  { x:  140, y:  130, r: 0.7, o: 0.45 },
  { x:  170, y:   60, r: 1.0, o: 0.55 },
  { x:  180, y:  -60, r: 0.8, o: 0.5  },
  { x:  150, y: -150, r: 1.1, o: 0.65 },
  { x:   80, y: -170, r: 0.7, o: 0.45 },
  { x:    0, y: -180, r: 0.6, o: 0.4  },
  { x: -120, y: -100, r: 0.6, o: 0.35 },
  { x:   30, y:   95, r: 0.7, o: 0.4  },
  { x: -100, y:   80, r: 0.7, o: 0.4  },
  { x:  -40, y:  175, r: 0.8, o: 0.45 },
  { x:  -10, y: -130, r: 0.5, o: 0.35 },
  { x:  140, y:    5, r: 0.6, o: 0.4  },
  { x: -170, y:  -20, r: 0.7, o: 0.4  },
];

function getStar(id: StarId): Star {
  const s = STARS.find((s) => s.id === id);
  if (!s) throw new Error(`unknown star ${id}`);
  return s;
}

export function CatConstellation({
  size = 460,
  stroke = 'var(--accent)',
  className,
}: {
  size?: number;
  stroke?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="-220 -220 440 440"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      {/* Soft outer celestial ring */}
      <circle
        cx="0"
        cy="0"
        r="205"
        fill="none"
        stroke={stroke}
        strokeWidth="0.5"
        strokeDasharray="1 9"
        opacity="0.55"
      />

      {/* Sparkle field */}
      <g fill={stroke}>
        {SPARKLES.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
        ))}
      </g>

      {/* Constellation lines — thin, faint, gentle */}
      <g
        stroke={stroke}
        strokeWidth="0.55"
        strokeLinecap="round"
        opacity="0.42"
        fill="none"
      >
        {LINES.map(([a, b], i) => {
          const sa = getStar(a);
          const sb = getStar(b);
          return <line key={i} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />;
        })}
      </g>

      {/* Stars — circle + 4-point spike for the major ones */}
      <g fill={stroke}>
        {STARS.map((s) => {
          const spike = s.spike ? s.r * 4.5 : 0;
          return (
            <g
              key={s.id}
              opacity={s.pulse ? undefined : 0.95}
              style={
                s.pulse
                  ? { animation: 'star-twinkle 3.4s ease-in-out infinite', transformOrigin: `${s.x}px ${s.y}px` }
                  : undefined
              }
            >
              {s.spike && (
                <>
                  <line
                    x1={s.x - spike}
                    y1={s.y}
                    x2={s.x + spike}
                    y2={s.y}
                    stroke={stroke}
                    strokeWidth="0.55"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                  <line
                    x1={s.x}
                    y1={s.y - spike}
                    x2={s.x}
                    y2={s.y + spike}
                    stroke={stroke}
                    strokeWidth="0.55"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </>
              )}
              <circle cx={s.x} cy={s.y} r={s.r} />
              {/* Soft halo for the spiky ones */}
              {s.spike && (
                <circle cx={s.x} cy={s.y} r={s.r * 1.9} opacity="0.22" />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default CatConstellation;
