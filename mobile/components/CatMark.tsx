import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { colors } from '../theme/tokens';

/**
 * The Meow mark, transcribed from the design artifact's 32×32 viewBox so it
 * scales identically everywhere. Gold is reserved for the cat and nothing else.
 *
 * `eyesClosed` is used at two moments only: night, and a delivered transfer.
 * Keeping it rare is what gives it meaning.
 */
export function CatMark({
  size = 32,
  color = colors.gold,
  pupil = colors.ink,
  eyesClosed = false,
  ring = true,
}: {
  size?: number;
  color?: string;
  pupil?: string;
  eyesClosed?: boolean;
  ring?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {ring && (
        <Circle cx={16} cy={16} r={15} fill="none" stroke={color} strokeWidth={1.4} />
      )}
      <Path
        d="M 11 11 L 13 8 L 14 13 L 18 13 L 19 8 L 21 11 Q 23 16 21 20 Q 16 23 11 20 Q 9 16 11 11 Z"
        fill={color}
      />
      {eyesClosed ? (
        <G stroke={pupil} strokeWidth={0.9} strokeLinecap="round" fill="none">
          <Path d="M 12.5 15 Q 13.6 16.1 14.7 15" />
          <Path d="M 17.3 15 Q 18.4 16.1 19.5 15" />
        </G>
      ) : (
        <>
          <Circle cx={13.6} cy={15} r={0.9} fill={pupil} />
          <Circle cx={18.4} cy={15} r={0.9} fill={pupil} />
        </>
      )}
    </Svg>
  );
}

/** The mark plus the wordmark, for headers and the welcome screen. */
export function BrandLockup({
  size = 26,
  tint = colors.ink,
  markColor = colors.gold,
}: {
  size?: number;
  tint?: string;
  markColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <CatMark size={size} color={markColor} pupil={colors.ink} />
      <Text
        style={{
          fontSize: size * 0.78,
          fontWeight: '700',
          letterSpacing: -0.6,
          color: tint,
        }}
      >
        Meow
      </Text>
    </View>
  );
}
