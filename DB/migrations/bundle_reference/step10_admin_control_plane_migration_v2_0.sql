-- Step 10 — Admin Control Plane + Governor + A/B toggles + Audit/Rollback (v2.0)
-- Provides a build-ready admin tuning surface while keeping runtime configs safe.

BEGIN;

-- 1) Admin users + roles (if you already have this, adapt)
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','ops','support','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz NULL
);

-- 2) Feature flags / A/B toggles by region (JSON for flexibility)
CREATE TABLE IF NOT EXISTS admin_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  region_id text NULL, -- null=global
  enabled boolean NOT NULL DEFAULT true,
  variant text NULL, -- e.g. 'A','B'
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  effective_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup
  ON admin_feature_flags (key, region_id, enabled, effective_at DESC);

-- 3) Reward budget caps + emergency switches
CREATE TABLE IF NOT EXISTS admin_reward_budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global','region')),
  region_id text NULL,
  cash_cap_daily_cents integer NOT NULL DEFAULT 0,
  cash_cap_monthly_cents integer NOT NULL DEFAULT 0,
  cash_rewards_enabled boolean NOT NULL DEFAULT true,
  emergency_disable_all_rewards boolean NOT NULL DEFAULT false,
  updated_by uuid NULL REFERENCES admin_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_budget_scope
  ON admin_reward_budget (scope, COALESCE(region_id,'__global__'));

-- 4) Config versions for goals/rewards/governor (store canonical JSON snapshots)
-- This supports effective_at, auditing, rollback, and safe deployment.
CREATE TABLE IF NOT EXISTS admin_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_type text NOT NULL CHECK (config_type IN ('goals','rewards','governor','levels','full_bundle')),
  version integer NOT NULL,
  region_id text NULL, -- null=global
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','draft')),
  effective_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL,
  change_summary text NOT NULL DEFAULT '',
  created_by uuid NULL REFERENCES admin_users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_config_versions_version
  ON admin_config_versions (config_type, version, COALESCE(region_id,'__global__'));

CREATE INDEX IF NOT EXISTS idx_config_versions_active
  ON admin_config_versions (config_type, region_id, status, effective_at DESC);

-- 5) Audit log (immutable append-only)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_user_id uuid NULL REFERENCES admin_users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NULL,
  before jsonb NULL,
  after jsonb NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_time
  ON admin_audit_log (created_at DESC);

-- 6) Governor config (if not already created in earlier steps)
CREATE TABLE IF NOT EXISTS region_governor_config (
  region_id text PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid NULL REFERENCES admin_users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
