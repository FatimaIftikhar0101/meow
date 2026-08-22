import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * The double-entry migration, executed rather than assumed.
 *
 * Every migration in the folder is applied in the order Prisma applies them,
 * against a real Postgres — PGlite is Postgres compiled to WebAssembly, so the
 * constraint triggers, the PL/pgSQL and the deferred-check semantics are the
 * genuine article and not a mock of them.
 *
 * This exists because the alternative was shipping unverified SQL that
 * rewrites the money table. There is no local Postgres on this machine and
 * `DATABASE_PUBLIC_URL` is still missing from Railway (backlog #33), so the
 * migration could not otherwise be run anywhere before it ran in production.
 *
 * It keeps earning its place after today: the triggers below are the only
 * thing standing between a future writer and an unbalanced ledger, and nothing
 * in TypeScript can test them.
 */

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'prisma', 'migrations');

async function migratedDatabase(seed?: (db: PGlite) => Promise<void>) {
  const db = await PGlite.create();
  const folders = readdirSync(MIGRATIONS_DIR)
    .filter((f) => !f.endsWith('.toml'))
    .sort();

  for (const folder of folders) {
    if (folder === '20260822_double_entry_ledger' && seed) {
      // Legacy rows have to exist *before* the migration that backfills them.
      await seed(db);
    }
    const sql = readFileSync(
      join(MIGRATIONS_DIR, folder, 'migration.sql'),
      'utf8',
    );
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`Migration ${folder} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/** A user, a wallet and a single-legged posting — the shape this replaces. */
async function seedLegacy(db: PGlite) {
  await db.exec(`
    INSERT INTO "User" ("id","email","passwordHash","createdAt","updatedAt")
    VALUES ('u-1','a@meow.test','x',NOW(),NOW());
    INSERT INTO "Wallet" ("id","userId","currency","createdAt")
    VALUES ('w-1','u-1','CAD',NOW());
    INSERT INTO "Corridor"
      ("id","fromCurrency","toCurrency","fromCountry","toCountry",
       "baseRate","minSendAmount","maxSendAmount")
    VALUES ('c-1','CAD','PKR','CA','PK',198,10,5000);

    -- A funding credit, alone in its group, as every posting used to be.
    INSERT INTO "LedgerEntry"
      ("id","walletId","txGroupId","direction","type","amount","currency","createdAt")
    VALUES ('e-1','w-1','g-1','credit','wallet_fund',1000,'CAD',NOW());

    -- A transfer hold and its fee: two debits sharing one group, which is what
    -- "both legs of a double-entry pair" actually meant in practice.
    INSERT INTO "LedgerEntry"
      ("id","walletId","txGroupId","direction","type","amount","currency","createdAt")
    VALUES ('e-2','w-1','g-2','debit','transfer_hold',250,'CAD',NOW()),
           ('e-3','w-1','g-2','debit','fee',2.5,'CAD',NOW());
  `);
}

async function balanceOf(db: PGlite, accountId: string): Promise<string> {
  const r = await db.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN "direction"='credit' THEN "amount" ELSE -"amount" END), 0)::text AS balance
       FROM "LedgerEntry" WHERE "accountId" = $1`,
    [accountId],
  );
  return r.rows[0].balance;
}

