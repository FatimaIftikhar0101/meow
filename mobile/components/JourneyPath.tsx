import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Body } from './ui';
import { Kitten, type KittenState } from './Kitten';
import { STATUS_LABEL, STATUS_STEPS, dateTimeOf } from '../lib/format';
import type { TransferEvent, TransferStatus } from '../lib/types';
import { colors } from '../theme/tokens';

/**
 * The transfer as a journey rather than a list.
 *
 * Six stations on one screen, no scrolling — a flat timeline answered "what
 * happened" but never "how far", and scrolling to find out where your money is
 * would be decoration charging rent.
 *
 * The trail behind the kitten is the yarn it has unspooled, and it fills in
 * exactly the way the world map fills its flown arc: one path drawn twice, the
 * second dashed to the distance covered. Drawing the same geometry twice is
 * what stops the two ever disagreeing.
 */

const NODE_R = 15;
/** Vertical distance between stations. Two lines of label sit beside each. */
const STEP = 64;
const PAD_TOP = 34; // headroom for the kitten sitting above its station
const PAD_BOTTOM = 12;
/** How far in from each edge the stations sit, as a fraction of width. */
const INSET = 0.2;

type Pt = { x: number; y: number };

/**
 * A smooth curve through the stations.
 *
 * Catmull-Rom converted to cubic Béziers, which gives a curve that actually
 * passes through every point — a plain Bézier with the stations as control
 * points would sail past them, and a station the path misses is not a station.
 *
 * The sketch had square corners. Those were softened deliberately: a character
 * rounding a curve reads as movement, whereas one turning ninety degrees needs
 * a pivot animation nobody is going to draw.
 */
function curveThrough(pts: Pt[]): string {
  if (pts.length < 2) return '';
  const d: string[] = [`M${pts[0].x} ${pts[0].y}`];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    // 1/6 is the standard Catmull-Rom to Bézier tangent scale.
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d.push(`C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`);
  }
  return d.join(' ');
}

/**
 * Distance along the curve to each station.
 *
 * react-native-svg has no getTotalLength, and the dash length has to be right
 * or the trail stops short of the kitten. Since the geometry is ours, the arc
 * length is sampled here rather than guessed.
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
    const STEPS = 24;
    for (let s = 1; s <= STEPS; s++) {
      const t = s / STEPS;
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
  kittenWidth = 96,
}: {
  status: TransferStatus;
  timeline: TransferEvent[];
  kittenWidth?: number;
}) {
  const [width, setWidth] = React.useState(0);

  const failed = status === 'failed' || status === 'cancelled';
  const reached = React.useMemo(
    () => new Set(timeline.map((e) => e.status)),
    [timeline],
  );

  /**
   * Where the kitten is standing.
   *
   * For a failed transfer the timeline stops wherever it got to, so the last
   * stage actually reached is the station — not the failure itself, which is
   * not one of the six.
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

  const height = PAD_TOP + STEP * (STATUS_STEPS.length - 1) + PAD_BOTTOM;

  const nodes: Pt[] = React.useMemo(() => {
    if (!width) return [];
    const left = width * INSET;
    const right = width * (1 - INSET);
    return STATUS_STEPS.map((_, i) => ({
      x: i % 2 === 0 ? left : right,
      y: PAD_TOP + i * STEP,
    }));
  }, [width]);

  const d = React.useMemo(() => curveThrough(nodes), [nodes]);
  const lengths = React.useMemo(() => cumulativeLengths(nodes), [nodes]);
  const total = lengths[lengths.length - 1] ?? 0;
  const travelled = lengths[currentIndex] ?? 0;

  return (
    <View
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 && (
        <>
          <Svg width={width} height={height} style={{ position: 'absolute' }}>
            {/* The whole route, so the journey has a visible end rather than an
                open question. */}
            <Path
              d={d}
              fill="none"
              stroke={colors.line}
              strokeWidth={5}
              strokeLinecap="round"
            />
            {/* The yarn already unspooled. Same path, dashed to the distance
                covered, so the trail cannot drift from the route. */}
            {travelled > 0 && (
              <Path
                d={d}
                fill="none"
                stroke={failed ? colors.pending : colors.accent}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={`${travelled} ${total}`}
              />
            )}

            {nodes.map((p, i) => {
              const done = reached.has(STATUS_STEPS[i]);
              const here = i === currentIndex;
              return (
                <Circle
                  key={STATUS_STEPS[i]}
                  cx={p.x}
                  cy={p.y}
                  r={here ? NODE_R : NODE_R - 4}
                  fill={done ? (failed ? colors.pending : colors.accent) : colors.card}
                  stroke={done ? (failed ? colors.pending : colors.accent) : colors.lineStrong}
                  strokeWidth={done ? 0 : 2}
                />
              );
            })}
          </Svg>

          {nodes.map((p, i) => {
            const step = STATUS_STEPS[i];
            const event = timeline.find((e) => e.status === step);
            const done = reached.has(step);
            const here = i === currentIndex;
            const onLeft = i % 2 === 0;
            return (
              <View
                key={step}
                style={{
                  position: 'absolute',
                  top: p.y - 17,
                  // Label sits on the inward side of its station, so the two
                  // columns of text flank the path instead of fighting it.
                  left: onLeft ? p.x + NODE_R + 10 : undefined,
                  right: onLeft ? undefined : width - p.x + NODE_R + 10,
                  maxWidth: width * (1 - INSET) - NODE_R - 18,
                  alignItems: onLeft ? 'flex-start' : 'flex-end',
                }}
                pointerEvents="none"
              >
                <Body size={13} tone={done ? 'ink' : 'faint'} weight={here ? '700' : done ? '600' : '400'}>
                  {STATUS_LABEL[step]}
                </Body>
                <Body size={11} tone="faint">
                  {event
                    ? dateTimeOf(event.createdAt)
                    : failed
                      ? 'Not reached'
                      : 'Pending'}
                </Body>
              </View>
            );
          })}

          {/* The kitten stands on the station it has reached. Above the node,
              never over a label — the mascot is the last thing that should cost
              anyone a piece of information. */}
          {nodes[currentIndex] && (
            <View
              style={{
                position: 'absolute',
                left: nodes[currentIndex].x - kittenWidth / 2,
                top: nodes[currentIndex].y - NODE_R - kittenWidth * 0.72,
              }}
              pointerEvents="none"
            >
              <Kitten
                state={kittenState}
                width={kittenWidth}
                accessibilityLabel={STATUS_LABEL[status]}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}
