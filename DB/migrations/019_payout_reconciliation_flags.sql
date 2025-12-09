-- 019_payout_reconciliation_flags.sql
-- Formalize payout_reconciliation_flags table for reconciliation tracking

CREATE TABLE IF NOT EXISTS payout_reconciliation_flags (
  payout_id UUID PRIMARY KEY REFERENCES payouts (id) ON DELETE CASCADE,
  cleaner_id UUID REFERENCES users (id) ON DELETE SET NULL,
  delta_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'flagged', -- flagged | resolved | ignored
  note TEXT,
  flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_payout_recon_status ON payout_reconciliation_flags (status);
CREATE INDEX IF NOT EXISTS idx_payout_recon_cleaner ON payout_reconciliation_flags (cleaner_id);

