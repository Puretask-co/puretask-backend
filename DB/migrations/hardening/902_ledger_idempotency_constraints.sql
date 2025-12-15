-- 902_ledger_idempotency_constraints.sql
-- Enforce idempotent ledger effects via unique constraints (additive, safe).
-- This prevents double-crediting, double-escrow, double-release, double-refund even if code retries.

-- Note: Adjust reason_code values to match your actual credit_reason enum values
-- Common values might be: 'purchase', 'job_escrow', 'job_release', 'refund', 'adjustment', etc.

-- 1) Prevent duplicate credit issuance for the same purchase
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_credit_purchase
  ON credit_ledger (user_id, reason, (job_id::TEXT))
  WHERE reason IN ('purchase', 'wallet_topup');

-- 2) Prevent double escrow reservation per job
-- Note: credit_ledger uses delta_credits (not amount/direction), adjust if schema differs
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_escrow_reserved_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'job_escrow' AND job_id IS NOT NULL;

-- 3) Prevent double escrow release per job
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_escrow_released_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'job_release' AND job_id IS NOT NULL;

-- 4) Prevent duplicate refunds per job/refund reference
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_refund_job
  ON credit_ledger (user_id, reason, job_id)
  WHERE reason = 'refund' AND job_id IS NOT NULL;

-- Note: If your ledger table uses different column names or reason codes,
-- adjust the index definitions above accordingly.

