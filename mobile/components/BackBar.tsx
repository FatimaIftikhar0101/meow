import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/tokens';

/**
 * A back affordance plus an optional title, for screens that need a visible
 * way out — one without it reads as a dead end — and a slot for per-screen
 * actions on the right.
 *
 * **`onBack` binds the hardware button too.** This used to say Android's back
 * button "already works", which was true only for screens inside a stack.
 * Wallet, Notifications and Refer & earn are tab routes with no tab button:
 * pressing back there asks the *tab* navigator to go back, and its default is
 * to return to the first tab — Home. So opening Wallet from You and pressing
 * back landed on the dashboard, and the arrow and the hardware button
 * disagreed with each other, which is worse than either being wrong.
 *
 * A screen that knows where back should go now says so once and both routes
 * out honour it.
 */
export function BackBar({
  title,
  right,
  onBack,
  tint,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  /** Overrides the ink colour — for a bar sitting on a dark slab. */
  tint?: string;
}) {
  const { colors } = useTheme();
  // Not a default parameter: one evaluated at import time would freeze this
  // bar in whichever scheme happened to load first.
  const fg = tint ?? colors.ink;
  const router = useRouter();

  // Held in a ref because every caller passes an inline arrow: depending on
  // `onBack` itself would tear down and re-arm the listener on every render.
  const latestOnBack = React.useRef(onBack);
  React.useEffect(() => {
    latestOnBack.current = onBack;
  }, [onBack]);

  // Only while this screen is the focused one — a listener left armed would
  // answer the back press of whatever screen came after it.
  const handlesBack = onBack != null;
  useFocusEffect(
    React.useCallback(() => {
      if (!handlesBack) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        latestOnBack.current?.();
        return true; // handled — do not let the tab navigator fall back to Home
      });
      return () => sub.remove();
    }, [handlesBack]),
  );

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
        gap: 4,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={10}
        onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/'))}
        style={({ pressed }) => ({
          width: 38,
          height: 38,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24">
          <Path
            d="M15 5l-7 7 7 7"
            stroke={fg}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Pressable>
      {title ? (
        <Text style={{ fontSize: 15, fontWeight: '600', color: fg, flex: 1 }}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}
