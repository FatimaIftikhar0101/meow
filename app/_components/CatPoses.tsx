'use client';

/**
 * Six elegant white-cat poses, one per transfer status. Vector silhouettes
 * with realistic feline proportions (long body, small head, almond eyes),
 * monochrome gradient shading, a single gold accent. Refined for a finance
 * app — no kawaii features, no cartoon eyes.
 *
 * These are the fallback. The page first tries to load
 *   /cats/{status}.{webp,png,jpg,gif}
 * which lets you drop in real photographs for true realism.
 */

const Defs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`fur-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#ffffff" />
      <stop offset="55%" stopColor="#f1f3f9" />
      <stop offset="100%" stopColor="#c8cde0" />
    </linearGradient>
    <linearGradient id={`shadow-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
      <stop offset="100%" stopColor="#0a0e1c" stopOpacity="0.18" />
    </linearGradient>
    <radialGradient id={`coin-${id}`} cx="30%" cy="30%" r="70%">
      <stop offset="0%" stopColor="#fff1c2" />
      <stop offset="55%" stopColor="#e0b259" />
      <stop offset="100%" stopColor="#7a5413" />
    </radialGradient>
  </defs>
);

const Eye = ({ x, y, closed }: { x: number; y: number; closed?: boolean }) =>
  closed ? (
    <path d={`M ${x - 1.6} ${y} q 1.6 1 3.2 0`} stroke="#0a0e1c" strokeWidth="0.7" fill="none" strokeLinecap="round" />
  ) : (
    <>
      {/* almond shape */}
      <path d={`M ${x - 1.6} ${y} q 1.6 -1.5 3.2 0 q -1.6 1.5 -3.2 0 Z`} fill="#0a0e1c" />
      <circle cx={x + 0.3} cy={y - 0.2} r="0.35" fill="#ffffff" opacity="0.9" />
    </>
  );

const Whiskers = ({ x, y, flip }: { x: number; y: number; flip?: boolean }) => (
  <g stroke="#c8cde0" strokeWidth="0.4" strokeLinecap="round" transform={flip ? `scale(-1 1) translate(${-x * 2} 0)` : undefined}>
    <line x1={x - 8} y1={y - 1} x2={x} y2={y - 0.5} />
    <line x1={x - 8} y1={y + 1} x2={x} y2={y} />
    <line x1={x - 8} y1={y + 3} x2={x} y2={y + 1} />
  </g>
);

/* 1. INITIATED — sitting upright, tail curled around, head slightly tilted up */
export function CatSitting({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="sit" />
      <ellipse cx="50" cy="93" rx="26" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail curled around */}
      <path d="M 66 84 Q 84 78 78 60 Q 72 50 64 56" fill="url(#fur-sit)" stroke="url(#shadow-sit)" strokeWidth="0.6" />
      {/* body — slender upright oval */}
      <path d="M 38 56 Q 36 86 50 90 Q 64 86 62 56 Q 50 48 38 56 Z" fill="url(#fur-sit)" />
      <path d="M 38 56 Q 36 86 50 90 Q 64 86 62 56 Q 50 48 38 56 Z" fill="url(#shadow-sit)" />
      {/* front paws */}
      <ellipse cx="44" cy="89" rx="3.5" ry="2" fill="url(#fur-sit)" />
      <ellipse cx="56" cy="89" rx="3.5" ry="2" fill="url(#fur-sit)" />
      {/* head — almond, slightly turned */}
      <path d="M 38 42 Q 38 28 50 26 Q 62 28 62 42 Q 60 52 50 53 Q 40 52 38 42 Z" fill="url(#fur-sit)" />
      <path d="M 38 42 Q 38 28 50 26 Q 62 28 62 42 Q 60 52 50 53 Q 40 52 38 42 Z" fill="url(#shadow-sit)" opacity="0.4" />
      {/* ears */}
      <path d="M 38 32 L 36 18 L 46 28 Z" fill="url(#fur-sit)" />
      <path d="M 62 32 L 64 18 L 54 28 Z" fill="url(#fur-sit)" />
      <path d="M 39 30 L 38.5 22 L 43 27 Z" fill="#0a0e1c" opacity="0.2" />
      <path d="M 61 30 L 61.5 22 L 57 27 Z" fill="#0a0e1c" opacity="0.2" />
      {/* eyes */}
      <Eye x={44} y={40} />
      <Eye x={56} y={40} />
      {/* nose */}
      <path d="M 49 46 L 51 46 L 50 47.5 Z" fill="#e0b259" />
      {/* mouth */}
      <path d="M 50 48 q -1.5 2 -3 1.5 m 3 -1.5 q 1.5 2 3 1.5" stroke="#0a0e1c" strokeWidth="0.5" fill="none" strokeLinecap="round" />
      <Whiskers x={42} y={46} />
      <Whiskers x={58} y={46} flip />
    </svg>
  );
}

