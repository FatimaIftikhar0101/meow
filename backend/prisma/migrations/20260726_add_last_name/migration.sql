-- AlterTable: add lastName so the full legal name can be stored.
-- Nullable on purpose: existing rows (and Google sign-ups, which only provide
-- a given name) have no value, and the UI falls back to the email local-part.
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
