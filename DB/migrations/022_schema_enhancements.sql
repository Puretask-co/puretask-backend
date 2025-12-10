-- 022_schema_enhancements.sql
-- Dispute routing columns, payout pause audit, and reconciliation flag history
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- Dispute routing fields (prefer explicit columns over metadata)
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS routed_to TEXT,
  ADD COLUMN IF NOT EXISTS route_note TEXT;

-- Payout pause provenance
ALTER TABLE cleaner_profiles
  ADD COLUMN IF NOT EXISTS payout_paused_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payout_paused_by TEXT REFERENCES users (id) ON DELETE SET NULL;

-- Reconciliation flag history (auditable changes)
CREATE TABLE IF NOT EXISTS payout_reconciliation_flag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES payout_reconciliation_flags (payout_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  actor_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payout_recon_hist_payout ON payout_reconciliation_flag_history (payout_id);
