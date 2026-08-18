/**
 * Encrypt account numbers that were written before column encryption existed.
 *
 * Run once, after deploying the code that reads them:
 *
 *   npx ts-node scripts/backfill-encryption.ts
 *
 * Safe to run more than once. `isEncrypted` skips anything already converted,
 * so an interrupted run resumes rather than double-encrypting — which would be
 * unrecoverable, since the second decrypt would return the first ciphertext.
 *
 * Order matters: deploy first, backfill second. `decryptField` passes
 * unprefixed values through unchanged, so between the two the application
 * reads old and new rows equally well. Doing it the other way round would
 * leave the running code handing ciphertext to customers as their account
 * number.
 */
import { PrismaClient } from '@prisma/client';
import { encryptField, isEncrypted } from '../src/common/crypto/field-crypto';

const prisma = new PrismaClient();

async function main() {
  let recipients = 0;
  for (const r of await prisma.recipient.findMany({
    select: { id: true, bankAccount: true },
  })) {
    if (isEncrypted(r.bankAccount)) continue;
    await prisma.recipient.update({
      where: { id: r.id },
      data: { bankAccount: encryptField(r.bankAccount) },
    });
    recipients++;
  }

  let transfers = 0;
  for (const t of await prisma.transfer.findMany({
    select: { id: true, recipientBankAccount: true },
  })) {
    if (isEncrypted(t.recipientBankAccount)) continue;
    await prisma.transfer.update({
      where: { id: t.id },
      data: { recipientBankAccount: encryptField(t.recipientBankAccount) },
    });
    transfers++;
  }

  console.log(`encrypted: ${recipients} recipients, ${transfers} transfers`);

  const left = await prisma.recipient.count({
    where: { NOT: { bankAccount: { startsWith: 'v1.' } } },
  });
  if (left > 0) {
    // Not an error — a row could have been inserted by the running app between
    // the read and now. Worth saying out loud so nobody assumes the table is
    // clean when it is not.
    console.log(`${left} recipient rows still unencrypted; re-run to catch up`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
