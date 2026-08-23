import { Image } from 'expo-image';
import React from 'react';
import {
  AccessibilityInfo,
  Image as RNImage,
  View,
  type ViewStyle,
} from 'react-native';
import type { TransferStatus } from '../lib/types';

/**
 * The mascot.
 *
 * One component, one state map. Every clip the product needs is named here and
 * resolved in `CLIPS` below, so adding the remaining artwork is an edit to a
 * single object rather than a hunt through screens.
 *
 * Animated WebP with alpha rather than video, deliberately. Transparent video
 * on Android means VP9-alpha in WebM, and getting it to actually composite over
 * a UI needs a TextureView and a surface that honours alpha — a lot of moving
 * parts to make a cat sit on a white card. expo-image plays animated WebP with
 * transparency, loops it, and costs nothing to place.
 */

export type KittenState =
  | 'idle'
  | 'play'
  | 'travel'
  | 'delivered'
  | 'waiting'
  | 'sorry';

/**
 * State to artwork.
 *
 * Built by scripts/key-clip.js from the ProRes masters in design/clips — those
 * carry a real alpha channel, so the mattes here are the ones the artist
 * authored rather than anything reconstructed.
 *
 * `idle` shares the waiting clip deliberately: both are the kitten sitting
 * still with its toy untouched, and a second near-identical loop would cost a
 * megabyte to say the same thing.
 */
/* eslint-disable @typescript-eslint/no-require-imports --
   require(), not import: React Native's asset pipeline resolves these to
   numeric asset ids, which is what Image.resolveAssetSource needs to report an
   artwork's intrinsic size. An ES import of a .webp has no such id. */
const WAITING = require('../assets/kitten/waiting.webp') as number;
const PLAY = require('../assets/kitten/play.webp') as number;
const TRAVEL = require('../assets/kitten/travel.webp') as number;
const DELIVERED = require('../assets/kitten/delivered.webp') as number;
const SORRY = require('../assets/kitten/sorry.webp') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

const CLIPS: Record<KittenState, number> = {
  idle: WAITING,
  play: PLAY,
  travel: TRAVEL,
  delivered: DELIVERED,
  waiting: WAITING,
  sorry: SORRY,
};

/**
 * How big to draw each clip, relative to the width the layout asks for.
 *
 * `key-clip.js` crops every clip to its own subject bounds, which is right for
 * the file and wrong for the screen: the crop contains whatever the kitten
 * brought with it. `travel` includes a cardboard plane that adds width, so at a
 * given box width the cat inside comes out small. `waiting` is the cat alone,
 * sitting upright, so the same box width draws it far bigger — 99px tall
 * against travel's 69px, and on a phone it read as a different, larger cat.
 *
 * There is no measurement that fixes this, because "how big is the cat" is not
 * recoverable from a bounding box that contains a plane. These are chosen by
 * eye against the two clips that already looked right, and those two are left
 * at 1 so they cannot drift.
 */
const DISPLAY_SCALE: Record<KittenState, number> = {
  idle: 0.74,
  waiting: 0.74,
  // Same shape of problem: the cat sits alone, so its crop is nearly square and
  // it outgrew everything else. Never seen next to the others — it replaces
  // them on a failed transfer — but it sits on the same line at the same
  // station, so it gets the same treatment.
  sorry: 0.72,
  play: 1,
  travel: 1,
  delivered: 1,
};

/** Which clip a transfer's status calls for. */
export function kittenStateFor(status: TransferStatus): KittenState {
  switch (status) {
    case 'delivered':
      return 'delivered';
    case 'failed':
    case 'cancelled':
      return 'sorry';
    case 'compliance_check':
      // The stage that can sit for a long time. A kitten batting a yarn ball
      // while someone's money is held for review reads as the app not taking
      // it seriously.
      return 'waiting';
    default:
      return 'travel';
  }
}

/**
 * Each clip's own aspect, read from the bundled asset.
 *
 * Not a constant: `key-clip.js` crops every clip to its own subject bounds, so
 * a kitten curled up and a kitten in a plane come out different shapes. A
 * hardcoded ratio would be right for exactly one of them and quietly letterbox
 * or stretch the rest.
 */
function ratioOf(source: number): number {
  const meta = RNImage.resolveAssetSource(source);
  return meta?.width && meta?.height ? meta.width / meta.height : 4 / 3;
}

export function Kitten({
  state = 'idle',
  width = 132,
  flip = false,
  style,
  accessibilityLabel,
}: {
  state?: KittenState;
  width?: number;
  /** Mirror horizontally. The travel clip is drawn facing left, so it has to
   *  be flipped on any leg that runs left to right or the plane flies
   *  backwards. Only meaningful for clips with a direction. */
  flip?: boolean;
  style?: ViewStyle;
  /** Describe the *transfer state*, not the cat — a screen reader user needs
   *  the status, and the mascot is decoration they cannot see. */
  accessibilityLabel?: string;
}) {
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // `width` is the box the caller offers; each clip takes the share of it that
  // draws the kitten at a consistent size. See DISPLAY_SCALE.
  const drawn = width * DISPLAY_SCALE[state];

  return (
    <View
      style={[{ width: drawn, height: drawn / ratioOf(CLIPS[state]) }, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      <Image
        source={CLIPS[state]}
        style={{ width: '100%', height: '100%', transform: [{ scaleX: flip ? -1 : 1 }] }}
        contentFit="contain"
        // Reduce Motion is a real request, not a preference to weigh: the
        // animation stops and the first frame stands in.
        autoplay={!reduceMotion}
        transition={160}
        // Decorative. The transfer status is announced by the wrapper above —
        // a screen reader user needs the status, not a description of a cat.
        alt=""
        accessible={false}
      />
    </View>
  );
}
