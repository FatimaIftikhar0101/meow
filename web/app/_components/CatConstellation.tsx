'use client';

/**
 * Paw-print constellation — five glowing stars arranged as a cat's paw
 * (one big main pad, four toe beans above), connected by thin faint
 * gold lines. Surrounded by a sparse mirrored sparkle field and a
 * dashed celestial ring.
 *
 * Replaces the face-on cat motif which read as eerie. Every coordinate
 * is mirrored across x=0 and the average y is zero, so the visual
 * centre lands exactly on the SVG origin — the wrapper's translate
 * lines it up perfectly on the globe center with no eyeball offset.
 */

type StarId = 'pad' | 'toe-1' | 'toe-2' | 'toe-3' | 'toe-4';

interface Star {
  id: StarId;
  x: number;
  y: number;
  r: number;
  spike?: boolean;
  pulse?: boolean;
  halo?: boolean;
}

/* Geometry — pad sits below the four toes in an arc. Coordinates
 * chosen so the average y is 0 (perfect vertical centring). */
const STARS: Star[] = [
  // Big main pad (palm / heel) — bottom centre, brightest star
  { id: 'pad', x: 0, y: 50, r: 4.6, spike: true, pulse: true, halo: true },
  // Four toes arched above, mirrored
  { id: 'toe-1', x: -55,  y:   2, r: 3.0, spike: true, halo: true },
  { id: 'toe-2', x: -22,  y: -28, r: 3.0, spike: true, halo: true },
  { id: 'toe-3', x:  22,  y: -28, r: 3.0, spike: true, halo: true },
  { id: 'toe-4', x:  55,  y:   2, r: 3.0, spike: true, halo: true },
];

const LINES: [StarId, StarId][] = [
  ['pad', 'toe-1'],
  ['pad', 'toe-2'],
  ['pad', 'toe-3'],
  ['pad', 'toe-4'],
  // Faint arc connecting toes to suggest the paw shape
  ['toe-1', 'toe-2'],
  ['toe-2', 'toe-3'],
  ['toe-3', 'toe-4'],
];

// Sparkle field — symmetric pairs only, so the eye stays on the centre.
const SPARKLES: { x: number; y: number; r: number; o: number }[] = [
  { x: -185, y: -150, r: 0.9, o: 0.5  },
  { x:  185, y: -150, r: 0.9, o: 0.5  },
  { x: -165, y:  -35, r: 0.7, o: 0.4  },
  { x:  165, y:  -35, r: 0.7, o: 0.4  },
  { x: -150, y:  130, r: 1.0, o: 0.55 },
  { x:  150, y:  130, r: 1.0, o: 0.55 },
  { x:  -75, y: -175, r: 0.7, o: 0.45 },
  { x:   75, y: -175, r: 0.7, o: 0.45 },
  { x:  -10, y: -195, r: 0.5, o: 0.4  },
  { x:   10, y:  180, r: 0.5, o: 0.4  },
  { x: -180, y:   55, r: 0.7, o: 0.45 },
  { x:  180, y:   55, r: 0.7, o: 0.45 },
  { x: -110, y: -110, r: 0.5, o: 0.35 },
  { x:  110, y: -110, r: 0.5, o: 0.35 },
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
      {/* Dashed celestial ring */}
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

      {/* Constellation lines — gentle, thin, only suggest the shape */}
      <g stroke={stroke} strokeWidth="0.5" strokeLinecap="round" opacity="0.35" fill="none">
        {LINES.map(([a, b], i) => {
          const sa = getStar(a);
          const sb = getStar(b);
          return <line key={i} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} />;
        })}
      </g>

      {/* Stars — circle + 4-point spike + soft halo */}
      <g fill={stroke}>
        {STARS.map((s) => {
          const spike = s.spike ? s.r * 4.5 : 0;
          return (
            <g
              key={s.id}
              opacity={s.pulse ? undefined : 0.92}
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
                    x1={s.x - spike} y1={s.y} x2={s.x + spike} y2={s.y}
                    stroke={stroke} strokeWidth="0.55" strokeLinecap="round" opacity="0.7"
                  />
                  <line
                    x1={s.x} y1={s.y - spike} x2={s.x} y2={s.y + spike}
                    stroke={stroke} strokeWidth="0.55" strokeLinecap="round" opacity="0.7"
                  />
                </>
              )}
              <circle cx={s.x} cy={s.y} r={s.r} />
              {s.halo && (
                <circle cx={s.x} cy={s.y} r={s.r * 2.1} opacity="0.18" />
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export default CatConstellation;
