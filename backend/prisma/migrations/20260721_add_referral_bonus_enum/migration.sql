-- Add referral_bonus to LedgerEntryType enum
-- (ALTER TYPE ADD VALUE cannot run inside a transaction block)
ALTER TYPE "LedgerEntryType" ADD VALUE 'referral_bonus';
