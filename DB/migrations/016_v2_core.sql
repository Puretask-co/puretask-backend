-- 016_v2_core.sql
-- PureTask V2 Core Data Model Changes

-- ============================================
-- 1.1 CITIES & SERVICE AREAS
-- ============================================

CREATE TABLE IF NOT EXISTS cities (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  country_code    TEXT NOT NULL DEFAULT 'US',
  state_region    TEXT,
  timezone        TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cities_active ON cities (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_cities_state ON cities (state_region);

-- Note: We already have cleaner_service_areas, but this is for platform-level areas
CREATE TABLE IF NOT EXISTS platform_service_areas (
  id              SERIAL PRIMARY KEY,
  city_id         INT NOT NULL REFERENCES cities(id),
  name            TEXT NOT NULL,
  zip_codes       TEXT[] NOT NULL,        -- list of ZIPs this area covers
  base_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.0,  -- pricing modifier
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_areas_city ON platform_service_areas (city_id);
CREATE INDEX IF NOT EXISTS idx_service_areas_active ON platform_service_areas (is_active) WHERE is_active = true;

-- ============================================
-- 1.2 PROPERTIES (Multi-property clients & B2B)
-- ============================================

CREATE TABLE IF NOT EXISTS properties (
  id              SERIAL PRIMARY KEY,
  client_id       UUID NOT NULL REFERENCES users(id),
  service_area_id INT REFERENCES platform_service_areas(id),
  label           TEXT NOT NULL,        -- "Home", "Rental 1", "Airbnb #3"
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state_region    TEXT,
  postal_code     TEXT,
  country_code    TEXT NOT NULL DEFAULT 'US',
  latitude        NUMERIC(9,6),
  longitude       NUMERIC(9,6),
  notes           TEXT,
  -- Property details for AI/pricing
  bedrooms        INT,
  bathrooms       NUMERIC(3,1),
  square_feet     INT,
  has_pets        BOOLEAN DEFAULT FALSE,
  has_kids        BOOLEAN DEFAULT FALSE,
  -- Cleaning score system
  cleaning_score  NUMERIC(5,2) NOT NULL DEFAULT 100,   -- 0–100 "cleanliness score"
  last_basic_at   TIMESTAMPTZ,
  last_deep_at    TIMESTAMPTZ,
  last_moveout_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_client ON properties (client_id);
CREATE INDEX IF NOT EXISTS idx_properties_area ON properties (service_area_id);
CREATE INDEX IF NOT EXISTS idx_properties_score ON properties (cleaning_score);

-- Add property_id to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id);

-- ============================================
-- 1.3 ENHANCED SUBSCRIPTIONS
-- ============================================

-- Drop and recreate with enhanced schema if needed
-- (Keep existing cleaning_subscriptions but add new columns)

ALTER TABLE cleaning_subscriptions 
  ADD COLUMN IF NOT EXISTS property_id INT REFERENCES properties(id),
  ADD COLUMN IF NOT EXISTS base_hours NUMERIC(5,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS cleaning_type TEXT DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Los_Angeles',
  ADD COLUMN IF NOT EXISTS paused_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- ============================================
-- 1.4 SAVED FAVORITES
-- ============================================

CREATE TABLE IF NOT EXISTS favorite_cleaners (
  id          SERIAL PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES users(id),
  cleaner_id  UUID NOT NULL REFERENCES users(id),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_client ON favorite_cleaners (client_id);

-- ============================================
-- 1.5 TEAMS & HELPERS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_teams (
  id              SERIAL PRIMARY KEY,
  owner_cleaner_id UUID NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  description     TEXT,
  max_members     INT NOT NULL DEFAULT 5,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON cleaner_teams (owner_cleaner_id);

CREATE TABLE IF NOT EXISTS team_members (
  id          SERIAL PRIMARY KEY,
  team_id     INT NOT NULL REFERENCES cleaner_teams(id) ON DELETE CASCADE,
  cleaner_id  UUID NOT NULL REFERENCES users(id),
  role        TEXT NOT NULL DEFAULT 'member', -- 'owner', 'lead', 'member'
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending, active, inactive
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, cleaner_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members (team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_cleaner ON team_members (cleaner_id);

-- Add team_id to jobs for team assignments
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS team_id INT REFERENCES cleaner_teams(id);

-- ============================================
-- 1.6 CLEANER GOALS
-- ============================================

CREATE TABLE IF NOT EXISTS cleaner_goals (
  id           SERIAL PRIMARY KEY,
  cleaner_id   UUID NOT NULL REFERENCES users(id),
  goal_type    TEXT NOT NULL DEFAULT 'jobs', -- jobs, earnings, rating
  month        DATE NOT NULL,
  target_value INT NOT NULL,
  current_value INT NOT NULL DEFAULT 0,
  reward_credits INT NOT NULL,
  is_awarded   BOOLEAN NOT NULL DEFAULT FALSE,
  awarded_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cleaner_id, goal_type, month)
);

CREATE INDEX IF NOT EXISTS idx_goals_cleaner ON cleaner_goals (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_goals_month ON cleaner_goals (month);

-- ============================================
-- 1.7 CALENDAR CONNECTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_connections (
  id            SERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES users(id),
  provider      TEXT NOT NULL,       -- 'google', 'apple', 'outlook'
  external_id   TEXT NOT NULL,       -- Google calendar id
  email         TEXT,                -- Connected account email
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  sync_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_connections (user_id);

-- Calendar events synced
CREATE TABLE IF NOT EXISTS calendar_events (
  id              SERIAL PRIMARY KEY,
  connection_id   INT NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  job_id          UUID REFERENCES jobs(id) ON DELETE SET NULL,
  external_event_id TEXT NOT NULL,
  event_type      TEXT NOT NULL DEFAULT 'job', -- job, reminder, block
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (connection_id, external_event_id)
);

-- ============================================
-- 1.8 FEATURE FLAGS (Enhanced)
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id          SERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,     -- e.g. "subscriptions.enabled.sacramento"
  description TEXT,
  is_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Targeting rules
  target_type TEXT,                     -- null (global), 'user', 'city', 'role'
  target_ids  TEXT[],                   -- specific IDs if targeted
  percentage  INT DEFAULT 100,          -- rollout percentage
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 1.9 USER ENHANCEMENTS
-- ============================================

-- Add referral_code to users if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- ============================================
-- 1.10 QUEUE TABLE (Simple DB-backed queue)
-- ============================================

CREATE TABLE IF NOT EXISTS job_queue (
  id              SERIAL PRIMARY KEY,
  queue_name      TEXT NOT NULL,        -- 'calendar_sync', 'ai_checklist', 'weekly_report'
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  priority        INT NOT NULL DEFAULT 0,
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 3,
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_pending ON job_queue (queue_name, status, scheduled_at) 
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_queue_name ON job_queue (queue_name);

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER trg_properties_updated_at
BEFORE UPDATE ON properties
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_calendar_connections_updated_at
BEFORE UPDATE ON calendar_connections
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_feature_flags_updated_at
BEFORE UPDATE ON feature_flags
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

CREATE TRIGGER trg_cleaner_teams_updated_at
BEFORE UPDATE ON cleaner_teams
FOR EACH ROW EXECUTE PROCEDURE set_updated_at_timestamp();

-- ============================================
-- SEED DATA
-- ============================================

-- Insert Sacramento as first city
INSERT INTO cities (name, country_code, state_region, timezone)
VALUES ('Sacramento', 'US', 'CA', 'America/Los_Angeles')
ON CONFLICT DO NOTHING;

-- Insert some feature flags
INSERT INTO feature_flags (key, description, is_enabled) VALUES
  ('subscriptions.enabled', 'Enable subscription cleanings', true),
  ('calendar_sync.enabled', 'Enable calendar sync feature', true),
  ('ai_features.enabled', 'Enable AI-powered features', true),
  ('teams.enabled', 'Enable cleaner teams', true),
  ('goals.enabled', 'Enable cleaner goals', true)
ON CONFLICT (key) DO NOTHING;

-- Comments
COMMENT ON TABLE cities IS 'Cities where PureTask operates';
COMMENT ON TABLE platform_service_areas IS 'Service areas within cities with pricing multipliers';
COMMENT ON TABLE properties IS 'Client properties for multi-location support';
COMMENT ON TABLE favorite_cleaners IS 'Client saved favorite cleaners';
COMMENT ON TABLE cleaner_teams IS 'Teams of cleaners working together';
COMMENT ON TABLE cleaner_goals IS 'Monthly goals for cleaners with credit rewards';
COMMENT ON TABLE calendar_connections IS 'OAuth connections to external calendars';
COMMENT ON TABLE feature_flags IS 'Feature flag system for gradual rollouts';
COMMENT ON TABLE job_queue IS 'Simple database-backed job queue';