/* 2. PAYMENT_RECEIVED — leaning forward, one paw extended */
export function CatReach({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="rea" />
      <ellipse cx="50" cy="93" rx="28" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail up */}
      <path d="M 72 74 Q 90 62 82 38 Q 78 28 86 26" stroke="url(#fur-rea)" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      {/* hind legs */}
      <ellipse cx="64" cy="82" rx="6" ry="9" fill="url(#fur-rea)" />
      <ellipse cx="56" cy="86" rx="3.5" ry="2" fill="url(#fur-rea)" />
      {/* body leaning low-forward */}
      <path d="M 38 62 Q 32 74 38 84 Q 64 88 76 78 Q 80 64 70 56 Q 50 52 38 62 Z" fill="url(#fur-rea)" />
      <path d="M 38 62 Q 32 74 38 84 Q 64 88 76 78 Q 80 64 70 56 Q 50 52 38 62 Z" fill="url(#shadow-rea)" opacity="0.5" />
      {/* extended front leg */}
      <path d="M 38 70 Q 24 76 18 84 L 24 88 Q 30 80 42 78 Z" fill="url(#fur-rea)" />
      <ellipse cx="20" cy="86" rx="3.5" ry="2" fill="url(#fur-rea)" />
      {/* head — almond, looking down at coin */}
      <path d="M 32 48 Q 30 36 42 34 Q 54 34 54 46 Q 52 56 42 56 Q 32 55 32 48 Z" fill="url(#fur-rea)" />
      <path d="M 32 48 Q 30 36 42 34 Q 54 34 54 46 Q 52 56 42 56 Q 32 55 32 48 Z" fill="url(#shadow-rea)" opacity="0.4" />
      {/* ears */}
      <path d="M 32 38 L 30 26 L 38 36 Z" fill="url(#fur-rea)" />
      <path d="M 52 36 L 54 24 L 46 32 Z" fill="url(#fur-rea)" />
      {/* eyes focused down */}
      <Eye x={38} y={46} />
      <Eye x={48} y={45} />
      <path d="M 41 50 L 43 50 L 42 51.5 Z" fill="#e0b259" />
      <Whiskers x={36} y={51} />
      {/* coin on ground */}
      <circle cx="14" cy="90" r="5" fill="url(#coin-rea)" />
      <text x="14" y="93" textAnchor="middle" fontSize="6" fill="#5e3f0d" fontWeight="bold">$</text>
    </svg>
  );
}

/* 3. COMPLIANCE_CHECK — crouched, eyes narrowed, examining */
export function CatInspect({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="ins" />
      <ellipse cx="50" cy="93" rx="32" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail flat behind, low */}
      <path d="M 78 80 Q 92 78 92 70" stroke="url(#fur-ins)" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* body crouched low */}
      <path d="M 22 78 Q 18 88 30 88 L 76 88 Q 86 86 86 78 Q 80 70 50 70 Q 28 70 22 78 Z" fill="url(#fur-ins)" />
      <path d="M 22 78 Q 18 88 30 88 L 76 88 Q 86 86 86 78 Q 80 70 50 70 Q 28 70 22 78 Z" fill="url(#shadow-ins)" opacity="0.5" />
      {/* legs tucked */}
      <ellipse cx="32" cy="89" rx="4" ry="2" fill="url(#fur-ins)" />
      <ellipse cx="70" cy="89" rx="4" ry="2" fill="url(#fur-ins)" />
      {/* head low and forward */}
      <path d="M 14 72 Q 12 60 24 58 Q 36 58 38 70 Q 36 80 24 80 Q 14 80 14 72 Z" fill="url(#fur-ins)" />
      <path d="M 14 72 Q 12 60 24 58 Q 36 58 38 70 Q 36 80 24 80 Q 14 80 14 72 Z" fill="url(#shadow-ins)" opacity="0.4" />
      {/* ears flattened forward */}
      <path d="M 14 62 L 10 52 L 20 58 Z" fill="url(#fur-ins)" />
      <path d="M 36 62 L 38 52 L 30 58 Z" fill="url(#fur-ins)" />
      {/* eyes narrowed (closed in concentration) */}
      <Eye x={20} y={70} closed />
      <Eye x={30} y={70} closed />
      <path d="M 23 74 L 25 74 L 24 75.5 Z" fill="#e0b259" />
      <Whiskers x={18} y={74} />
      {/* coin being inspected, with magnifier dashes */}
      <circle cx="6" cy="86" r="4" fill="url(#coin-ins)" />
      <circle cx="6" cy="86" r="7" fill="none" stroke="#e0b259" strokeWidth="0.4" strokeDasharray="2 1" opacity="0.6" />
    </svg>
  );
}

