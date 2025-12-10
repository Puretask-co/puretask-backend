-- 015_referrals_and_boosts.sql
-- Referral system and premium features (boosts, rush jobs)
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- REFERRALS
-- ============================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  code            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL DEFAULT 'standard',  -- standard, promo, influencer
  reward_credits  INTEGER NOT NULL DEFAULT 20,
  referee_credits INTEGER NOT NULL DEFAULT 10,  -- What new user gets
  max_uses        INTEGER,  -- NULL = unlimited
  uses_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes (code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON referral_codes (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     TEXT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  referee_id      TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT,
  referral_code   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, qualified, rewarded, expired
  referee_role    TEXT NOT NULL,  -- client, cleaner
  -- Qualification criteria
  jobs_required   INTEGER NOT NULL DEFAULT 3,
  jobs_completed  INTEGER NOT NULL DEFAULT 0,
  -- Rewards
  referrer_reward INTEGER NOT NULL DEFAULT 20,
  referee_reward  INTEGER NOT NULL DEFAULT 10,
  rewarded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals (referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals (status);

-- ============================================
-- CLEANER BOOSTS (Premium Placement)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_boosts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  boost_type      TEXT NOT NULL DEFAULT 'standard',  -- standard, premium, mega
  credits_spent   INTEGER NOT NULL,
  multiplier      NUMERIC(3,2) NOT NULL DEFAULT 1.5,  -- Ranking multiplier
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at         TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',  -- active, expired, cancelled
  jobs_during     INTEGER NOT NULL DEFAULT 0,  -- Jobs received during boost
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cleaner_boosts_cleaner ON cleaner_boosts (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_cleaner_boosts_active ON cleaner_boosts (status, ends_at) 
  WHERE status = 'active';

-- ============================================
-- RUSH JOBS (Priority Jobs)
-- ============================================

ALTER TABLE jobs 
  ADD COLUMN IF NOT EXISTS is_rush BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rush_fee_credits INTEGER DEFAULT 0;

-- Rush job settings
CREATE TABLE IF NOT EXISTS rush_job_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  min_hours_ahead INTEGER NOT NULL DEFAULT 2,  -- Minimum hours before start
  rush_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.25,  -- 25% extra
  max_rush_fee    INTEGER NOT NULL DEFAULT 50,  -- Max 50 credits extra
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO rush_job_settings (min_hours_ahead, rush_multiplier, max_rush_fee)
VALUES (2, 1.25, 50)
ON CONFLICT DO NOTHING;

-- ============================================
-- SUBSCRIPTION CLEANINGS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaning_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cleaner_id      TEXT REFERENCES users (id) ON DELETE SET NULL,  -- Preferred cleaner
  frequency       TEXT NOT NULL,  -- weekly, biweekly, monthly
  day_of_week     SMALLINT,  -- 0-6 (Sunday-Saturday)
  preferred_time  TIME,
  address         TEXT NOT NULL,
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  credit_amount   INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',  -- active, paused, cancelled
  next_job_date   DATE,
  jobs_created    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_client ON cleaning_subscriptions (client_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON cleaning_subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_next_job ON cleaning_subscriptions (next_job_date) 
  WHERE status = 'active';

-- ============================================
-- HELPER VIEWS
-- ============================================

-- Active boosts per cleaner
CREATE OR REPLACE VIEW active_cleaner_boosts AS
SELECT 
  cleaner_id,
  boost_type,
  multiplier,
  ends_at,
  EXTRACT(EPOCH FROM (ends_at - NOW())) / 3600 as hours_remaining
FROM cleaner_boosts
WHERE status = 'active' AND ends_at > NOW();

-- Referral leaderboard
CREATE OR REPLACE VIEW referral_leaderboard AS
SELECT 
  r.referrer_id,
  u.email,
  COUNT(*) as total_referrals,
  COUNT(*) FILTER (WHERE r.status = 'rewarded') as successful_referrals,
  SUM(r.referrer_reward) FILTER (WHERE r.status = 'rewarded') as total_credits_earned
FROM referrals r
JOIN users u ON u.id = r.referrer_id
GROUP BY r.referrer_id, u.email
ORDER BY successful_referrals DESC;

-- Trigger for updated_at
CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON cleaning_subscriptions
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- Comments
COMMENT ON TABLE referral_codes IS 'Unique referral codes per user';
COMMENT ON TABLE referrals IS 'Track referral relationships and rewards';
COMMENT ON TABLE cleaner_boosts IS 'Paid ranking boosts for cleaners';
COMMENT ON TABLE cleaning_subscriptions IS 'Recurring cleaning subscriptions';
