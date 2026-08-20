-- Attempt counters for the one-time codes that replace reset and verification
-- links.
--
-- Six digits is only defensible because guessing is capped: without a counter
-- a million possibilities falls in minutes. The existing token columns now hold
-- a bcrypt hash of the code rather than a random URL token, which needs no
-- schema change — they were already nullable text.
--
-- Existing rows carry whatever link tokens were outstanding. Those will simply
-- fail to match a six-digit code, so anyone mid-reset requests a new one. That
-- is preferable to migrating them: a link token in flight cannot be turned into
-- a code anybody knows.
ALTER TABLE "User" ADD COLUMN "pwResetAttempts"     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "emailVerifyAttempts" INTEGER NOT NULL DEFAULT 0;
