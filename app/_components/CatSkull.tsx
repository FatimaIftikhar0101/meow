'use client';

/**
 * Line-art cat skull — tarot/Day-of-the-Dead inspired, drawn with thin
 * gold strokes. Friendly-eerie, not horror. Used as a background motif
 * behind the launcher tiles on the dashboard.
 *
 * The SVG is centered on its own viewBox so it scales cleanly. Pass a
 * `size` for the rendered px dimension; opacity is left to the caller
 * (it's meant to sit at ~25–35 % over the globe).
 */
export function CatSkull({
  size = 420,
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
      <g
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {/* ─── Tarot-card frame: nested circles with dashed ring + cardinal marks ─── */}
        <circle cx="0" cy="0" r="208" strokeWidth="0.6" opacity="0.55" />
        <circle cx="0" cy="0" r="196" strokeWidth="0.8" strokeDasharray="1 7" opacity="0.7" />
        <circle cx="0" cy="0" r="180" strokeWidth="0.6" opacity="0.4" />

        {/* Cardinal + ordinal pip marks around the ring */}
        <g fill={stroke} stroke="none" opacity="0.65">
          <circle cx="0" cy="-204" r="2.2" />
          <circle cx="0" cy=" 204" r="2.2" />
          <circle cx="-204" cy="0" r="2.2" />
          <circle cx=" 204" cy="0" r="2.2" />
          <circle cx="-144" cy="-144" r="1.5" />
          <circle cx=" 144" cy="-144" r="1.5" />
          <circle cx="-144" cy=" 144" r="1.5" />
          <circle cx=" 144" cy=" 144" r="1.5" />
        </g>

        {/* Decorative leaf flourishes top + bottom */}
        <g opacity="0.55">
          <path d="M -32 -190 Q 0 -200, 32 -190 Q 0 -178, -32 -190 Z" />
          <path d="M -32  190 Q 0  178, 32  190 Q 0  202, -32  190 Z" />
        </g>

        {/* ─── Skull silhouette ─── */}
        {/* Cranium dome */}
        <path d="M -86 -38 C -98 -118, -56 -158, 0 -158 C 56 -158, 98 -118, 86 -38" />

        {/* Pointed ear bumps (cat-distinctive: tall triangle sockets) */}
        <path d="M -78 -118 L -58 -156 L -42 -120" />
        <path d="M  78 -118 L  58 -156 L  42 -120" />
        {/* inner ear hollow lines */}
        <path d="M -64 -142 L -54 -126" strokeWidth="0.7" opacity="0.6" />
        <path d="M  64 -142 L  54 -126" strokeWidth="0.7" opacity="0.6" />

        {/* Suture seam down the middle of the cranium */}
        <path d="M 0 -158 Q -3 -100, 0 -42" strokeWidth="0.6" opacity="0.55" />

        {/* Eye sockets — large rounded almonds, cat-style */}
        <ellipse cx="-42" cy="-66" rx="30" ry="34" />
        <ellipse cx=" 42" cy="-66" rx="30" ry="34" />
        {/* Pupil dots inside the sockets — vertical slits like a real cat */}
        <path d="M -42 -76 L -42 -56" stroke={stroke} strokeWidth="2.5" />
        <path d="M  42 -76 L  42 -56" stroke={stroke} strokeWidth="2.5" />

        {/* Nasal cavity — small upside-down heart */}
        <path d="M -7 -22 Q 0 -36, 7 -22 L 0 -8 Z" />

        {/* Zygomatic cheekbones flaring out */}
        <path d="M -86 -38 Q -98 -8, -76 16" />
        <path d="M  86 -38 Q  98 -8,  76 16" />

        {/* Upper jaw line */}
        <path d="M -72 12 Q 0 22, 72 12" />

        {/* Upper fangs — two prominent triangles (cat canines!) */}
        <path d="M -24 12 L -32 44 L -18 44 Z" />
        <path d="M  24 12 L  32 44 L  18 44 Z" />

        {/* Smaller incisor teeth between the fangs */}
        <g strokeWidth="0.9" opacity="0.85">
          <path d="M -12 16 L -12 26" />
          <path d="M  -4 18 L  -4 26" />
          <path d="M   4 18 L   4 26" />
          <path d="M  12 16 L  12 26" />
        </g>

        {/* Lower jaw — U shape that meets the upper teeth */}
        <path d="M -60 28 Q -58 76, 0 84 Q 58 76, 60 28" />

        {/* Lower fangs (smaller, projecting up) */}
        <path d="M -22 30 L -28 16 L -18 16 Z" opacity="0.7" />
        <path d="M  22 30 L  28 16 L  18 16 Z" opacity="0.7" />

        {/* Decorative whisker dots — three pips per cheek where whiskers sat */}
        <g fill={stroke} stroke="none" opacity="0.75">
          <circle cx="-58" cy="0" r="1.4" />
          <circle cx="-62" cy="-6" r="1.4" />
          <circle cx="-58" cy="-12" r="1.4" />
          <circle cx=" 58" cy="0" r="1.4" />
          <circle cx=" 62" cy="-6" r="1.4" />
          <circle cx=" 58" cy="-12" r="1.4" />
        </g>

        {/* Tiny third-eye diamond above the brow — tarot flourish */}
        <path d="M -6 -132 L 0 -126 L 6 -132 L 0 -138 Z" opacity="0.85" />
        <circle cx="0" cy="-132" r="1.6" fill={stroke} stroke="none" />
      </g>
    </svg>
  );
}

export default CatSkull;
