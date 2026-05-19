'use client';
import { CatCoin } from './CatCoin';

/**
 * A stylised world map with sender + recipient pins and an animated arc.
 *
 * Continent silhouettes are simplified polygons positioned on a 1000x500
 * equirectangular-ish canvas. Cities are placed in normalised viewBox
 * coordinates so the kitten can fly along a Bezier curve between them.
 */

interface MapCity {
  name: string;
  country: string;
  countryCode: string;
  /** x, y in viewBox coordinates (1000 x 500). */
  x: number;
  y: number;
}

const CITIES: Record<string, MapCity> = {
  CA: { name: 'Toronto', country: 'Canada', countryCode: 'CA', x: 250, y: 165 },
  US: { name: 'New York', country: 'USA', countryCode: 'US', x: 285, y: 195 },
  GB: { name: 'London', country: 'UK', countryCode: 'GB', x: 495, y: 155 },
  PK: { name: 'Karachi', country: 'Pakistan', countryCode: 'PK', x: 680, y: 230 },
  IN: { name: 'Mumbai', country: 'India', countryCode: 'IN', x: 700, y: 260 },
  PH: { name: 'Manila', country: 'Philippines', countryCode: 'PH', x: 830, y: 270 },
};

const CURRENCY_COUNTRY: Record<string, string> = {
  CAD: 'CA',
  USD: 'US',
  GBP: 'GB',
  PKR: 'PK',
  INR: 'IN',
  PHP: 'PH',
};

interface WorldMapProps {
  sendCurrency: string;
  receiveCurrency: string;
  recipientName?: string;
  /** 0 to 1 along the arc. */
  progress: number;
  delivered?: boolean;
  failed?: boolean;
}

