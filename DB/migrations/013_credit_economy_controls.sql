-- 013_credit_economy_controls.sql
-- Credit economy controls: anti-fraud, bonus caps, audit logs, device tokens
-- NOTE: Uses TEXT for user references to match existing users.id column type

-- ============================================
-- AUDIT LOGS (Admin & System Actions)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_type      TEXT NOT NULL,  -- admin, system, user
  action          TEXT NOT NULL,  -- e.g., credit_adjustment, user_update, dispute_resolved
  resource_type   TEXT NOT NULL,  -- user, job, credit_ledger, etc.
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  metadata        JSONB DEFAULT '{}'::jsonb,
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- ============================================
-- DEVICE TOKENS (Push Notifications)
-- ============================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token           TEXT NOT NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_name     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_used_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens (is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER trg_device_tokens_updated_at
BEFORE UPDATE ON device_tokens
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- ============================================
-- CREDIT BONUS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS credit_bonuses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bonus_type      TEXT NOT NULL,  -- signup, referral, promo, weekly_reward, tier_bonus
  amount          INTEGER NOT NULL,
  week_of_year    INTEGER NOT NULL,  -- ISO week number for weekly caps
  year            INTEGER NOT NULL,
  source          TEXT,  -- promo code, referrer_id, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_bonuses_user ON credit_bonuses (user_id);
CREATE INDEX IF NOT EXISTS idx_credit_bonuses_week ON credit_bonuses (year, week_of_year);
CREATE INDEX IF NOT EXISTS idx_credit_bonuses_type ON credit_bonuses (bonus_type);

-- View: Weekly bonus totals per user
CREATE OR REPLACE VIEW user_weekly_bonuses AS
SELECT 
  user_id,
  year,
  week_of_year,
  SUM(amount) as total_bonuses,
  COUNT(*) as bonus_count
FROM credit_bonuses
GROUP BY user_id, year, week_of_year;

-- ============================================
-- FRAUD DETECTION ALERTS
-- ============================================

CREATE TABLE IF NOT EXISTS fraud_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT REFERENCES users (id) ON DELETE SET NULL,
  alert_type      TEXT NOT NULL,  -- rapid_bonus, large_adjustment, suspicious_pattern
  severity        TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high, critical
  description     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'open',  -- open, investigating, resolved, false_positive
  resolved_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fraud_alerts_user ON fraud_alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_status ON fraud_alerts (status);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_severity ON fraud_alerts (severity);
CREATE INDEX IF NOT EXISTS idx_fraud_alerts_created ON fraud_alerts (created_at DESC);

-- ============================================
-- RELIABILITY HISTORY (for decay tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS reliability_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  old_score       NUMERIC(5,2) NOT NULL,
  new_score       NUMERIC(5,2) NOT NULL,
  old_tier        TEXT NOT NULL,
  new_tier        TEXT NOT NULL,
  reason          TEXT NOT NULL,  -- job_completed, job_cancelled, decay, manual_adjustment
  metadata        JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reliability_history_cleaner ON reliability_history (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_reliability_history_created ON reliability_history (created_at DESC);

-- ============================================
-- TIER LOCKS (prevent rapid tier changes)
-- ============================================

CREATE TABLE IF NOT EXISTS tier_locks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,
  locked_until    TIMESTAMPTZ NOT NULL,
  reason          TEXT NOT NULL,  -- promotion, grace_period
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- One active lock per cleaner
  CONSTRAINT unique_active_tier_lock UNIQUE (cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_tier_locks_cleaner ON tier_locks (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_tier_locks_until ON tier_locks (locked_until);

-- ============================================
-- CANCELLATION PENALTIES
-- ============================================

CREATE TABLE IF NOT EXISTS cancellation_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id          UUID NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  cancelled_by    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  cancelled_by_role TEXT NOT NULL,  -- client, cleaner
  cancellation_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_start   TIMESTAMPTZ NOT NULL,
  hours_before      NUMERIC(6,2) NOT NULL,  -- Hours before scheduled start
  penalty_applied   BOOLEAN NOT NULL DEFAULT false,
  penalty_credits   INTEGER,
  is_grace_period   BOOLEAN NOT NULL DEFAULT false,  -- First 2 cancels of month = grace
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancellation_records_job ON cancellation_records (job_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_user ON cancellation_records (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_cancellation_records_created ON cancellation_records (created_at DESC);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get user's weekly bonus total
CREATE OR REPLACE FUNCTION get_user_weekly_bonus_total(
  p_user_id TEXT,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  p_week INTEGER DEFAULT EXTRACT(WEEK FROM NOW())::INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total
  FROM credit_bonuses
  WHERE user_id = p_user_id
    AND year = p_year
    AND week_of_year = p_week;
  
  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check if cleaner has tier lock active
CREATE OR REPLACE FUNCTION is_tier_locked(p_cleaner_id TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tier_locks
    WHERE cleaner_id = p_cleaner_id
      AND locked_until > NOW()
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get user's monthly cancellation count
CREATE OR REPLACE FUNCTION get_monthly_cancellation_count(
  p_user_id TEXT,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER,
  p_month INTEGER DEFAULT EXTRACT(MONTH FROM NOW())::INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM cancellation_records
  WHERE cancelled_by = p_user_id
    AND EXTRACT(YEAR FROM created_at) = p_year
    AND EXTRACT(MONTH FROM created_at) = p_month;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Comments
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all admin and system actions';
COMMENT ON TABLE device_tokens IS 'Push notification device tokens';
COMMENT ON TABLE credit_bonuses IS 'Track all bonus credits for weekly cap enforcement';
COMMENT ON TABLE fraud_alerts IS 'Suspicious activity alerts for admin review';
COMMENT ON TABLE reliability_history IS 'Historical record of reliability score changes';
COMMENT ON TABLE tier_locks IS 'Prevent rapid tier demotions after promotions';
COMMENT ON TABLE cancellation_records IS 'Track cancellations for penalty and grace period logic';
