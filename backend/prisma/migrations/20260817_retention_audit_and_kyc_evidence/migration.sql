-- Retention guarantees, audit detail, and somewhere to put KYC evidence.

-- ── Retention ───────────────────────────────────────────────────────────────
--
-- Wallets, recipients, KYC records and referrals all cascaded from User. No
-- code path deletes a user today — there are no delete calls anywhere in the
-- backend, and `recipients.remove()` is already a soft delete — so this is not
-- fixing a live bug. It is closing the route by which a future erasure request
-- could silently destroy financial and identity records that carry a retention
-- obligation.
--
-- Sessions keep cascading: they are operational state, not evidence, and should
-- go when an account does. TransferEvent keeps cascading from Transfer for the
-- same reason it always did — an event has no meaning without its transfer.
ALTER TABLE "Wallet"    DROP CONSTRAINT "Wallet_userId_fkey";
ALTER TABLE "Wallet"    ADD CONSTRAINT "Wallet_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Recipient" DROP CONSTRAINT "Recipient_userId_fkey";
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KycRecord" DROP CONSTRAINT "KycRecord_userId_fkey";
ALTER TABLE "KycRecord" ADD CONSTRAINT "KycRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral"  DROP CONSTRAINT "Referral_referrerId_fkey";
ALTER TABLE "Referral"  ADD CONSTRAINT "Referral_referrerId_fkey"
  FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Referral"  DROP CONSTRAINT "Referral_refereeId_fkey";
ALTER TABLE "Referral"  ADD CONSTRAINT "Referral_refereeId_fkey"
  FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Audit detail ────────────────────────────────────────────────────────────
--
-- `metadata` was carrying whatever each call site chose to put there: corridor
-- updates stored the incoming DTO (new values only), user suspension stored
-- nothing. Prior value, new value and reason get their own columns so the
-- shape is enforced rather than conventional. `actorEmail` is denormalised
-- because the user relation is SetNull — without it, the trail can lose the
-- one thing it exists to record.
ALTER TABLE "AuditLog" ADD COLUMN "actorEmail"  TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "beforeValue" JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "afterValue"  JSONB;
ALTER TABLE "AuditLog" ADD COLUMN "reason"      TEXT;

-- ── KYC evidence ────────────────────────────────────────────────────────────
--
-- All nullable: the current provider is a mock and produces no evidence. These
-- exist so that wiring a real provider is a code change rather than a migration
-- against production data. `documentLast4` is deliberately not the full number.
ALTER TABLE "KycRecord" ADD COLUMN "verifiedName"     TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "verifiedDob"      TIMESTAMP(3);
ALTER TABLE "KycRecord" ADD COLUMN "verifiedAddress"  TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "documentType"     TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "documentLast4"    TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "documentExpiry"   TIMESTAMP(3);
ALTER TABLE "KycRecord" ADD COLUMN "method"           TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "providerResponse" JSONB;
ALTER TABLE "KycRecord" ADD COLUMN "reviewedById"     TEXT;
ALTER TABLE "KycRecord" ADD COLUMN "reviewedAt"       TIMESTAMP(3);
