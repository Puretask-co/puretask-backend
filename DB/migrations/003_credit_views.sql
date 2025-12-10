-- 003_credit_views.sql
-- SQL helpers for credit balance calculations
-- NOTE: Uses TEXT for user_id parameters to match users.id column type
-- NOTE: This migration requires 001_init.sql to be run first (creates credit_ledger, jobs, payouts tables)

-- Total credit balance per user (all time)
-- Balance = SUM(delta_credits) from credit_ledger
CREATE OR REPLACE VIEW user_credit_balances AS
SELECT
  user_id,
  COALESCE(SUM(delta_credits), 0)::INTEGER AS balance_credits
FROM credit_ledger
GROUP BY user_id;

-- Helper function: get a user's current balance
CREATE OR REPLACE FUNCTION get_user_credit_balance(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(delta_credits), 0)
  INTO v_balance
  FROM credit_ledger
  WHERE user_id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: check if user has enough credits
CREATE OR REPLACE FUNCTION user_has_credits(p_user_id TEXT, p_required INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_user_credit_balance(p_user_id) >= p_required;
END;
$$ LANGUAGE plpgsql STABLE;

-- View: credit ledger with running balance (useful for history display)
CREATE OR REPLACE VIEW credit_ledger_with_balance AS
SELECT
  cl.*,
  SUM(cl.delta_credits) OVER (
    PARTITION BY cl.user_id
    ORDER BY cl.created_at
    ROWS UNBOUNDED PRECEDING
  )::INTEGER AS running_balance
FROM credit_ledger cl;

-- View: credit summary by reason (for admin dashboards)
CREATE OR REPLACE VIEW credit_summary_by_reason AS
SELECT
  reason,
  COUNT(*) as transaction_count,
  SUM(CASE WHEN delta_credits > 0 THEN delta_credits ELSE 0 END)::INTEGER as total_added,
  SUM(CASE WHEN delta_credits < 0 THEN ABS(delta_credits) ELSE 0 END)::INTEGER as total_removed,
  SUM(delta_credits)::INTEGER as net_change
FROM credit_ledger
GROUP BY reason;

-- View: cleaner earnings from completed jobs (credits released to them)
CREATE OR REPLACE VIEW cleaner_job_earnings AS
SELECT
  j.id AS job_id,
  j.cleaner_id,
  j.credit_amount,
  j.status,
  j.actual_end_at as completed_at,
  p.id AS payout_id,
  p.status AS payout_status,
  p.stripe_transfer_id
FROM jobs j
LEFT JOIN payouts p ON p.job_id = j.id
WHERE j.status = 'completed'
  AND j.cleaner_id IS NOT NULL;

-- View: unpaid cleaner earnings (jobs completed but not yet paid out)
CREATE OR REPLACE VIEW cleaner_unpaid_earnings AS
SELECT
  j.cleaner_id,
  COUNT(*) as unpaid_jobs,
  SUM(j.credit_amount)::INTEGER as total_credits_unpaid
FROM jobs j
LEFT JOIN payouts p ON p.job_id = j.id
WHERE j.status = 'completed'
  AND j.cleaner_id IS NOT NULL
  AND (p.id IS NULL OR p.status = 'failed')
GROUP BY j.cleaner_id;

-- Index to optimize credit balance lookups
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_balance
  ON credit_ledger (user_id, created_at);
