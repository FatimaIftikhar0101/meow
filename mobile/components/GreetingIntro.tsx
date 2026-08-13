import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { CatMark } from './CatMark';
import { Body, Title } from './ui';
import { DayPart, GREETING, dayPartFor } from '../lib/format';
import { colors, fonts } from '../theme/tokens';

/**
 * The time-of-day greeting, as a brief full-screen moment on entering the app.
 *
 * It used to be pinned to the top of the dashboard, where it ate the first
 * third of the screen on every visit and pushed the corridor rate — the thing
 * people actually open the app for — below the fold. It was always meant to
 * behave like a splash: say hello, then get out of the way.
 *
 * Three things keep it from becoming an obstacle:
 *   · it shows once per app launch, not on every return to Home;
 *   · a tap dismisses it immediately, so it is never something to wait through;
 *   · with Reduce Motion on it is skipped entirely rather than merely faded
 *     faster, because the whole element is decorative.
 */

const HOLD_MS = 1400;
const FADE_MS = 380;

/**
 * Module-level, deliberately: this should survive remounts as the user moves
 * between tabs, and reset only when the process does. A ref would re-show the
 * greeting every time Home regained focus, which is the bug being fixed.
 */
let shownThisLaunch = false;

/** Lets sign-out replay the greeting for whoever signs in next. */
export function resetGreeting() {
  shownThisLaunch = false;
}

/** Each moment gets a ground and a mood; none of them get a green landscape. */
function sceneFor(part: DayPart): {
  ground: string;
  onGround: 'ink' | 'onSlab';
  muted: 'muted' | 'onSlabMuted';
  arc: string;
  eyesClosed: boolean;
} {
  switch (part) {
    case 'morning':
    case 'afternoon':
      return {
        ground: colors.canvas,
        onGround: 'ink',
        muted: 'muted',
        arc: colors.line,
        eyesClosed: false,
      };
    case 'evening':
      return {
        ground: colors.slab,
        onGround: 'onSlab',
        muted: 'onSlabMuted',
        arc: 'rgba(255,255,255,0.22)',
        eyesClosed: false,
      };
    case 'night':
      return {
        ground: colors.slabDeep,
        onGround: 'onSlab',
        muted: 'onSlabMuted',
        arc: 'rgba(255,255,255,0.16)',
        eyesClosed: true,
      };
  }
}

export function GreetingIntro({ name }: { name: string }) {
  const part = dayPartFor();
  const scene = sceneFor(part);

  const [visible, setVisible] = useState(!shownThisLaunch);
  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(10)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    shownThisLaunch = true;

    let cancelled = false;

    const dismiss = () => {
      if (cancelled) return;
      Animated.timing(fade, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (!cancelled) setVisible(false);
      });
    };

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        // Decorative and time-based: the honest response to Reduce Motion is
        // not a slower fade, it is not showing an animation at all.
        setVisible(false);
        return;
      }
      Animated.timing(rise, {
        toValue: 0,
        duration: 460,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(dismiss, HOLD_MS);
    });

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, fade, rise]);

  if (!visible) return null;

  const skip = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(fade, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  return (
    <Animated.View
      style={{
        ...StyleSheetAbsoluteFill,
        backgroundColor: scene.ground,
        opacity: fade,
        zIndex: 20,
      }}
    >
      <Pressable
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={`${GREETING[part]}, ${name}. Tap to continue.`}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}
      >
        <View style={{ width: 200, height: 90, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={200} height={90} viewBox="0 0 200 90" style={{ position: 'absolute' }}>
            <Path
              d="M14 74 Q100 6 186 74"
              stroke={scene.arc}
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx={14} cy={74} r={4} fill={scene.arc} />
            <Circle cx={186} cy={74} r={4} fill={scene.arc} />
          </Svg>
          <Animated.View style={{ transform: [{ translateY: rise }] }}>
            <CatMark size={64} eyesClosed={scene.eyesClosed} roundel={part !== 'night'} />
          </Animated.View>
        </View>

        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: rise }] }}>
          <Body size={14} tone={scene.muted}>
            {GREETING[part]},
          </Body>
          <Title
            size={30}
            tone={scene.onGround}
            numberOfLines={1}
            style={{ fontFamily: fonts.display, fontWeight: '400', marginTop: 4 }}
          >
            {name}
          </Title>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

/** Inlined so the component has no StyleSheet import for a single constant. */
const StyleSheetAbsoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
