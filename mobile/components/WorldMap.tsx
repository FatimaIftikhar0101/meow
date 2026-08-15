import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { colors } from '../theme/tokens';
import { CatMark } from './CatMark';
import { COUNTRY_PATH, LAND_PATH, MAP_H, MAP_W } from './worldLand.data';

/**
 * The corridor drawn on the real world.
 *
 * The coastline is precomputed SVG path data (see components/worldLand.data.ts
 * and the generator that made it), so the app ships no map library and the
 * phone does no projection work — the earlier web globe spent 4.5s of main
 * thread on exactly that mistake.
 *
 * Everything here shares one equirectangular space, which is the whole reason
 * a pin sits on its own country rather than near it: `project()` below is the
 * identical transform that produced the coastline, verified to 0.0000 drift
 * against d3-geo at build time.
 */

interface City {
  name: string;
  /** Real longitude, latitude. */
  lon: number;
  lat: number;
}

/**
 * One city per country, used as that country's pin.
 *
 * Wider than the corridors that exist today (CA/US/GB → PK/IN/PH) so that
 * adding a corridor does not silently mis-draw the map. The first four match
 * the web client's coordinates exactly, so the two maps agree where they
 * overlap.
 */
export const CITIES: Record<string, City> = {
  // Send side
  CA: { name: 'Toronto', lon: -79.3832, lat: 43.6532 },
  US: { name: 'New York', lon: -74.006, lat: 40.7128 },
  GB: { name: 'London', lon: -0.1276, lat: 51.5074 },
  AU: { name: 'Sydney', lon: 151.2093, lat: -33.8688 },
  AE: { name: 'Dubai', lon: 55.2708, lat: 25.2048 },
  SA: { name: 'Riyadh', lon: 46.6753, lat: 24.7136 },
  DE: { name: 'Berlin', lon: 13.405, lat: 52.52 },
  FR: { name: 'Paris', lon: 2.3522, lat: 48.8566 },
  IT: { name: 'Rome', lon: 12.4964, lat: 41.9028 },
  ES: { name: 'Madrid', lon: -3.7038, lat: 40.4168 },
  SG: { name: 'Singapore', lon: 103.8198, lat: 1.3521 },
  MY: { name: 'Kuala Lumpur', lon: 101.6869, lat: 3.139 },
  QA: { name: 'Doha', lon: 51.531, lat: 25.2854 },
  KW: { name: 'Kuwait City', lon: 47.9774, lat: 29.3759 },
  // Receive side
  PK: { name: 'Karachi', lon: 67.0099, lat: 24.8607 },
  IN: { name: 'Mumbai', lon: 72.8777, lat: 19.076 },
  PH: { name: 'Manila', lon: 120.9842, lat: 14.5995 },
  BD: { name: 'Dhaka', lon: 90.4125, lat: 23.8103 },
  NP: { name: 'Kathmandu', lon: 85.324, lat: 27.7172 },
  LK: { name: 'Colombo', lon: 79.8612, lat: 6.9271 },
  NG: { name: 'Lagos', lon: 3.3792, lat: 6.5244 },
  KE: { name: 'Nairobi', lon: 36.8219, lat: -1.2921 },
  GH: { name: 'Accra', lon: -0.187, lat: 5.6037 },
  EG: { name: 'Cairo', lon: 31.2357, lat: 30.0444 },
  MX: { name: 'Mexico City', lon: -99.1332, lat: 19.4326 },
  VN: { name: 'Hanoi', lon: 105.8342, lat: 21.0278 },
  ID: { name: 'Jakarta', lon: 106.8456, lat: -6.2088 },
  CN: { name: 'Shanghai', lon: 121.4737, lat: 31.2304 },
};

/**
 * Where a currency is sent from. A transfer records its send *currency*, not a
 * country, so the origin pin has to be derived. Falls back to Canada, which is
 * the only corridor origin the product currently has.
 */
const CURRENCY_COUNTRY: Record<string, string> = {
  CAD: 'CA',
  USD: 'US',
  GBP: 'GB',
  PKR: 'PK',
  INR: 'IN',
  PHP: 'PH',
};

export function countryForCurrency(code: string | null | undefined): string {
  return CURRENCY_COUNTRY[(code ?? '').toUpperCase()] ?? 'CA';
}

/** Equirectangular. Linear, and identical to the build-time projection. */
function project(lon: number, lat: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * MAP_W,
    y: ((90 - lat) / 180) * MAP_H,
  };
}

/**
 * A quadratic whose apex sits a fixed height above the higher endpoint.
 *
 * The lift is capped. Purely proportional lift put Canada→Pakistan's apex at
 * y = -10.7 — off the top of the map entirely, so the mark flew over blank
 * space above the north pole and dragged a quarter of the frame with it.
 */
function arcOf(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const apexY = Math.min(a.y, b.y) - Math.min(dist * 0.26, 110);
  // For a quadratic, the curve at t=0.5 is (p0 + 2·ctrl + p2)/4. Solving that
  // for the control point puts the apex exactly where we asked, rather than
  // roughly near it.
  const ctrl = { x: (a.x + b.x) / 2, y: 2 * apexY - (a.y + b.y) / 2 };
  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * ctrl.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * ctrl.y + t * t * b.y,
    };
  };
  return { ctrl, at, d: `M${a.x} ${a.y} Q${ctrl.x} ${ctrl.y} ${b.x} ${b.y}`, length: dist * 1.25 };
}

