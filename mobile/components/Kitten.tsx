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
 * Only `waiting` has real artwork so far; the rest point at it while the other
 * clips are produced. That is a placeholder, not a design decision — a playful
 * loop where `sorry` belongs is exactly the tonal mistake the state list exists
 * to prevent, so these must be replaced before this ships to a customer.
 */
const WAITING = require('../assets/kitten/waiting.webp') as number;

const CLIPS: Record<KittenState, number> = {
  idle: WAITING,
  play: WAITING,
  travel: WAITING,
  delivered: WAITING,
  waiting: WAITING,
  sorry: WAITING,
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
  style,
  accessibilityLabel,
}: {
  state?: KittenState;
  width?: number;
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

  return (
    <View
      style={[{ width, height: width / ratioOf(CLIPS[state]) }, style]}
      accessible={accessibilityLabel != null}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
    >
      <Image
        source={CLIPS[state]}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        // Reduce Motion is a real request, not a preference to weigh: the
        // animation stops and the first frame stands in.
        autoplay={!reduceMotion}
        transition={160}
        accessible={false}
      />
    </View>
  );
}
