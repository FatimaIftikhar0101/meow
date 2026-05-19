'use client';
import { CatCoin } from './CatCoin';

interface City {
  flag: string;
  city: string;
  country: string;
}

const COUNTRY_PIN: Record<string, City> = {
  CA: { flag: '🇨🇦', city: 'Toronto', country: 'Canada' },
  US: { flag: '🇺🇸', city: 'New York', country: 'USA' },
  GB: { flag: '🇬🇧', city: 'London', country: 'UK' },
  PK: { flag: '🇵🇰', city: 'Karachi', country: 'Pakistan' },
  IN: { flag: '🇮🇳', city: 'Mumbai', country: 'India' },
  PH: { flag: '🇵🇭', city: 'Manila', country: 'Philippines' },
};

const CORRIDOR_BY_CURRENCY: Record<string, string> = {
  CAD: 'CA',
  USD: 'US',
  GBP: 'GB',
  PKR: 'PK',
  INR: 'IN',
  PHP: 'PH',
};

interface TransferMapProps {
  sendCurrency: string;
  receiveCurrency: string;
  recipientName?: string;
  /** 0 to 1, where 1 means delivered. */
  progress: number;
  delivered?: boolean;
  failed?: boolean;
}

export function TransferMap({
  sendCurrency,
  receiveCurrency,
  recipientName,
  progress,
  delivered,
  failed,
}: TransferMapProps) {
  const sender = COUNTRY_PIN[CORRIDOR_BY_CURRENCY[sendCurrency] ?? 'CA'] ?? COUNTRY_PIN.CA;
  const receiver = COUNTRY_PIN[CORRIDOR_BY_CURRENCY[receiveCurrency] ?? 'PK'] ?? COUNTRY_PIN.PK;

  // The arc goes from (10, 78) to (90, 78) with a peak at (50, 18) — quadratic
  // Bezier. Compute (x, y) at t along the curve.
  const t = Math.max(0, Math.min(1, progress));
  const p0 = { x: 10, y: 78 };
  const p1 = { x: 50, y: 18 };
  const p2 = { x: 90, y: 78 };
  const cx = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const cy = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-[var(--border-strong)]"
      style={{
        background:
          'radial-gradient(ellipse at 30% 20%, #2b1d5a 0%, #1a1748 40%, #0d1230 80%)',
      }}
    >
      {/* twinkling stars */}
      <Stars />

      {/* faint continent shapes — abstract amoeba blobs */}
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full opacity-15"
        aria-hidden="true"
      >
        <path d="M5 42 Q 8 30 18 32 Q 28 28 30 36 Q 25 46 14 48 Q 6 50 5 42 Z" fill="#ffffff" />
        <path d="M70 38 Q 78 30 88 34 Q 96 38 95 48 Q 88 56 78 52 Q 68 50 70 38 Z" fill="#ffffff" />
      </svg>

      <svg
        viewBox="0 0 100 80"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="arcGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff4d6d" />
            <stop offset="50%" stopColor="#f5b342" />
            <stop offset="100%" stopColor="#0fbfa7" />
          </linearGradient>
        </defs>
        {/* dashed marching path */}
        <path
          d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="0.4"
          strokeDasharray="2 2"
          style={{ animation: 'path-pulse 1.4s linear infinite' }}
        />
        {/* filled portion */}
        <path
          d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`}
          fill="none"
          stroke="url(#arcGlow)"
          strokeWidth="0.8"
          strokeLinecap="round"
          strokeDasharray="200"
          strokeDashoffset={delivered ? 0 : 200 - 200 * t}
          style={{ transition: 'stroke-dashoffset 800ms ease-out' }}
        />
      </svg>

      {/* origin pin */}
      <Pin city={sender} subtitle="From" align="left" />

      {/* destination pin */}
      <Pin city={receiver} subtitle={recipientName ? `To ${recipientName}` : 'To'} align="right" />

      {/* the kitten flying along the arc */}
      {!failed && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${cx}%`,
            top: `${cy}%`,
            transition: 'left 900ms ease-out, top 900ms ease-out',
          }}
        >
          <CatCoin size={64} playful={!delivered} flying />
        </div>
      )}

      {failed && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-5xl">😿</p>
          <p className="text-white/80 text-xs mt-1 font-semibold uppercase tracking-wider">Returned home</p>
        </div>
      )}

      {/* aspect-ratio spacer */}
      <div className="pt-[58%]" />
    </div>
  );
}

function Pin({ city, subtitle, align }: { city: City; subtitle: string; align: 'left' | 'right' }) {
  return (
    <div
      className="absolute bottom-3"
      style={{
        [align]: '5%',
      } as React.CSSProperties}
    >
      <div className={`flex ${align === 'right' ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
        <div className="w-12 h-12 rounded-full bg-white/95 backdrop-blur flex items-center justify-center text-2xl shadow-lg ring-2 ring-white/40">
          {city.flag}
        </div>
        <div className={align === 'right' ? 'text-right' : 'text-left'}>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">{subtitle}</p>
          <p className="text-white font-bold text-sm leading-tight">{city.city}</p>
          <p className="text-white/60 text-xs">{city.country}</p>
        </div>
      </div>
    </div>
  );
}

function Stars() {
  // Deterministic star positions so we don't re-randomise on every render.
  const stars = [
    [12, 22, 1.2, '0s'],
    [28, 14, 1.6, '0.3s'],
    [42, 32, 1, '0.6s'],
    [58, 12, 1.4, '0.9s'],
    [70, 28, 1.1, '1.2s'],
    [82, 18, 1.5, '0.4s'],
    [18, 48, 1, '0.7s'],
    [88, 42, 1.2, '1s'],
    [62, 46, 0.9, '1.4s'],
    [38, 60, 1.3, '0.2s'],
    [76, 64, 1, '0.8s'],
  ] as const;
  return (
    <>
      {stars.map(([x, y, r, delay], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${r * 2}px`,
            height: `${r * 2}px`,
            animation: `twinkle 2.4s ease-in-out infinite ${delay}`,
            boxShadow: '0 0 6px rgba(255,255,255,0.6)',
          }}
        />
      ))}
    </>
  );
}