export function WorldMap({
  fromCountry = 'CA',
  toCountry = 'PK',
  progress = 0,
  aspect = 3.4,
  showMark = true,
  markSize = 22,
  eyesClosed = false,
  onSlab = true,
}: {
  fromCountry?: string;
  toCountry?: string;
  /** 0–1 along the corridor. */
  progress?: number;
  /** Width ÷ height of the box this is drawn in. The viewBox is cropped to
   *  match, so the map never letterboxes and overlays stay aligned. */
  aspect?: number;
  showMark?: boolean;
  markSize?: number;
  eyesClosed?: boolean;
  /** Drawn on a dark slab (washes of white) rather than on the white canvas. */
  onSlab?: boolean;
}) {
  const fromCode = fromCountry?.toUpperCase() ?? '';
  const toCode = toCountry?.toUpperCase() ?? '';
  const from = CITIES[fromCode];
  const to = CITIES[toCode];

  /**
   * If either end is a country we have no coordinates for, draw the world and
   * stop there — no arc, no pins, no mark.
   *
   * This used to fall back to Toronto → Karachi, which meant an unrecognised
   * corridor would confidently draw the money going somewhere it was not. On a
   * screen whose whole job is telling someone where their money is, a map that
   * guesses is worse than a map that admits it does not know.
   */
  const known = from != null && to != null;

  const view = useMemo(() => {
    if (!known) return null;
    const a = project(from.lon, from.lat);
    const b = project(to.lon, to.lat);
    const arc = arcOf(a, b);
    const t = Math.max(0, Math.min(1, progress));
    const cat = arc.at(t);

    // Frame both endpoints and the arc's apex, then grow the short side until
    // the crop matches the container. Growing rather than shrinking keeps both
    // pins inside the frame whatever shape the container turns out to be.
    const apex = arc.at(0.5);
    let minX = Math.min(a.x, b.x);
    let maxX = Math.max(a.x, b.x);
    let minY = Math.min(a.y, b.y, apex.y);
    let maxY = Math.max(a.y, b.y, apex.y);

    const padX = (maxX - minX) * 0.22 + 24;
    const padY = (maxY - minY) * 0.3 + 18;
    minX -= padX;
    maxX += padX;
    minY -= padY;
    maxY += padY;

    let w = maxX - minX;
    let h = maxY - minY;
    if (w / h < aspect) {
      const want = h * aspect;
      minX -= (want - w) / 2;
      w = want;
    } else {
      const want = w / aspect;
      minY -= (want - h) / 2;
      h = want;
    }

    return { a, b, arc, cat, minX, minY, w, h };
  }, [known, from, to, progress, aspect]);

  const t = Math.max(0, Math.min(1, progress));

  const landFill = onSlab ? 'rgba(255,255,255,0.10)' : colors.inset;
  const landEdge = onSlab ? 'rgba(255,255,255,0.16)' : colors.line;
  const hiFill = onSlab ? 'rgba(255,255,255,0.26)' : colors.lineStrong;
  const route = onSlab ? 'rgba(255,255,255,0.30)' : colors.lineStrong;
  const flown = onSlab ? colors.onSlab : colors.accent;
  const pin = onSlab ? colors.onSlab : colors.accent;

  /** Whole world, centred, when we cannot honestly draw a route. */
  if (!view) {
    return (
      <View style={{ width: '100%', aspectRatio: aspect }}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid slice"
        >
          <Path d={LAND_PATH} fill={landFill} stroke={landEdge} strokeWidth={0.5} />
        </Svg>
      </View>
    );
  }

  const { a, b, arc, cat, minX, minY, w, h } = view;

  return (
    <View style={{ width: '100%', aspectRatio: aspect }}>
      <Svg width="100%" height="100%" viewBox={`${minX} ${minY} ${w} ${h}`}>
        {/* Every landmass, merged — one path, no internal borders to read as
            noise at this size. */}
        <Path d={LAND_PATH} fill={landFill} stroke={landEdge} strokeWidth={0.5} />

        {/* The two countries this corridor actually joins, picked out. */}
        {COUNTRY_PATH[fromCode] && <Path d={COUNTRY_PATH[fromCode]} fill={hiFill} />}
        {COUNTRY_PATH[toCode] && <Path d={COUNTRY_PATH[toCode]} fill={hiFill} />}

        {/* The whole route, then the portion already flown drawn by dashing the
            same path so the two cannot diverge. */}
        <Path d={arc.d} fill="none" stroke={route} strokeWidth={1.6} strokeLinecap="round" />
        {t > 0 && (
          <Path
            d={arc.d}
            fill="none"
            stroke={flown}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${arc.length * t} ${arc.length}`}
          />
        )}

        <G>
          <Circle cx={a.x} cy={a.y} r={4} fill={pin} />
          <Circle
            cx={b.x}
            cy={b.y}
            r={4}
            fill={t >= 1 ? pin : 'transparent'}
            stroke={pin}
            strokeWidth={1.8}
          />
        </G>
      </Svg>

      {/* The mark rides the arc. It is a React Native view over the SVG, so it
          is placed as a fraction of the *cropped* viewBox — the same box the
          container's aspectRatio pins, which is what keeps the two in step. */}
      {showMark && (
        <View
          style={{
            position: 'absolute',
            left: `${((cat.x - minX) / w) * 100}%`,
            top: `${((cat.y - minY) / h) * 100}%`,
            marginLeft: -markSize / 2,
            marginTop: -markSize / 2,
          }}
          pointerEvents="none"
        >
          <CatMark size={markSize} eyesClosed={eyesClosed} roundel />
        </View>
      )}
    </View>
  );
}
