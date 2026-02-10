-- Migration 052: Cash Reward Budget Enforcement (Step 13)
-- Ledger of cash rewards granted + spend views for caps.

CREATE TABLE IF NOT EXISTS gamification_cash_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NULL,
  reward_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('goal','level','admin','choice')),
  source_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_source
  ON gamification_cash_reward_ledger (cleaner_id, reward_id, source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_time
  ON gamification_cash_reward_ledger (granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_ledger_region_time
  ON gamification_cash_reward_ledger (region_id, granted_at DESC);

CREATE OR REPLACE VIEW gamification_cash_spend_daily AS
SELECT
  COALESCE(region_id, '__global__') AS region_key,
  date_trunc('day', granted_at)::date AS day,
  SUM(amount_cents)::bigint AS spend_cents
FROM gamification_cash_reward_ledger
GROUP BY 1, 2;

CREATE OR REPLACE VIEW gamification_cash_spend_monthly AS
SELECT
  COALESCE(region_id, '__global__') AS region_key,
  date_trunc('month', granted_at)::date AS month,
  SUM(amount_cents)::bigint AS spend_cents
FROM gamification_cash_reward_ledger
GROUP BY 1, 2;

SELECT 'Migration 052 Completed' AS status;
