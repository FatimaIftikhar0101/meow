import { TransferStatus } from '@prisma/client';
import {
  AGING_THRESHOLD_MINUTES,
  NON_TERMINAL,
  agingCutoffs,
  minutesSince,
  thresholdFor,
} from './aging';

/**
 * The aging rules, tested as arithmetic rather than through the database.
 *
 * These thresholds decide which transfers an operations desk is shown as
 * problems and which it is not shown at all. A silent off-by-one here does not
 * fail loudly — it produces a queue that looks calm, which is the worst
 * possible failure mode for this particular screen.
 */
describe('transfer aging', () => {
  const NOW = new Date('2026-08-22T12:00:00Z').getTime();

  describe('thresholds', () => {
    it('covers every non-terminal status', () => {
      // A status with no threshold can never be overdue. If a new one is added
      // to the enum and not to the map, transfers can pile up in it invisibly.
      for (const status of NON_TERMINAL) {
        expect(thresholdFor(status)).toBeGreaterThan(0);
      }
    });

    it('gives terminal statuses no threshold', () => {
      const terminal: TransferStatus[] = ['delivered', 'failed', 'cancelled'];
      for (const status of terminal) {
        expect(thresholdFor(status)).toBeNull();
      }
    });

    it('allows a payout longer than a compliance check allows an FX conversion', () => {
      // Not tidiness — the ordering is the claim the thresholds make about the
      // business. Flattening them into one number is the change this catches.
      expect(AGING_THRESHOLD_MINUTES.payout_processing).toBeGreaterThan(
        AGING_THRESHOLD_MINUTES.compliance_check,
      );
      expect(AGING_THRESHOLD_MINUTES.compliance_check).toBeGreaterThan(
        AGING_THRESHOLD_MINUTES.fx_converted,
      );
    });
  });

  describe('minutesSince', () => {
    it('floors to whole minutes', () => {
      expect(minutesSince(new Date(NOW - 119_000), NOW)).toBe(1);
    });

    it('never reports a negative age', () => {
      // Clock skew between the app and the database would otherwise produce a
      // transfer that is minus four minutes old, and a sort that puts it first.
      expect(minutesSince(new Date(NOW + 60_000), NOW)).toBe(0);
    });
  });

  describe('agingCutoffs', () => {
    it('produces one cutoff per non-terminal status', () => {
      const cutoffs = agingCutoffs(undefined, NOW);
      expect(cutoffs.map((c) => c.status).sort()).toEqual(
        [...NON_TERMINAL].sort(),
      );
    });

    it('places each cutoff its own threshold into the past', () => {
      const cutoffs = agingCutoffs(undefined, NOW);
      for (const { status, before } of cutoffs) {
        const minutes = (NOW - before.getTime()) / 60_000;
        expect(minutes).toBe(AGING_THRESHOLD_MINUTES[status]);
      }
    });

    it('collapses every threshold when overridden', () => {
      // The incident question: "what has been sitting for over half an hour,
      // whatever it thinks it is doing?"
      const cutoffs = agingCutoffs(30, NOW);
      for (const { before } of cutoffs) {
        expect(NOW - before.getTime()).toBe(30 * 60_000);
      }
    });

    it('treats an override of zero as zero, not as absent', () => {
      // `?? threshold` would be correct here and `|| threshold` would not:
      // asking for everything currently in flight is a real request, and the
      // falsy-zero bug would silently answer a different question.
      const cutoffs = agingCutoffs(0, NOW);
      for (const { before } of cutoffs) {
        expect(before.getTime()).toBe(NOW);
      }
    });
  });
});
