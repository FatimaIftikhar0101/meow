-- Snapshot the beneficiary onto each transfer.
--
-- Transfers previously read their beneficiary through the `recipientId`
-- relation. Recipients are mutable, so editing one retroactively rewrote what
-- every past transfer to them claimed to have done — a delivered transfer's
-- receipt would show a bank account the money had never been sent to.
--
-- Added nullable, backfilled, then constrained, so this is safe to run against
-- a database that already holds rows.

ALTER TABLE "Transfer" ADD COLUMN "recipientName"        TEXT;
ALTER TABLE "Transfer" ADD COLUMN "recipientCountry"     TEXT;
ALTER TABLE "Transfer" ADD COLUMN "recipientBankAccount" TEXT;
ALTER TABLE "Transfer" ADD COLUMN "recipientBankName"    TEXT;
ALTER TABLE "Transfer" ADD COLUMN "recipientBankCode"    TEXT;

-- Backfill from the recipient as it stands today.
--
-- This is best-available truth, not recovered history: if a recipient was
-- edited before this migration ran, the original values were never recorded
-- anywhere and cannot be reconstructed. What it does guarantee is that the
-- drift stops here — every row from this point forward records what was
-- actually true when the transfer was made.
UPDATE "Transfer" t
SET "recipientName"        = r."name",
    "recipientCountry"     = r."country",
    "recipientBankAccount" = r."bankAccount",
    "recipientBankName"    = r."bankName",
    "recipientBankCode"    = r."bankCode"
FROM "Recipient" r
WHERE r."id" = t."recipientId";

-- Any transfer whose recipient row has vanished cannot be left null once the
-- constraint lands. Nothing in the application deletes recipients, so this is
-- a belt-and-braces guard against manual database surgery rather than an
-- expected case — and it marks the row as unknown rather than inventing a
-- plausible-looking beneficiary.
UPDATE "Transfer"
SET "recipientName"        = COALESCE("recipientName", 'UNKNOWN'),
    "recipientCountry"     = COALESCE("recipientCountry", 'XX'),
    "recipientBankAccount" = COALESCE("recipientBankAccount", 'UNKNOWN')
WHERE "recipientName" IS NULL
   OR "recipientCountry" IS NULL
   OR "recipientBankAccount" IS NULL;

ALTER TABLE "Transfer" ALTER COLUMN "recipientName"        SET NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "recipientCountry"     SET NOT NULL;
ALTER TABLE "Transfer" ALTER COLUMN "recipientBankAccount" SET NOT NULL;
