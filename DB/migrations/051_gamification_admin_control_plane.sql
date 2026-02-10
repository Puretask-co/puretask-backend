-- Migration 051: Gamification Admin Control Plane (Step 10)
-- Feature flags, reward budget, config versions, audit log, region governor

-- 1) Feature flags / A/B toggles by region
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

CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup
  ON admin_feature_flags (key, region_id, enabled, effective_at DESC);

-- 2) Reward budget caps + emergency switches (region_id='__global__' for global scope)
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

-- 3) Config versions for goals/rewards/governor (versioned JSON snapshots)
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_config_versions_version
  ON admin_config_versions (config_type, version, COALESCE(region_id,'__global__'));

CREATE INDEX IF NOT EXISTS idx_config_versions_active
  ON admin_config_versions (config_type, region_id, status, effective_at DESC);

-- 4) Audit log (immutable append-only)
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

CREATE INDEX IF NOT EXISTS idx_audit_log_time
  ON admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON admin_audit_log (entity_type, entity_id);

-- 5) Region governor config (if not exists from earlier)
CREATE TABLE IF NOT EXISTS region_governor_config (
  region_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT NULL REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

SELECT 'Migration 051 Completed' AS status;
