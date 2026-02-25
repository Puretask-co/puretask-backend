-- MIGRATIONS 043-056 + 906 APPENDIX
-- To be appended to 000_COMPLETE_CONSOLIDATED_SCHEMA.sql

-- ============================================
-- MIGRATION 043: Cleaner Level System (condensed)
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

CREATE TABLE IF NOT EXISTS cleaner_goal_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  goal_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(cleaner_id, level, goal_key)
);

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

CREATE TABLE IF NOT EXISTS cleaner_login_days (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleaner_id, login_date)
);

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

INSERT INTO cleaner_level_goals (level, goal_key, goal_type, name, description, criteria, reward_type, reward_config, display_order) VALUES
(1, 'complete_1_cleaning', 'core', 'Complete 1 cleaning', 'Finish your first job', '{"type":"jobs_completed","min":1}'::jsonb, null, null, 1),
(1, 'upload_photos', 'core', 'Upload before & after photos', 'Upload photos for a job', '{"type":"photos_uploaded","min":1}'::jsonb, null, null, 2),
(1, 'clock_in_out', 'core', 'Successful clock-in and clock-out', 'Check in and check out on a job', '{"type":"clock_in_out","min":1}'::jsonb, null, null, 3),
(1, 'accept_1_job', 'core', 'Accept 1 job request', 'Accept your first job', '{"type":"jobs_accepted","min":1}'::jsonb, null, null, 4),
(1, 'send_1_message', 'core', 'Send at least 1 message to a client', 'Communicate with a client', '{"type":"messages_sent","min":1}'::jsonb, null, null, 5)
ON CONFLICT (level, goal_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

DROP TRIGGER IF EXISTS trigger_initialize_level_progress ON users;
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
CREATE TRIGGER trigger_initialize_level_progress AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION initialize_cleaner_level_progress();

INSERT INTO cleaner_level_progress (cleaner_id, current_level)
SELECT cp.user_id, 1 FROM cleaner_profiles cp
WHERE NOT EXISTS (SELECT 1 FROM cleaner_level_progress lp WHERE lp.cleaner_id = cp.user_id)
ON CONFLICT (cleaner_id) DO NOTHING;

-- ============================================
-- MIGRATION 044: Meaningful Login
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_meaningful_actions (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_date DATE NOT NULL,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cleaner_id, action_date, action_type)
);

CREATE OR REPLACE VIEW cleaner_boost_attribution_placeholder AS
SELECT c.cleaner_id, DATE_TRUNC('week', NOW())::date AS week_start, 0::int AS extra_bookings_attributed
FROM cleaner_active_boosts c
WHERE c.is_active = true AND c.expires_at > NOW()
GROUP BY c.cleaner_id;

-- ============================================
-- MIGRATION 045: Gamification Expansion
-- ============================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS has_addons BOOLEAN DEFAULT false;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS addons_count INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS template_id TEXT;
DO $$ BEGIN ALTER TABLE job_offers ADD COLUMN decline_reason TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
ALTER TABLE cleaner_profiles ADD COLUMN IF NOT EXISTS max_travel_miles NUMERIC(5,2) DEFAULT 10;

