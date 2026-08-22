-- The rate that relates the two halves of a currency exchange.
--
-- A posting cannot span currencies, so an exchange is two postings linked by
-- transferId. Storing the rate on them means the ledger describes one event
-- rather than two unrelated movements the reader must go elsewhere to connect.
ALTER TABLE "LedgerPosting" ADD COLUMN "fxRate" DECIMAL(20,8);
