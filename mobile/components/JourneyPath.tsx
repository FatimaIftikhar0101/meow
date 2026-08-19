import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body } from './ui';
import { Kitten, type KittenState } from './Kitten';
import { STATUS_LABEL, STATUS_STEPS, dateTimeOf } from '../lib/format';
import type { TransferEvent, TransferStatus } from '../lib/types';
import { colors, radius } from '../theme/tokens';

/**
 * The transfer as a journey.
 *
 * The layout rule this is built on, learned the hard way: **the rail and the
 * text occupy disjoint columns.** A first attempt let the path wander across
 * the full width with labels beside each station, and the two fought for the
 * same pixels — timestamps ended up struck through by the curve. Duolingo's
 * path can wander because it carries no text; ours carries six labels and six
 * timestamps, so the path lives in a fixed left gutter and the text starts
 * where the gutter ends. Nothing can overlap because nothing shares an x range.
 *
 * The gutter is sized to the mascot rather than the other way round, so the
 * kitten has somewhere real to stand instead of floating over the copy.
 */

/** The mascot, and therefore the gutter it lives in. */
const KITTEN_W = 96;
const GUTTER_W = 104;
/** Centre of the rail within the gutter. */
const RAIL_CX = 52;
/**
 * How far the rail drifts either side of centre.
 *
 * Deliberately small. The first version swung across the whole card and read
 * as a seismograph — this is a journey, not a readout, and a bank's screen
 * should feel composed. This is enough to read as a path and not enough to read
 * as a zigzag.
 */
const AMP = 24;
const ROW_H = 54;
/**
 * A fixed box the mascot is centred in.
 *
 * Tall enough for the tallest clip (the sorry pose, 320x356, which is 116pt at
 * this width). Fixing the box rather than measuring each clip keeps every state
 * sitting at exactly the same height on its station.
 */
const KITTEN_BOX = 112;
/** Half the box, so the kitten never clips the card at the first or last stop. */
const PAD_V = KITTEN_BOX / 2 + 8;
const NODE_R = 7;
const TEXT_X = GUTTER_W + 14;

type Pt = { x: number; y: number };

/**
 * A smooth curve through the stations.
 *
 * Catmull-Rom converted to cubic Béziers, so the curve passes through every
 * station — a plain Bézier using the stations as control points would sail
 * past them, and a station the path misses is not a station.
 */
