import React from 'react';
import { AccessibilityInfo, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body, Row } from './ui';
import { Kitten, type KittenState } from './Kitten';
import { STATUS_LABEL, STATUS_STEPS, dateTimeOf } from '../lib/format';
import type { TransferEvent, TransferStatus } from '../lib/types';
import { useTheme } from '../theme/tokens';

/**
 * The transfer as a journey: one winding route across the card, six stations,
 * and the kitten walking it.
 *
 * The layout rule that makes this work — and that an earlier vertical attempt
 * broke — is that **the route runs horizontally and every label sits directly
 * beneath its station**. Path above the line, text below it, so the two cannot
 * collide however the route bends. Stations are placed only on the straight
 * runs, never inside a turn, because a label under a bend has the curve passing
 * either side of it.
 */

/* ── Geometry ─────────────────────────────────────────────────────────────
 *
 * Three lanes joined by rounded U-turns. The vertical positions are fixed; the
 * horizontal extents come from the measured width, so this fits whatever the
 * card gives it.
 */
const LANE = [100, 236, 372];
const HEIGHT = 414;
/** Inset of the outer edge of each turn. */
const EDGE = 26;
const NODE_R = 13;
const STAR_R = 6.4;

const KITTEN_W = 92;
/** Fixed box, tall enough for the tallest clip, so every state sits at the
 *  same height on its station instead of bobbing as the artwork changes. */
const KITTEN_BOX = 108;

/** How far each station sits along its lane, as a fraction of the lane's run. */
const STATION_T = [0.0, 0.62, 0.06, 0.79, 0.36, 1.0];

/**
 * The clip the kitten holds while the money sits at a station, one per station.
 *
 * Fixed per station rather than timed, and that is the point. The kitten used
 * to arrive, play for 3.2 seconds, then swap to the sitting clip without
 * moving — and because the clips are cropped to different shapes, it changed
 * size on the spot. A transfer can sit at one stage for minutes; whatever it
 * shows there has to be something it can hold indefinitely.
 *
 * Alternating gives the journey some variety without anything being random:
 * the same stage always looks the same, on every transfer and every reopen, so
 * there is no state to keep and nothing to resynchronise when a socket update
 * arrives.
 *
 * `compliance_check` is not part of the alternation. A kitten batting a yarn
 * ball while someone's money is held for review reads as the app not taking it
 * seriously — the one station where the clip is a judgement, not a decoration.
 *
 * Indices follow STATUS_STEPS. `delivered` and the failure states never reach
 * here; they have clips of their own.
 */
const STATIONARY_CLIP: KittenState[] = [
  'idle', // initiated
  'play', // payment_received
  'waiting', // compliance_check — held, deliberately never playful
  'play', // fx_converted
  'idle', // payout_processing
  'delivered', // delivered — overridden below, listed so the map stays total
];

type Pt = { x: number; y: number };

type Seg =
  | { kind: 'line'; from: Pt; to: Pt; len: number }
  | { kind: 'arc'; cx: number; cy: number; r: number; a0: number; a1: number; len: number };

interface Route {
  d: string;
  segs: Seg[];
  total: number;
  /** Distance along the route to each of the six stations. */
  stops: number[];
}

function lineSeg(from: Pt, to: Pt): Seg {
  return { kind: 'line', from, to, len: Math.hypot(to.x - from.x, to.y - from.y) };
}

function arcSeg(cx: number, cy: number, r: number, a0: number, a1: number): Seg {
  return { kind: 'arc', cx, cy, r, a0, a1, len: r * Math.abs(a1 - a0) };
}

/**
 * Build the route for a given width.
 *
 * react-native-svg has no getTotalLength or getPointAtLength — the browser
 * prototype leaned on both — so the route is modelled as an explicit list of
 * lines and quarter arcs. Everything downstream (the mascot's position, the
 * length of the travelled thread, which way it is facing) reads from this one
 * model, so they cannot drift apart.
 */
