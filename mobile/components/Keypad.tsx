import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { radius, useTheme } from '../theme/tokens';

/**
 * A custom numeric pad rather than the system keyboard.
 *
 * The system numeric keyboard on Android gives small keys, an inconsistent
 * layout across OEM keyboards, and covers the running conversion — which is
 * the one thing the user is watching while they type. Owning the pad means
 * bigger targets and the amount, the rate and the fee all stay on screen.
 */

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

export function Keypad({
  value,
  onChange,
  maxDecimals = 2,
}: {
  value: string;
  onChange: (next: string) => void;
  maxDecimals?: number;
}) {
  const { colors } = useTheme();
  const press = (key: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (key === '⌫') {
      onChange(value.length <= 1 ? '' : value.slice(0, -1));
      return;
    }
    if (key === '.') {
      if (value.includes('.')) return;
      onChange(value === '' ? '0.' : `${value}.`);
      return;
    }
    // Reject a third decimal place rather than accepting it and rounding
    // silently — the backend's @IsNumber({ maxDecimalPlaces: 4 }) would take
    // it, but money the user did not type is money they did not agree to.
    const [, frac] = value.split('.');
    if (frac !== undefined && frac.length >= maxDecimals) return;
    // No leading zeros: "0" then "5" is 5, not 05.
    if (value === '0') {
      onChange(key);
      return;
    }
    if (value.replace('.', '').length >= 9) return;
    onChange(value + key);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPress={() => press(k)}
          accessibilityRole="button"
          accessibilityLabel={k === '⌫' ? 'Delete' : k}
          style={({ pressed }) => ({
            width: '33.333%',
            height: 62,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.sm,
            backgroundColor: pressed ? colors.inset : 'transparent',
          })}
        >
          {k === '⌫' ? (
            <Svg width={24} height={24} viewBox="0 0 24 24">
              <Path
                d="M9 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6-7z"
                stroke={colors.ink}
                strokeWidth={1.7}
                fill="none"
                strokeLinejoin="round"
              />
              <Path
                d="M12 10l4 4M16 10l-4 4"
                stroke={colors.ink}
                strokeWidth={1.7}
                strokeLinecap="round"
              />
            </Svg>
          ) : (
            <Text
              style={{
                fontSize: 25,
                fontWeight: '500',
                color: colors.ink,
                fontVariant: ['tabular-nums'],
              }}
            >
              {k}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
