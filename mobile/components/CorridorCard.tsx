import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Text, View } from 'react-native';
import { formatMoney, formatRate } from '../lib/money';
import type { Corridor } from '../lib/types';
import { radius, shadow, useTheme } from '../theme/tokens';
import { CITIES, WorldMap } from './WorldMap';

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

/** Width ÷ height of the map band. Tall enough for the arc to have somewhere
 *  to go without the card losing the rate below it. */
const MAP_ASPECT = 3.0;

function flag(code: string): string {
  if (!code || code.length !== 2) return '🏳️';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

/** A flag and city name tucked into a corner of the map, rather than a disc in
 *  the flow — the map's own pins already say where the money is going. */
function EndLabel({ code, align }: { code: string; align: 'left' | 'right' }) {
  const { colors } = useTheme();
  const city = CITIES[code?.toUpperCase()]?.name ?? code?.toUpperCase() ?? '';
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        [align]: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
      }}
      pointerEvents="none"
    >
      <Text style={{ fontSize: 12 }}>{flag(code)}</Text>
      <Text style={{ color: colors.onSlabMuted, fontSize: 10, fontWeight: '600' }}>{city}</Text>
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
  const { colors } = useTheme();
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

      {/* The corridor on the real world. The mark rides the arc's midpoint
          here because home is not tracking one transfer — it is showing the
          route itself. */}
      <View style={{ marginTop: 10 }}>
        <WorldMap
          fromCountry={corridor?.fromCountry ?? 'CA'}
          toCountry={corridor?.toCountry ?? 'PK'}
          progress={0.5}
          aspect={MAP_ASPECT}
          markSize={24}
        />
        <EndLabel code={corridor?.fromCountry ?? 'CA'} align="left" />
        <EndLabel code={corridor?.toCountry ?? 'PK'} align="right" />
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
