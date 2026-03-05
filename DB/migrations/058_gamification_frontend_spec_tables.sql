-- Migration 058: Gamification frontend spec tables (GAMIFICATION_FRONTEND_BACKEND_SPEC.md)
-- Adds: gamification_goals (admin library), gamification_rewards (admin library),
--       gamification_choice_groups, cleaner_reward_pause, abuse_signals.
-- Flags and governor use existing admin_feature_flags / region_governor_* with API mapping.

-- 1) Goals library (admin CRUD; doc shape)
CREATE TABLE IF NOT EXISTS gamification_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL CHECK (level >= 1 AND level <= 10),
  type TEXT NOT NULL CHECK (type IN ('core', 'stretch', 'maintenance')),
  metric_key TEXT,
  operator TEXT,
  target NUMERIC NULL,
  target_display TEXT NULL,
  window TEXT,
  filters JSONB NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  effective_at TIMESTAMPTZ NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_goals_level ON gamification_goals (level);
CREATE INDEX IF NOT EXISTS idx_gamification_goals_type ON gamification_goals (type);
CREATE INDEX IF NOT EXISTS idx_gamification_goals_enabled ON gamification_goals (enabled);

-- 2) Rewards library (admin CRUD; doc shape)
CREATE TABLE IF NOT EXISTS gamification_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL,
  name TEXT,
  duration_days INTEGER NULL,
  usage_limit INTEGER NULL,
  stacking TEXT,
  permanent BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_rewards_kind ON gamification_rewards (kind);
CREATE INDEX IF NOT EXISTS idx_gamification_rewards_enabled ON gamification_rewards (enabled);

-- 3) Choice reward groups (admin CRUD; doc shape)
CREATE TABLE IF NOT EXISTS gamification_choice_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  reward_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  eligibility_window_days INTEGER NOT NULL DEFAULT 14,
  expires_at TIMESTAMPTZ NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gamification_choice_groups_enabled ON gamification_choice_groups (enabled);

-- 4) Pause rewards for a cleaner (abuse/support)
CREATE TABLE IF NOT EXISTS cleaner_reward_pause (
  cleaner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT,
  paused_until TIMESTAMPTZ NULL,
  admin_id TEXT NULL REFERENCES users(id) ON DELETE SET NULL
);

-- 5) Abuse/fraud signals (for admin list)
CREATE TABLE IF NOT EXISTS abuse_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('spam_messages', 'login_farming', 'photo_timestamp', 'decline_abuse')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  detail TEXT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_abuse_signals_cleaner ON abuse_signals (cleaner_id);
CREATE INDEX IF NOT EXISTS idx_abuse_signals_type ON abuse_signals (type);
CREATE INDEX IF NOT EXISTS idx_abuse_signals_detected ON abuse_signals (detected_at DESC);

-- 6) Governor region settings (doc shape) - optional flat columns for API
--    If region_governor_config.config already holds these, API can use JSON; otherwise add columns.
ALTER TABLE region_governor_config
  ADD COLUMN IF NOT EXISTS supply_score INTEGER NULL,
  ADD COLUMN IF NOT EXISTS demand_score INTEGER NULL,
  ADD COLUMN IF NOT EXISTS fill_time_hours NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS early_exposure_min INTEGER NULL,
  ADD COLUMN IF NOT EXISTS cap_multiplier NUMERIC NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT false;

SELECT 'Migration 058 Completed' AS status;
