'use client';

/**
 * Six unique cat poses, one per transfer step. Pure SVG, white silhouettes
 * with a single gold accent (the coin / star). Each cat is drawn in a
 * different activity:
 *
 *   initiated         — sitting, ears up, watching the coin
 *   payment_received  — reaching forward, paw on coin
 *   compliance_check  — crouched low, inspecting closely
 *   fx_converted      — batting the coin into the air
 *   payout_processing — walking with coin
 *   delivered         — sitting proud beside a star
 *
 * Inline gradients keep the silhouette readable on dark surfaces.
 */

const Defs = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={`fur-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#ffffff" />
      <stop offset="100%" stopColor="#dde3f0" />
    </linearGradient>
    <radialGradient id={`coin-${id}`} cx="30%" cy="30%" r="70%">
      <stop offset="0%" stopColor="#fff1c2" />
      <stop offset="60%" stopColor="#e0b259" />
      <stop offset="100%" stopColor="#9a6d18" />
    </radialGradient>
  </defs>
);

function Eye({ x, y, closed }: { x: number; y: number; closed?: boolean }) {
  return closed ? (
    <path d={`M ${x - 1.4} ${y} q 1.4 1 2.8 0`} stroke="#0a0e1c" strokeWidth="0.8" fill="none" strokeLinecap="round" />
  ) : (
    <ellipse cx={x} cy={y} rx="1.4" ry="1.8" fill="#0a0e1c" />
  );
}

export function CatSitting({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="sit" />
      <ellipse cx="50" cy="92" rx="32" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail curled around */}
      <path d="M 70 80 Q 84 74 78 60" stroke="url(#fur-sit)" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="50" cy="72" rx="22" ry="18" fill="url(#fur-sit)" />
      {/* front paws */}
      <ellipse cx="40" cy="86" rx="5" ry="3.5" fill="url(#fur-sit)" />
      <ellipse cx="60" cy="86" rx="5" ry="3.5" fill="url(#fur-sit)" />
      {/* head */}
      <circle cx="50" cy="44" r="18" fill="url(#fur-sit)" />
      {/* ears alert */}
      <polygon points="35,30 42,40 44,28" fill="url(#fur-sit)" />
      <polygon points="65,30 58,40 56,28" fill="url(#fur-sit)" />
      <polygon points="37,32 42,38 43,30" fill="#0a0e1c" opacity="0.18" />
      <polygon points="63,32 58,38 57,30" fill="#0a0e1c" opacity="0.18" />
      {/* eyes — looking up */}
      <Eye x={43} y={43} />
      <Eye x={57} y={43} />
      {/* nose */}
      <path d="M 48 50 l 2 1.4 l 2 -1.4 z" fill="#e0b259" />
      {/* coin in front, looking at it */}
      <circle cx="50" cy="98" r="4" fill="url(#coin-sit)" />
    </svg>
  );
}

export function CatReach({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="reach" />
      <ellipse cx="50" cy="92" rx="30" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail up */}
      <path d="M 72 70 Q 86 50 80 30" stroke="url(#fur-reach)" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* hind legs */}
      <ellipse cx="62" cy="84" rx="6" ry="8" fill="url(#fur-reach)" />
      {/* body — leaning forward */}
      <ellipse cx="56" cy="60" rx="22" ry="16" fill="url(#fur-reach)" transform="rotate(-10 56 60)" />
      {/* front leg extended toward coin */}
      <rect x="30" y="58" width="8" height="22" rx="4" fill="url(#fur-reach)" transform="rotate(-30 34 70)" />
      <circle cx="22" cy="78" r="4" fill="url(#fur-reach)" />
      {/* head, leaning */}
      <circle cx="42" cy="38" r="15" fill="url(#fur-reach)" />
      {/* ears */}
      <polygon points="30,24 36,36 38,22" fill="url(#fur-reach)" />
      <polygon points="54,24 48,36 46,22" fill="url(#fur-reach)" />
      {/* eyes — focused */}
      <Eye x={36} y={38} />
      <Eye x={48} y={38} />
      <circle cx="33.5" cy="42" r="1.4" fill="#e0b259" opacity="0.5" />
      {/* coin */}
      <circle cx="16" cy="80" r="6" fill="url(#coin-reach)" />
      <text x="16" y="83" textAnchor="middle" fontSize="6" fill="#7a5413" fontWeight="bold">$</text>
    </svg>
  );
}

export function CatInspect({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="ins" />
      <ellipse cx="50" cy="92" rx="34" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail flat behind */}
      <path d="M 78 78 Q 92 76 92 68" stroke="url(#fur-ins)" strokeWidth="7" fill="none" strokeLinecap="round" />
      {/* body — crouched low, elongated */}
      <ellipse cx="50" cy="74" rx="28" ry="12" fill="url(#fur-ins)" />
      {/* legs tucked */}
      <ellipse cx="34" cy="84" rx="5" ry="3" fill="url(#fur-ins)" />
      <ellipse cx="66" cy="84" rx="5" ry="3" fill="url(#fur-ins)" />
      {/* head — down, close to coin */}
      <circle cx="28" cy="68" r="14" fill="url(#fur-ins)" />
      {/* ears low */}
      <polygon points="18,58 22,66 26,58" fill="url(#fur-ins)" />
      <polygon points="38,58 34,66 30,58" fill="url(#fur-ins)" />
      {/* eyes squinting (closed) */}
      <Eye x={22} y={70} closed />
      <Eye x={34} y={70} closed />
      {/* coin being inspected */}
      <circle cx="12" cy="80" r="6" fill="url(#coin-ins)" />
      <circle cx="12" cy="80" r="9" fill="none" stroke="#e0b259" strokeOpacity="0.5" strokeWidth="0.5" strokeDasharray="2 1" />
    </svg>
  );
}

export function CatBat({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="bat" />
      <ellipse cx="50" cy="92" rx="26" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail up */}
      <path d="M 64 64 Q 80 50 76 32" stroke="url(#fur-bat)" strokeWidth="8" fill="none" strokeLinecap="round" />
      {/* hind legs */}
      <ellipse cx="50" cy="84" rx="14" ry="8" fill="url(#fur-bat)" />
      {/* body — upright */}
      <ellipse cx="50" cy="58" rx="16" ry="18" fill="url(#fur-bat)" />
      {/* front paws up batting */}
      <rect x="34" y="36" width="7" height="18" rx="3.5" fill="url(#fur-bat)" transform="rotate(-25 37 44)" />
      <rect x="59" y="36" width="7" height="18" rx="3.5" fill="url(#fur-bat)" transform="rotate(25 63 44)" />
      {/* head */}
      <circle cx="50" cy="36" r="14" fill="url(#fur-bat)" />
      <polygon points="40,22 44,32 48,20" fill="url(#fur-bat)" />
      <polygon points="60,22 56,32 52,20" fill="url(#fur-bat)" />
      {/* eyes wide */}
      <Eye x={44} y={36} />
      <Eye x={56} y={36} />
      {/* coin in air with motion lines */}
      <circle cx="50" cy="10" r="6" fill="url(#coin-bat)" />
      <line x1="46" y1="6" x2="43" y2="2" stroke="#e0b259" strokeWidth="1" strokeLinecap="round" />
      <line x1="54" y1="6" x2="57" y2="2" stroke="#e0b259" strokeWidth="1" strokeLinecap="round" />
      <line x1="50" y1="18" x2="50" y2="22" stroke="#e0b259" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function CatWalk({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="walk" />
      <ellipse cx="50" cy="92" rx="36" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail trailing */}
      <path d="M 80 56 Q 96 52 92 38" stroke="url(#fur-walk)" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* body side-profile elongated */}
      <ellipse cx="50" cy="60" rx="30" ry="14" fill="url(#fur-walk)" />
      {/* legs — mid-stride */}
      <rect x="28" y="70" width="6" height="16" rx="3" fill="url(#fur-walk)" />
      <rect x="40" y="70" width="6" height="16" rx="3" fill="url(#fur-walk)" transform="rotate(-12 43 78)" />
      <rect x="60" y="70" width="6" height="16" rx="3" fill="url(#fur-walk)" transform="rotate(12 63 78)" />
      <rect x="72" y="70" width="6" height="16" rx="3" fill="url(#fur-walk)" />
      {/* head */}
      <circle cx="22" cy="52" r="12" fill="url(#fur-walk)" />
      <polygon points="14,40 18,50 22,40" fill="url(#fur-walk)" />
      <polygon points="30,40 26,50 22,40" fill="url(#fur-walk)" />
      {/* eye */}
      <Eye x={17} y={52} />
      {/* nose */}
      <circle cx="11" cy="56" r="1.4" fill="#e0b259" />
      {/* coin in mouth */}
      <circle cx="6" cy="60" r="4" fill="url(#coin-walk)" />
    </svg>
  );
}

export function CatHappy({ size = 80 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <Defs id="happy" />
      <ellipse cx="50" cy="92" rx="30" ry="3" fill="#0a0e1c" opacity="0.4" />
      {/* tail curled */}
      <path d="M 70 80 Q 86 70 78 56" stroke="url(#fur-happy)" strokeWidth="9" fill="none" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="50" cy="72" rx="22" ry="18" fill="url(#fur-happy)" />
      {/* paws */}
      <ellipse cx="40" cy="86" rx="5" ry="3.5" fill="url(#fur-happy)" />
      <ellipse cx="60" cy="86" rx="5" ry="3.5" fill="url(#fur-happy)" />
      {/* head */}
      <circle cx="50" cy="42" r="18" fill="url(#fur-happy)" />
      <polygon points="35,28 42,40 44,26" fill="url(#fur-happy)" />
      <polygon points="65,28 58,40 56,26" fill="url(#fur-happy)" />
      {/* eyes — closed happy */}
      <Eye x={43} y={43} closed />
      <Eye x={57} y={43} closed />
      {/* smile */}
      <path d="M 46 50 q 4 3 8 0" stroke="#0a0e1c" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* star instead of coin — delivered! */}
      <g transform="translate(82 22)">
        <path
          d="M 0 -8 L 2 -2 L 8 -2 L 3 2 L 5 8 L 0 4 L -5 8 L -3 2 L -8 -2 L -2 -2 Z"
          fill="url(#coin-happy)"
        />
      </g>
      <g transform="translate(18 30)">
        <path
          d="M 0 -4 L 1 -1 L 4 -1 L 1.5 1 L 2.5 4 L 0 2 L -2.5 4 L -1.5 1 L -4 -1 L -1 -1 Z"
          fill="url(#coin-happy)"
          opacity="0.7"
        />
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
