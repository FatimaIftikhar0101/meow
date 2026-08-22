import { InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertBalanced, type Posting } from './ledger.service';

/**
 * The balance check that runs before anything reaches the database.
 *
 * A constraint trigger enforces the same rule and is the real guarantee — it
 * holds for writers that never call this code. What this layer adds is a clear
 * error at the call site, naming the posting and the amount it is out by,
 * rather than a Postgres exception surfacing three frames away.
 */

function posting(
  legs: Array<[Posting['legs'][number]['direction'], string]>,
): Posting {
  return {
    key: 'test:posting',
    currency: 'CAD',
    legs: legs.map(([direction, amount]) => ({
      accountId: `acct-${direction}-${amount}`,
      direction,
      type: 'transfer_hold',
      amount: new Prisma.Decimal(amount),
    })),
  };
}

describe('assertBalanced', () => {
  it('accepts debits equal to credits', () => {
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '250.00'],
          ['credit', '250.00'],
        ]),
      ),
    ).not.toThrow();
  });

  it('accepts one debit split across two credits', () => {
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '252.50'],
          ['credit', '250.00'],
          ['credit', '2.50'],
        ]),
      ),
    ).not.toThrow();
  });

  it('rejects a single leg — the shape this replaces', () => {
    // Every posting in the codebase used to look exactly like this.
    expect(() => assertBalanced(posting([['debit', '250.00']]))).toThrow(
      /at least two sides/,
    );
  });

  it('rejects an imbalance, and says how big it is', () => {
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '250.00'],
          ['credit', '249.99'],
        ]),
      ),
    ).toThrow(/debits 250 vs credits 249.99/);
  });

  it('rejects a negative amount even when the sums agree', () => {
    // -100 debit and 100 debit sum to zero and would sail past a naive check,
    // while making every `SUM(...) WHERE direction = 'debit'` in the system
    // wrong. The sign belongs in the direction, never in the amount.
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '-100.00'],
          ['debit', '100.00'],
        ]),
      ),
    ).toThrow(/non-positive amount/);
  });

  it('rejects a zero amount', () => {
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '0'],
          ['credit', '0'],
        ]),
      ),
    ).toThrow(/non-positive amount/);
  });

  it('compares decimals exactly, not as floats', () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. Amounts are Prisma.Decimal
    // for exactly this reason, and the check has to keep them that way.
    expect(() =>
      assertBalanced(
        posting([
          ['debit', '0.1'],
          ['debit', '0.2'],
          ['credit', '0.3'],
        ]),
      ),
    ).not.toThrow();
  });

  it('throws an internal error, not a client one', () => {
    // An unbalanced posting is a bug in our code, never bad input from a
    // customer — so it must not surface as a 400 that looks like their fault.
    try {
      assertBalanced(posting([['debit', '1']]));
      fail('expected a throw');
    } catch (err) {
      expect(err).toBeInstanceOf(InternalServerErrorException);
    }
  });
});
