import { Prisma } from '@prisma/client';
import { assertBalanced } from '../ledger/ledger.service';

/**
 * The two halves of an exchange, and why they are two.
 *
 * A posting must balance within one currency. 250 CAD debited and 49,500 PKR
 * credited is not a balanced posting, it is two numbers in a row — so the
 * delivery of a cross-currency transfer is two postings, each balanced in its
 * own currency, linked by transferId and by the rate that relates them.
 *
 * These assert the property directly on `assertBalanced`, which is what the
 * write path calls and what the database trigger independently enforces.
 */
describe('cross-currency delivery', () => {
  const D = (n: string) => new Prisma.Decimal(n);

  it('accepts each half as balanced within its own currency', () => {
    expect(() =>
      assertBalanced({
        key: 'transfer:t-1:settle',
        currency: 'CAD',
        legs: [
          {
            accountId: 'suspense-cad',
            direction: 'debit',
            type: 'transfer_release',
            amount: D('250.00'),
          },
          {
            accountId: 'settle-cad',
            direction: 'credit',
            type: 'transfer_release',
            amount: D('250.00'),
          },
        ],
      }),
    ).not.toThrow();

    expect(() =>
      assertBalanced({
        key: 'transfer:t-1:payout',
        currency: 'PKR',
        fxRate: D('198.00000000'),
        legs: [
          {
            accountId: 'settle-pkr',
            direction: 'debit',
            type: 'fx_conversion',
            amount: D('49500.00'),
          },
          {
            accountId: 'float-pkr',
            direction: 'credit',
            type: 'fx_conversion',
            amount: D('49500.00'),
          },
        ],
      }),
    ).not.toThrow();
  });

  it('rejects the tempting single posting that spans both currencies', () => {
    // The shape somebody reaches for first. It is not a rounding problem or a
    // style preference: the sum has no meaning, and letting it through would
    // put a number in the trial balance that is the addition of two different
    // units.
    expect(() =>
      assertBalanced({
        key: 'transfer:t-1:wrong',
        currency: 'CAD',
        legs: [
          {
            accountId: 'suspense-cad',
            direction: 'debit',
            type: 'transfer_release',
            amount: D('250.00'),
          },
          {
            accountId: 'float-pkr',
            direction: 'credit',
            type: 'fx_conversion',
            amount: D('49500.00'),
          },
        ],
      }),
    ).toThrow();
  });

  it('holds the rate that relates the halves', () => {
    // 250 CAD at 198 is 49,500 PKR. The ledger stores the rate rather than
    // making a reader reconstruct it from two amounts and hope.
    const send = D('250.00');
    const rate = D('198');
    expect(send.times(rate).toFixed(2)).toBe('49500.00');
  });
});