function buildRoute(width: number): Route {
  const R = Math.max(18, Math.min(44, (width - EDGE * 2) / 4));
  const xL = EDGE;
  const xR = width - EDGE;
  const innerL = xL + R;
  const innerR = xR - R;
  const start = xL + 20;
  const end = xR - 39;

  const HALF_PI = Math.PI / 2;

  const segs: Seg[] = [
    lineSeg({ x: start, y: LANE[0] }, { x: innerR, y: LANE[0] }),
    arcSeg(innerR, LANE[0] + R, R, -HALF_PI, 0),
    lineSeg({ x: xR, y: LANE[0] + R }, { x: xR, y: LANE[1] - R }),
    arcSeg(innerR, LANE[1] - R, R, 0, HALF_PI),
    lineSeg({ x: innerR, y: LANE[1] }, { x: innerL, y: LANE[1] }),
    arcSeg(innerL, LANE[1] + R, R, -HALF_PI, -Math.PI),
    lineSeg({ x: xL, y: LANE[1] + R }, { x: xL, y: LANE[2] - R }),
    arcSeg(innerL, LANE[2] - R, R, Math.PI, HALF_PI),
    lineSeg({ x: innerL, y: LANE[2] }, { x: end, y: LANE[2] }),
  ];

  const d = [
    `M${start} ${LANE[0]}`,
    `L${innerR} ${LANE[0]}`,
    `A${R} ${R} 0 0 1 ${xR} ${LANE[0] + R}`,
    `L${xR} ${LANE[1] - R}`,
    `A${R} ${R} 0 0 1 ${innerR} ${LANE[1]}`,
    `L${innerL} ${LANE[1]}`,
    `A${R} ${R} 0 0 0 ${xL} ${LANE[1] + R}`,
    `L${xL} ${LANE[2] - R}`,
    `A${R} ${R} 0 0 0 ${innerL} ${LANE[2]}`,
    `L${end} ${LANE[2]}`,
  ].join(' ');

  const total = segs.reduce((a, s) => a + s.len, 0);

  // Stations live on the three straight lanes — segments 0, 4 and 8 — two to a
  // lane. Offsets are fractions of their own lane so they stay proportionate
  // when the card is narrower.
  const before = (i: number) => segs.slice(0, i).reduce((a, s) => a + s.len, 0);
  const lanes = [
    { at: before(0), len: segs[0].len },
    { at: before(4), len: segs[4].len },
    { at: before(8), len: segs[8].len },
  ];
  const stops = STATION_T.map((t, i) => {
    const lane = lanes[Math.floor(i / 2)];
    return lane.at + lane.len * t;
  });

  return { d, segs, total, stops };
}

/** The point at a distance along the route. */
function pointAt(route: Route, len: number): Pt {
  let rest = Math.max(0, Math.min(len, route.total));
  for (const s of route.segs) {
    if (rest > s.len) {
      rest -= s.len;
      continue;
    }
    const t = s.len === 0 ? 0 : rest / s.len;
    if (s.kind === 'line') {
      return {
        x: s.from.x + (s.to.x - s.from.x) * t,
        y: s.from.y + (s.to.y - s.from.y) * t,
      };
    }
    const a = s.a0 + (s.a1 - s.a0) * t;
    return { x: s.cx + s.r * Math.cos(a), y: s.cy + s.r * Math.sin(a) };
  }
  const last = route.segs[route.segs.length - 1];
  return last.kind === 'line' ? last.to : { x: last.cx, y: last.cy };
}

