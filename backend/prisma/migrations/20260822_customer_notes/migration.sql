-- What support learned that no other table records.
--
-- Restrict on both foreign keys, matching every other evidential record in this
-- schema (KycRecord, Recipient, Referral). A note is part of what staff knew
-- and when; removing either party must fail loudly rather than take it along.

CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- The note list is always "this customer, newest first".
CREATE INDEX "CustomerNote_customerId_createdAt_idx"
    ON "CustomerNote"("customerId", "createdAt");

ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
