-- Screening: a blocklist, the alerts rules raise, and the cases they become.

CREATE TYPE "BlocklistKind" AS ENUM ('name', 'account', 'country', 'email');
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "AlertStatus" AS ENUM ('open', 'cleared', 'escalated');
CREATE TYPE "CaseStatus" AS ENUM ('open', 'closed');

CREATE TABLE "BlocklistEntry" (
    "id" TEXT NOT NULL,
    "kind" "BlocklistKind" NOT NULL,
    "value" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlocklistEntry_pkey" PRIMARY KEY ("id")
);

-- The value is normalised at write time so screening is an index lookup. A
-- blocklist that is expensive to consult is one somebody consults less often.
CREATE UNIQUE INDEX "BlocklistEntry_kind_value_key" ON "BlocklistEntry"("kind", "value");
CREATE INDEX "BlocklistEntry_kind_active_idx" ON "BlocklistEntry"("kind", "active");

CREATE TABLE "ComplianceCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'open',
    "summary" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "closedById" TEXT,
    "closedReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceCase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ComplianceCase_reference_key" ON "ComplianceCase"("reference");
CREATE INDEX "ComplianceCase_status_createdAt_idx" ON "ComplianceCase"("status", "createdAt");
CREATE INDEX "ComplianceCase_userId_idx" ON "ComplianceCase"("userId");

CREATE TABLE "ComplianceAlert" (
    "id" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "userId" TEXT NOT NULL,
    "transferId" TEXT,
    "detail" JSONB NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "caseId" TEXT,
    "adjudicatedById" TEXT,
    "adjudicationReason" TEXT,
    "adjudicatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAlert_pkey" PRIMARY KEY ("id")
);

-- The queue: open first, most severe first, oldest first.
CREATE INDEX "ComplianceAlert_status_severity_createdAt_idx"
    ON "ComplianceAlert"("status", "severity", "createdAt");
CREATE INDEX "ComplianceAlert_userId_createdAt_idx" ON "ComplianceAlert"("userId", "createdAt");
CREATE INDEX "ComplianceAlert_transferId_idx" ON "ComplianceAlert"("transferId");

-- Restrict throughout. An alert and its adjudication are evidence that someone
-- looked at a payment on a given day; removing the customer must not take the
-- record of the review with them.
ALTER TABLE "BlocklistEntry" ADD CONSTRAINT "BlocklistEntry_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BlocklistEntry" ADD CONSTRAINT "BlocklistEntry_deactivatedById_fkey"
    FOREIGN KEY ("deactivatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_openedById_fkey"
    FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceCase" ADD CONSTRAINT "ComplianceCase_closedById_fkey"
    FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_adjudicatedById_fkey"
    FOREIGN KEY ("adjudicatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComplianceAlert" ADD CONSTRAINT "ComplianceAlert_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "ComplianceCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