export function WorldMap({
  sendCurrency,
  receiveCurrency,
  recipientName,
  progress,
  delivered,
  failed,
}: WorldMapProps) {
  const sender = CITIES[CURRENCY_COUNTRY[sendCurrency] ?? 'CA'] ?? CITIES.CA;
  const receiver = CITIES[CURRENCY_COUNTRY[receiveCurrency] ?? 'PK'] ?? CITIES.PK;

  // Bezier arc from sender to receiver, peaking above the midpoint.
  const midX = (sender.x + receiver.x) / 2;
  const peakY = Math.min(sender.y, receiver.y) - 100;
  const t = Math.max(0, Math.min(1, progress));
  const cx = (1 - t) * (1 - t) * sender.x + 2 * (1 - t) * t * midX + t * t * receiver.x;
  const cy = (1 - t) * (1 - t) * sender.y + 2 * (1 - t) * t * peakY + t * t * receiver.y;

  const arcLen = 1200;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-[var(--border)]"
      style={{ background: 'linear-gradient(180deg, #07090f 0%, #0b1126 100%)' }}
    >
      {/* twinkling background stars */}
      <Stars />

      <svg
        viewBox="0 0 1000 500"
        preserveAspectRatio="xMidYMid meet"
        className="block w-full"
      >
        <defs>
          <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e0b259" />
            <stop offset="50%" stopColor="#2dd4a6" />
            <stop offset="100%" stopColor="#e0b259" />
          </linearGradient>
          <radialGradient id="pinGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#e0b259" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#e0b259" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Continents — simplified silhouettes, equirectangular-ish */}
        <g fill="#0f1b3a" stroke="#1d2a52" strokeWidth="1">
          {/* North America */}
          <path d="M 120 100 L 160 92 L 200 100 L 240 96 L 280 92 L 320 96 L 350 110 L 360 140 L 350 170 L 330 200 L 300 220 L 260 235 L 220 230 L 190 215 L 165 195 L 145 170 L 130 145 Z" />
          {/* Greenland */}
          <path d="M 380 70 L 420 65 L 435 95 L 425 120 L 395 115 L 380 95 Z" />
          {/* Central America */}
          <path d="M 240 235 L 270 230 L 285 250 L 280 270 L 255 265 Z" />
          {/* South America */}
          <path d="M 280 265 L 320 260 L 345 290 L 360 330 L 350 380 L 320 420 L 290 440 L 270 410 L 265 360 L 270 310 Z" />
          {/* Europe */}
          <path d="M 470 130 L 510 122 L 540 130 L 555 150 L 545 175 L 510 185 L 480 180 L 460 165 L 460 145 Z" />
          {/* Africa */}
          <path d="M 480 195 L 530 190 L 570 200 L 595 230 L 600 280 L 585 330 L 555 370 L 520 390 L 490 370 L 470 320 L 470 260 Z" />
          {/* Asia */}
          <path d="M 540 130 L 600 120 L 680 110 L 760 100 L 830 105 L 880 115 L 920 140 L 940 175 L 920 210 L 870 235 L 800 245 L 740 235 L 690 220 L 650 215 L 610 220 L 580 215 L 555 200 L 545 170 Z" />
          {/* India peninsula */}
          <path d="M 680 240 L 720 240 L 735 270 L 720 300 L 695 285 L 680 265 Z" />
          {/* SE Asia mainland */}
          <path d="M 800 250 L 830 250 L 840 280 L 820 295 L 800 280 Z" />
          {/* Australia */}
          <path d="M 850 360 L 900 355 L 935 380 L 925 410 L 880 425 L 845 415 L 835 385 Z" />
          {/* Indonesia / island arcs (small) */}
          <path d="M 830 305 L 855 305 L 855 320 L 830 320 Z" />
          <path d="M 870 320 L 895 320 L 895 335 L 870 335 Z" />
          {/* Japan / Korea hint */}
          <path d="M 905 175 L 920 170 L 925 195 L 910 200 Z" />
          <path d="M 880 195 L 895 192 L 895 210 L 880 210 Z" />
          {/* UK / Ireland */}
          <path d="M 465 145 L 478 142 L 480 162 L 467 165 Z" />
          {/* Iceland */}
          <path d="M 440 110 L 460 108 L 460 122 L 442 122 Z" />
          {/* Madagascar */}
          <path d="M 620 340 L 632 338 L 635 370 L 622 372 Z" />
          {/* New Zealand */}
          <path d="M 940 415 L 955 415 L 955 440 L 940 440 Z" />
        </g>

        {/* Gridlines — faint latitude lines for aesthetic */}
        <g stroke="#1a2240" strokeWidth="0.4" opacity="0.6">
          <line x1="0" y1="125" x2="1000" y2="125" />
          <line x1="0" y1="250" x2="1000" y2="250" strokeOpacity="0.8" />
          <line x1="0" y1="375" x2="1000" y2="375" />
        </g>

        {/* Arc path — dashed marching guide */}
        <path
          d={`M ${sender.x} ${sender.y} Q ${midX} ${peakY} ${receiver.x} ${receiver.y}`}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1.2"
          strokeDasharray="6 6"
          style={{ animation: 'path-dash 1.6s linear infinite' }}
        />
        {/* Progress fill of the arc */}
        <path
          d={`M ${sender.x} ${sender.y} Q ${midX} ${peakY} ${receiver.x} ${receiver.y}`}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={delivered ? 0 : arcLen - arcLen * t}
          style={{ transition: 'stroke-dashoffset 800ms ease-out', filter: 'drop-shadow(0 0 4px rgba(224,178,89,0.6))' }}
        />

        {/* Origin pin */}
        <Pin x={sender.x} y={sender.y} />
        {/* Destination pin */}
        <Pin x={receiver.x} y={receiver.y} pulsing={!delivered && !failed} />
      </svg>

      {/* The kitten flying along the arc — absolute HTML overlay so we can
          use rich SVG/CSS animation on it. Position computed from Bezier. */}
      {!failed && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${(cx / 1000) * 100}%`,
            top: `${(cy / 500) * 100}%`,
            transition: 'left 900ms ease-out, top 900ms ease-out',
          }}
        >
          <CatCoin size={42} playful={!delivered} />
        </div>
      )}

      {failed && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-white/60 text-[11px] uppercase tracking-[0.2em] font-semibold">Returned to sender</p>
        </div>
      )}

      {/* City labels overlay (HTML so emoji + text render nicely) */}
      <CityCallout city={sender} subtitle="From" anchor="left" />
      <CityCallout city={receiver} subtitle={recipientName ? `To · ${recipientName}` : 'To'} anchor="right" />

      {/* Status strip */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Live tracking</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
      </div>
      <div className="absolute top-3 right-3 text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold font-mono">
        {Math.round(t * 100)}%
      </div>
    </div>
  );
}

function Pin({ x, y, pulsing }: { x: number; y: number; pulsing?: boolean }) {
  return (
    <g>
      {pulsing && (
        <circle cx={x} cy={y} r="10" fill="url(#pinGlow)">
          <animate attributeName="r" from="6" to="22" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.8" to="0" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={x} cy={y} r="4" fill="#e0b259" />
      <circle cx={x} cy={y} r="6" fill="none" stroke="#e0b259" strokeOpacity="0.6" strokeWidth="1" />
    </g>
  );
}

function CityCallout({
  city,
  subtitle,
  anchor,
}: {
  city: MapCity;
  subtitle: string;
  anchor: 'left' | 'right';
}) {
  return (
    <div
      className={`absolute ${anchor === 'left' ? 'left-4' : 'right-4'} bottom-4 text-${anchor === 'right' ? 'right' : 'left'}`}
    >
      <p className="text-[9px] uppercase tracking-[0.25em] text-white/50 font-bold">{subtitle}</p>
      <p className="text-white text-base font-bold mt-0.5">
        {city.name} <span className="text-white/40 font-mono text-xs ml-1">{city.countryCode}</span>
      </p>
      <p className="text-white/50 text-[11px] font-mono mt-0.5">{city.country.toUpperCase()}</p>
    </div>
  );
}

function Stars() {
  const stars = [
    [8, 12, 1], [18, 8, 1.2], [32, 18, 0.9], [44, 10, 1], [60, 14, 1.1],
    [72, 6, 0.9], [84, 20, 1], [92, 12, 1.3], [12, 30, 1.1], [50, 32, 1],
    [76, 36, 0.9], [88, 30, 1], [22, 70, 1], [40, 78, 1.1], [62, 84, 0.9],
    [82, 76, 1], [10, 86, 1], [94, 80, 1.2],
  ] as const;
  return (
    <>
      {stars.map(([x, y, r], i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${r * 2}px`,
            height: `${r * 2}px`,
            animation: `twinkle ${2 + (i % 3) * 0.4}s ease-in-out infinite ${(i * 0.13) % 2}s`,
            boxShadow: '0 0 6px rgba(255,255,255,0.5)',
          }}
        />
      ))}
    </>
  );
}
