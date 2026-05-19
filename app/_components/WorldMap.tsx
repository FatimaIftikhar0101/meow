'use client';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { geoNaturalEarth1, type GeoProjection } from 'd3-geo';

/**
 * Real-world map (Natural Earth low-res, 110m resolution, ~106KB) rendered
 * via react-simple-maps + d3-geo. Real coastline data — not a stylised
 * polygon approximation. Sender + recipient cities are projected from
 * real lat/long, and the kitten flies along a quadratic Bezier between
 * the two projected screen-space points.
 */

interface MapCity {
  name: string;
  country: string;
  countryCode: string;
  /** Real lon, lat. */
  coords: [number, number];
}

const CITIES: Record<string, MapCity> = {
  CA: { name: 'Toronto', country: 'Canada', countryCode: 'CA', coords: [-79.3832, 43.6532] },
  US: { name: 'New York', country: 'USA', countryCode: 'US', coords: [-74.006, 40.7128] },
  GB: { name: 'London', country: 'UK', countryCode: 'GB', coords: [-0.1276, 51.5074] },
  PK: { name: 'Karachi', country: 'Pakistan', countryCode: 'PK', coords: [67.0099, 24.8607] },
  IN: { name: 'Mumbai', country: 'India', countryCode: 'IN', coords: [72.8777, 19.076] },
  PH: { name: 'Manila', country: 'Philippines', countryCode: 'PH', coords: [120.9842, 14.5995] },
};

const CURRENCY_COUNTRY: Record<string, string> = {
  CAD: 'CA',
  USD: 'US',
  GBP: 'GB',
  PKR: 'PK',
  INR: 'IN',
  PHP: 'PH',
};

const MAP_W = 1000;
const MAP_H = 500;

// Shared projection so the arc + kitten line up with the rendered map.
function makeProjection(): GeoProjection {
  return geoNaturalEarth1().scale(170).translate([MAP_W / 2, MAP_H / 2 + 10]);
}

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
  const projection = makeProjection();
  const sender = CITIES[CURRENCY_COUNTRY[sendCurrency] ?? 'CA'] ?? CITIES.CA;
  const receiver = CITIES[CURRENCY_COUNTRY[receiveCurrency] ?? 'PK'] ?? CITIES.PK;
  const senderCode = CURRENCY_COUNTRY[sendCurrency] ?? sender.countryCode;
  const receiverCode = CURRENCY_COUNTRY[receiveCurrency] ?? receiver.countryCode;

  const [sx, sy] = projection(sender.coords) ?? [0, 0];
  const [rx, ry] = projection(receiver.coords) ?? [0, 0];

  // Bezier control point: lifted above the midpoint by ~30% of the distance.
  const midX = (sx + rx) / 2;
  const dist = Math.hypot(rx - sx, ry - sy);
  const peakY = Math.min(sy, ry) - dist * 0.3;

  const t = Math.max(0, Math.min(1, progress));
  const cx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * midX + t * t * rx;
  const cy = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * peakY + t * t * ry;
  const arcLen = Math.max(400, dist * 1.6);

  // Geographies callback typed loosely because react-simple-maps' GeoJSON
  // payload is generic.
  type Geo = { rsmKey: string; id?: string; properties?: { name?: string } };

  return (
    <div
      className="relative rounded-3xl overflow-hidden border border-[var(--border)]"
      style={{ background: 'linear-gradient(180deg, #03050a 0%, #0b1126 100%)' }}
    >
      <Stars />

      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 170 }}
        width={MAP_W}
        height={MAP_H}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <Geographies geography="/world-110m.json">
          {({ geographies }: { geographies: Geo[] }) =>
            geographies.map((geo) => {
              const isOrigin = geo.id === iso3(senderCode);
              const isDest = geo.id === iso3(receiverCode);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo as unknown as Parameters<typeof Geography>[0]['geography']}
                  fill={isOrigin || isDest ? '#1a2a52' : '#0f1b3a'}
                  stroke="#1d2a52"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover: { outline: 'none', fill: '#1a2a52' },
                    pressed: { outline: 'none' },
                  }}
                />
              );
            })
          }
        </Geographies>

        {/* Latitude gridlines for atmosphere */}
        <g stroke="#1a2240" strokeWidth="0.4" opacity="0.5">
          <line x1="0" y1={MAP_H * 0.3} x2={MAP_W} y2={MAP_H * 0.3} />
          <line x1="0" y1={MAP_H * 0.5} x2={MAP_W} y2={MAP_H * 0.5} strokeOpacity="0.8" />
          <line x1="0" y1={MAP_H * 0.7} x2={MAP_W} y2={MAP_H * 0.7} />
        </g>

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
        </defs>

        {/* Dashed marching guide */}
        <path
          d={`M ${sx} ${sy} Q ${midX} ${peakY} ${rx} ${ry}`}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.2"
          strokeDasharray="6 6"
          style={{ animation: 'path-dash 1.6s linear infinite' }}
        />
        {/* Progress fill */}
        <path
          d={`M ${sx} ${sy} Q ${midX} ${peakY} ${rx} ${ry}`}
          fill="none"
          stroke="url(#arcGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={arcLen}
          strokeDashoffset={delivered ? 0 : arcLen - arcLen * t}
          style={{ transition: 'stroke-dashoffset 800ms ease-out', filter: 'drop-shadow(0 0 4px rgba(224,178,89,0.6))' }}
        />

        {/* Pins */}
        <Pin x={sx} y={sy} />
        <Pin x={rx} y={ry} pulsing={!delivered && !failed} />
      </ComposableMap>

      {/* A small gold packet glides along the arc — the cat is shown in the
          separate timeline below, not on the map itself. */}
      {!failed && (
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            left: `${(cx / MAP_W) * 100}%`,
            top: `${(cy / MAP_H) * 100}%`,
            transition: 'left 900ms ease-out, top 900ms ease-out',
            filter: 'drop-shadow(0 0 8px rgba(224,178,89,0.7))',
          }}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #fff1c2, #e0b259 60%, #9a6d18)',
            }}
          />
        </div>
      )}

      {failed && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-white/60 text-[11px] uppercase tracking-[0.2em] font-semibold">Returned to sender</p>
        </div>
      )}

      <CityCallout city={sender} subtitle="From" anchor="left" />
      <CityCallout city={receiver} subtitle={recipientName ? `To · ${recipientName}` : 'To'} anchor="right" />

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
      className={`absolute ${anchor === 'left' ? 'left-4' : 'right-4'} bottom-4 ${anchor === 'right' ? 'text-right' : 'text-left'}`}
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
          className="absolute rounded-full bg-white pointer-events-none"
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

// world-atlas keys countries by ISO 3166-1 numeric ID (string), not alpha-2.
function iso3(alpha2: string): string | undefined {
  return ISO_NUMERIC[alpha2];
}
const ISO_NUMERIC: Record<string, string> = {
  CA: '124',
  US: '840',
  GB: '826',
  PK: '586',
  IN: '356',
  PH: '608',
};
