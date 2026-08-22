-- Turn the ledger into an actual double-entry ledger.
--
-- The schema has always described `txGroupId` as "both legs of a double-entry
-- pair share this". Every posting in the codebase wrote one leg. Creating a
-- transfer debited the customer's wallet and credited nothing; a refund
-- credited it back and debited nothing; fees were taken and recorded nowhere,
-- so the business had no record of its own revenue. Balances were right —
-- each wallet summed its own rows — but money that was not in somebody's
-- wallet existed in no account at all.
--
-- ── Order matters here ───────────────────────────────────────────────────────
--
-- Wallet ids are PRESERVED as account ids. That is what makes this migration
-- cheap and safe: every existing LedgerEntry keeps pointing at exactly the
-- account it always pointed at, so no entry is rewritten and no balance can
-- move. The rename is a rename, not a data migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Accounts
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "AccountKind" AS ENUM (
  'customer_wallet',
  'float',
  'transfer_suspense',
  'fee_revenue',
  'marketing_expense',
  'payout_settlement',
  'opening_balance'
);

ALTER TABLE "Wallet" RENAME TO "LedgerAccount";
ALTER TABLE "LedgerAccount" RENAME CONSTRAINT "Wallet_pkey" TO "LedgerAccount_pkey";

ALTER TABLE "LedgerAccount" ADD COLUMN "kind" "AccountKind";
ALTER TABLE "LedgerAccount" ADD COLUMN "code" TEXT;
ALTER TABLE "LedgerAccount" RENAME COLUMN "userId" TO "ownerId";

-- Everything that existed was a customer wallet by definition.
UPDATE "LedgerAccount"
   SET "kind" = 'customer_wallet',
       "code" = 'wallet.' || "ownerId" || '.' || "currency";

ALTER TABLE "LedgerAccount" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "LedgerAccount" ALTER COLUMN "code" SET NOT NULL;
-- Nullable from here on: system accounts have no owner.
ALTER TABLE "LedgerAccount" ALTER COLUMN "ownerId" DROP NOT NULL;

DROP INDEX IF EXISTS "Wallet_userId_currency_key";
DROP INDEX IF EXISTS "Wallet_userId_idx";
CREATE UNIQUE INDEX "LedgerAccount_code_key" ON "LedgerAccount" ("code");
CREATE UNIQUE INDEX "LedgerAccount_kind_ownerId_currency_key"
  ON "LedgerAccount" ("kind", "ownerId", "currency");
CREATE INDEX "LedgerAccount_kind_currency_idx" ON "LedgerAccount" ("kind", "currency");

ALTER TABLE "LedgerAccount" RENAME CONSTRAINT "Wallet_userId_fkey" TO "LedgerAccount_ownerId_fkey";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The system accounts, one set per currency already in use
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "LedgerAccount" ("id", "kind", "ownerId", "currency", "code", "createdAt")
SELECT gen_random_uuid(), k.kind, NULL, c.currency,
       k.prefix || '.' || c.currency, NOW()