/* 4. FX_CONVERTED — upright on hind legs, paws batting a coin in the air */
export function CatBat({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="bat" />
      <ellipse cx="50" cy="93" rx="22" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail */}
      <path d="M 64 64 Q 80 50 76 30" stroke="url(#fur-bat)" strokeWidth="6.5" fill="none" strokeLinecap="round" />
      {/* hind legs */}
      <ellipse cx="50" cy="84" rx="14" ry="9" fill="url(#fur-bat)" />
      {/* body upright */}
      <path d="M 38 50 Q 36 76 50 80 Q 64 76 62 50 Q 50 42 38 50 Z" fill="url(#fur-bat)" />
      <path d="M 38 50 Q 36 76 50 80 Q 64 76 62 50 Q 50 42 38 50 Z" fill="url(#shadow-bat)" opacity="0.4" />
      {/* front paws raised */}
      <path d="M 36 42 Q 28 32 26 22 L 32 20 Q 36 30 42 38 Z" fill="url(#fur-bat)" />
      <ellipse cx="28" cy="22" rx="3" ry="2" fill="url(#fur-bat)" />
      <path d="M 64 42 Q 72 32 74 22 L 68 20 Q 64 30 58 38 Z" fill="url(#fur-bat)" />
      <ellipse cx="72" cy="22" rx="3" ry="2" fill="url(#fur-bat)" />
      {/* head */}
      <path d="M 38 38 Q 38 24 50 22 Q 62 24 62 38 Q 60 48 50 49 Q 40 48 38 38 Z" fill="url(#fur-bat)" />
      <path d="M 38 38 Q 38 24 50 22 Q 62 24 62 38 Q 60 48 50 49 Q 40 48 38 38 Z" fill="url(#shadow-bat)" opacity="0.4" />
      <path d="M 38 28 L 36 14 L 46 24 Z" fill="url(#fur-bat)" />
      <path d="M 62 28 L 64 14 L 54 24 Z" fill="url(#fur-bat)" />
      {/* eyes wide-up */}
      <Eye x={44} y={36} />
      <Eye x={56} y={36} />
      <path d="M 49 42 L 51 42 L 50 43.5 Z" fill="#e0b259" />
      {/* coin in air */}
      <circle cx="50" cy="10" r="5.5" fill="url(#coin-bat)" />
      <text x="50" y="13" textAnchor="middle" fontSize="6" fill="#5e3f0d" fontWeight="bold">$</text>
      {/* motion lines */}
      <line x1="44" y1="6" x2="40" y2="2" stroke="#e0b259" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
      <line x1="56" y1="6" x2="60" y2="2" stroke="#e0b259" strokeWidth="0.6" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

/* 5. PAYOUT_PROCESSING — walking side-profile, coin in mouth */
export function CatWalk({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="wlk" />
      <ellipse cx="50" cy="93" rx="36" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail trailing */}
      <path d="M 82 60 Q 96 56 92 40" stroke="url(#fur-wlk)" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* body — long horizontal */}
      <path d="M 24 64 Q 22 76 36 78 L 76 78 Q 86 76 84 64 Q 76 56 50 56 Q 28 56 24 64 Z" fill="url(#fur-wlk)" />
      <path d="M 24 64 Q 22 76 36 78 L 76 78 Q 86 76 84 64 Q 76 56 50 56 Q 28 56 24 64 Z" fill="url(#shadow-wlk)" opacity="0.4" />
      {/* legs mid-stride (4 visible, two near, two far slightly darker) */}
      <rect x="28" y="76" width="5" height="14" rx="2.5" fill="url(#fur-wlk)" />
      <rect x="40" y="76" width="5" height="14" rx="2.5" fill="url(#fur-wlk)" transform="rotate(-15 42.5 84)" />
      <rect x="58" y="76" width="5" height="14" rx="2.5" fill="url(#fur-wlk)" transform="rotate(15 60.5 84)" />
      <rect x="72" y="76" width="5" height="14" rx="2.5" fill="url(#fur-wlk)" />
      {/* head — side */}
      <path d="M 14 54 Q 12 44 22 42 Q 32 42 32 52 Q 30 60 22 62 Q 14 60 14 54 Z" fill="url(#fur-wlk)" />
      <path d="M 14 54 Q 12 44 22 42 Q 32 42 32 52 Q 30 60 22 62 Q 14 60 14 54 Z" fill="url(#shadow-wlk)" opacity="0.4" />
      <path d="M 14 46 L 12 36 L 20 42 Z" fill="url(#fur-wlk)" />
      <path d="M 30 44 L 32 34 L 26 40 Z" fill="url(#fur-wlk)" />
      {/* eye */}
      <Eye x={20} y={50} />
      {/* nose tip */}
      <circle cx="8" cy="58" r="1" fill="#e0b259" />
      {/* coin in mouth (held lower lip) */}
      <circle cx="5" cy="61" r="3.5" fill="url(#coin-wlk)" />
    </svg>
  );
}

