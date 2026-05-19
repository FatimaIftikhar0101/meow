'use client';

interface CatCoinProps {
  size?: number;
  playful?: boolean;
}

/**
 * A small SVG kitten batting a gold coin. Used in the transfer timeline to
 * personify the money moving from "initiated" all the way to "delivered".
 *
 * When playful=true the kitten wags and the coin bounces; otherwise it sits
 * still (used for the "delivered" final frame).
 */
export function CatCoin({ size = 56, playful = true }: CatCoinProps) {
  return (
    <div
      className="relative inline-block"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        width={size}
        height={size}
        style={{
          animation: playful ? 'cat-walk 1.6s ease-in-out infinite' : undefined,
          transformOrigin: 'center bottom',
        }}
      >
        {/* body */}
        <ellipse cx="28" cy="44" rx="16" ry="13" fill="#3b3a3a" />
        {/* head */}
        <circle cx="22" cy="28" r="13" fill="#3b3a3a" />
        {/* ears */}
        <polygon points="11,18 14,28 19,22" fill="#3b3a3a" />
        <polygon points="33,18 30,28 25,22" fill="#3b3a3a" />
        <polygon points="13,21 14.5,26 17,23" fill="#ff9c7a" />
        <polygon points="31,21 29.5,26 27,23" fill="#ff9c7a" />
        {/* face */}
        <circle cx="17" cy="28" r="1.6" fill="#fff" />
        <circle cx="27" cy="28" r="1.6" fill="#fff" />
        <circle cx="17" cy="28" r="0.8" fill="#0e1a3a" />
        <circle cx="27" cy="28" r="0.8" fill="#0e1a3a" />
        <path d="M21 32 q1 1 2 0" stroke="#ff9c7a" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* whiskers */}
        <line x1="10" y1="31" x2="16" y2="31" stroke="#fff" strokeWidth="0.6" />
        <line x1="28" y1="31" x2="34" y2="31" stroke="#fff" strokeWidth="0.6" />
        {/* tail */}
        <path d="M44 44 Q52 38 50 30" stroke="#3b3a3a" strokeWidth="4" fill="none" strokeLinecap="round" />
        {/* paw reaching toward the coin */}
        <g
          style={{
            transformOrigin: '42px 42px',
            animation: playful ? 'paw-tap 0.9s ease-in-out infinite' : undefined,
          }}
        >
          <circle cx="44" cy="42" r="3.2" fill="#3b3a3a" />
        </g>
      </svg>

      {/* the coin */}
      <div
        className="absolute"
        style={{
          right: -6,
          top: size * 0.45,
          width: size * 0.32,
          height: size * 0.32,
          animation: playful ? 'coin-bounce 0.9s ease-in-out infinite' : undefined,
        }}
      >
        <div
          className="rounded-full border-2 border-yellow-700 bg-gradient-to-br from-yellow-300 to-yellow-500 flex items-center justify-center font-bold text-yellow-900 shadow"
          style={{
            width: '100%',
            height: '100%',
            fontSize: size * 0.18,
            animation: playful ? 'coin-spin 2.4s linear infinite' : undefined,
            transformStyle: 'preserve-3d',
          }}
        >
          $
        </div>
      </div>
    </div>
  );
}
