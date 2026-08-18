-- Back-office roles.
--
-- Additive only: every existing row is `customer` or `admin` and keeps its
-- value. Postgres cannot add enum values inside a transaction block in older
-- versions, so these are separate statements; Prisma runs each on its own.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'operations';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'compliance';
