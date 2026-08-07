import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { formatMoney, formatRate } from '../lib/money';
import type { Corridor } from '../lib/types';
import { colors, radius, shadow } from '../theme/tokens';
import { CatMark } from './CatMark';

/**
 * The signature card.
 *
 * A remittance app has no credit card to put on the home screen, and the wallet
 * balance is a staging account someone tops up and empties — it is not what
 * anyone opens the app to see. The rate is. So the corridor is the hero: where
 * the money goes, and what it converts at, on one black slab.
 *
 * The arc lives in its own band with the rate below it in flow. In the first
 * draft both shared a box and the curve ran straight through the rate text.
 */

const ROUTE_W = 216;
const ROUTE_H = 46;

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

function End({ code, align }: { code: string; align: 'left' | 'right' }) {
  return (
    <View style={{ alignItems: 'center', width: 58 }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          backgroundColor: '#1D251F',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 14 }}>{flag(code)}</Text>
      </View>
      <Text style={{ color: colors.onInk2, fontSize: 9.5, marginTop: 4 }} numberOfLines={1}>
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
    <View
      style={[
        {
          backgroundColor: colors.ink,
          borderRadius: radius.lg,
          padding: 16,
        },
        shadow.liftLg,
      ]}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ color: colors.onInk2, fontSize: 10.5, fontWeight: '700', letterSpacing: 1.4 }}>
          YOUR CORRIDOR
        </Text>
        {live && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.mint }}
            />
            <Text style={{ color: colors.mint, fontSize: 10, fontWeight: '700' }}>Live</Text>
          </View>
        )}
      </View>

      {/* Route band. The arc and the flags share this box and nothing else. */}
      <View style={{ height: ROUTE_H, marginTop: 12, justifyContent: 'center' }}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${ROUTE_W} ${ROUTE_H}`}
          style={{ position: 'absolute' }}
        >
          <Path
            d="M32 19 Q108 9 184 19"
            fill="none"
            stroke={colors.mint}
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={0.85}
          />
          {/* Sits on the curve's midpoint by construction: the quadratic's
              apex at t=0.5 is (108, 14), which is this group's origin. */}
          <G transform="translate(108,14)">
            <Circle cx={0} cy={0} r={11} fill={colors.ink} />
          </G>
        </Svg>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: `${(3 / ROUTE_H) * 100}%`,
            alignItems: 'center',
          }}
        >
          <CatMark size={18} ring />
        </View>

        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            paddingTop: 3,
          }}
        >
          <End code={corridor?.fromCountry ?? 'CA'} align="left" />
          <End code={corridor?.toCountry ?? 'PK'} align="right" />
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: 6 }}>
        <Text
          style={{
            color: colors.onInk,
            fontSize: 30,
            fontWeight: '700',
            letterSpacing: -1,
            fontVariant: ['tabular-nums'],
          }}
        >
          {applied === null ? '—' : formatRate(applied, 2)}
          <Text style={{ fontSize: 14, color: colors.onInk2, fontWeight: '600' }}>
            {' '}
            {corridor?.toCurrency ?? ''}
          </Text>
        </Text>
        <Text style={{ color: colors.onInk2, fontSize: 11, marginTop: 2 }}>
          per 1 {corridor?.fromCurrency ?? 'CAD'} · fee {corridor ? formatRate(corridor.feeFlat, 2) : '—'}{' '}
          {corridor?.fromCurrency ?? ''} flat
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
          borderTopColor: '#232B24',
        }}
      >
        <View>
          <Text style={{ color: colors.onInk2, fontSize: 10.5 }}>Available to send</Text>
          <Text
            style={{
              color: colors.onInk,
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
              backgroundColor: '#1D251F',
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text style={{ color: colors.onInk2, fontSize: 10, fontWeight: '600' }}>
              min {formatRate(corridor.minSendAmount, 0)} · max{' '}
              {formatRate(corridor.maxSendAmount, 0)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
