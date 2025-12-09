-- 020_stripe_object_processed.sql
-- Per-object Stripe processing flags to harden idempotency across event replays

CREATE TABLE IF NOT EXISTS stripe_object_processed (
  object_id TEXT NOT NULL,
  object_type TEXT NOT NULL, -- invoice, charge, dispute, payout, transfer
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (object_id, object_type)
);

CREATE INDEX IF NOT EXISTS idx_stripe_object_processed_type ON stripe_object_processed (object_type);

