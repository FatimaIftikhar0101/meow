import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { formatMoney, formatRate } from '../lib/money';
import type { Corridor } from '../lib/types';
import { colors, radius, shadow } from '../theme/tokens';
import { CatMark } from './CatMark';

/**
 * The signature card, and the app's 60%.
 *
 * A remittance app has no credit card to put on the home screen, and the wallet
 * balance is a staging account someone tops up and empties — it is not what
 * anyone opens the app to see. The rate is. So the corridor is the hero: where
 * the money goes and what it converts at, on one slate slab.
 *
 * The slab is slate rather than charcoal because slate is the base colour at
 * 60%, and this is the largest single object in the product.
 */

const ROUTE_W = 216;
const ROUTE_H = 52;
/** Apex of the quadratic at t=0.5, in viewBox units. The mark sits here. */
const APEX_Y = 16;
const MARK = 22;

const CITY: Record<string, string> = {
  PK: 'Karachi',
  IN: 'Mumbai',
  PH: 'Manila',
  CA: 'Toronto',
  US: 'New York',
  GB: 'London',
};

function flag(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function End({ code }: { code: string }) {
  return (
    <View style={{ alignItems: 'center', width: 58 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: 'rgba(255,255,255,0.12)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{flag(code)}</Text>
      </View>
      <Text style={{ color: colors.onSlabMuted, fontSize: 9.5, marginTop: 4 }} numberOfLines={1}>
        {CITY[code.toUpperCase()] ?? code.toUpperCase()}
      </Text>
    </View>
  );
}

export function CorridorCard({
  corridor,
  balance,
  balanceCurrency,
  live = true,
}: {
  corridor: Corridor | null;
  balance: string | null;
  balanceCurrency: string;
  live?: boolean;
}) {
  /**
   * The displayed rate is the *applied* rate, not the corridor's base rate:
   * base × (10000 − marginBps) / 10000, exactly as CorridorsService.computeQuote
   * derives it. Showing baseRate here would promise a rate no transfer gets.
   */
  const applied = corridor
    ? (Number(corridor.baseRate) * (10000 - corridor.marginBps)) / 10000
    : null;

  return (
    <LinearGradient
      colors={[colors.slab, colors.slabDeep]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: radius.lg, padding: 16 }, shadow.liftLg]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            color: colors.onSlabMuted,
            fontSize: 10.5,
            fontWeight: '700',
            letterSpacing: 1.4,
          }}
        >
          YOUR CORRIDOR
        </Text>
        {live && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.onSlab }}
            />
            <Text style={{ color: colors.onSlab, fontSize: 10, fontWeight: '700' }}>Live</Text>
          </View>
        )}
      </View>

      {/* Route band. Pinned to the viewBox's aspect ratio so the mark and the
          arc share one coordinate space — see the note in welcome.tsx. */}
      <View style={{ width: '100%', aspectRatio: ROUTE_W / ROUTE_H, marginTop: 10 }}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${ROUTE_W} ${ROUTE_H}`}>
          <Path
            d={`M32 22 Q108 ${APEX_Y - 6} 184 22`}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={1.6}
            strokeLinecap="round"
          />
          <Circle cx={32} cy={22} r={2.6} fill={colors.onSlab} />
          <Circle cx={184} cy={22} r={2.6} fill="rgba(255,255,255,0.5)" />
        </Svg>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(APEX_Y / ROUTE_H) * 100}%`,
            marginTop: -MARK / 2,
            alignItems: 'center',
          }}
          pointerEvents="none"
        >
          <CatMark size={MARK} roundel={false} />
        </View>

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <End code={corridor?.fromCountry ?? 'CA'} />
          <End code={corridor?.toCountry ?? 'PK'} />
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <Text
          style={{
            color: colors.onSlab,
            fontSize: 31,
            fontWeight: '700',
            letterSpacing: -1,
            fontVariant: ['tabular-nums'],
          }}
        >
          {applied === null ? '—' : formatRate(applied, 2)}
          <Text style={{ fontSize: 14, color: colors.onSlabMuted, fontWeight: '600' }}>
            {' '}
            {corridor?.toCurrency ?? ''}
          </Text>
        </Text>
        <Text style={{ color: colors.onSlabMuted, fontSize: 11, marginTop: 2 }}>
          per 1 {corridor?.fromCurrency ?? 'CAD'} · fee{' '}
          {corridor ? formatRate(corridor.feeFlat, 2) : '—'} {corridor?.fromCurrency ?? ''} flat
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 14,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.18)',
        }}
      >
        <View>
          <Text style={{ color: colors.onSlabMuted, fontSize: 10.5 }}>Available to send</Text>
          <Text
            style={{
              color: colors.onSlab,
              fontSize: 17,
              fontWeight: '700',
              fontVariant: ['tabular-nums'],
              marginTop: 1,
            }}
          >
            {balance === null ? '—' : formatMoney(balance, balanceCurrency)}
          </Text>
        </View>
        {corridor && (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: colors.onSlabMuted, fontSize: 10, fontWeight: '600' }}>
              min {formatRate(corridor.minSendAmount, 0)} · max{' '}
              {formatRate(corridor.maxSendAmount, 0)}
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}
