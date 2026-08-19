-- Two-factor authentication for back-office accounts.
--
-- All nullable with a safe default: customers never use these columns, and
-- existing staff accounts land un-enrolled, which StaffGuard treats as "can
-- reach enrolment and nothing else". So this applies cleanly to a live
-- database and locks nobody out mid-deploy — they are prompted to enrol on
-- their next sign-in.
ALTER TABLE "User" ADD COLUMN "mfaSecret"        TEXT;
ALTER TABLE "User" ADD COLUMN "mfaEnabledAt"     TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "mfaRecoveryCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "mfaLastTimeStep"  INTEGER;
