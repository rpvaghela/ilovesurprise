-- Additive patch for an existing schema. Back up and test restore before production use.
-- Enable PAYOUTS_ENABLED only after this patch and the matching Prisma client are installed.
BEGIN;
CREATE TABLE IF NOT EXISTS "payout_allocations" (
  "id" TEXT PRIMARY KEY,
  "payoutId" TEXT NOT NULL REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "commissionId" TEXT NOT NULL REFERENCES "commission_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "amountUsd" DECIMAL(12,4) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "payout_allocations_payoutId_commissionId_key" ON "payout_allocations"("payoutId", "commissionId");
CREATE INDEX IF NOT EXISTS "payout_allocations_commissionId_idx" ON "payout_allocations"("commissionId");
CREATE TABLE IF NOT EXISTS "payout_events" (
  "id" TEXT PRIMARY KEY,
  "payoutId" TEXT NOT NULL REFERENCES "payout_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "note" TEXT,
  "referenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "payout_events_payoutId_createdAt_idx" ON "payout_events"("payoutId", "createdAt");
COMMIT;