/** True when the route is heading left-to-right at this point. */
function headingRight(route: Route, len: number): boolean {
  const a = pointAt(route, Math.max(0, len - 4));
  const b = pointAt(route, Math.min(route.total, len + 4));
  return b.x > a.x;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

export function JourneyPath({
  status,
  timeline,
}: {
  status: TransferStatus;
  timeline: TransferEvent[];
}) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const failed = status === 'failed' || status === 'cancelled';
  const reached = React.useMemo(
    () => new Set(timeline.map((e) => e.status)),
    [timeline],
  );

  /**
   * Which station the kitten belongs on.
   *
   * A failed transfer stops wherever it got to, and neither `failed` nor
   * `cancelled` is one of the six stations — so it stands on the last stage
   * actually reached rather than nowhere.
   */
  const targetIndex = React.useMemo(() => {
    if (failed) {
      let last = 0;
      STATUS_STEPS.forEach((s, i) => {
        if (reached.has(s)) last = i;
      });
      return last;
    }
    const i = STATUS_STEPS.indexOf(status);
    return i === -1 ? 0 : i;
  }, [status, failed, reached]);

  const route = React.useMemo(
    () => (width > 0 ? buildRoute(width) : null),
    [width],
  );

  /* ── Walking between stations ───────────────────────────────────────────
   *
   * Stage changes arrive from the backend over a socket, so the kitten walks
   * whenever the target moves rather than on a canned timer. `travelled` is the
   * distance covered; the thread and the mascot both read from it.
   */
  const [travelled, setTravelled] = React.useState(0);
  const [walking, setWalking] = React.useState(false);
  const frame = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!route) return;
    const to = route.stops[targetIndex];
    const from = travelled;

    // Arriving used to start a 3.2-second burst of the play clip, which then
    // swapped back to the sitting one in place. Two clips at one station, and
    // the swap was visible: `play` and `waiting` are cropped to different
    // shapes, so the kitten jumped size mid-stage and read as broken. A
    // station now shows one clip for as long as the money sits there —
    // see STATIONARY_CLIP.
    const settle = () => setWalking(false);

    if (reduceMotion || Math.abs(to - from) < 0.5) {
      setTravelled(to);
      settle();
      return;
    }

    setWalking(true);
    // Slow on purpose. The clips are ten-second loops, and hurrying between
    // stations showed a fraction of one — enough to read as a still image.
    const duration = 1100 + Math.abs(to - from) * 8;
    const t0 = Date.now();
    const ease = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / duration);
      setTravelled(from + (to - from) * ease(k));
      if (k < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        frame.current = null;
        settle();
      }
    };
    frame.current = requestAnimationFrame(step);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
    // `travelled` is deliberately not a dependency: it changes every frame and
    // would restart the walk on each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, targetIndex, reduceMotion, failed, status]);

  const kittenState: KittenState = failed
    ? 'sorry'
    : walking
      ? 'travel'
      : status === 'delivered'
        ? 'delivered'
        : (STATIONARY_CLIP[targetIndex] ?? 'idle');

  if (!route) {
    return (
      <View
        style={{ height: HEIGHT }}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      />
    );
  }

  const here = pointAt(route, travelled);
  const doneColor = failed ? colors.pending : colors.accent;
  // Only the travel clip has a direction to get wrong; the sitting poses face
  // the camera and flipping them would achieve nothing.
  const flip = kittenState === 'travel' && headingRight(route, travelled);

  const currentEvent = timeline.find((e) => e.status === STATUS_STEPS[targetIndex]);

  return (
    <View style={{ gap: 10 }}>
      {/* Where the money is now, and when it got there. One line, above the
          route — the stations carry their names only, because a second line
          under each one collided with the mascot and ran off the card. */}
      <Row style={{ alignItems: 'center' }} gap={8}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: failed ? colors.pending : colors.accent,
          }}
        />
        <Body size={13} tone="ink" weight="600">
          {failed ? STATUS_LABEL[status] : STATUS_LABEL[STATUS_STEPS[targetIndex]]}
        </Body>
        {currentEvent ? (
          <Body size={11} tone="faint" style={{ marginLeft: 'auto' }}>
            {dateTimeOf(currentEvent.createdAt)}
          </Body>
        ) : null}
      </Row>

      <View style={{ height: HEIGHT }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Svg width={width} height={HEIGHT} style={{ position: 'absolute' }}>
        {/* The route still to come: dotted, so "planned" and "done" differ by
            shape and not only by colour. */}
        <Path
          d={route.d}
          fill="none"
          stroke={colors.lineStrong}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="1 8"
        />
        {travelled > 0 && (
          <Path
            d={route.d}
            fill="none"
            stroke={doneColor}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={`${travelled} ${route.total}`}
          />
        )}

        {route.stops.map((len, i) => {
          const p = pointAt(route, len);
          const done = travelled >= len - 0.5;
          return (
            <React.Fragment key={STATUS_STEPS[i]}>
              <Circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                fill={done ? doneColor : colors.card}
                stroke={done ? doneColor : colors.lineStrong}
                strokeWidth={done ? 0 : 2}
              />
              {/* Gold, and gold only here. The mark's colour measures 1.97:1 on
                  white, so it never touches the card — on the slate disc of a
                  completed station it is legible and ties the mascot, the logo
                  and the route into one palette. */}
              <Path
                d={starPath(p.x, p.y, STAR_R, STAR_R * 0.42)}
                fill={done ? colors.gold : 'none'}
                stroke={done ? 'none' : colors.lineStrong}
                strokeWidth={1.2}
              />
            </React.Fragment>
          );
        })}
      </Svg>

      {route.stops.map((len, i) => {
        const step = STATUS_STEPS[i];
        const p = pointAt(route, len);
        const done = reached.has(step);
        const atHere = i === targetIndex;
        const first = i === 0;
        const last = i === route.stops.length - 1;
        return (
          <View
            key={step}
            style={{
              position: 'absolute',
              top: p.y + NODE_R + 6,
              // Centred under its station, except at the two ends where that
              // would hang the text off the card.
              left: first ? Math.max(0, p.x - NODE_R) : last ? undefined : p.x - 60,
              right: last ? Math.max(0, width - p.x - NODE_R - 4) : undefined,
              width: first || last ? undefined : 120,
              alignItems: first ? 'flex-start' : last ? 'flex-end' : 'center',
            }}
            pointerEvents="none"
          >
            <Body
              size={10.5}
              tone={done ? 'ink' : 'faint'}
              weight={atHere ? '700' : done ? '600' : '400'}
              numberOfLines={1}
            >
              {STATUS_LABEL[step]}
            </Body>
          </View>
        );
      })}

      {/* Feet on the line, body above it. Labels live below the line, so the
          mascot can travel the whole route without ever covering a word. */}
      <View
        style={{
          position: 'absolute',
          left: here.x - KITTEN_W / 2,
          top: here.y + 7 - KITTEN_BOX,
          width: KITTEN_W,
          height: KITTEN_BOX,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
        pointerEvents="none"
      >
        <Kitten
          state={kittenState}
          width={KITTEN_W}
          flip={flip}
          accessibilityLabel={STATUS_LABEL[status]}
        />
      </View>
      </View>
    </View>
  );
}
