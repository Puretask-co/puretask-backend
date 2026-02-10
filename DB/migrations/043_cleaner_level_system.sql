-- Migration 043: PureTask Cleaner Level System
-- Implements the behavior-driven gamification: levels, goals, rewards
-- Levels = permission gates; Goals = real rewards (cash, visibility, fee reductions)
-- NOTE: Uses TEXT for cleaner_id to match users.id (canonical); see DB/neon/ for UUID variant

-- ============================================
-- LEVEL DEFINITIONS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_level_definitions (
  level INTEGER PRIMARY KEY CHECK (level >= 1 AND level <= 10),
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cleaner_level_definitions (level, name, description, display_order) VALUES
(1, 'New Cleaner', 'First success, zero friction', 1),
(2, 'Active', 'Prove consistency and responsiveness', 2),
(3, 'Reliable', 'Establish trust', 3),
(4, 'Trusted', 'Reduce platform risk, higher quality', 4),
(5, 'Professional', 'Separate pros from casuals', 5),
(6, 'Elite', 'Operational excellence', 6),
(7, 'Community Favorite', 'Retention and loyalty', 7),
(8, 'Master', 'High-value supply', 8),
(9, 'Top Performer', 'Scarcity and excellence', 9),
(10, 'Legend', 'Long-term anchors', 10)
ON CONFLICT (level) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================
-- GOAL DEFINITIONS (per level, core/stretch/maintenance)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_level_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL REFERENCES cleaner_level_definitions(level),
  goal_key TEXT NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('core', 'stretch', 'maintenance')),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  reward_type TEXT,
  reward_config JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(level, goal_key)
);

CREATE INDEX IF NOT EXISTS idx_level_goals_level ON cleaner_level_goals(level);
CREATE INDEX IF NOT EXISTS idx_level_goals_type ON cleaner_level_goals(goal_type);