FROM (
  SELECT DISTINCT "currency" FROM "LedgerAccount"
  UNION
  SELECT DISTINCT "fromCurrency" FROM "Corridor"
  UNION
  SELECT DISTINCT "toCurrency" FROM "Corridor"
) AS c(currency)
CROSS JOIN (
  VALUES ('float'::"AccountKind",             'float'),
         ('transfer_suspense'::"AccountKind", 'suspense.transfer'),
         ('fee_revenue'::"AccountKind",       'revenue.fee'),
         ('marketing_expense'::"AccountKind", 'expense.marketing'),
         ('payout_settlement'::"AccountKind", 'settlement.payout'),
         ('opening_balance'::"AccountKind",   'equity.opening')
) AS k(kind, prefix)
ON CONFLICT ("code") DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Postings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "LedgerPosting" (
  "id"         TEXT NOT NULL,
  "key"        TEXT NOT NULL,
  "currency"   TEXT NOT NULL,
  "transferId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LedgerPosting_key_key" ON "LedgerPosting" ("key");
CREATE INDEX "LedgerPosting_transferId_idx" ON "LedgerPosting" ("transferId");
CREATE INDEX "LedgerPosting_createdAt_idx" ON "LedgerPosting" ("createdAt");
ALTER TABLE "LedgerPosting"
  ADD CONSTRAINT "LedgerPosting_transferId_fkey"
  FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One posting per historical txGroupId, reusing the group id as the posting id
-- so the entries below need only a column rename to point at it.
INSERT INTO "LedgerPosting" ("id", "key", "currency", "transferId", "createdAt")
SELECT e."txGroupId",
       'legacy:' || e."txGroupId",
       MIN(e."currency"),
       MIN(e."transferId"),
       MIN(e."createdAt")
FROM "LedgerEntry" e
GROUP BY e."txGroupId";

ALTER TABLE "LedgerEntry" RENAME COLUMN "walletId" TO "accountId";
ALTER TABLE "LedgerEntry" RENAME COLUMN "txGroupId" TO "postingId";
ALTER TABLE "LedgerEntry" RENAME CONSTRAINT "LedgerEntry_walletId_fkey" TO "LedgerEntry_accountId_fkey";
DROP INDEX IF EXISTS "LedgerEntry_walletId_idx";
DROP INDEX IF EXISTS "LedgerEntry_txGroupId_idx";
CREATE INDEX "LedgerEntry_accountId_idx" ON "LedgerEntry" ("accountId");
CREATE INDEX "LedgerEntry_postingId_idx" ON "LedgerEntry" ("postingId");

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_postingId_fkey"
  FOREIGN KEY ("postingId") REFERENCES "LedgerPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The balance query is SUM(amount) filtered by account and direction. INCLUDE
-- puts the amount in the index so it can be answered without touching the
-- heap — Prisma cannot express a covering index, so it is written here.
CREATE INDEX "LedgerEntry_balance_idx"
  ON "LedgerEntry" ("accountId", "direction") INCLUDE ("amount");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Balance the history
--
-- Every existing posting has one side. Rather than pretend otherwise, give
-- each one a counterparty against equity.opening. The resulting balance on
-- that account is precisely the amount of history whose other side was never
-- recorded — a number worth being able to state, and one that stops growing
-- from today.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO "LedgerEntry" (
  "id", "accountId", "postingId", "transferId",
  "direction", "type", "amount", "currency", "description", "createdAt"
)
SELECT gen_random_uuid(),
       opening."id",
       g."postingId",
       NULL,
       -- The mirror image, so the pair sums to zero.
       CASE WHEN g."net" > 0 THEN 'debit'::"LedgerDirection"
            ELSE 'credit'::"LedgerDirection" END,
       g."type",
       ABS(g."net"),
       g."currency",
       'Opening counterparty for a posting written before double-entry',
       g."createdAt"
FROM (
  SELECT e."postingId",
         e."currency",
         MIN(e."createdAt")  AS "createdAt",
         (ARRAY_AGG(e."type" ORDER BY e."createdAt"))[1] AS "type",
         SUM(CASE WHEN e."direction" = 'credit' THEN e."amount" ELSE -e."amount" END) AS "net"
  FROM "LedgerEntry" e
  GROUP BY e."postingId", e."currency"
  HAVING SUM(CASE WHEN e."direction" = 'credit' THEN e."amount" ELSE -e."amount" END) <> 0
) AS g
JOIN "LedgerAccount" opening
  ON opening."kind" = 'opening_balance' AND opening."currency" = g."currency";

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Make it impossible to write an unbalanced posting
--
-- In application code this is a convention. Here it is a rule: it holds for
-- every writer, including a future service, a data-fix script, and somebody
-- with a psql prompt at two in the morning.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assert_posting_balances() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  imbalance NUMERIC;
  currencies INT;
BEGIN
  SELECT COUNT(DISTINCT "currency"),
         COALESCE(SUM(CASE WHEN "direction" = 'credit' THEN "amount" ELSE -"amount" END), 0)
    INTO currencies, imbalance
    FROM "LedgerEntry"
   WHERE "postingId" = NEW."postingId";

  -- A posting spanning currencies cannot balance in any meaningful sense; the
  -- two sides of an exchange are two postings linked by a rate, not one.
  IF currencies > 1 THEN
    RAISE EXCEPTION 'Posting % mixes % currencies', NEW."postingId", currencies
      USING ERRCODE = 'check_violation';
  END IF;

  IF imbalance <> 0 THEN
    RAISE EXCEPTION 'Posting % is out by %', NEW."postingId", imbalance
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NULL;
END $$;

-- DEFERRABLE INITIALLY DEFERRED so the check runs once at COMMIT rather than
-- after each leg. Checking per statement would reject every posting at its
-- first leg, which is the shape all of them have.
CREATE CONSTRAINT TRIGGER "ledger_posting_balances"
  AFTER INSERT ON "LedgerEntry"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_posting_balances();

CREATE OR REPLACE FUNCTION reject_ledger_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'LedgerEntry is append-only; post a reversing entry instead'
    USING ERRCODE = 'check_violation';
END $$;

CREATE TRIGGER "ledger_entry_immutable"
  BEFORE UPDATE OR DELETE ON "LedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();

-- A positive amount with an explicit direction. A negative debit is a credit
-- wearing a disguise and makes every SUM in the system wrong.
ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_amount_positive" CHECK ("amount" > 0);
