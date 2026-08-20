/**
 * Read-only health check on the deployed database.
 *
 * Answers the three questions a redeploy raises, in order of how bad the
 * answer can be: is the schema there, is the data there, and does what is
 * stored still decrypt with the key the app is holding.
 *
 * That last one is the quiet failure. A restored or re-provisioned database
 * paired with a regenerated ENCRYPTION_KEY leaves every row present and every
 * account number unreadable, and nothing surfaces it until a customer opens a
 * transfer.
 *
 *   railway run npm run db:check
 *
 * Writes nothing.
 */
import { decryptField, isEncrypted } from '../src/common/crypto/field-crypto';
import { scriptPrisma } from './script-db';

const prisma = scriptPrisma();

async function main() {
  const migrations = await prisma.$queryRawUnsafe<
    { migration_name: string; finished_at: Date | null }[]
  >(
    `SELECT migration_name, finished_at FROM "_prisma_migrations"
     ORDER BY finished_at DESC NULLS FIRST`,
  );
  const unfinished = migrations.filter((m) => m.finished_at === null);
  console.log(`migrations applied: ${migrations.length - unfinished.length}`);
  if (unfinished.length) {
    console.log(
      `  UNFINISHED: ${unfinished.map((m) => m.migration_name).join(', ')}`,
    );
  }
  console.log(`  latest: ${migrations[0]?.migration_name ?? '(none)'}`);

  // Sequential, not Promise.all. Through Railway's public proxy a burst of
  // concurrent queries fails as `Can't reach database server`, which reads as
  // an outage rather than as too many sockets. Nothing here is slow enough for
  // the parallelism to have been worth that.
  const users = await prisma.user.count();
  const staff = await prisma.user.count({
    where: { role: { not: 'customer' } },
  });
  const admins = await prisma.user.count({ where: { role: 'admin' } });
  const wallets = await prisma.wallet.count();
  const recipients = await prisma.recipient.count();
  const transfers = await prisma.transfer.count();
  const audits = await prisma.auditLog.count();

  console.log('\nrows');
  console.log(`  users ${users} (staff ${staff}, admin ${admins})`);
  console.log(`  wallets ${wallets}  recipients ${recipients}`);
  console.log(`  transfers ${transfers}  audit entries ${audits}`);

  // The columns the recent migrations added. Selecting them at all proves they
  // exist; Prisma throws P2022 if they do not.
  await prisma.user.findFirst({
    select: { mfaEnabledAt: true, mfaRecoveryCodes: true },
  });
  await prisma.auditLog.findFirst({
    select: { actorEmail: true, beforeValue: true, reason: true },
  });
  await prisma.transfer.findFirst({ select: { recipientBankAccount: true } });
  console.log('\nnew columns present: mfa*, audit before/after, transfer snapshot');

  console.log('\nencryption');
  let checked = 0;
  let plaintext = 0;
  let failed = 0;
  for (const r of await prisma.recipient.findMany({
    select: { id: true, bankAccount: true },
  })) {
    if (!isEncrypted(r.bankAccount)) {
      plaintext++;
      continue;
    }
    checked++;
    try {
      decryptField(r.bankAccount);
    } catch {
      failed++;
    }
  }
  console.log(`  recipients: ${checked} encrypted, ${plaintext} plaintext`);
  if (failed > 0) {
    console.log(
      `  ${failed} FAILED TO DECRYPT — the key does not match this data. ` +
        'Do not write anything until that is resolved.',
    );
  } else if (checked > 0) {
    console.log('  all decrypt with the key this environment holds');
  }
}

main()
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
