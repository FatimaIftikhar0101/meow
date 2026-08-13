import React from 'react';
import { Text, View } from 'react-native';
import { STATUS_LABEL } from '../lib/format';
import type { TransferStatus } from '../lib/types';
import { colors, radius } from '../theme/tokens';

/**
 * Status colour is deliberately not the accent. The accent means "this is the
 * app's action"; reusing it for "delivered" made a finished transfer look like
 * something to press. So: delivered is pine, in flight is earth, terminal-bad
 * is brick — each with a word next to it, never colour alone.
 *
 * Fills are solid rather than tinted. On the old off-white ground a pale chip
 * had something to sit against; on white it dissolves.
 */
function toneFor(status: TransferStatus) {
  switch (status) {
    case 'delivered':
      return { bg: colors.success, fg: colors.onSuccess };
    case 'failed':
    case 'cancelled':
      return { bg: colors.danger, fg: colors.onDanger };
    default:
      return { bg: colors.pending, fg: colors.onPending };
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
      <Text style={{ color: tone.fg, fontSize: compact ? 10 : 11, fontWeight: '700' }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

/** Initials disc, used for recipients and the people row. */
export function Avatar({
  name,
  size = 42,
  tone = 'inset',
}: {
  name: string;
  size?: number;
  tone?: 'inset' | 'slab' | 'accent';
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const map = {
    inset: { bg: colors.inset, fg: colors.accent },
    slab: { bg: colors.slab, fg: colors.onSlab },
    accent: { bg: colors.accent, fg: colors.onAccent },
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