function curveThrough(pts: Pt[]): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d.push(`C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

/**
 * Distance along the curve to each station.
 *
 * react-native-svg has no getTotalLength, and the dash length has to be exact
 * or the travelled thread stops short of the kitten standing on it.
 */
function cumulativeLengths(pts: Pt[]): number[] {
  const out = [0];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    let prev = p1;
    for (let s = 1; s <= 24; s++) {
      const t = s / 24;
      const u = 1 - t;
      const pt = {
        x: u * u * u * p1.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p2.x,
        y: u * u * u * p1.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p2.y,
      };
      total += Math.hypot(pt.x - prev.x, pt.y - prev.y);
      prev = pt;
    }
    out.push(total);
  }
  return out;
}

export function JourneyPath({
  status,
  timeline,
}: {
  status: TransferStatus;
  timeline: TransferEvent[];
}) {
  const [width, setWidth] = React.useState(0);

  const failed = status === 'failed' || status === 'cancelled';
  const reached = React.useMemo(
    () => new Set(timeline.map((e) => e.status)),
    [timeline],
  );

  /**
   * Which station the kitten is standing on.
   *
   * A failed transfer stops wherever it got to, and neither `failed` nor
   * `cancelled` is one of the six stations — so the marker goes on the last
   * stage actually reached rather than nowhere.
   */
  const currentIndex = React.useMemo(() => {
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

  const kittenState: KittenState = failed
    ? 'sorry'
    : status === 'delivered'
      ? 'delivered'
      : status === 'compliance_check'
        ? 'waiting'
        : 'travel';

  const height = PAD_V * 2 + ROW_H * (STATUS_STEPS.length - 1);

  const nodes: Pt[] = React.useMemo(
    () =>
      STATUS_STEPS.map((_, i) => ({
        // One gentle wave over the whole list rather than a hard alternation,
        // so consecutive segments lean into each other instead of snapping back.
        x: RAIL_CX + AMP * Math.sin((i / (STATUS_STEPS.length - 1)) * Math.PI * 2),
        y: PAD_V + i * ROW_H,
      })),
    [],
  );

  const d = React.useMemo(() => curveThrough(nodes), [nodes]);
  const lengths = React.useMemo(() => cumulativeLengths(nodes), [nodes]);
  const total = lengths[lengths.length - 1] ?? 0;
  const travelled = lengths[currentIndex] ?? 0;
  const doneColor = failed ? colors.pending : colors.accent;

  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* The current stage, called out behind its text. The eye should land on
          "where is my money right now" before anything else on this card. */}
      <View
        style={{
          position: 'absolute',
          left: TEXT_X - 12,
          right: 0,
          top: PAD_V + currentIndex * ROW_H - 22,
          height: 44,
          borderRadius: radius.sm,
          backgroundColor: colors.inset,
        }}
        pointerEvents="none"
      />

      <Svg width={GUTTER_W} height={height} style={{ position: 'absolute' }}>
        {/* The route still to come: dashed, so it reads as planned rather than
            travelled. Drawn first and thinner, so the solid thread covers it. */}
        <Path
          d={d}
          fill="none"
          stroke={colors.lineStrong}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="1 9"
        />
        {/* The thread already unspooled. Same geometry, dashed to the distance
            covered — drawing the route twice is what stops the two disagreeing. */}
        {travelled > 0 && (
          <Path
            d={d}
            fill="none"
            stroke={doneColor}
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={`${travelled} ${total}`}
          />
        )}

        {nodes.map((p, i) => {
          const done = reached.has(STATUS_STEPS[i]);
          // The kitten stands on the current station, so no dot is drawn there
          // — the mascot is the marker, and two markers would be one too many.
          if (i === currentIndex) return null;
          return (
            <Circle
              key={STATUS_STEPS[i]}
              cx={p.x}
              cy={p.y}
              r={NODE_R}
              fill={done ? doneColor : colors.card}
              stroke={done ? doneColor : colors.lineStrong}
              strokeWidth={done ? 0 : 2}
            />
          );
        })}
      </Svg>

      {width > 0 &&
        nodes.map((p, i) => {
          const step = STATUS_STEPS[i];
          const event = timeline.find((e) => e.status === step);
          const done = reached.has(step);
          const here = i === currentIndex;
          return (
            <View
              key={step}
              style={{
                position: 'absolute',
                left: TEXT_X,
                right: 0,
                top: p.y - 17,
              }}
              pointerEvents="none"
            >
              <Body
                size={13.5}
                tone={done ? 'ink' : 'faint'}
                weight={here ? '700' : done ? '600' : '400'}
                numberOfLines={1}
              >
                {STATUS_LABEL[step]}
              </Body>
              <Body size={11.5} tone="faint" numberOfLines={1}>
                {event ? dateTimeOf(event.createdAt) : failed ? 'Not reached' : 'Pending'}
              </Body>
            </View>
          );
        })}

      {/* The mascot, standing on its station inside the gutter. It cannot reach
          the text column, so it can never cover a label or a time.

          Centred inside a fixed box rather than offset by half its own width:
          every clip is cropped to its own subject, so their heights differ —
          the plane is wide and short, the sorry pose tall and narrow — and
          offsetting by width would sit each one at a different height. */}
      <View
        style={{
          position: 'absolute',
          // Fixed horizontally at the centre of the gutter, moving only down.
          // Following the rail's x as well would push the mascot off the card
          // at the outer swings — and since the rail never leaves the mascot's
          // own footprint, it still reads as standing on its station.
          left: 0,
          top: nodes[currentIndex].y - KITTEN_BOX / 2,
          width: GUTTER_W,
          height: KITTEN_BOX,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        pointerEvents="none"
      >
        <Kitten
          state={kittenState}
          width={KITTEN_W}
          accessibilityLabel={STATUS_LABEL[status]}
        />
      </View>
    </View>
  );
}
