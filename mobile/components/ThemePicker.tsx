import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { radius, useTheme, type ThemePreference } from '../theme/tokens';
import { Body } from './ui';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light, dark, or whatever the phone says.
 *
 * "System" is first and is the default, because the phone already knows things
 * this app does not — that it is night, that the person has scheduled a switch,
 * that they turned on the accessibility setting which forces one scheme. Making
 * the app's own choice the default would override all of that.
 *
 * The other two exist because the phone is not always right: a receipt read
 * outdoors wants light regardless of the hour, and someone checking a transfer
 * in bed at 2am wants dark regardless of what their schedule says.
 */
export function ThemePicker() {
  const { colors, preference, setPreference } = useTheme();
  return (
    <View style={{ paddingVertical: 14, gap: 10 }}>
      <View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Appearance</Text>
        <Body size={12} tone="faint" style={{ marginTop: 2 }}>
          {preference === 'system'
            ? 'Following your phone’s setting.'
            : `Always ${preference}, whatever your phone is set to.`}
        </Body>
      </View>

      <View
        // A segmented control rather than a switch: three states, and a switch
        // cannot express "I have not chosen".
        accessibilityRole="radiogroup"
        style={{
          flexDirection: 'row',
          backgroundColor: colors.inset,
          borderRadius: radius.md,
          padding: 3,
          gap: 3,
        }}
      >
        {OPTIONS.map((o) => {
          const on = preference === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => setPreference(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              style={({ pressed }) => ({
                flex: 1,
                paddingVertical: 9,
                borderRadius: radius.sm,
                alignItems: 'center',
                backgroundColor: on ? colors.accent : 'transparent',
                opacity: pressed && !on ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '600',
                  color: on ? colors.onAccent : colors.inkMuted,
                }}
              >
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