-- ============================================
-- CLEANER LEVEL PROGRESS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_level_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_level INTEGER NOT NULL DEFAULT 1 REFERENCES cleaner_level_definitions(level),
  level_reached_at TIMESTAMPTZ,
  maintenance_paused BOOLEAN DEFAULT false,
  maintenance_paused_at TIMESTAMPTZ,
  maintenance_paused_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_level_progress_cleaner ON cleaner_level_progress(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_level_progress_level ON cleaner_level_progress(current_level);

-- ============================================
-- GOAL COMPLETIONS (idempotent tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  goal_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(cleaner_id, level, goal_key)
);

CREATE INDEX IF NOT EXISTS idx_goal_completions_cleaner ON cleaner_goal_completions(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_goal_completions_level ON cleaner_goal_completions(cleaner_id, level);

-- ============================================
-- REWARDS GRANTED (cash, boosts, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_rewards_granted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  goal_key TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  reward_config JSONB NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'used', 'revoked')),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_rewards_cleaner ON cleaner_rewards_granted(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_rewards_status ON cleaner_rewards_granted(cleaner_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_rewards_expires ON cleaner_rewards_granted(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- LOGIN STREAK TRACKING (for "log in X days" goals)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_login_days (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleaner_id, login_date)
);

CREATE INDEX IF NOT EXISTS idx_login_days_cleaner ON cleaner_login_days(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_login_days_date ON cleaner_login_days(login_date);

-- ============================================
-- ACTIVE BOOSTS (priority visibility, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_active_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost_type TEXT NOT NULL,
  multiplier NUMERIC(5,2),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  source_goal_key TEXT,
  source_level INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_boosts_cleaner ON cleaner_active_boosts(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_boosts_active ON cleaner_active_boosts(cleaner_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_boosts_expires ON cleaner_active_boosts(expires_at) WHERE is_active = true;

-- ============================================
-- SEED LEVEL 1 GOALS
-- ============================================

INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
-- LEVEL 1 CORE
(1, 'complete_1_cleaning', 'core', 'Complete 1 cleaning', 'Finish your first job', '{"type":"jobs_completed","min":1}'::jsonb, null, null, 1),
(1, 'upload_photos', 'core', 'Upload before & after photos', 'Upload photos for a job', '{"type":"photos_uploaded","min":1}'::jsonb, null, null, 2),
(1, 'clock_in_out', 'core', 'Successful clock-in and clock-out', 'Check in and check out on a job', '{"type":"clock_in_out","min":1}'::jsonb, null, null, 3),
(1, 'accept_1_job', 'core', 'Accept 1 job request', 'Accept your first job', '{"type":"jobs_accepted","min":1}'::jsonb, null, null, 4),
(1, 'send_1_message', 'core', 'Send at least 1 message to a client', 'Communicate with a client', '{"type":"messages_sent","min":1}'::jsonb, null, null, 5),
-- LEVEL 1 STRETCH
(1, 'receive_5_star', 'stretch', 'Receive a 5-star rating', 'Get a perfect rating', '{"type":"five_star_rating","min":1}'::jsonb, 'priority_visibility', '{"hours":48}'::jsonb, 10),
(1, 'no_reschedules_5', 'stretch', 'No reschedules for 5 jobs', 'Complete 5 jobs without rescheduling', '{"type":"no_reschedules","jobs":5}'::jsonb, 'escrow_reduction', '{"percent":10,"days":30}'::jsonb, 11),
-- LEVEL 1 MAINTENANCE
(1, 'no_no_shows', 'maintenance', 'No no-shows', 'Never miss a scheduled job', '{"type":"no_no_shows"}'::jsonb, null, null, 20),
(1, 'no_policy_violations', 'maintenance', 'No policy violations', 'Stay compliant', '{"type":"no_policy_violations"}'::jsonb, null, null, 21),
(1, 'account_verified', 'maintenance', 'Account remains verified', 'Keep your account in good standing', '{"type":"account_verified"}'::jsonb, null, null, 22)
ON CONFLICT (level, goal_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria,
  reward_type = EXCLUDED.reward_type,
  reward_config = EXCLUDED.reward_config,
  display_order = EXCLUDED.display_order;

-- ============================================
-- SEED LEVEL 2 GOALS
-- ============================================

INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
-- LEVEL 2 CORE
(2, 'complete_5_basic', 'core', 'Complete 5 basic cleanings', 'Finish 5 basic cleaning jobs', '{"type":"basic_cleanings","min":5}'::jsonb, 'cash_bonus', '{"amount_cents":1000}'::jsonb, 1),
(2, 'photos_approved_5', 'core', 'Photos approved 5 times', 'Get client approval on photos 5 times', '{"type":"photos_approved","min":5}'::jsonb, null, null, 2),
(2, 'avg_rating_35_14d', 'core', 'Average rating ≥ 3.5 (14 days)', 'Maintain good ratings', '{"type":"avg_rating","min":3.5,"days":14}'::jsonb, null, null, 3),
(2, 'send_5_messages', 'core', 'Send at least 5 messages to clients', 'Stay communicative', '{"type":"messages_sent","min":5}'::jsonb, null, null, 4),
(2, 'on_time_3', 'core', 'On-time for 3 jobs', 'Arrive on time for 3 jobs', '{"type":"on_time","min":3}'::jsonb, null, null, 5),
-- LEVEL 2 STRETCH
(2, 'zero_cancellations_5', 'stretch', 'Zero cancellations across 5 jobs', 'Do not cancel', '{"type":"no_cancellations","jobs":5}'::jsonb, 'priority_visibility', '{"days":7}'::jsonb, 10),
(2, '5_cleanings_7_days', 'stretch', '5 cleanings in 7 days', 'Complete 5 jobs within a week', '{"type":"jobs_in_period","count":5,"days":7}'::jsonb, 'cash_bonus', '{"amount_cents":1500}'::jsonb, 11),
(2, 'accept_5_jobs', 'stretch', 'Accept 5 jobs', 'Accept 5 job offers', '{"type":"jobs_accepted","min":5}'::jsonb, 'early_access', '{"minutes":5}'::jsonb, 12),
(2, 'early_evening_job', 'stretch', 'Complete 1 early or evening job', 'Flexibility badge', '{"type":"early_evening_job","min":1}'::jsonb, null, null, 13),
(2, 'accept_10_requests', 'stretch', 'Accept 10 job requests', 'Be responsive to opportunities', '{"type":"jobs_accepted","min":10}'::jsonb, 'ranking_boost', '{"percent":10,"days":30}'::jsonb, 14),
-- LEVEL 2 MAINTENANCE
(2, 'no_late_10min', 'maintenance', 'No late arrivals > 10 min', 'Be punctual', '{"type":"no_late_over","minutes":10}'::jsonb, null, null, 20),
(2, 'no_disputes', 'maintenance', 'No disputes', 'Avoid disputes', '{"type":"no_disputes"}'::jsonb, null, null, 21),
(2, 'active_weekly', 'maintenance', 'Active at least once per week', 'Stay engaged', '{"type":"active_weekly"}'::jsonb, null, null, 22)
ON CONFLICT (level, goal_key) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, criteria = EXCLUDED.criteria,
  reward_type = EXCLUDED.reward_type, reward_config = EXCLUDED.reward_config, display_order = EXCLUDED.display_order;

-- ============================================
-- SEED LEVELS 3-10 (summary - full spec in service)
-- ============================================
-- Remaining goals are evaluated in cleanerLevelService.ts from the spec.
-- We add a minimal set here; the service can evaluate against live job/rating data.

INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
-- LEVEL 3
(3, 'complete_10', 'core', '10 completed cleanings', null, '{"type":"jobs_completed","min":10}'::jsonb, 'cash_bonus', '{"amount_cents":2000}'::jsonb, 1),
(3, 'on_time_8', 'core', 'On-time for 8 jobs', null, '{"type":"on_time","min":8}'::jsonb, null, null, 2),
(3, 'zero_no_shows', 'core', 'Zero no-shows', null, '{"type":"no_no_shows_lifetime"}'::jsonb, null, null, 3),
(3, 'five_star_5', 'stretch', '5 five-star ratings', null, '{"type":"five_star_ratings","min":5}'::jsonb, 'priority_visibility', '{"days":14}'::jsonb, 10),
(3, '2_clients_3_jobs', 'stretch', '2 clients with 3+ cleanings each', null, '{"type":"repeat_clients","clients":2,"min_jobs":3}'::jsonb, null, null, 11),
(3, 'no_cancellations_10', 'stretch', 'Zero cancellations across 10 jobs', null, '{"type":"no_cancellations","jobs":10}'::jsonb, 'platform_fee', '{"percent_reduction":2,"days":30}'::jsonb, 12),
(3, 'no_disputes_10', 'maintenance', 'No disputes in last 10 jobs', null, '{"type":"no_disputes_in_jobs","jobs":10}'::jsonb, null, null, 20),
(3, 'no_last_minute_cancel', 'maintenance', 'No last-minute cancellations', null, '{"type":"no_last_minute_cancel"}'::jsonb, null, null, 21),
(3, 'rating_45_rolling', 'maintenance', 'Rolling rating ≥ 4.5', null, '{"type":"avg_rating","min":4.5,"rolling":true}'::jsonb, null, null, 22)
ON CONFLICT (level, goal_key) DO NOTHING;

-- LEVEL 4 GOALS
INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
(4, '10_deep_10_basic', 'core', '10 deep + 10 basic cleanings', null, '{"type":"deep_and_basic","deep":10,"basic":10}'::jsonb, 'cash_bonus', '{"amount_cents":2500}'::jsonb, 1),
(4, 'on_time_90', 'core', 'On-time rate ≥ 90%', null, '{"type":"on_time_rate","min":90}'::jsonb, 'ranking_multiplier', '{"multiplier":1.2}'::jsonb, 2),
(4, 'no_cancel_7d', 'core', 'No cancellations in last 7 days', null, '{"type":"no_cancellations_days","days":7}'::jsonb, 'escrow_reduction', '{"percent":20}'::jsonb, 3),
(4, 'login_14_days', 'stretch', 'Log into platform 14 days in a row', null, '{"type":"login_streak","days":14}'::jsonb, 'early_access', '{"minutes":10}'::jsonb, 10),
(4, '15_five_star', 'stretch', '15 five-star reviews', null, '{"type":"five_star_ratings","min":15}'::jsonb, 'cash_bonus', '{"amount_cents":3000}'::jsonb, 11),
(4, '5_weekend_early', 'stretch', '5 weekend or early-morning jobs', null, '{"type":"weekend_early_jobs","min":5}'::jsonb, null, null, 12),
(4, 'login_21_times', 'maintenance', 'Logged in 21 times', null, '{"type":"login_count","min":21}'::jsonb, null, null, 20),
(4, 'no_losing_disputes_15', 'maintenance', 'No losing disputes in last 15 jobs', null, '{"type":"no_losing_disputes","jobs":15}'::jsonb, null, null, 21),
(4, 'active_weekly', 'maintenance', 'Active weekly', null, '{"type":"active_weekly"}'::jsonb, null, null, 22)
ON CONFLICT (level, goal_key) DO NOTHING;

-- LEVEL 5-10 PLACEHOLDER GOALS (service evaluates full spec)
INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, criteria, reward_type, reward_config, display_order) VALUES
(5, 'complete_50', 'core', '50 completed cleanings', '{"type":"jobs_completed","min":50}'::jsonb, 'cash_bonus', '{"amount_cents":5000}'::jsonb, 1),
(5, 'no_cancel_14d', 'core', 'No cancellations in last 14 days', '{"type":"no_cancellations_days","days":14}'::jsonb, null, null, 2),
(5, 'photos_approved_30', 'core', '30 approved photo sets', '{"type":"photos_approved","min":30}'::jsonb, null, null, 3),
(5, '25_five_star', 'core', '25 five-star reviews', '{"type":"five_star_ratings","min":25}'::jsonb, null, null, 4),
(5, 'on_time_95', 'core', 'On-time rate ≥ 95%', '{"type":"on_time_rate","min":95}'::jsonb, null, null, 5),
(6, 'complete_45', 'core', '45 completed cleanings', '{"type":"jobs_completed","min":45}'::jsonb, 'cash_bonus', '{"amount_cents":7500}'::jsonb, 1),
(6, 'on_time_80_30jobs', 'core', 'On-time 80% in last 30 jobs', '{"type":"on_time_rate_last_n","min":80,"jobs":30}'::jsonb, null, null, 2),
(6, '25_five_star', 'core', '25 five-star ratings', '{"type":"five_star_ratings","min":25}'::jsonb, 'instant_payout', '{}'::jsonb, 3),
(6, 'on_time_97', 'core', 'On-time rate ≥ 97%', '{"type":"on_time_rate","min":97}'::jsonb, null, null, 4),
(7, 'complete_75', 'core', '75 completed cleanings', '{"type":"jobs_completed","min":75}'::jsonb, 'cash_bonus', '{"amount_cents":10000}'::jsonb, 1),
(7, '0_disputes_30d', 'core', '0 disputes in last 30 days', '{"type":"no_disputes_days","days":30}'::jsonb, null, null, 2),
(7, 'avg_rating_48', 'core', 'Average rating ≥ 4.8', '{"type":"avg_rating","min":4.8}'::jsonb, null, null, 3),
(8, 'complete_100', 'core', '100 completed jobs', '{"type":"jobs_completed","min":100}'::jsonb, 'cash_bonus', '{"amount_cents":15000}'::jsonb, 1),
(8, 'on_time_90', 'core', 'On-time rate ≥ 90%', '{"type":"on_time_rate","min":90}'::jsonb, null, null, 2),
(8, 'losing_disputes_lt3_50', 'core', '< 3 losing disputes in last 50 jobs', '{"type":"losing_disputes_lt","jobs":50,"max":3}'::jsonb, null, null, 3),
(8, 'avg_rating_485', 'core', 'Average rating ≥ 4.85', '{"type":"avg_rating","min":4.85}'::jsonb, null, null, 4),
(9, 'complete_200', 'core', '200 completed jobs', '{"type":"jobs_completed","min":200}'::jsonb, 'cash_bonus', '{"amount_cents":25000}'::jsonb, 1),
(9, 'avg_rating_95', 'core', 'Average rating ≥ 4.95', '{"type":"avg_rating","min":4.95}'::jsonb, null, null, 2),
(9, 'losing_disputes_le1_50', 'core', '≤ 1 losing dispute in last 50 jobs', '{"type":"losing_disputes_lt","jobs":50,"max":1}'::jsonb, null, null, 3),
(9, 'top_10_reliability', 'core', 'Top 10% reliability', '{"type":"reliability_percentile","max_percentile":10}'::jsonb, null, null, 4),
(10, 'complete_300', 'core', '300 completed jobs', '{"type":"jobs_completed","min":300}'::jsonb, 'cash_bonus', '{"amount_cents":50000}'::jsonb, 1),
(10, 'avg_rating_95', 'core', 'Average rating ≥ 4.95', '{"type":"avg_rating","min":4.95}'::jsonb, null, null, 2),
(10, 'lifetime_dispute_lt5', 'core', 'Lifetime losing dispute rate < 5%', '{"type":"lifetime_losing_dispute_rate","max_percent":5}'::jsonb, null, null, 3),
(10, '12_months_active', 'core', '12 months active', '{"type":"months_active","min":12}'::jsonb, null, null, 4),
(10, 'top_1_reliability', 'maintenance', 'Reliability score top 1%', '{"type":"reliability_percentile","max_percentile":1}'::jsonb, null, null, 20)
ON CONFLICT (level, goal_key) DO NOTHING;

-- ============================================
-- INITIALIZE PROGRESS FOR NEW CLEANERS
-- ============================================

CREATE OR REPLACE FUNCTION initialize_cleaner_level_progress()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'cleaner' THEN
    INSERT INTO cleaner_level_progress (cleaner_id, current_level)
    VALUES (NEW.id, 1)
    ON CONFLICT (cleaner_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_initialize_level_progress ON users;
CREATE TRIGGER trigger_initialize_level_progress
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_cleaner_level_progress();

-- Backfill existing cleaners
INSERT INTO cleaner_level_progress (cleaner_id, current_level)
SELECT cp.user_id, 1
FROM cleaner_profiles cp
WHERE NOT EXISTS (SELECT 1 FROM cleaner_level_progress lp WHERE lp.cleaner_id = cp.user_id)
ON CONFLICT (cleaner_id) DO NOTHING;

COMMENT ON TABLE cleaner_level_definitions IS 'Level 1-10 definitions for PureTask cleaner gamification';
COMMENT ON TABLE cleaner_level_goals IS 'Goals per level: core (required), stretch (1+ required), maintenance (ongoing)';
COMMENT ON TABLE cleaner_level_progress IS 'Per-cleaner level and progress';
COMMENT ON TABLE cleaner_goal_completions IS 'Tracks which goals each cleaner has completed';
COMMENT ON TABLE cleaner_rewards_granted IS 'Rewards awarded (cash, boosts, fee reductions)';
COMMENT ON TABLE cleaner_login_days IS 'Login streak tracking for daily login goals';
COMMENT ON TABLE cleaner_active_boosts IS 'Active visibility/ranking boosts';

SELECT 'Cleaner Level System Migration 043 Completed' AS status;
