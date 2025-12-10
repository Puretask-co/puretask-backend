-- 022_schema_enhancements.sql
-- Dispute routing columns, payout pause audit, and reconciliation flag history
-- NOTE: Uses TEXT for user references to match existing users.id column type
-- NOTE: This migration requires earlier migrations to be run first (001_init.sql creates disputes, cleaner_profiles tables)

-- Dispute routing fields (prefer explicit columns over metadata)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
    ALTER TABLE disputes
      ADD COLUMN IF NOT EXISTS routed_to TEXT,
      ADD COLUMN IF NOT EXISTS route_note TEXT;
  END IF;
END $$;

-- Payout pause provenance
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cleaner_profiles') THEN
    ALTER TABLE cleaner_profiles
      ADD COLUMN IF NOT EXISTS payout_paused_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS payout_paused_by TEXT REFERENCES users (id) ON DELETE SET NULL;
  END IF;
END $$;

-- Reconciliation flag history (auditable changes)
-- Note: This requires payout_reconciliation_flags table from 019_payout_reconciliation_flags.sql
CREATE TABLE IF NOT EXISTS payout_reconciliation_flag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint only if payout_reconciliation_flags table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payout_reconciliation_flags') THEN
    -- Check if constraint doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'payout_reconciliation_flag_history_payout_id_fkey'
    ) THEN
      ALTER TABLE payout_reconciliation_flag_history
        ADD CONSTRAINT payout_reconciliation_flag_history_payout_id_fkey
        FOREIGN KEY (payout_id) REFERENCES payout_reconciliation_flags (payout_id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payout_recon_hist_payout ON payout_reconciliation_flag_history (payout_id);
