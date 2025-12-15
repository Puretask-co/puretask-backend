-- 903_payout_items_uniqueness.sql
-- Ensure the same ledger entry cannot be paid out twice.

-- Check if payout_items table exists, if not create it
CREATE TABLE IF NOT EXISTS payout_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  ledger_entry_id UUID NOT NULL REFERENCES credit_ledger(id) ON DELETE RESTRICT,
  amount          INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent same ledger entry from being included in multiple payouts
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payout_items_ledger_entry
  ON payout_items (ledger_entry_id);

-- Helpful index for payout reconciliation
CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id
  ON payout_items (payout_id);

