import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Mask, Path, Rect } from 'react-native-svg';
import { DayPart, GREETING, dayPartFor } from '../lib/format';
import { colors, fonts, scenes } from '../theme/tokens';
import { CatMark } from './CatMark';
import { Body, Title } from './ui';

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

const HOLD_MS = 1800;
const FADE_MS = 420;

/** The scene is drawn in this space and cropped to the screen, never squashed. */
const VB_W = 400;
const VB_H = 800;

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

/** Where the sun or moon sits, per part of the day: it climbs, then sets. */
const CELESTIAL: Record<DayPart, { cx: number; cy: number; r: number }> = {
  morning: { cx: 296, cy: 300, r: 40 },
  afternoon: { cx: 268, cy: 176, r: 32 },
  evening: { cx: 116, cy: 356, r: 44 },
  night: { cx: 292, cy: 196, r: 34 },
};

const STARS: readonly (readonly [number, number, number])[] = [
  [44, 108, 1.6], [96, 62, 1.1], [148, 132, 1.4], [206, 78, 1.2], [246, 148, 1],
  [330, 96, 1.5], [368, 168, 1.1], [72, 214, 1.2], [178, 232, 1], [252, 268, 1.3],
  [340, 250, 1], [28, 296, 1.1], [124, 320, 1.2], [376, 320, 1.4], [200, 40, 1],
];

function Scene({ part }: { part: DayPart }) {
  const s = scenes[part];
  const c = CELESTIAL[part];

  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={[s.sky[0], s.sky[1]]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* `slice` crops the scene to the screen the way a background image would,
          rather than letterboxing it — phone aspect ratios vary too much to
          compose for one. Everything that matters sits well inside the middle. */}
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          {/* A crescent is the disc minus a second disc offset from it — far
              cheaper and crisper than a path approximating the same curve. */}
          <Mask id="crescent">
            <Rect width={VB_W} height={VB_H} fill="black" />
            <Circle cx={c.cx} cy={c.cy} r={c.r} fill="white" />
            <Circle cx={c.cx + c.r * 0.42} cy={c.cy - c.r * 0.3} r={c.r * 0.92} fill="black" />
          </Mask>
        </Defs>

        {s.stars && (
          <G fill={colors.onSlab}>
            {STARS.map(([x, y, r], i) => (
              <Circle key={i} cx={x} cy={y} r={r} opacity={0.35 + (i % 4) * 0.16} />
            ))}
          </G>
        )}

        {/* Halo first, so the disc sits inside its own glow. */}
        <Circle cx={c.cx} cy={c.cy} r={c.r * 2.1} fill={s.halo} />
        <Circle cx={c.cx} cy={c.cy} r={c.r * 1.5} fill={s.halo} />
        {s.crescent ? (
          <Rect width={VB_W} height={VB_H} fill={s.celestial} mask="url(#crescent)" />
        ) : (
          <Circle cx={c.cx} cy={c.cy} r={c.r} fill={s.celestial} />
        )}

        {/* Three hill bands. The near one is tall enough to hold the bottom of
            any screen once `slice` has cropped the scene. */}
        <Path d={`M0 470 Q104 424 208 462 T400 440 V${VB_H} H0 Z`} fill={s.hills[0]} />
        <Path d={`M0 546 Q120 500 240 540 T400 516 V${VB_H} H0 Z`} fill={s.hills[1]} />
        <Path d={`M0 632 Q140 588 280 626 T400 606 V${VB_H} H0 Z`} fill={s.hills[2]} />
      </Svg>
    </View>
  );
}

export function GreetingIntro({ name }: { name: string }) {
  const part = dayPartFor();
  const s = scenes[part];

  const [visible, setVisible] = useState(!shownThisLaunch);
  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(14)).current;
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
        duration: 520,
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
    Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }).start(() =>
      setVisible(false),
    );
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, zIndex: 20 }]}>
      <Scene part={part} />
      <Pressable
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={`${GREETING[part]}, ${name}. Tap to continue.`}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}
      >
        <Animated.View style={{ transform: [{ translateY: rise }] }}>
          <CatMark size={76} eyesClosed={part === 'night'} />
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', transform: [{ translateY: rise }] }}>
          <Body size={14} tone={s.onDark ? 'onSlabMuted' : 'muted'}>
            {GREETING[part]},
          </Body>
          <Title
            size={32}
            tone={s.onDark ? 'onSlab' : 'ink'}
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
