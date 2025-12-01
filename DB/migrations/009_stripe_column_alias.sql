-- 009_stripe_column_alias.sql
-- Ensure stripe_account_id exists (code uses this, 001_init uses stripe_connect_id)

-- First, add stripe_account_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cleaner_profiles' AND column_name = 'stripe_account_id'
  ) THEN
    -- Check if stripe_connect_id exists and rename it
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'cleaner_profiles' AND column_name = 'stripe_connect_id'
    ) THEN
      -- Copy data from stripe_connect_id to new column
      ALTER TABLE cleaner_profiles ADD COLUMN stripe_account_id TEXT;
      UPDATE cleaner_profiles SET stripe_account_id = stripe_connect_id;
    ELSE
      -- Just add the column
      ALTER TABLE cleaner_profiles ADD COLUMN stripe_account_id TEXT;
    END IF;
  END IF;
END
$$;

-- Create or replace view to get cleaner with stripe info
CREATE OR REPLACE VIEW cleaner_stripe_info AS
SELECT
  cp.user_id,
  cp.tier,
  cp.reliability_score,
  cp.hourly_rate_credits,
  COALESCE(cp.stripe_account_id, cp.stripe_connect_id) as stripe_account_id,
  u.email as cleaner_email
FROM cleaner_profiles cp
JOIN users u ON u.id = cp.user_id;

-- Comment for clarity
COMMENT ON COLUMN cleaner_profiles.stripe_account_id IS 'Stripe Connect Express account ID for payouts';