CREATE TABLE IF NOT EXISTS message_templates (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  copy TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO message_templates (id, label, copy, category) VALUES
('tmpl_on_my_way', 'On my way', 'On my way', 'professional'),
('tmpl_arrived', 'I''ve arrived', 'I''ve arrived', 'professional'),
('tmpl_starting_now', 'Starting now', 'Starting now', 'professional'),
('tmpl_finished_photos_attached', 'Finished — photos attached', 'Finished — here are your photos.', 'professional'),
('tmpl_thank_you', 'Thank you', 'Thanks for choosing PureTask! I just finished up — let me know if there''s anything you''d like adjusted.', 'courtesy'),
('tmpl_review_request', 'Request a review', 'If you were happy with the cleaning, would you mind leaving a quick review? It really helps me get booked more often. Thank you!', 'courtesy')
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, copy = EXCLUDED.copy, category = EXCLUDED.category;

-- ============================================
-- MIGRATION 046: Safety Reports
-- ============================================

CREATE TABLE IF NOT EXISTS safety_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_offer_id UUID REFERENCES job_offers(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT 'safety_concern',
  note TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MIGRATION 047: Event Ingestion
-- ============================================

CREATE TABLE IF NOT EXISTS pt_event_log (
  event_id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mobile','web','server','admin','system')),
  idempotency_key TEXT,
  cleaner_id TEXT,
  client_id TEXT,
  job_id UUID,
  job_request_id UUID,
  region_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pt_event_log_occurred_at ON pt_event_log (occurred_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pt_event_log_idempotency ON pt_event_log (event_type, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS pt_engagement_sessions (
  session_id UUID PRIMARY KEY,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('mobile','web')),
  timezone TEXT,
  device_platform TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pt_engagement_actions (
  action_id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES pt_engagement_sessions(session_id) ON DELETE CASCADE,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL,
  action TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MIGRATION 048: Reward Grants
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_goal_progress (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  current_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cleaner_id, goal_id)
);

CREATE TABLE IF NOT EXISTS gamification_reward_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NULL,
  uses_remaining INTEGER NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('goal','level','admin')),
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gamification_choice_eligibilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice_group_id TEXT NOT NULL,
  source_goal_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_reward_id TEXT NULL,
  selected_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','selected','expired','revoked')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE VIEW gamification_active_rewards AS
SELECT * FROM gamification_reward_grants
WHERE status = 'active' AND (ends_at IS NULL OR ends_at > now());

-- ============================================
-- MIGRATION 049: SQL Helpers
-- ============================================

CREATE OR REPLACE FUNCTION pt_haversine_meters(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT 2 * 6371000 * asin(sqrt(pow(sin(radians((lat2 - lat1) / 2)), 2) + cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians((lon2 - lon1) / 2)), 2)));
$$;

CREATE OR REPLACE FUNCTION pt_haversine_miles(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT pt_haversine_meters(lat1, lon1, lat2, lon2) / 1609.344;
$$;

CREATE OR REPLACE FUNCTION pt_within_radius_meters(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision, radius_m double precision)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT pt_haversine_meters(lat1, lon1, lat2, lon2) <= radius_m;
$$;

-- ============================================
-- MIGRATION 050: Reward Idempotency
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_source ON gamification_reward_grants (cleaner_id, reward_id, source_type, source_id);
ALTER TABLE gamification_choice_eligibilities ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION gamification_use_reward(grant_id uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE gamification_reward_grants
  SET uses_remaining = CASE WHEN uses_remaining IS NULL THEN NULL WHEN uses_remaining <= 1 THEN 0 ELSE uses_remaining - 1 END,
      status = CASE WHEN uses_remaining IS NULL THEN status WHEN uses_remaining <= 1 THEN 'expired' ELSE status END
  WHERE id = grant_id AND status = 'active';
END;
$$;

-- ============================================
-- MIGRATION 051: Admin Control Plane
-- ============================================

CREATE TABLE IF NOT EXISTS admin_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  region_id TEXT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  variant TEXT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_reward_budget (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL CHECK (scope IN ('global','region')),
  region_id TEXT NOT NULL DEFAULT '__global__',
  cash_cap_daily_cents INTEGER NOT NULL DEFAULT 0,
  cash_cap_monthly_cents INTEGER NOT NULL DEFAULT 0,
  cash_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
  emergency_disable_all_rewards BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope, region_id)
);

CREATE TABLE IF NOT EXISTS admin_config_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type TEXT NOT NULL CHECK (config_type IN ('goals','rewards','governor','levels','full_bundle')),
  version INTEGER NOT NULL,
  region_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','draft')),
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  created_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_user_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS region_governor_config (
  region_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- MIGRATION 052: Cash Budget
-- ============================================

CREATE TABLE IF NOT EXISTS gamification_cash_reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NULL,
  reward_id TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('goal','level','admin','choice')),
  source_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cash_ledger_source ON gamification_cash_reward_ledger (cleaner_id, reward_id, source_type, source_id);

CREATE OR REPLACE VIEW gamification_cash_spend_daily AS
SELECT COALESCE(region_id, '__global__') AS region_key, date_trunc('day', granted_at)::date AS day, SUM(amount_cents)::bigint AS spend_cents
FROM gamification_cash_reward_ledger GROUP BY 1, 2;

CREATE OR REPLACE VIEW gamification_cash_spend_monthly AS
SELECT COALESCE(region_id, '__global__') AS region_key, date_trunc('month', granted_at)::date AS month, SUM(amount_cents)::bigint AS spend_cents
FROM gamification_cash_reward_ledger GROUP BY 1, 2;

-- ============================================
-- MIGRATION 053: Badges
-- ============================================

CREATE TABLE IF NOT EXISTS badge_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('core','fun')),
  icon_key TEXT NULL,
  is_profile_visible BOOLEAN NOT NULL DEFAULT false,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  trigger JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cleaner_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaner_badge_once ON cleaner_badges (cleaner_id, badge_id);

CREATE TABLE IF NOT EXISTS cleaner_achievement_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('badge','level_up','goal_complete','reward_granted')),
  ref_id TEXT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO badge_definitions (id, name, description, category, icon_key, is_profile_visible, sort_order, trigger) VALUES
('badge_first_job', 'First Job Completed', 'Completed your first job on PureTask.', 'core', 'first_job', true, 10, '{"type":"metric","metric":"jobs.completed.count","op":">=","target":1}'::jsonb),
('badge_first_5star', 'First 5-Star Rating', 'Received your first 5-star rating.', 'core', 'star', true, 20, '{"type":"metric","metric":"ratings.five_star.count","op":">=","target":1}'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- ============================================
-- MIGRATION 054: Seasonal Challenges
-- ============================================

CREATE TABLE IF NOT EXISTS season_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  regions TEXT[] NULL,
  rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS season_application_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id TEXT NOT NULL REFERENCES season_rules(id) ON DELETE CASCADE,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================
-- MIGRATION 055: Ops Views
-- ============================================

CREATE OR REPLACE VIEW ops_cleaner_gamification_snapshot AS
SELECT clp.cleaner_id, clp.current_level AS level, clp.maintenance_paused AS paused,
  CASE WHEN clp.maintenance_paused_reason IS NOT NULL AND trim(clp.maintenance_paused_reason) <> ''
    THEN regexp_split_to_array(trim(clp.maintenance_paused_reason), $$\s*;\s*$$)
    ELSE ARRAY[]::text[] END AS pause_reasons,
  clp.updated_at
FROM cleaner_level_progress clp;

CREATE OR REPLACE VIEW ops_cleaner_goal_counts AS
SELECT cleaner_id,
  COUNT(*) FILTER (WHERE completed = true) AS goals_complete_total,
  COUNT(*) FILTER (WHERE completed = false) AS goals_in_progress_total,
  COUNT(*) AS goals_total
FROM cleaner_goal_progress GROUP BY cleaner_id;

-- ============================================
-- MIGRATION 056: Marketplace Governor
-- ============================================

CREATE TABLE IF NOT EXISTS region_marketplace_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  active_cleaners INTEGER NOT NULL DEFAULT 0,
  available_cleaners INTEGER NOT NULL DEFAULT 0,
  job_requests INTEGER NOT NULL DEFAULT 0,
  jobs_booked INTEGER NOT NULL DEFAULT 0,
  median_fill_minutes INTEGER NULL,
  cancel_rate NUMERIC NULL,
  dispute_rate NUMERIC NULL,
  avg_rating NUMERIC NULL,
  on_time_rate NUMERIC NULL,
  acceptance_rate NUMERIC NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS region_governor_state (
  region_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('undersupply','balanced','oversupply','quality_risk')),
  visibility_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  early_exposure_minutes INTEGER NOT NULL DEFAULT 0,
  acceptance_strictness_factor NUMERIC NOT NULL DEFAULT 1.0,
  quality_emphasis_factor NUMERIC NOT NULL DEFAULT 1.0,
  cash_rewards_enabled BOOLEAN NOT NULL DEFAULT true,
  reason TEXT NULL,
  based_on_window_end TIMESTAMPTZ NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS region_governor_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('compute','override','enable','disable','config_update')),
  actor TEXT NULL,
  before_state JSONB NULL,
  after_state JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO region_governor_state (region_id, state, reason)
VALUES ('__global__', 'balanced', 'no_metrics')
ON CONFLICT (region_id) DO NOTHING;

-- ============================================
-- MIGRATION 906: Durable Jobs
-- ============================================

CREATE TABLE IF NOT EXISTS durable_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  payload_json JSONB,
  result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uniq_durable_jobs_type_key UNIQUE (job_type, idempotency_key),
  CONSTRAINT chk_durable_jobs_status CHECK (status IN ('pending','running','completed','failed','retrying','dead'))
);

CREATE INDEX IF NOT EXISTS idx_durable_jobs_pending ON durable_jobs (run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_durable_jobs_type_status ON durable_jobs (job_type, status, run_at);
CREATE INDEX IF NOT EXISTS idx_durable_jobs_locked ON durable_jobs (locked_at) WHERE status = 'running';
