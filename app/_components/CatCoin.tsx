'use client';

interface CatCoinProps {
  size?: number;
  /** When false the kitten sits still (used for the "delivered" final frame). */
  playful?: boolean;
  /** Side-on travelling pose (used in the map). When false, idle pose. */
  flying?: boolean;
}

/**
 * A fluffy white kitten. Two modes:
 *  - flying: a side-on flying pose, paws curled, scarf streaming, coin clutched
 *  - !flying: a seated kitten on the ground (used in the auth hero)
 *
 * Pure SVG + CSS keyframes. Designed to read at small sizes and feel alive
 * (breathing, tail flick, ear twitch, blink, coin spin + sparkle).
 */
export function CatCoin({ size = 96, playful = true, flying = true }: CatCoinProps) {
  const a = playful ? undefined : { animation: 'none' as const };
  return flying ? (
    <FlyingKitten size={size} playful={playful} a={a} />
  ) : (
    <SeatedKitten size={size} playful={playful} a={a} />
  );
}

function FlyingKitten({ size, playful, a }: { size: number; playful: boolean; a?: { animation: 'none' } }) {
  return (
    <div
      className="relative inline-block select-none"
      style={{
        width: size * 1.5,
        height: size,
        animation: playful ? 'float-bob 2.4s ease-in-out infinite' : undefined,
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 150 100"
        width={size * 1.5}
        height={size}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="kittenFur" cx="40%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#e9e7df" />
          </radialGradient>
          <radialGradient id="catShine" cx="30%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* aura glow */}
        <ellipse cx="70" cy="55" rx="60" ry="22" fill="#ffffff" opacity="0.18" />

        {/* trailing tail (curls behind the body, wags) */}
        <g style={playful ? { animation: 'tail-flick 1.4s ease-in-out infinite', transformOrigin: '110px 56px' } : a}>
          <path
            d="M 108 56 Q 128 50 135 38 Q 140 28 148 30"
            stroke="url(#kittenFur)"
            strokeWidth="9"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M 110 56 Q 128 50 135 38 Q 140 28 148 30"
            stroke="#fff5e8"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
        </g>

        {/* body — soft elongated for flight */}
        <ellipse cx="70" cy="58" rx="42" ry="22" fill="url(#kittenFur)" />
        <ellipse cx="62" cy="68" rx="26" ry="10" fill="#fff5e8" opacity="0.9" />

        {/* back paw tucked back */}
        <g style={playful ? { animation: 'paw-curl 1.6s ease-in-out infinite', transformOrigin: '92px 70px' } : a}>
          <ellipse cx="92" cy="74" rx="7" ry="4" fill="url(#kittenFur)" />
          <ellipse cx="95" cy="76" rx="2" ry="1.2" fill="#ffb6c1" />
        </g>

        {/* front paws curled forward (carrying coin) */}
        <g style={playful ? { animation: 'paw-curl 1.4s ease-in-out infinite 0.3s', transformOrigin: '46px 70px' } : a}>
          <ellipse cx="46" cy="72" rx="6" ry="4" fill="url(#kittenFur)" />
          <ellipse cx="44" cy="74" rx="1.8" ry="1.1" fill="#ffb6c1" />
        </g>
        <g style={playful ? { animation: 'paw-curl 1.4s ease-in-out infinite', transformOrigin: '36px 64px' } : a}>
          <ellipse cx="36" cy="66" rx="5.5" ry="3.5" fill="url(#kittenFur)" />
        </g>

        {/* head */}
        <g>
          <circle cx="32" cy="48" r="20" fill="url(#kittenFur)" />
          {/* cheek lighter patch */}
          <ellipse cx="24" cy="54" rx="9" ry="6" fill="#fff" opacity="0.7" />

          {/* ears */}
          <g style={playful ? { animation: 'ear-twitch 4.5s ease-in-out infinite', transformOrigin: '23px 33px' } : a}>
            <polygon points="14,28 21,42 27,34" fill="url(#kittenFur)" />
            <polygon points="17,31 21,40 24,34" fill="#ffb6c1" />
          </g>
          <g style={playful ? { animation: 'ear-twitch 4.5s ease-in-out infinite 0.5s', transformOrigin: '40px 33px' } : a}>
            <polygon points="44,28 37,42 32,34" fill="url(#kittenFur)" />
            <polygon points="41,31 37,40 34,34" fill="#ffb6c1" />
          </g>

          {/* eye (side-profile, one visible) */}
          <g style={playful ? { animation: 'blink 5.5s ease-in-out infinite', transformOrigin: '22px 48px' } : a}>
            <ellipse cx="22" cy="48" rx="2.8" ry="3.6" fill="#0d1230" />
            <circle cx="23" cy="46.5" r="0.9" fill="#ffffff" />
            <circle cx="21.3" cy="49" r="0.5" fill="#ffffff" opacity="0.7" />
          </g>

          {/* nose + mouth */}
          <path d="M14 53 l-2 -0.5 l1.4 1.7 z" fill="#ffb6c1" />
          <path d="M14 56 q1.5 2 3 1.5 m-3 -1.5 q-1.5 2 -3 1.5" stroke="#0d1230" strokeWidth="0.7" fill="none" strokeLinecap="round" />

          {/* whiskers */}
          <g style={playful ? { animation: 'whisker 3.2s ease-in-out infinite', transformOrigin: '14px 56px' } : a}>
            <line x1="0" y1="55" x2="13" y2="55" stroke="#cfc8b5" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="0" y1="58" x2="13" y2="57.5" stroke="#cfc8b5" strokeWidth="0.7" strokeLinecap="round" />
            <line x1="0" y1="61" x2="13" y2="60" stroke="#cfc8b5" strokeWidth="0.7" strokeLinecap="round" />
          </g>

          {/* head shine */}
          <ellipse cx="26" cy="40" rx="8" ry="5" fill="url(#catShine)" />
        </g>
      </svg>

      {/* coin clutched in paws */}
      <div
        className="absolute"
        style={{
          left: '14%',
          top: '52%',
          width: size * 0.36,
          height: size * 0.36,
          animation: playful ? 'coin-tilt 1.8s ease-in-out infinite' : undefined,
          filter: 'drop-shadow(0 6px 12px rgba(245, 179, 66, 0.55))',
        }}
      >
        <div
          className="relative rounded-full"
          style={{
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 30% 30%, #fff1c2, #f5b342 60%, #b07a14)',
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

      {/* sparkle trail */}
      {playful && (
        <>
          <Sparkle delay="0s" cx="58%" cy="36%" />
          <Sparkle delay="0.6s" cx="52%" cy="64%" />
          <Sparkle delay="1.1s" cx="78%" cy="44%" />
        </>
      )}
    </div>
  );
}

function SeatedKitten({ size, playful, a }: { size: number; playful: boolean; a?: { animation: 'none' } }) {
  return (
    <div className="relative inline-block select-none" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <defs>
          <radialGradient id="seatedFur" cx="40%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#fafafa" />
            <stop offset="100%" stopColor="#e9e7df" />
          </radialGradient>
        </defs>
        {/* shadow */}
        <ellipse cx="50" cy="92" rx="32" ry="3" fill="#0d1230" opacity="0.1" />
        {/* tail curled around */}
        <g style={playful ? { animation: 'tail-flick 1.6s ease-in-out infinite', transformOrigin: '72px 78px' } : a}>
          <path d="M72 78 Q86 70 80 56" stroke="url(#seatedFur)" strokeWidth="10" fill="none" strokeLinecap="round" />
        </g>
        {/* body */}
        <ellipse cx="50" cy="72" rx="28" ry="18" fill="url(#seatedFur)" />
        {/* legs */}
        <ellipse cx="36" cy="86" rx="7" ry="4" fill="url(#seatedFur)" />
        <ellipse cx="64" cy="86" rx="7" ry="4" fill="url(#seatedFur)" />
        {/* head */}
        <circle cx="50" cy="42" r="22" fill="url(#seatedFur)" />
        {/* ears */}
        <g style={playful ? { animation: 'ear-twitch 4.5s ease-in-out infinite', transformOrigin: '38px 26px' } : a}>
          <polygon points="32,16 40,32 46,22" fill="url(#seatedFur)" />
          <polygon points="35,20 40,30 43,23" fill="#ffb6c1" />
        </g>
        <g style={playful ? { animation: 'ear-twitch 4.5s ease-in-out infinite 0.5s', transformOrigin: '62px 26px' } : a}>
          <polygon points="68,16 60,32 54,22" fill="url(#seatedFur)" />
          <polygon points="65,20 60,30 57,23" fill="#ffb6c1" />
        </g>
        {/* eyes */}
        <g style={playful ? { animation: 'blink 5.5s ease-in-out infinite', transformOrigin: '50px 44px' } : a}>
          <ellipse cx="42" cy="44" rx="3" ry="4" fill="#0d1230" />
          <ellipse cx="58" cy="44" rx="3" ry="4" fill="#0d1230" />
          <circle cx="43" cy="42.5" r="1" fill="#ffffff" />
          <circle cx="59" cy="42.5" r="1" fill="#ffffff" />
        </g>
        {/* nose + mouth */}
        <path d="M48 52 l2 1.5 l2 -1.5 z" fill="#ffb6c1" />
        <path d="M50 54 q-1 2 -2 1.5 m2 -1.5 q1 2 2 1.5" stroke="#0d1230" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* whiskers */}
        <line x1="28" y1="50" x2="42" y2="50" stroke="#cfc8b5" strokeWidth="0.7" />
        <line x1="58" y1="50" x2="72" y2="50" stroke="#cfc8b5" strokeWidth="0.7" />
      </svg>
    </div>
  );
}

function Sparkle({ delay, cx, cy }: { delay: string; cx: string; cy: string }) {
  return (
    <span
      className="absolute"
      style={{
        left: cx,
        top: cy,
        width: 6,
        height: 6,
        animation: `sparkle 1.8s ease-in-out infinite ${delay}`,
      }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }}
      />
    </span>
  );
}
