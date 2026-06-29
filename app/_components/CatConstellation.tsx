'use client';

/**
 * Constellation cat — a face-on, perfectly symmetric celestial line-drawing.
 * Bright "named" stars at every face-anatomy point connect via thin faint
 * gold lines (Big-Dipper diagram style), surrounded by a sparse field of
 * sparkle stars and a single dashed celestial ring.
 *
 * Every coordinate is mirrored across x=0 and the y range is balanced
 * around 0 — so the cat's visual center is the SVG origin. That means
 * the wrapper's translate(-50%, -50%) lines it up exactly on the globe
 * center with no eyeballing offsets.
 */

type StarId =
  | 'ear-l-tip' | 'ear-r-tip'
  | 'ear-l-base' | 'ear-r-base' | 'forehead'
  | 'eye-l' | 'eye-r'
  | 'nose' | 'chin'
  | 'cheek-l' | 'cheek-r'
  | 'whisker-l' | 'whisker-r';

interface Star {
  id: StarId;
  x: number;
  y: number;
  r: number;
  spike?: boolean;
  pulse?: boolean;
}

const STARS: Star[] = [
  // Ears — tall pointed pair at the top, mirrored
  { id: 'ear-l-tip',  x: -52, y: -75, r: 2.6, spike: true },
  { id: 'ear-r-tip',  x:  52, y: -75, r: 2.6, spike: true },
  { id: 'ear-l-base', x: -28, y: -34, r: 1.3 },
  { id: 'ear-r-base', x:  28, y: -34, r: 1.3 },
  // Forehead — single star between ears (on the y-axis)
  { id: 'forehead', x: 0, y: -32, r: 1.3 },
  // Eyes — the two brightest, slowly twinkling
  { id: 'eye-l', x: -26, y: 4, r: 2.8, spike: true, pulse: true },
  { id: 'eye-r', x:  26, y: 4, r: 2.8, spike: true, pulse: true },
  // Snout
  { id: 'nose', x: 0, y: 32, r: 2.0 },
  { id: 'chin', x: 0, y: 64, r: 1.4 },
  // Cheeks
  { id: 'cheek-l', x: -40, y: 38, r: 1.5 },
  { id: 'cheek-r', x:  40, y: 38, r: 1.5 },
  // Whisker tips — faint twinkling stars far to either side
  { id: 'whisker-l', x: -92, y: 30, r: 1.6, pulse: true },
  { id: 'whisker-r', x:  92, y: 30, r: 1.6, pulse: true },
];

const LINES: [StarId, StarId][] = [
  // Ear edges
  ['ear-l-tip', 'ear-l-base'],
  ['ear-r-tip', 'ear-r-base'],
  // Crown of head: left ear-base → forehead → right ear-base
  ['ear-l-base', 'forehead'],
  ['forehead', 'ear-r-base'],
  // Face sides — from ears down to eyes
  ['ear-l-base', 'eye-l'],
  ['ear-r-base', 'eye-r'],
  // Face triangle — eyes to nose
  ['eye-l', 'nose'],
  ['eye-r', 'nose'],
  // Snout down to chin
  ['nose', 'chin'],
  // Cheek lines — eye down to cheek, cheek to chin
  ['eye-l', 'cheek-l'],
  ['eye-r', 'cheek-r'],
  ['cheek-l', 'chin'],
  ['cheek-r', 'chin'],
  // Whisker rays
  ['cheek-l', 'whisker-l'],
  ['cheek-r', 'whisker-r'],
];

// Hand-placed sparkle field — symmetric-ish so it doesn't pull the eye.
const SPARKLES: { x: number; y: number; r: number; o: number }[] = [
  { x: -185, y: -150, r: 0.9, o: 0.55 },
  { x:  185, y: -150, r: 0.9, o: 0.55 },
  { x: -160, y:  -40, r: 0.7, o: 0.4  },
  { x:  160, y:  -40, r: 0.7, o: 0.4  },
  { x: -150, y:  120, r: 1.0, o: 0.55 },
  { x:  150, y:  120, r: 1.0, o: 0.55 },
  { x:  -75, y: -165, r: 0.8, o: 0.5  },
  { x:   75, y: -165, r: 0.8, o: 0.5  },
  { x:   -8, y: -185, r: 0.6, o: 0.4  },
  { x:    8, y:  175, r: 0.6, o: 0.4  },
  { x:  -55, y:  155, r: 0.6, o: 0.4  },
  { x:   55, y:  155, r: 0.6, o: 0.4  },
  { x: -180, y:   50, r: 0.7, o: 0.45 },
  { x:  180, y:   50, r: 0.7, o: 0.45 },
  { x: -110, y:  -90, r: 0.5, o: 0.35 },
  { x:  110, y:  -90, r: 0.5, o: 0.35 },
];

function getStar(id: StarId): Star {
  const s = STARS.find((st) => st.id === id);
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

      {/* Constellation lines */}
      <g stroke={stroke} strokeWidth="0.55" strokeLinecap="round" opacity="0.45" fill="none">
        {LINES.map(([a, b], i) => {
          const sa = getStar(a);
          const sb = getStar(b);
          return <line key={i} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />;
        })}
      </g>

      {/* Stars — circle + 4-point spike on the major ones */}
      <g fill={stroke}>
        {STARS.map((s) => {
          const spike = s.spike ? s.r * 4.5 : 0;
          return (
            <g
              key={s.id}
              opacity={s.pulse ? undefined : 0.95}
              style={
                s.pulse
                  ? {
                      animation: 'star-twinkle 3.4s ease-in-out infinite',
                      transformOrigin: `${s.x}px ${s.y}px`,
                    }
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
              {s.spike && <circle cx={s.x} cy={s.y} r={s.r * 1.9} opacity="0.22" />}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default CatConstellation;
