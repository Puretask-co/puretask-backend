-- Run this in Neon SQL Editor if you have schema mismatches after running the consolidated schema.
-- Fixes: cleaner_profiles columns, is_cleaner_available(TEXT), onboarding, invalidated_tokens, users role

-- 0. Fix users role constraint (some DBs have restrictive CHECK that excludes 'client')
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 1. Ensure cleaner_profiles has required columns (for existing DBs)
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS onboarding_current_step TEXT DEFAULT 'terms';
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS onboarding_reminder_sent_at TIMESTAMPTZ;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS payout_percent NUMERIC(5,2) DEFAULT 80;

-- 2. Ensure invalidated_tokens exists (for JWT auth /auth/me)
-- Create without FK to avoid type mismatch (users.id may be TEXT or UUID depending on schema)
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  jti TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT,
  invalidated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invalidated_tokens_user ON invalidated_tokens(user_id);

-- 3. Fix is_cleaner_available to accept TEXT (matches users.id)
CREATE OR REPLACE FUNCTION is_cleaner_available(
  p_cleaner_id TEXT,
  p_datetime TIMESTAMPTZ
) RETURNS BOOLEAN AS $$
DECLARE
  v_day_of_week INTEGER;
  v_time TIME;
  v_has_availability BOOLEAN;
  v_has_time_off BOOLEAN;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_datetime);
  v_time := p_datetime::TIME;
  
  SELECT EXISTS (
    SELECT 1 FROM cleaner_availability
    WHERE cleaner_id = p_cleaner_id
      AND day_of_week = v_day_of_week
      AND is_available = true
      AND v_time >= start_time
      AND v_time < end_time
  ) INTO v_has_availability;
  
  IF NOT v_has_availability THEN
    RETURN FALSE;
  END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM cleaner_time_off
    WHERE cleaner_id = p_cleaner_id
      AND p_datetime::DATE BETWEEN start_date AND end_date
      AND (all_day = true OR (
        p_datetime::TIME >= start_time AND p_datetime::TIME < end_time
      ))
  ) INTO v_has_time_off;
  
  RETURN NOT v_has_time_off;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Ensure abandoned onboarding index exists
CREATE INDEX IF NOT EXISTS idx_cleaner_profiles_abandoned_onboarding
  ON cleaner_profiles (onboarding_completed_at, onboarding_started_at, onboarding_reminder_sent_at)
  WHERE onboarding_completed_at IS NULL;
