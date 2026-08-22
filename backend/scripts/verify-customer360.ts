/**
 * Customer 360, exercised against a real Postgres.
 *
 *   railway run npm run verify:customer360
 *
 * The unit suite builds `CustomersService` with a mocked Prisma, so it proves
 * what the service *does* with rows it is handed and nothing about whether the
 * queries that fetch them are valid. Nested selects, `_count`, relation
 * filters and the `customer_wallet` scoping are all things that typecheck
 * perfectly and fail at runtime against a real schema. This runs them.
 *
 * Writes, then removes what it wrote. Everything it creates is prefixed
 * `verify360-` and deleted in a `finally`, including on failure — the one
 * exception being the ledger, which is immutable by trigger. See `cleanup()`.
 *
 * Not part of `npm test`: it needs a real database and real credentials, and a
 * test suite that silently depends on production is worse than no suite.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CustomersService } from '../src/admin/customers.service';
import { encryptField, maskAccount } from '../src/common/crypto/field-crypto';
import { scriptPrisma } from './script-db';
import type { AuthUser } from '../src/auth/decorators/current-user.decorator';

const ACCOUNT = 'PK36SCBL0000001199887766';
const TAG = `verify360-${Date.now()}`;

let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ok    ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function main() {
  const prisma = scriptPrisma();

  // The service takes a WalletService only for `computeBalance`, which is a
  // sum over LedgerEntry. Handing it the real query keeps this honest: the
  // balance below is derived from the entries actually written.
  const wallets = {
    computeBalance: async (accountId: string) => {
      const entries = await prisma.ledgerEntry.findMany({
        where: { accountId },
        select: { direction: true, amount: true },
      });
      return entries.reduce(
        (acc, e) =>
          e.direction === 'credit' ? acc.plus(e.amount) : acc.minus(e.amount),
        new Prisma.Decimal(0),
      );
    },
  };

  const service = new CustomersService(
    prisma as unknown as ConstructorParameters<typeof CustomersService>[0],
    wallets as unknown as ConstructorParameters<typeof CustomersService>[1],
  );

  const ids = {
    customer: randomUUID(),
    staff: randomUUID(),
    wallet: randomUUID(),
    recipient: randomUUID(),
    transfer: randomUUID(),
    posting: randomUUID(),
  };

  try {
    await seed(prisma, ids);

    // ── The aggregate ────────────────────────────────────────────────────────
    console.log('\nGET /admin/customers/:id');
    const view = await service.overview(ids.customer);

    check(
      'profile is the customer asked for',
      view.profile.id === ids.customer,
    );
    check(
      'counts come from the database',
      view.profile.transferCount === 1,
      `got ${view.profile.transferCount}`,
    );
    check(
      'recipient count is right',
      view.profile.recipientCount === 1,
      `got ${view.profile.recipientCount}`,
    );
    check(
      'balance is derived from the ledger entries',
      view.balances[0]?.balance === '250.00',
      `got ${view.balances[0]?.balance}`,
    );
    check('only the customer wallet is listed', view.balances.length === 1);
    check('the transfer is present', view.transfers.length === 1);
    check(
      'the account number is masked',
      view.transfers[0]?.recipientBankAccountMasked === maskAccount(ACCOUNT),
      `got ${view.transfers[0]?.recipientBankAccountMasked}`,
    );

    // The assertion that matters most, against a real row rather than a
    // hand-built one: nothing anywhere in the payload is the real number.
    const serialised = JSON.stringify(view);
    check(
      'no full account number anywhere in the payload',
      !serialised.includes(ACCOUNT),
    );
    // The stored value, read back from the row rather than re-encrypted —
    // every ciphertext carries its own IV, so encrypting the same number twice
    // does not produce the same string and comparing against a fresh one would
    // pass for the wrong reason.
    const storedRow = await prisma.transfer.findUniqueOrThrow({
      where: { id: ids.transfer },
      select: { recipientBankAccount: true },
    });
    check(
      'no ciphertext in the payload either',
      !serialised.includes(storedRow.recipientBankAccount),
    );

    // ── The reveal ───────────────────────────────────────────────────────────
    console.log('\nPOST /admin/customers/:id/reveal');
    const staff: AuthUser = {
      id: ids.staff,
      email: `${TAG}-staff@meow.test`,
    } as AuthUser;

    const revealed = await service.reveal(staff, ids.customer, {
      transferId: ids.transfer,
      reason: 'Verification run against the real database',
    });
    check('returns the full number', revealed.bankAccount === ACCOUNT);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: ids.transfer, action: 'admin.customer.pii_reveal' },
      orderBy: { createdAt: 'desc' },
    });
    check('an audit row was written', Boolean(audit));
    check(
      'the audit row carries the reason',
      audit?.reason === 'Verification run against the real database',
    );
    check(
      'the audit row does not contain the number itself',
      !JSON.stringify(audit).includes(ACCOUNT),
    );

    // ── The cross-customer guard, against real rows ──────────────────────────
    console.log('\nreveal scoped to the customer in the path');
    let refused = false;
    try {
      await service.reveal(staff, randomUUID(), {
        transferId: ids.transfer,
        reason: 'should not work',
      });
    } catch {
      refused = true;
    }
    check('a transfer belonging to someone else is refused', refused);

    const auditCount = await prisma.auditLog.count({
      where: { entityId: ids.transfer, action: 'admin.customer.pii_reveal' },
    });
    check(
      'the refused attempt wrote no audit row',
      auditCount === 1,
      `got ${auditCount}`,
    );
  } finally {
    await cleanup(prisma, ids);
    await prisma.$disconnect();
  }

  console.log(
    failures === 0
      ? '\nAll checks passed against the real database.'
      : `\n${failures} check(s) FAILED.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

async function seed(prisma: PrismaClient, ids: Record<string, string>) {
  console.log(`Seeding ${TAG}…`);

  await prisma.user.create({
    data: {
      id: ids.staff,
      email: `${TAG}-staff@meow.test`,
      role: 'compliance',
    },
  });
  await prisma.user.create({
    data: {
      id: ids.customer,
      email: `${TAG}-customer@meow.test`,
      firstName: 'Verify',
      lastName: 'Customer',
      country: 'CA',
      emailVerified: true,
    },
  });

  await prisma.ledgerAccount.create({
    data: {
      id: ids.wallet,
      kind: 'customer_wallet',
      ownerId: ids.customer,
      currency: 'CAD',
      code: `wallet.${ids.customer}.CAD`,
    },
  });

  // A balanced posting, because the ledger enforces that with a deferred
  // constraint trigger — an unbalanced pair is rejected at COMMIT. The
  // counterparty is the opening-balance account the ledger migration created.
  const opening = await prisma.ledgerAccount.findFirstOrThrow({
    where: { kind: 'opening_balance', currency: 'CAD' },
  });

  await prisma.ledgerPosting.create({
    data: {
      id: ids.posting,
      key: `${TAG}:seed`,
      currency: 'CAD',
      entries: {
        create: [
          {
            accountId: ids.wallet,
            direction: 'credit',
            type: 'wallet_fund',
            amount: '250.00',
            currency: 'CAD',
            description: `${TAG} seed`,
          },
          {
            accountId: opening.id,
            direction: 'debit',
            type: 'wallet_fund',
            amount: '250.00',
            currency: 'CAD',
            description: `${TAG} seed`,
          },
        ],
      },
    },
  });

  await prisma.recipient.create({
    data: {
      id: ids.recipient,
      userId: ids.customer,
      name: 'Ayesha Khan',
      country: 'PK',
      bankAccount: encryptField(ACCOUNT),
      bankName: 'Standard Chartered',
    },
  });

  await prisma.transfer.create({
    data: {
      id: ids.transfer,
      userId: ids.customer,
      recipientId: ids.recipient,
      recipientName: 'Ayesha Khan',
      recipientCountry: 'PK',
      recipientBankAccount: encryptField(ACCOUNT),
      recipientBankName: 'Standard Chartered',
      sendAmount: '100.00',
      sendCurrency: 'CAD',
      receiveCurrency: 'PKR',
      feeAmount: '2.99',
      status: 'payout_processing',
      idempotencyKey: `${TAG}-idem`,
      timeline: {
        create: [{ status: 'initiated', message: 'Seeded for verification' }],
      },
    },
  });
}

/**
 * Remove everything this script created.
 *
 * Order follows the foreign keys, which are `Restrict` on every financial
 * relation by design — so this has to be deliberate rather than a cascade.
 *
 * The ledger is the exception and cannot be cleaned: `LedgerEntry` has a
 * BEFORE UPDATE OR DELETE trigger that rejects both, which is the correct
 * behaviour for an accounting record and the reason this script leaves two
 * balanced entries and one account behind. They are inert — a zero-sum posting
 * against opening balance, tagged `verify360-` — and the whole database is
 * being wiped before handover anyway.
 */