/* 6. DELIVERED — sitting elegantly, eyes closed, star beside */
export function CatHappy({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="hpy" />
      <ellipse cx="50" cy="93" rx="26" ry="2" fill="#0a0e1c" opacity="0.35" />
      {/* tail curled gracefully */}
      <path d="M 66 84 Q 84 76 76 58" fill="none" stroke="url(#fur-hpy)" strokeWidth="7" strokeLinecap="round" />
      {/* body */}
      <path d="M 38 54 Q 36 86 50 90 Q 64 86 62 54 Q 50 46 38 54 Z" fill="url(#fur-hpy)" />
      <path d="M 38 54 Q 36 86 50 90 Q 64 86 62 54 Q 50 46 38 54 Z" fill="url(#shadow-hpy)" opacity="0.4" />
      {/* front paws */}
      <ellipse cx="44" cy="89" rx="3.5" ry="2" fill="url(#fur-hpy)" />
      <ellipse cx="56" cy="89" rx="3.5" ry="2" fill="url(#fur-hpy)" />
      {/* head — content */}
      <path d="M 38 40 Q 38 26 50 24 Q 62 26 62 40 Q 60 50 50 51 Q 40 50 38 40 Z" fill="url(#fur-hpy)" />
      <path d="M 38 40 Q 38 26 50 24 Q 62 26 62 40 Q 60 50 50 51 Q 40 50 38 40 Z" fill="url(#shadow-hpy)" opacity="0.4" />
      <path d="M 38 30 L 36 16 L 46 26 Z" fill="url(#fur-hpy)" />
      <path d="M 62 30 L 64 16 L 54 26 Z" fill="url(#fur-hpy)" />
      {/* closed content eyes */}
      <Eye x={44} y={38} closed />
      <Eye x={56} y={38} closed />
      <path d="M 49 44 L 51 44 L 50 45.5 Z" fill="#e0b259" />
      {/* contented smile */}
      <path d="M 46 47 q 4 3 8 0" stroke="#0a0e1c" strokeWidth="0.6" fill="none" strokeLinecap="round" />
      <Whiskers x={42} y={44} />
      <Whiskers x={58} y={44} flip />
      {/* gold star — delivered */}
      <g transform="translate(82 24)">
        <path d="M 0 -8 L 2.4 -2.4 L 8 -2.4 L 3.4 1.4 L 5.2 8 L 0 4.2 L -5.2 8 L -3.4 1.4 L -8 -2.4 L -2.4 -2.4 Z" fill="url(#coin-hpy)" />
      </g>
    </svg>
  );
}

export const POSES = {
  initiated: CatSitting,
  payment_received: CatReach,
  compliance_check: CatInspect,
  fx_converted: CatBat,
  payout_processing: CatWalk,
  delivered: CatHappy,
} as const;
