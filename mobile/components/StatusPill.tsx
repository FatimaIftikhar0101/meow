import React from 'react';
import { Text, View } from 'react-native';
import { STATUS_LABEL } from '../lib/format';
import type { TransferStatus } from '../lib/types';
import { colors, radius } from '../theme/tokens';

/**
 * Status colour is deliberately not the mint accent: mint means "the app's
 * primary action", and reusing it for "delivered" made the two read as the
 * same thing in the earlier design. Delivered is mint-ink on mint-lo, in
 * flight is amber, terminal-bad is clay.
 */
function toneFor(status: TransferStatus) {
  switch (status) {
    case 'delivered':
      return { bg: colors.mintLo, fg: colors.mintInk };
    case 'failed':
    case 'cancelled':
      return { bg: colors.clayLo, fg: colors.clay };
    default:
      return { bg: colors.amberLo, fg: colors.amber };
  }
}

export function StatusPill({
  status,
  compact = false,
}: {
  status: TransferStatus;
  compact?: boolean;
}) {
  const tone = toneFor(status);
  return (
    <View
      style={{
        backgroundColor: tone.bg,
        borderRadius: radius.pill,
        paddingHorizontal: compact ? 8 : 10,
        paddingVertical: compact ? 3 : 5,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: tone.fg, fontSize: compact ? 10.5 : 11.5, fontWeight: '700' }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

/** Initials disc, used for recipients and the people row. */
export function Avatar({
  name,
  size = 42,
  tone = 'tint',
}: {
  name: string;
  size?: number;
  tone?: 'tint' | 'ink' | 'mint';
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const map = {
    tint: { bg: colors.tint, fg: colors.mintInk },
    ink: { bg: colors.ink, fg: colors.onInk },
    mint: { bg: colors.mint, fg: colors.ink },
  }[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: map.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: map.fg, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials || '?'}
      </Text>
    </View>
  );
}