async function cleanup(prisma: PrismaClient, ids: Record<string, string>) {
  console.log('\nCleaning up…');
  const step = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (err) {
      console.log(`  could not remove ${label}: ${(err as Error).message}`);
    }
  };

  await step('audit rows', () =>
    prisma.auditLog.deleteMany({ where: { entityId: ids.transfer } }),
  );
  await step('customer notes', () =>
    prisma.customerNote.deleteMany({ where: { customerId: ids.customer } }),
  );
  await step('timeline', () =>
    prisma.transferEvent.deleteMany({ where: { transferId: ids.transfer } }),
  );
  await step('transfer', () =>
    prisma.transfer.deleteMany({ where: { id: ids.transfer } }),
  );
  await step('recipient', () =>
    prisma.recipient.deleteMany({ where: { id: ids.recipient } }),
  );
  await step('sessions', () =>
    prisma.session.deleteMany({ where: { userId: ids.customer } }),
  );
  await step('notifications', () =>
    prisma.notification.deleteMany({ where: { userId: ids.customer } }),
  );
  // The staff account owns nothing and goes cleanly. The customer does not:
  // it owns a LedgerAccount, which is Restrict, and that account's entries
  // cannot be deleted at all. This is the schema working as intended — an
  // accounting record outliving attempts to tidy it up is the point — so the
  // script reports what it left rather than pretending otherwise.
  await step('staff user', () =>
    prisma.user.deleteMany({ where: { email: `${TAG}-staff@meow.test` } }),
  );
  const customerGone = await prisma.user
    .delete({ where: { email: `${TAG}-customer@meow.test` } })
    .then(() => true)
    .catch(() => false);

  if (customerGone) {
    console.log('  customer removed');
  } else {
    console.log(
      `  LEFT BEHIND, by design: the customer ${TAG}-customer@meow.test, its ` +
        'CAD wallet, and one balanced posting against opening balance. ' +
        'LedgerEntry rejects DELETE by trigger, so the account cannot be ' +
        'removed and nor can its owner. Net effect on the books is zero.',
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
