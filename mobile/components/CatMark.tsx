import React, { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../theme/tokens';

/**
 * The Meow mark, taken from app/_components/Brand.tsx unchanged — same 32×32
 * viewBox, same silhouette path, same gold gradient, same dark pupils. The
 * mobile app previously drew its own line-art cat, which was never the brand.
 *
 * The gradient id is per-instance: react-native-svg resolves `url(#id)` against
 * the whole document on some platforms, so two marks sharing an id can leave the
 * second one unpainted.
 */
function Mark({
  size,
  eyesClosed,
  ring,
}: {
  size: number;
  eyesClosed: boolean;
  ring: boolean;
}) {
  const { colors } = useTheme();
  const gid = `meow-gold-${useId()}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={colors.goldLight} />
          <Stop offset="60%" stopColor={colors.gold} />
          <Stop offset="100%" stopColor={colors.goldDeep} />
        </LinearGradient>
      </Defs>
      {ring && (
        <Circle cx={16} cy={16} r={15} fill="none" stroke={`url(#${gid})`} strokeWidth={1.5} />
      )}
      <Path
        d="M 11 11 L 13 8 L 14 13 L 18 13 L 19 8 L 21 11 Q 23 16 21 20 Q 16 23 11 20 Q 9 16 11 11 Z"
        fill={`url(#${gid})`}
      />
      {eyesClosed ? (
        <G stroke={colors.goldPupil} strokeWidth={1} strokeLinecap="round" fill="none">
          <Path d="M 12.4 14.7 Q 13.5 15.9 14.6 14.7" />
          <Path d="M 17.4 14.7 Q 18.5 15.9 19.6 14.7" />
        </G>
      ) : (
        <>
          <Circle cx={13.5} cy={15} r={0.9} fill={colors.goldPupil} />
          <Circle cx={18.5} cy={15} r={0.9} fill={colors.goldPupil} />
        </>
      )}
    </Svg>
  );
}

/**
 * The mark, on the dark disc it needs.
 *
 * Gold measures 1.97:1 against white — below even the 3:1 floor for a graphic —
 * so on a white app the bare mark all but disappears. That is not a flaw in the
 * mark; it was drawn for the dark web client, where it has something to glow
 * against. The roundel gives it that ground anywhere: 5.61:1 on charcoal.
 *
 * `roundel={false}` is for surfaces that are already dark, where the disc would
 * only add a second edge.
 *
 * `eyesClosed` is used at two moments and no others — night, and a delivered
 * transfer. Keeping it rare is what gives it meaning.
 */
export function CatMark({
  size = 32,
  eyesClosed = false,
  ring = true,
  roundel = true,
}: {
  /** Overall diameter, including the roundel when there is one. */
  size?: number;
  eyesClosed?: boolean;
  ring?: boolean;
  roundel?: boolean;
}) {
  const { colors } = useTheme();
  if (!roundel) return <Mark size={size} eyesClosed={eyesClosed} ring={ring} />;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.roundel,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Mark size={size * 0.66} eyesClosed={eyesClosed} ring={ring} />
    </View>
  );
}

/** The mark plus the wordmark, for headers and the welcome screen. */
export function BrandLockup({
  size = 30,
  tone,
  roundel = true,
}: {
  size?: number;
  /** Overrides the ink colour — for the lockup on a dark ground. */
  tone?: string;
  roundel?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <CatMark size={size} roundel={roundel} />
      <Text
        style={{
          fontSize: size * 0.42,
          fontWeight: '700',
          letterSpacing: size * 0.14,
          textTransform: 'uppercase',
          color: tone ?? colors.ink,
        }}
      >
        Meow
      </Text>
    </View>
  );
}
