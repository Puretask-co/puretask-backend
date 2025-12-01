-- 004_connect_payouts.sql
-- Add Stripe Connect account ID to cleaner profiles

-- Add stripe_account_id column to cleaner_profiles (if not already present from 001_init.sql)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cleaner_profiles' AND column_name = 'stripe_account_id'
  ) THEN
    ALTER TABLE cleaner_profiles ADD COLUMN stripe_account_id TEXT;
  END IF;
END
$$;

-- Index for Stripe account lookups
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_stripe_account_id
  ON cleaner_profiles (stripe_account_id)
  WHERE stripe_account_id IS NOT NULL;

-- View: payouts with cleaner details (for admin dashboard)
CREATE OR REPLACE VIEW payouts_with_details AS
SELECT
  p.*,
  u.email as cleaner_email,
  cp.stripe_account_id,
  cp.tier as cleaner_tier,
  j.address as job_address,
  j.scheduled_start_at as job_date
FROM payouts p
JOIN users u ON p.cleaner_id = u.id
LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
JOIN jobs j ON p.job_id = j.id;

-- View: cleaner payout summary
CREATE OR REPLACE VIEW cleaner_payout_summary AS
SELECT
  p.cleaner_id,
  u.email,
  cp.stripe_account_id,
  COUNT(*) FILTER (WHERE p.status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE p.status = 'paid') as paid_count,
  COUNT(*) FILTER (WHERE p.status = 'failed') as failed_count,
  COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'pending'), 0)::INTEGER as pending_cents,
  COALESCE(SUM(p.amount_cents) FILTER (WHERE p.status = 'paid'), 0)::INTEGER as paid_cents
FROM payouts p
JOIN users u ON p.cleaner_id = u.id
LEFT JOIN cleaner_profiles cp ON cp.user_id = p.cleaner_id
GROUP BY p.cleaner_id, u.email, cp.stripe_account_id;

