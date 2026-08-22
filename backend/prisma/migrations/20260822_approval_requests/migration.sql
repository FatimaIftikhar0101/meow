-- Four-eyes on the actions where one operator can do irreversible harm.

CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'expired');

CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "requestedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- The queue: pending, oldest first.
CREATE INDEX "ApprovalRequest_status_createdAt_idx"
    ON "ApprovalRequest"("status", "createdAt");

-- "Is one already open against this transfer?" — what stops two operators
-- queuing the same force-fail twice.
CREATE INDEX "ApprovalRequest_entityType_entityId_status_idx"
    ON "ApprovalRequest"("entityType", "entityId", "status");

ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Four-eyes, in the database rather than only in the service. A row that
-- records the same person on both sides is not a weaker approval, it is not an
-- approval — so it must not be storable, whatever a future code path believes.
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_distinct_parties"
    CHECK ("decidedById" IS NULL OR "decidedById" <> "requestedById");
