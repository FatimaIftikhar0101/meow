import { TransferStatus } from '@prisma/client';

/**
 * When a transfer has been sitting in one status too long.
 *
 * An operations desk cannot act on a list sorted by newest first. A transfer in
 * `payout_processing` for three hours is somebody's rent not arriving; one that
 * has been there thirty seconds is the system working. Nothing in a plain
 * status column distinguishes them, so the desk is left scanning and hoping to
 * notice — which is not a control, it is a hope.
 *
 * These are per-status because the statuses are not comparable. Waiting on a
 * compliance review is expected to take a while; waiting on an FX conversion is
 * not. One global threshold would either bury the FX problem or flood the queue
 * with compliance rows that are fine.
 *
 * The numbers below are sized for a real payout partner, not for the mock
 * provider currently driving these transitions on a five-second timer. Against
 * the mock nothing will ever be overdue, which is the correct outcome: an
 * always-empty queue is what "nothing is stuck" looks like. To see the screen
 * work before a real provider exists, pass `olderThanMins` — see below.
 */
export const AGING_THRESHOLD_MINUTES: Readonly<Record<string, number>> = {
  // Funds have not cleared into the wallet yet. Short, because the customer is
  // watching this one and it is the first place a payment problem shows.
  initiated: 15,
  payment_received: 15,
  // Screening can legitimately involve a person reading something.
  compliance_check: 60,
  // A rate was applied and the money should move. Nothing here should be slow.
  fx_converted: 30,
  // With the partner, out of our hands, and the status a customer chases us
  // about. Three hours is the point at which somebody should be asking.
  payout_processing: 180,
};

/** Statuses money can still be moving in. Terminal statuses cannot be overdue. */
export const NON_TERMINAL: TransferStatus[] = [
  'initiated',
  'payment_received',
  'compliance_check',
  'fx_converted',
  'payout_processing',
];

export function thresholdFor(status: TransferStatus): number | null {
  return AGING_THRESHOLD_MINUTES[status] ?? null;
}

/**
 * Minutes since a transfer last changed.
 *
 * `updatedAt` is used rather than the last `TransferEvent`, and the difference
 * is worth stating: every write to a transfer row touches `updatedAt`, so this
 * is "time since anything happened", not strictly "time in this status". Today
 * the only writes are status transitions, so the two are the same thing. If a
 * transfer ever gains a field that is written without a status change, this
 * becomes a per-row join on the timeline instead.
 */
export function minutesSince(at: Date, now = Date.now()): number {
  return Math.max(0, Math.floor((now - at.getTime()) / 60_000));
}

/**
 * The cutoff instants for an aging query, one per non-terminal status.
 *
 * `override` collapses them to a single threshold. That exists for the operator
 * who wants "show me anything over thirty minutes, whatever it is doing" — a
 * real question during an incident, when the per-status defaults are exactly
 * the assumption being questioned.
 */
export function agingCutoffs(
  override?: number,
  now = Date.now(),
): Array<{ status: TransferStatus; before: Date }> {
  return NON_TERMINAL.map((status) => {
    const minutes = override ?? AGING_THRESHOLD_MINUTES[status];
    return { status, before: new Date(now - minutes * 60_000) };
  });
}
