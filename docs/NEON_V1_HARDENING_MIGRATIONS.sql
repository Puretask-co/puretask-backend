-- ============================================================================
-- V1 HARDENING MIGRATIONS FOR NEON SQL EDITOR
-- ============================================================================
-- Copy-paste this entire file into Neon SQL Editor and run it
-- These migrations add idempotency guards, worker tracking, and safety features
--
-- Migration order:
-- 901: Stripe webhook idempotency
-- 902: Ledger idempotency constraints
-- 903: Payout items uniqueness
-- 904: Worker runs tracking
-- 905: Users FK text consistency (documentation only)
-- ============================================================================

-- ============================================================================
-- 901: Stripe Events Processed Table
-- ============================================================================
-- Stripe webhook idempotency: record processed Stripe events/objects so replays do nothing.

CREATE TABLE IF NOT EXISTS stripe_events_processed (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT NOT NULL UNIQUE,
  stripe_object_id TEXT, -- optional: pi_ / ch_ / re_ / po_ etc.
  event_type       TEXT,
  status           TEXT NOT NULL DEFAULT 'processed',
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload      JSONB
);

-- Optional extra guard: prevent processing same Stripe object twice
CREATE UNIQUE INDEX IF NOT EXISTS uniq_stripe_object_processed
  ON stripe_events_processed (stripe_object_id)
  WHERE stripe_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_event_id ON stripe_events_processed (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_processed_at ON stripe_events_processed (processed_at);

-- ============================================================================
-- 902: Ledger Idempotency Constraints
-- ============================================================================
-- Add unique constraints to prevent duplicate credit operations for the same job/user/reason combo

-- Prevent duplicate credit purchases for same job
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_credit_purchase
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason IN ('purchase', 'wallet_topup') AND job_id IS NOT NULL;

-- Prevent duplicate escrow reservations for same job
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_escrow_reserved_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'job_escrow' AND job_id IS NOT NULL;

-- Prevent duplicate escrow releases for same job
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_escrow_released_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'job_release' AND job_id IS NOT NULL;

-- Prevent duplicate refunds for same job
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_refund_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'refund' AND job_id IS NOT NULL;

-- ============================================================================
-- 903: Payout Items Uniqueness
-- ============================================================================
-- Ensure each ledger entry can only be included in one payout (prevent double-payouts)

CREATE TABLE IF NOT EXISTS payout_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id       UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
  ledger_entry_id UUID NOT NULL REFERENCES credit_ledger(id) ON DELETE RESTRICT,
  amount          INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_payout_items_ledger_entry
  ON payout_items (ledger_entry_id);

CREATE INDEX IF NOT EXISTS idx_payout_items_payout_id
  ON payout_items (payout_id);

-- ============================================================================
-- 904: Worker Runs Table
-- ============================================================================
-- Track worker execution for observability and concurrency guards

CREATE TABLE IF NOT EXISTS worker_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'running', -- running|success|failed
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  processed     INTEGER NOT NULL DEFAULT 0,
  failed        INTEGER NOT NULL DEFAULT 0,
  metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_worker_runs_worker_name_status ON worker_runs (worker_name, status);
CREATE INDEX IF NOT EXISTS idx_worker_runs_started_at ON worker_runs (started_at);
CREATE INDEX IF NOT EXISTS idx_worker_runs_name_started ON worker_runs (worker_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_runs_status ON worker_runs (status, started_at DESC);

-- ============================================================================
-- 905: Users FK Text Consistency (Documentation)
-- ============================================================================
-- Canonical decision: users.id is TEXT. All FKs to users(id) must also be TEXT.

COMMENT ON COLUMN users.id IS 'Canonical: users.id is TEXT. All FKs to users(id) must also be TEXT.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these after executing the migrations to verify everything was created:

-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'stripe_events_processed',
    'payout_items',
    'worker_runs'
  )
ORDER BY table_name;

-- Check indexes exist
SELECT indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname IN (
    'uniq_stripe_object_processed',
    'uniq_ledger_credit_purchase',
    'uniq_ledger_escrow_reserved_job',
    'uniq_ledger_escrow_released_job',
    'uniq_ledger_refund_job',
    'uniq_payout_items_ledger_entry',
    'idx_worker_runs_worker_name_status',
    'idx_stripe_events_processed_event_id'
  )
ORDER BY indexname;

-- ============================================================================
-- END OF V1 HARDENING MIGRATIONS
-- ============================================================================

