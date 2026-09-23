CREATE TYPE "SupportFaqStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "SupportTicketStatus" AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE "SupportMessageSender" AS ENUM ('customer', 'staff');
CREATE TYPE "SupportTicketEventKind" AS ENUM ('created', 'claimed', 'unclaimed', 'resolved', 'reopened');

CREATE TABLE "SupportCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupportCategory_slug_key" ON "SupportCategory"("slug");
CREATE INDEX "SupportCategory_active_sortOrder_idx" ON "SupportCategory"("active", "sortOrder");

CREATE TABLE "SupportFaq" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "SupportFaqStatus" NOT NULL DEFAULT 'draft',
    "createdById" TEXT,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportFaq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportFaq_categoryId_status_sortOrder_idx" ON "SupportFaq"("categoryId", "status", "sortOrder");

CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "transferId" TEXT,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'open',
    "assigneeId" TEXT,
    "lastCustomerActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicket_customerId_lastActivityAt_idx" ON "SupportTicket"("customerId", "lastActivityAt");
CREATE INDEX "SupportTicket_status_assigneeId_lastCustomerActivityAt_idx" ON "SupportTicket"("status", "assigneeId", "lastCustomerActivityAt");
CREATE INDEX "SupportTicket_categoryId_lastActivityAt_idx" ON "SupportTicket"("categoryId", "lastActivityAt");
CREATE INDEX "SupportTicket_transferId_idx" ON "SupportTicket"("transferId");

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "sender" "SupportMessageSender" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

CREATE TABLE "SupportTicketEvent" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "actorId" TEXT,
    "kind" "SupportTicketEventKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportTicketEvent_ticketId_createdAt_idx" ON "SupportTicketEvent"("ticketId", "createdAt");

ALTER TABLE "SupportFaq" ADD CONSTRAINT "SupportFaq_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "SupportCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportFaq" ADD CONSTRAINT "SupportFaq_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportFaq" ADD CONSTRAINT "SupportFaq_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "SupportCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "Transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicketEvent" ADD CONSTRAINT "SupportTicketEvent_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicketEvent" ADD CONSTRAINT "SupportTicketEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Public, product-specific starting guidance. These rows have no staff author
-- because they are introduced with the feature rather than written by one.
INSERT INTO "SupportCategory" ("id", "name", "slug", "description", "sortOrder", "updatedAt") VALUES
  ('10000000-0000-4000-8000-000000000001', 'Transfers', 'transfers', 'Track a transfer or get help with a recipient payment.', 10, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000002', 'Wallet & funding', 'wallet-funding', 'Questions about your wallet balance and adding money.', 20, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000003', 'Fees & exchange rates', 'fees-exchange-rates', 'Understand quotes, fees, limits, and exchange rates.', 30, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000004', 'Verification & account', 'verification-account', 'Help with identity verification, sign-in, and account security.', 40, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000005', 'Recipients & security', 'recipients-security', 'Manage recipients and keep your account secure.', 50, CURRENT_TIMESTAMP),
  ('10000000-0000-4000-8000-000000000006', 'App & notifications', 'app-notifications', 'Troubleshoot the app and manage notifications.', 60, CURRENT_TIMESTAMP);

INSERT INTO "SupportFaq" ("id", "categoryId", "question", "answer", "sortOrder", "status", "publishedAt", "updatedAt") VALUES
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'How do I track my transfer?', 'Open Activity and select the transfer. Its journey shows the current stage and updates as the transfer moves forward.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Why is my transfer still processing?', 'Transfers can pass through payment, review, exchange, and payout stages. Check the transfer journey for its latest status before contacting support.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'My recipient has not received the money. What should I do?', 'First check whether the transfer is marked delivered in Activity. If it is not delivered or something looks incorrect, contact support and link the transfer so the team can investigate it.', 30, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Where can I see my wallet balance?', 'Open You, then Wallet. Your available balance is shown there before you start a transfer.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'Why is my available balance different from what I expected?', 'A transfer can reserve money while it is being processed. Review your Activity and wallet history; contact support if the balance still does not make sense.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000003', 'When do I see the exchange rate and fee?', 'The review screen shows the rate, transfer fee, total charge, and recipient amount before you confirm a transfer.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000003', 'Why can the rate change?', 'Rates are quoted before confirmation and can move with the market. Always review the quote shown immediately before you send.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000004', 'Why do I need to verify my identity?', 'Identity verification helps keep transfers secure and is required before your first transfer.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000004', 'How do I change my password or review signed-in devices?', 'Open You, then choose Change password or Devices & sessions. Use those controls if you do not recognise a session.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000005', 'How do I add or update a recipient?', 'Open People to add a recipient or select an existing recipient to review their details before sending money.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000005', 'I do not recognise account activity. What should I do?', 'Review your Activity and Devices & sessions straight away. Change your password if needed, then contact support with the details you noticed.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000006', 'Where do transfer updates appear?', 'Transfer updates appear in Notifications and in the transfer journey inside Activity.', 10, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000006', 'How do I update the app?', 'Open You and use the version row to check for an available update.', 20, 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
