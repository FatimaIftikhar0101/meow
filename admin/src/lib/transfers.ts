/**
 * The vocabulary shared by the queue and the transfer detail page.
 *
 * Both screens render the same statuses and the same ages. Duplicating the
 * label map was how the two ended up disagreeing about what `fx_converted`
 * should be called, which is a small thing until support is reading one screen
 * to a customer looking at the other.
 */

export type TransferStatus =
  | 'initiated'
  | 'payment_received'
  | 'compliance_check'
  | 'fx_converted'
  | 'payout_processing'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export const TERMINAL: TransferStatus[] = ['delivered', 'failed', 'cancelled'];

export const STATUS_LABEL: Record<TransferStatus, string> = {
  initiated: 'Initiated',
  payment_received: 'Payment received',
  compliance_check: 'Compliance check',
  fx_converted: 'FX converted',
  payout_processing: 'Paying out',
  delivered: 'Delivered',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function toneFor(status: TransferStatus) {
  if (status === 'delivered') return 'success' as const;
  if (status === 'failed') return 'danger' as const;
  if (TERMINAL.includes(status)) return 'neutral' as const;
  return 'pending' as const;
}

export function isTerminal(status: TransferStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * A duration a person can read at a glance.
 *
 * Deliberately coarse above an hour: the question this column answers is "is
 * this one worse than that one", and "3h" answers it faster than "187m". Below
 * an hour it stays in minutes, because that is the range where the difference
 * between six and forty matters.
 */
export function formatAge(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

/**
 * The sign of a decimal string, without going through a float.
 *
 * Amounts arrive from the API as decimal strings and are rendered as decimal
 * strings — the column is checked against a bank statement, so nothing on the
 * way past is allowed to round. `Number(x) < 0` would be correct for the sign
 * today and is still the wrong habit to establish on this screen; reading the
 * sign off the string cannot be wrong for any value.
 */
export function signOf(decimal: string): -1 | 0 | 1 {
  const trimmed = decimal.trim();
  if (trimmed.startsWith('-')) return -1;
  // "0", "0.00", "+0.0000" are all zero.
  return /[1-9]/.test(trimmed) ? 1 : 0;
}
