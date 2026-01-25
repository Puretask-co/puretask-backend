-- 035_onboarding_enhancements.sql
-- Onboarding Enhancement Features
-- 1. Progress Persistence
-- 2. Email Reminders
-- 3. Admin ID Verification Support

-- ============================================
-- 1. PROGRESS PERSISTENCE
-- ============================================

ALTER TABLE cleaner_profiles 
ADD COLUMN IF NOT EXISTS onboarding_current_step TEXT DEFAULT 'terms';

COMMENT ON COLUMN cleaner_profiles.onboarding_current_step IS 'Current step in onboarding flow (terms, basic-info, phone-verification, etc.)';

-- ============================================
-- 2. EMAIL REMINDERS
-- ============================================

ALTER TABLE cleaner_profiles
ADD COLUMN IF NOT EXISTS onboarding_reminder_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN cleaner_profiles.onboarding_reminder_sent_at IS 'When the reminder email was sent (null = not sent)';
COMMENT ON COLUMN cleaner_profiles.onboarding_started_at IS 'When the cleaner profile was created (onboarding started)';

-- Partial index for efficient querying of abandoned onboarding
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_abandoned_onboarding 
ON cleaner_profiles (onboarding_completed_at, onboarding_started_at, onboarding_reminder_sent_at)
WHERE onboarding_completed_at IS NULL;

-- ============================================
-- 3. ID VERIFICATION ENHANCEMENTS
-- ============================================

-- Update id_verifications table to use 'verified' and 'failed' instead of 'approved' and 'rejected'
-- (if not already using these statuses)

DO $$
BEGIN
  -- Add verified_at and reviewed_by if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'id_verifications' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE id_verifications ADD COLUMN verified_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'id_verifications' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE id_verifications ADD COLUMN reviewed_by TEXT REFERENCES users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'id_verifications' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE id_verifications ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update status values if needed (ensure we use 'verified' and 'failed')
-- Note: This assumes status is TEXT, not an enum. If it's an enum, you'd need to alter the type.

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_id_verifications_status_created 
ON id_verifications(status, created_at DESC);

-- Index for cleaner queries
CREATE INDEX IF NOT EXISTS idx_id_verifications_cleaner_status 
ON id_verifications(cleaner_id, status);

COMMENT ON COLUMN id_verifications.verified_at IS 'When the document was verified (approved)';
COMMENT ON COLUMN id_verifications.reviewed_by IS 'Admin user who reviewed the document';
COMMENT ON COLUMN id_verifications.expires_at IS 'When the verification expires (typically 5 years for verified documents)';

-- ============================================
-- HELPER FUNCTION: Get abandoned onboarding cleaners
-- ============================================

CREATE OR REPLACE FUNCTION get_abandoned_onboarding_cleaners(hours_threshold INTEGER DEFAULT 24)
RETURNS TABLE (
  id UUID,
  user_id TEXT,
  first_name TEXT,
  onboarding_current_step TEXT,
  onboarding_started_at TIMESTAMPTZ,
  email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.id,
    cp.user_id,
    cp.first_name,
    cp.onboarding_current_step,
    cp.onboarding_started_at,
    u.email
  FROM cleaner_profiles cp
  JOIN users u ON u.id = cp.user_id
  WHERE cp.onboarding_completed_at IS NULL
    AND cp.onboarding_started_at < NOW() - (hours_threshold || ' hours')::INTERVAL
    AND (cp.onboarding_reminder_sent_at IS NULL 
         OR cp.onboarding_reminder_sent_at < cp.onboarding_started_at);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_abandoned_onboarding_cleaners IS 'Returns cleaners who started onboarding but haven''t completed it after the threshold hours';
