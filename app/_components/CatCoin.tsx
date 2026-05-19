'use client';

interface CatCoinProps {
  size?: number;
  /** When false the kitten sits still (used for the "delivered" final frame). */
  playful?: boolean;
}

/**
 * A lifelike side-profile kitten walking with a coin floating beside it.
 * Breathing, tail wag, ear twitch, slow blink, and a four-leg lateral gait
 * are layered with different keyframes so it never feels stiff.
 */
export function CatCoin({ size = 96, playful = true }: CatCoinProps) {
  const a = playful ? undefined : { animation: 'none' };

  return (
    <div
      className="relative inline-block select-none"
      style={{ width: size * 1.4, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 140 100"
        width={size * 1.4}
        height={size}
        style={{
          overflow: 'visible',
          animation: playful ? 'cat-breath 2.2s ease-in-out infinite' : undefined,
          transformOrigin: 'center bottom',
        }}
      >
        {/* soft ground shadow */}
        <ellipse cx="60" cy="92" rx="42" ry="3" fill="#0d1230" opacity="0.08" />

        {/* far-side legs (paint first so near-side overlaps) */}
        <g style={playful ? { animation: 'leg-step-b 0.7s ease-in-out infinite', transformOrigin: '40px 78px' } : a}>
          <rect x="36" y="74" width="6" height="16" rx="3" fill="#2a2f55" />
          <ellipse cx="39" cy="91" rx="4.5" ry="2" fill="#0d1230" />
        </g>
        <g style={playful ? { animation: 'leg-step-a 0.7s ease-in-out infinite', transformOrigin: '80px 78px' } : a}>
          <rect x="76" y="74" width="6" height="16" rx="3" fill="#2a2f55" />
          <ellipse cx="79" cy="91" rx="4.5" ry="2" fill="#0d1230" />
        </g>

        {/* tail — wags from base */}
        <g style={playful ? { animation: 'tail-wag 0.9s ease-in-out infinite', transformOrigin: '92px 60px' } : a}>
          <path
            d="M92 60 Q 112 50, 118 38 Q 121 32, 126 36"
            stroke="#3b3a3a"
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M92 60 Q 112 50, 118 38 Q 121 32, 126 36"
            stroke="#5a5775"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* body */}
        <ellipse cx="60" cy="64" rx="34" ry="18" fill="#3b3a3a" />
        {/* belly highlight */}
        <ellipse cx="58" cy="72" rx="22" ry="8" fill="#e8d6c1" opacity="0.85" />

        {/* head */}
        <g>
          <circle cx="30" cy="50" r="18" fill="#3b3a3a" />
          {/* cheek/snout lighter patch */}
          <ellipse cx="22" cy="55" rx="9" ry="6" fill="#e8d6c1" />

          {/* ears */}
          <g style={playful ? { animation: 'ear-twitch 4s ease-in-out infinite', transformOrigin: '22px 36px' } : a}>
            <polygon points="14,32 18,44 24,38" fill="#3b3a3a" />
            <polygon points="16,34 18.5,41 22,37" fill="#ff9c7a" />
          </g>
          <g style={playful ? { animation: 'ear-twitch 4s ease-in-out infinite 0.4s', transformOrigin: '34px 36px' } : a}>
            <polygon points="36,32 32,44 42,40" fill="#3b3a3a" />
            <polygon points="36,34 33.5,41 38,38" fill="#ff9c7a" />
          </g>

          {/* eye — closed lid above, animates a blink */}
          <g style={playful ? { animation: 'blink 5s ease-in-out infinite', transformOrigin: '20px 48px' } : a}>
            <ellipse cx="20" cy="48" rx="2.6" ry="3.4" fill="#fff5e0" />
            <ellipse cx="20.5" cy="48.5" rx="1.4" ry="2.4" fill="#0d1230" />
            <circle cx="20.9" cy="47.5" r="0.6" fill="#ffffff" />
          </g>

          {/* nose + mouth */}
          <path d="M14 53 l-2 -0.5 l1 1.5 z" fill="#ff4d6d" />
          <path d="M14 55 q1 2 2.5 1.5 m-2.5 -1.5 q-1 2 -2.5 1.5" stroke="#0d1230" strokeWidth="0.7" fill="none" strokeLinecap="round" />

          {/* whiskers */}
          <g style={playful ? { animation: 'whisker 3.2s ease-in-out infinite', transformOrigin: '14px 56px' } : a}>
            <line x1="2" y1="55" x2="14" y2="55" stroke="#fff5e0" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="2" y1="58" x2="14" y2="57" stroke="#fff5e0" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="2" y1="61" x2="14" y2="59" stroke="#fff5e0" strokeWidth="0.7" strokeLinecap="round" />
          </g>
        </g>

        {/* near-side legs (in front) */}
        <g style={playful ? { animation: 'leg-step-a 0.7s ease-in-out infinite', transformOrigin: '46px 78px' } : a}>
          <rect x="42" y="74" width="6" height="16" rx="3" fill="#3b3a3a" />
          <ellipse cx="45" cy="91" rx="4.5" ry="2" fill="#0d1230" />
        </g>
        <g style={playful ? { animation: 'leg-step-b 0.7s ease-in-out infinite', transformOrigin: '86px 78px' } : a}>
          <rect x="82" y="74" width="6" height="16" rx="3" fill="#3b3a3a" />
          <ellipse cx="85" cy="91" rx="4.5" ry="2" fill="#0d1230" />
        </g>
      </svg>

      {/* the coin orbits above the kitten's shoulders */}
      <div
        className="absolute"
        style={{
          right: '14%',
          top: '6%',
          width: size * 0.34,
          height: size * 0.34,
          animation: playful ? 'coin-float 1.8s ease-in-out infinite' : undefined,
          filter: 'drop-shadow(0 4px 8px rgba(245, 179, 66, 0.45))',
        }}
      >
        <div
          className="relative rounded-full"
          style={{
            width: '100%',
            height: '100%',
            background:
              'radial-gradient(circle at 30% 30%, #fff1c2, #f5b342 60%, #b07a14)',
            border: '2px solid #b07a14',
            animation: playful ? 'coin-spin 2.6s linear infinite' : undefined,
            transformStyle: 'preserve-3d',
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center font-extrabold text-amber-900"
            style={{ fontSize: size * 0.18 }}
          >
            $
          </div>
          {/* moving highlight */}
          <div
            className="absolute rounded-full bg-white"
            style={{
              width: '35%',
              height: '35%',
              top: '15%',
              left: '15%',
              opacity: 0.55,
              animation: playful ? 'coin-shine 2.6s ease-in-out infinite' : undefined,
              filter: 'blur(2px)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
