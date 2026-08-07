import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * A back affordance plus an optional title. Android's hardware back already
 * works; this exists because a screen with no visible way back reads as a dead
 * end, and because the right slot is where per-screen actions live.
 */
export function BackBar({
  title,
  right,
  onBack,
  tint = colors.ink,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  tint?: string;
}) {
  const router = useRouter();
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
            stroke={tint}
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Pressable>
      {title ? (
        <Text style={{ fontSize: 15, fontWeight: '600', color: tint, flex: 1 }}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {right}
    </View>
  );
}