describe('double-entry migration', () => {
  jest.setTimeout(60_000);

  it('applies cleanly onto an empty database', async () => {
    const db = await migratedDatabase();
    const r = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM "LedgerAccount"`,
    );
    // No wallets and no corridors, so there is nothing to derive a currency
    // from and no system accounts to create. Cleanly, not by erroring.
    expect(r.rows[0].n).toBe(0);
    await db.close();
  });

  describe('with legacy single-legged data', () => {
    let db: PGlite;
    beforeAll(async () => {
      db = await migratedDatabase(seedLegacy);
    });
    afterAll(async () => {
      await db.close();
    });

    it('keeps the wallet id, so no entry has to be rewritten', async () => {
      const r = await db.query<{ kind: string; code: string; ownerId: string }>(
        `SELECT "kind","code","ownerId" FROM "LedgerAccount" WHERE id = 'w-1'`,
      );
      expect(r.rows[0]).toEqual({
        kind: 'customer_wallet',
        code: 'wallet.u-1.CAD',
        ownerId: 'u-1',
      });
    });

    it('leaves the customer balance exactly where it was', async () => {
      // 1000 funded, 250 held, 2.50 fee. If the migration moved a customer's
      // money by a cent, nothing else about it matters.
      expect(await balanceOf(db, 'w-1')).toBe('747.5000');
    });

    it('creates the system accounts for every currency in use', async () => {
      const r = await db.query<{ code: string }>(
        `SELECT "code" FROM "LedgerAccount" WHERE "ownerId" IS NULL ORDER BY "code"`,
      );
      const codes = r.rows.map((x) => x.code);
      // CAD from the wallet and the corridor, PKR from the corridor's far side.
      expect(codes).toContain('float.CAD');
      expect(codes).toContain('revenue.fee.CAD');
      expect(codes).toContain('suspense.transfer.CAD');
      expect(codes).toContain('float.PKR');
    });

    it('gives every legacy posting a counterparty', async () => {
      const r = await db.query<{ postingId: string; net: string }>(
        `SELECT "postingId",
                SUM(CASE WHEN "direction"='credit' THEN "amount" ELSE -"amount" END)::text AS net
           FROM "LedgerEntry" GROUP BY "postingId" HAVING
                SUM(CASE WHEN "direction"='credit' THEN "amount" ELSE -"amount" END) <> 0`,
      );
      expect(r.rows).toEqual([]);
    });

    it('parks the unrecorded history on opening_balance, not nowhere', async () => {
      const acc = await db.query<{ id: string }>(
        `SELECT id FROM "LedgerAccount" WHERE "kind"='opening_balance' AND "currency"='CAD'`,
      );
      // 1000 credited to the wallet needs 1000 debited here; 252.50 debited
      // from the wallet needs 252.50 credited. Net -747.50, the mirror of the
      // customer's balance — which is what a liability account should look
      // like when the other side was never written down.
      expect(await balanceOf(db, acc.rows[0].id)).toBe('-747.5000');
    });
  });

  /**
   * The whole money path, posted the way the services post it.
   *
   * Written as SQL rather than by driving the services, because the thing
   * being checked is the chart of accounts itself: whether the directions
   * chosen for each movement leave every account where it should be, and the
   * ledger as a whole summing to zero. A sign error here is invisible in a
   * unit test — every individual posting balances — and shows up only as a
   * float account that drifts the wrong way over months.
   */
  describe('the money path', () => {
    let db: PGlite;
    const account: Record<string, string> = {};

    beforeAll(async () => {
      db = await migratedDatabase(seedLegacy);
      const r = await db.query<{ code: string; id: string }>(
        `SELECT "code", "id" FROM "LedgerAccount"`,
      );
      for (const row of r.rows) account[row.code] = row.id;
    });
    afterAll(async () => {
      await db.close();
    });

    async function post(
      key: string,
      legs: Array<[string, 'debit' | 'credit', string, string]>,
    ) {
      const id = `p-${key}`;
      const values = legs
        .map(
          ([code, direction, amount, type], i) =>
            `('e-${key}-${i}','${account[code]}','${id}','${direction}','${type}',${amount},'CAD',NOW())`,
        )
        .join(',');
      await db.exec(`
        BEGIN;
        INSERT INTO "LedgerPosting" ("id","key","currency","createdAt")
          VALUES ('${id}','${key}','CAD',NOW());
        INSERT INTO "LedgerEntry"
          ("id","accountId","postingId","direction","type","amount","currency","createdAt")
          VALUES ${values};
        COMMIT;
      `);
    }

    it('funds, holds, charges a fee and settles, staying balanced throughout', async () => {
      // Funding: our cash rises, and so does what we owe the customer.
      await post('fund', [
        ['wallet.u-1.CAD', 'credit', '500', 'wallet_fund'],
        ['float.CAD', 'debit', '500', 'wallet_fund'],
      ]);
      // The hold: their money becomes money in flight.
      await post('hold', [
        ['wallet.u-1.CAD', 'debit', '250', 'transfer_hold'],
        ['suspense.transfer.CAD', 'credit', '250', 'transfer_hold'],
      ]);
      // The fee: revenue the business can now actually report.
      await post('fee', [
        ['wallet.u-1.CAD', 'debit', '2.5', 'fee'],
        ['revenue.fee.CAD', 'credit', '2.5', 'fee'],
      ]);
      // Delivery: in-flight money leaves for the payout partner. Without this
      // posting suspense only ever grows.
      await post('settle', [
        ['suspense.transfer.CAD', 'debit', '250', 'transfer_release'],
        ['settlement.payout.CAD', 'credit', '250', 'transfer_release'],
      ]);

      // Seeded 1000 funded / 250 held / 2.50 fee, then 500 / 250 / 2.50 here.
      expect(await balanceOf(db, account['wallet.u-1.CAD'])).toBe('995.0000');
      // Nothing in flight once everything has settled — the property that
      // makes this account worth watching.
      expect(await balanceOf(db, account['suspense.transfer.CAD'])).toBe(
        '0.0000',
      );
      expect(await balanceOf(db, account['revenue.fee.CAD'])).toBe('2.5000');
      expect(await balanceOf(db, account['float.CAD'])).toBe('-500.0000');
    });

    it('leaves the ledger as a whole summing to zero', async () => {
      // The property that makes it a ledger. If this ever fails, some posting
      // moved money into or out of existence.
      const r = await db.query<{ total: string }>(
        `SELECT COALESCE(SUM(CASE WHEN "direction"='credit' THEN "amount" ELSE -"amount" END),0)::text AS total
           FROM "LedgerEntry"`,
      );
      expect(r.rows[0].total).toBe('0.0000');
    });

    it('returns everything to the customer when a transfer is refunded', async () => {
      const before = await balanceOf(db, account['wallet.u-1.CAD']);

      await post('hold2', [
        ['wallet.u-1.CAD', 'debit', '100', 'transfer_hold'],
        ['suspense.transfer.CAD', 'credit', '100', 'transfer_hold'],
      ]);
      await post('fee2', [
        ['wallet.u-1.CAD', 'debit', '1', 'fee'],
        ['revenue.fee.CAD', 'credit', '1', 'fee'],
      ]);
      await post('refund2', [
        ['suspense.transfer.CAD', 'debit', '100', 'transfer_refund'],
        ['wallet.u-1.CAD', 'credit', '100', 'transfer_refund'],
      ]);
      await post('fee-refund2', [
        ['revenue.fee.CAD', 'debit', '1', 'transfer_refund'],
        ['wallet.u-1.CAD', 'credit', '1', 'transfer_refund'],
      ]);

      // The customer is whole again.
      expect(await balanceOf(db, account['wallet.u-1.CAD'])).toBe(before);
      // And the fee is not revenue, because the transfer never happened.
      expect(await balanceOf(db, account['revenue.fee.CAD'])).toBe('2.5000');
      expect(await balanceOf(db, account['suspense.transfer.CAD'])).toBe(
        '0.0000',
      );
    });
  });

  describe('the balance trigger', () => {
    let db: PGlite;
    beforeAll(async () => {
      db = await migratedDatabase(seedLegacy);
    });
    afterAll(async () => {
      await db.close();
    });

    /**
     * Run a statement block as one transaction, rolling back if it fails.
     *
     * The rollback is not tidiness. Postgres puts a session into "current
     * transaction is aborted" after a failed statement and refuses everything
     * until the block ends — so without this, the first test that correctly
     * rejects a posting makes every later test in the file fail for an
     * entirely unrelated reason.
     */
    async function inTransaction(sql: string) {
      try {
        await db.exec(`BEGIN; ${sql} COMMIT;`);
      } catch (err) {
        await db.exec('ROLLBACK');
        throw err;
      }
    }

    async function post(legs: Array<[string, string, string]>, key: string) {
      const values = legs
        .map(
          ([account, dir, amount], i) =>
            `('x-${key}-${i}','${account}','p-${key}',NULL,'${dir}','transfer_hold',${amount},'CAD',NULL,NOW())`,
        )
        .join(',');
      await inTransaction(`
        INSERT INTO "LedgerPosting" ("id","key","currency","createdAt")
          VALUES ('p-${key}','${key}','CAD',NOW());
        INSERT INTO "LedgerEntry"
          ("id","accountId","postingId","transferId","direction","type","amount","currency","description","createdAt")
          VALUES ${values};
      `);
    }

    let suspense: string;
    beforeAll(async () => {
      const r = await db.query<{ id: string }>(
        `SELECT id FROM "LedgerAccount" WHERE "code"='suspense.transfer.CAD'`,
      );
      suspense = r.rows[0].id;
    });

    it('accepts a balanced posting', async () => {
      await post(
        [
          ['w-1', 'debit', '100'],
          [suspense, 'credit', '100'],
        ],
        'ok',
      );
      const r = await db.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM "LedgerEntry" WHERE "postingId"='p-ok'`,
      );
      expect(r.rows[0].n).toBe(2);
    });

    it('rejects one that does not balance', async () => {
      await expect(
        post(
          [
            ['w-1', 'debit', '100'],
            [suspense, 'credit', '99'],
          ],
          'bad',
        ),
      ).rejects.toThrow(/is out by/);
    });

    it('rejects a single-legged posting — the shape this replaces', async () => {
      await expect(post([['w-1', 'debit', '50']], 'lonely')).rejects.toThrow(
        /is out by/,
      );
    });

    it('rejects a posting that mixes currencies', async () => {
      await expect(
        inTransaction(`
          INSERT INTO "LedgerPosting" ("id","key","currency","createdAt")
            VALUES ('p-fx','fx','CAD',NOW());
          INSERT INTO "LedgerEntry"
            ("id","accountId","postingId","direction","type","amount","currency","createdAt")
            VALUES ('x-fx-0','w-1','p-fx','debit','fx_conversion',250,'CAD',NOW()),
                   ('x-fx-1','${suspense}','p-fx','credit','fx_conversion',250,'PKR',NOW());
        `),
      ).rejects.toThrow(/mixes 2 currencies/);
    });

    it('refuses a negative amount', async () => {
      await expect(
        post(
          [
            ['w-1', 'debit', '-100'],
            [suspense, 'debit', '100'],
          ],
          'negative',
        ),
      ).rejects.toThrow(/LedgerEntry_amount_positive/);
    });

    it('refuses to let an entry be edited or deleted', async () => {
      await expect(
        db.exec(`UPDATE "LedgerEntry" SET "amount" = 1 WHERE id = 'e-1'`),
      ).rejects.toThrow(/append-only/);
      await expect(
        db.exec(`DELETE FROM "LedgerEntry" WHERE id = 'e-1'`),
      ).rejects.toThrow(/append-only/);
    });

    it('refuses a duplicate posting key', async () => {
      // What stops a retried operation posting the same movement twice. The
      // old randomUUID() group id could not: a retry simply made a new one.
      await expect(
        inTransaction(`INSERT INTO "LedgerPosting" ("id","key","currency","createdAt")
                 VALUES ('p-dup','ok','CAD',NOW());`),
      ).rejects.toThrow(/duplicate key|unique/i);
    });
  });
});
