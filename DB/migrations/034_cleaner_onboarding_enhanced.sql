-- 034_cleaner_onboarding_enhanced.sql
-- Enhanced Cleaner Onboarding System
-- Adds tables and columns for comprehensive 10-step onboarding flow

-- ============================================
-- 1. ENHANCE CLEANER_PROFILES TABLE
-- ============================================

ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS 
  professional_headline TEXT,
  profile_photo_url TEXT,
  onboarding_completed_at TIMESTAMPTZ,
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT false;

COMMENT ON COLUMN cleaner_profiles.professional_headline IS 'Professional headline/tagline for cleaner profile';
COMMENT ON COLUMN cleaner_profiles.profile_photo_url IS 'URL to profile photo (face shot)';
COMMENT ON COLUMN cleaner_profiles.onboarding_completed_at IS 'Timestamp when onboarding was completed (NULL = not completed)';
COMMENT ON COLUMN cleaner_profiles.phone_number IS 'Phone number (E.164 format)';
COMMENT ON COLUMN cleaner_profiles.phone_verified IS 'Whether phone number has been verified via OTP';

-- ============================================
-- 2. ENHANCE USERS TABLE (if needed)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;

COMMENT ON COLUMN users.phone_number IS 'User phone number (can be used across roles)';

-- ============================================
-- 3. CLEANER AGREEMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  agreement_type TEXT NOT NULL, -- 'terms_of_service', 'independent_contractor', 'background_check_consent'
  version TEXT NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_agreements_cleaner_id ON cleaner_agreements(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_agreements_type ON cleaner_agreements(agreement_type);
CREATE INDEX IF NOT EXISTS idx_cleaner_agreements_cleaner_type ON cleaner_agreements(cleaner_id, agreement_type);

COMMENT ON TABLE cleaner_agreements IS 'Tracks legal agreements and consents with audit trail';
COMMENT ON COLUMN cleaner_agreements.agreement_type IS 'Type of agreement: terms_of_service, independent_contractor, background_check_consent';
COMMENT ON COLUMN cleaner_agreements.ip_address IS 'IP address when agreement was accepted (for audit)';
COMMENT ON COLUMN cleaner_agreements.user_agent IS 'Browser user agent when agreement was accepted (for audit)';

-- ============================================
-- 4. PHONE VERIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires ON phone_verifications(expires_at);

COMMENT ON TABLE phone_verifications IS 'Stores OTP codes for phone number verification';
COMMENT ON COLUMN phone_verifications.otp_code IS '6-digit OTP code';
COMMENT ON COLUMN phone_verifications.expires_at IS 'When the OTP code expires (typically 10 minutes)';
COMMENT ON COLUMN phone_verifications.verified_at IS 'When the OTP was successfully verified';

-- ============================================
-- 5. ID VERIFICATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS id_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'drivers_license', 'passport', 'state_id'
  document_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_id_verifications_cleaner_id ON id_verifications(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_id_verifications_status ON id_verifications(status);
CREATE INDEX IF NOT EXISTS idx_id_verifications_cleaner_status ON id_verifications(cleaner_id, status);

COMMENT ON TABLE id_verifications IS 'Tracks government ID document verification status';
COMMENT ON COLUMN id_verifications.document_type IS 'Type of ID: drivers_license, passport, state_id';
COMMENT ON COLUMN id_verifications.document_url IS 'URL/path to uploaded document (stored securely)';
COMMENT ON COLUMN id_verifications.status IS 'Verification status: pending, approved, rejected';
COMMENT ON COLUMN id_verifications.reviewed_by IS 'Admin user who reviewed the document';

-- ============================================
-- 6. ENSURE BACKGROUND_CHECKS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS background_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'checkr',
  provider_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'passed', 'failed'
  report_url TEXT,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_background_checks_cleaner_id ON background_checks(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_background_checks_status ON background_checks(status);
CREATE INDEX IF NOT EXISTS idx_background_checks_cleaner_status ON background_checks(cleaner_id, status);

COMMENT ON TABLE background_checks IS 'Tracks background check status and results';
COMMENT ON COLUMN background_checks.provider IS 'Background check provider (e.g., checkr)';
COMMENT ON COLUMN background_checks.provider_id IS 'ID from the provider system';
COMMENT ON COLUMN background_checks.status IS 'Status: pending, in_progress, passed, failed';
COMMENT ON COLUMN background_checks.report_url IS 'URL to background check report (if available)';
COMMENT ON COLUMN background_checks.expires_at IS 'When the background check expires (if applicable)';

-- ============================================
-- 7. ENSURE CLEANER_SERVICE_AREAS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  zip_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_cleaner_id ON cleaner_service_areas(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_zip ON cleaner_service_areas(zip_code);
CREATE INDEX IF NOT EXISTS idx_cleaner_service_areas_cleaner_zip ON cleaner_service_areas(cleaner_id, zip_code);

COMMENT ON TABLE cleaner_service_areas IS 'Stores zip codes where cleaner works';
COMMENT ON COLUMN cleaner_service_areas.zip_code IS '5-digit US zip code';

-- ============================================
-- 8. ENSURE AVAILABILITY_BLOCKS TABLE EXISTS
-- ============================================

CREATE TABLE IF NOT EXISTS availability_blocks (
  id BIGSERIAL PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES cleaner_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_availability_blocks_cleaner_id ON availability_blocks(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_day ON availability_blocks(day_of_week);
CREATE INDEX IF NOT EXISTS idx_availability_blocks_cleaner_day ON availability_blocks(cleaner_id, day_of_week);

COMMENT ON TABLE availability_blocks IS 'Stores weekly availability schedule for cleaners';
COMMENT ON COLUMN availability_blocks.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN availability_blocks.start_time IS 'Start time for this day (e.g., 09:00)';
COMMENT ON COLUMN availability_blocks.end_time IS 'End time for this day (e.g., 17:00)';
COMMENT ON COLUMN availability_blocks.is_active IS 'Whether this availability block is currently active';

-- ============================================
-- 9. HELPER FUNCTION: Check if cleaner onboarding is complete
-- ============================================

CREATE OR REPLACE FUNCTION cleaner_onboarding_complete(cleaner_profile_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM cleaner_profiles
    WHERE id = cleaner_profile_id
      AND onboarding_completed_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION cleaner_onboarding_complete IS 'Returns true if cleaner has completed onboarding';

-- ============================================
-- 10. HELPER FUNCTION: Get cleaner onboarding progress
-- ============================================

CREATE OR REPLACE FUNCTION cleaner_onboarding_progress(cleaner_profile_id UUID)
RETURNS JSONB AS $$
DECLARE
  profile_record RECORD;
  agreements_count INTEGER;
  phone_verified BOOLEAN;
  has_profile_photo BOOLEAN;
  has_id_verification BOOLEAN;
  has_background_check BOOLEAN;
  has_service_areas BOOLEAN;
  has_availability BOOLEAN;
  completed_steps INTEGER := 0;
  total_steps INTEGER := 10;
BEGIN
  -- Get profile
  SELECT * INTO profile_record
  FROM cleaner_profiles
  WHERE id = cleaner_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('completed', 0, 'total', total_steps, 'percentage', 0);
  END IF;

  -- Check agreements (Step 1)
  SELECT COUNT(*) INTO agreements_count
  FROM cleaner_agreements
  WHERE cleaner_id = cleaner_profile_id
    AND agreement_type IN ('terms_of_service', 'independent_contractor');
  
  IF agreements_count >= 2 THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check basic info (Step 2)
  IF profile_record.first_name IS NOT NULL 
     AND profile_record.last_name IS NOT NULL 
     AND profile_record.bio IS NOT NULL 
     AND length(profile_record.bio) >= 20 THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check phone verification (Step 3)
  phone_verified := COALESCE(profile_record.phone_verified, false);
  IF phone_verified THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check face photo (Step 4)
  has_profile_photo := profile_record.profile_photo_url IS NOT NULL;
  IF has_profile_photo THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check ID verification (Step 5)
  SELECT EXISTS (
    SELECT 1 FROM id_verifications
    WHERE cleaner_id = cleaner_profile_id
  ) INTO has_id_verification;
  
  IF has_id_verification THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check background check consent (Step 6)
  SELECT EXISTS (
    SELECT 1 FROM cleaner_agreements
    WHERE cleaner_id = cleaner_profile_id
      AND agreement_type = 'background_check_consent'
  ) INTO has_background_check;
  
  IF has_background_check THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check service areas (Step 7)
  SELECT EXISTS (
    SELECT 1 FROM cleaner_service_areas
    WHERE cleaner_id = cleaner_profile_id
  ) INTO has_service_areas;
  
  IF has_service_areas THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check availability (Step 8)
  SELECT EXISTS (
    SELECT 1 FROM availability_blocks
    WHERE cleaner_id = cleaner_profile_id
      AND is_active = true
  ) INTO has_availability;
  
  IF has_availability THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Check rates (Step 9)
  IF profile_record.hourly_rate_credits > 0 
     AND profile_record.travel_radius_km IS NOT NULL 
     AND profile_record.travel_radius_km > 0 THEN
    completed_steps := completed_steps + 1;
  END IF;

  -- Step 10 (Review) is just a summary, so it doesn't count

  RETURN jsonb_build_object(
    'completed', completed_steps,
    'total', total_steps,
    'percentage', ROUND((completed_steps::NUMERIC / total_steps::NUMERIC) * 100, 2),
    'steps', jsonb_build_object(
      'agreements', agreements_count >= 2,
      'basic_info', profile_record.first_name IS NOT NULL AND profile_record.last_name IS NOT NULL AND profile_record.bio IS NOT NULL,
      'phone_verified', phone_verified,
      'profile_photo', has_profile_photo,
      'id_verification', has_id_verification,
      'background_check', has_background_check,
      'service_areas', has_service_areas,
      'availability', has_availability,
      'rates', profile_record.hourly_rate_credits > 0
    )
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION cleaner_onboarding_progress IS 'Returns onboarding progress as JSON with completed steps and details';
