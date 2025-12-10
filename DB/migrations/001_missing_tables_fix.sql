-- 001_missing_tables_fix.sql
-- Quick fix to create missing payouts and disputes tables if they don't exist
-- Run this if payouts/disputes tables are missing after running migrations

-- Check and create payouts table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payouts') THEN
    CREATE TABLE payouts (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cleaner_id          TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
      job_id              UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
      stripe_transfer_id  TEXT UNIQUE,
      amount_credits      INTEGER NOT NULL,
      amount_cents        INTEGER NOT NULL,
      status              payout_status NOT NULL DEFAULT 'pending',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_payouts_cleaner_id ON payouts (cleaner_id);
    CREATE INDEX idx_payouts_job_id ON payouts (job_id);
    CREATE INDEX idx_payouts_status ON payouts (status);
    
    RAISE NOTICE 'Created payouts table';
  ELSE
    RAISE NOTICE 'payouts table already exists';
  END IF;
END $$;

-- Check and create disputes table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
    CREATE TABLE disputes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      job_id          UUID NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
      client_id       TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
      status          dispute_status NOT NULL DEFAULT 'open',
      client_notes    TEXT NOT NULL,
      admin_notes     TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX idx_disputes_status ON disputes (status);
    CREATE INDEX idx_disputes_client_id ON disputes (client_id);
    CREATE INDEX idx_disputes_created_at ON disputes (created_at);
    
    RAISE NOTICE 'Created disputes table';
  ELSE
    RAISE NOTICE 'disputes table already exists';
  END IF;
END $$;

