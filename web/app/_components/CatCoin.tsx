'use client';

interface CatCoinProps {
  size?: number;
  /** When false the kitten sits still (used for terminal states / heroes). */
  playful?: boolean;
}

/**
 * A sleek white kitten silhouette carrying a gold coin.
 *
 * Designed as a brand mark for an elite finance app: monochrome with a single
 * gold accent, restrained motion. No pink ears, no bouncy sparkles. The
 * kitten glides faintly, the coin spins, and the tail sways. Everything else
 * is still.
 */
export function CatCoin({ size = 48, playful = true }: CatCoinProps) {
  const w = size * 1.45;
  return (
    <div
      className="relative inline-block select-none"
      style={{
        width: w,
        height: size,
        animation: playful ? 'glide 3.2s ease-in-out infinite' : undefined,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 145 100"
        width={w}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="furGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dde3f0" />
          </linearGradient>
          <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff1c2" />
            <stop offset="55%" stopColor="#e0b259" />
            <stop offset="100%" stopColor="#9a6d18" />
          </linearGradient>
        </defs>

        {/* faint underglow */}
        <ellipse cx="72" cy="56" rx="56" ry="14" fill="#ffffff" opacity="0.06" />

        {/* tail — long, sleek, no bone shading */}
        <g
          style={
            playful
              ? { animation: 'tail-sway 2.4s ease-in-out infinite', transformOrigin: '108px 56px' }
              : undefined
          }
        >
          <path
            d="M 108 56 Q 132 50 138 36"
            stroke="url(#furGrad)"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* body — long, slender, side-profile gliding pose */}
        <path
          d="M 36 56 Q 30 38 50 36 L 96 36 Q 116 36 110 58 Q 108 72 92 72 L 50 72 Q 32 72 36 56 Z"
          fill="url(#furGrad)"
        />

        {/* subtle body fold */}
        <path
          d="M 50 60 Q 70 64 92 60"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="1.2"
          fill="none"
          strokeLinecap="round"
        />

        {/* back leg tucked */}
        <path d="M 90 70 Q 96 80 88 84 L 84 80 Z" fill="url(#furGrad)" />
        {/* front leg holding the coin */}
        <path d="M 44 68 Q 38 78 46 82 L 50 78 Z" fill="url(#furGrad)" />

        {/* head */}
        <g>
          <circle cx="32" cy="44" r="16" fill="url(#furGrad)" />

          {/* ears — single tone, geometric */}
          <polygon points="18,30 24,42 28,34" fill="url(#furGrad)" />
          <polygon points="42,30 38,42 34,34" fill="url(#furGrad)" />
          <polygon points="20,33 24,40 26,35" fill="#2d3553" opacity="0.35" />
          <polygon points="40,33 38,40 36,35" fill="#2d3553" opacity="0.35" />

          {/* eye — tiny, sharp */}
          <g
            style={
              playful
                ? { animation: 'blink 6s ease-in-out infinite', transformOrigin: '24px 44px' }
                : undefined
            }
          >
            <ellipse cx="24" cy="44" rx="1.8" ry="2.4" fill="#0a0e1c" />
          </g>

          {/* nose — minimal dot */}
          <circle cx="17" cy="48" r="1.4" fill="#0a0e1c" />

          {/* whiskers — three thin lines */}
          <line x1="3" y1="49" x2="15" y2="49" stroke="#bcc3d8" strokeWidth="0.5" strokeLinecap="round" />
          <line x1="3" y1="51.5" x2="15" y2="51" stroke="#bcc3d8" strokeWidth="0.5" strokeLinecap="round" />
        </g>
      </svg>

      {/* the coin — slim gold disk, spins on the cat's chest */}
      <div
        className="absolute"
        style={{
          left: '24%',
          top: '54%',
          width: size * 0.34,
          height: size * 0.34,
          filter: 'drop-shadow(0 4px 10px rgba(224, 178, 89, 0.4))',
        }}
      >
        <div
          className="relative rounded-full border"
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #fff1c2, #e0b259 60%, #9a6d18)',
            borderColor: '#9a6d18',
            animation: playful ? 'coin-spin 3.6s linear infinite' : undefined,
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center font-bold text-amber-900"
            style={{ fontSize: size * 0.16, letterSpacing: '-0.02em' }}
          >
            $
          </div>
        </div>
      </div>
    </div>
  );
}
