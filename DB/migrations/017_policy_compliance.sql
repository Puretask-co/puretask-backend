-- 017_policy_compliance.sql
-- Updates to align with Privacy Policy, Terms of Service, and Cancellation Policy documents
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- GRACE CANCELLATIONS (per Cancellation Policy)
-- Each client gets 2 FREE grace cancellations (LIFETIME, not monthly)
-- ============================================

CREATE TABLE IF NOT EXISTS grace_cancellations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  job_id      UUID REFERENCES jobs (id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grace_cancellations_client ON grace_cancellations (client_id);
CREATE INDEX IF NOT EXISTS idx_grace_cancellations_created ON grace_cancellations (created_at DESC);

COMMENT ON TABLE grace_cancellations IS 'Tracks lifetime grace cancellations used by clients (max 2 per client)';

-- ============================================
-- UPDATE CANCELLATION RECORDS (add fee tracking)
-- ============================================

-- Add new columns if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cancellation_records' AND column_name = 'fee_percent') THEN
    ALTER TABLE cancellation_records ADD COLUMN fee_percent NUMERIC(5,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cancellation_records' AND column_name = 'refund_credits') THEN
    ALTER TABLE cancellation_records ADD COLUMN refund_credits INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN cancellation_records.fee_percent IS 'Cancellation fee percentage (0%, 50%, or 100% based on notice)';
COMMENT ON COLUMN cancellation_records.refund_credits IS 'Credits refunded to client after fee deduction';

-- ============================================
-- CLEANER NO-SHOWS (per Cancellation Policy)
-- Track no-shows separately for bonus credit compensation
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_no_shows (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  client_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonus_credits    INTEGER NOT NULL DEFAULT 50, -- Policy: 50 bonus credits to client
  processed        BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_no_shows_job ON cleaner_no_shows (job_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_no_shows_cleaner ON cleaner_no_shows (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_no_shows_processed ON cleaner_no_shows (processed);

COMMENT ON TABLE cleaner_no_shows IS 'Tracks cleaner no-shows for compensation processing (client gets full refund + 50 bonus credits)';

-- ============================================
-- PHOTO COMPLIANCE TRACKING (per Photo Proof policy)
-- Track photo compliance for reliability bonuses
-- ============================================

CREATE TABLE IF NOT EXISTS photo_compliance (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id           UUID NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
  cleaner_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  total_photos     INTEGER NOT NULL DEFAULT 0,
  before_photos    INTEGER NOT NULL DEFAULT 0,
  after_photos     INTEGER NOT NULL DEFAULT 0,
  meets_minimum    BOOLEAN NOT NULL DEFAULT false, -- Policy: minimum 3 photos total
  bonus_applied    BOOLEAN NOT NULL DEFAULT false, -- +10 reliability points
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_compliance_job ON photo_compliance (job_id);
CREATE INDEX IF NOT EXISTS idx_photo_compliance_cleaner ON photo_compliance (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_photo_compliance_bonus ON photo_compliance (bonus_applied);

COMMENT ON TABLE photo_compliance IS 'Tracks photo compliance for reliability score bonuses (+10 points per policy)';

-- ============================================
-- DISPUTES (add time window enforcement)
-- Per policy: Disputes must be filed within 48 hours
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disputes' AND column_name = 'job_completed_at') THEN
    ALTER TABLE disputes ADD COLUMN job_completed_at TIMESTAMPTZ;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disputes' AND column_name = 'within_window') THEN
    ALTER TABLE disputes ADD COLUMN within_window BOOLEAN DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN disputes.job_completed_at IS 'When the job was completed (for 48-hour dispute window calculation)';
COMMENT ON COLUMN disputes.within_window IS 'Whether dispute was filed within 48-hour window';

-- ============================================
-- CLIENT PROFILES (add grace cancellation tracking)
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_profiles' AND column_name = 'grace_cancellations_used') THEN
    ALTER TABLE client_profiles ADD COLUMN grace_cancellations_used INTEGER DEFAULT 0;
  END IF;
END $$;

COMMENT ON COLUMN client_profiles.grace_cancellations_used IS 'Number of lifetime grace cancellations used (max 2)';

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get client's remaining grace cancellations
CREATE OR REPLACE FUNCTION get_client_grace_cancellations_remaining(p_client_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  used_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO used_count
  FROM grace_cancellations
  WHERE client_id = p_client_id;
  
  RETURN GREATEST(0, 2 - used_count); -- Max 2 per policy
END;
$$ LANGUAGE plpgsql;

-- Check if dispute is within 48-hour window
CREATE OR REPLACE FUNCTION is_dispute_within_window(p_job_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  completed_at TIMESTAMPTZ;
BEGIN
  SELECT actual_end_at INTO completed_at
  FROM jobs
  WHERE id = p_job_id;
  
  IF completed_at IS NULL THEN
    RETURN true; -- Job not completed, always allow
  END IF;
  
  RETURN (NOW() - completed_at) <= INTERVAL '48 hours';
END;
$$ LANGUAGE plpgsql;

-- Calculate cancellation fee percentage based on hours before
CREATE OR REPLACE FUNCTION calculate_cancellation_fee_percent(hours_before NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF hours_before > 48 THEN
    RETURN 0;    -- Free cancellation
  ELSIF hours_before > 24 THEN
    RETURN 50;   -- 50% fee
  ELSE
    RETURN 100;  -- 100% fee
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE CLEANER PROFILES (add payout tier tracking)
-- Per policy: Cleaners receive 80-85% based on tier
-- ============================================

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cleaner_profiles' AND column_name = 'payout_percent') THEN
    ALTER TABLE cleaner_profiles ADD COLUMN payout_percent NUMERIC(5,2) DEFAULT 80;
  END IF;
END $$;

-- Update existing cleaner payout percentages based on tier
UPDATE cleaner_profiles
SET payout_percent = CASE tier
  WHEN 'platinum' THEN 85
  WHEN 'gold' THEN 84
  WHEN 'silver' THEN 82
  ELSE 80  -- bronze
END
WHERE payout_percent IS NULL OR payout_percent = 80;

COMMENT ON COLUMN cleaner_profiles.payout_percent IS 'Payout percentage based on tier: bronze=80%, silver=82%, gold=84%, platinum=85%';

-- Trigger to update payout_percent when tier changes
CREATE OR REPLACE FUNCTION update_payout_percent_on_tier_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tier != OLD.tier THEN
    NEW.payout_percent = CASE NEW.tier
      WHEN 'platinum' THEN 85
      WHEN 'gold' THEN 84
      WHEN 'silver' THEN 82
      ELSE 80
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_payout_percent ON cleaner_profiles;
CREATE TRIGGER trg_update_payout_percent
BEFORE UPDATE ON cleaner_profiles
FOR EACH ROW
EXECUTE FUNCTION update_payout_percent_on_tier_change();
