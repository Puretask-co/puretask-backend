-- PureTask Gamification — Step 6 Persistence & API tables (v1.3)
-- Adds reward grants table, choice eligibility table, season rules, and helper view.
-- Run after puretask_gamification_migrations.sql (v1.0) + event_tables_migration_v1.sql.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS gamification_reward_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL,
  reward_id text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NULL,
  uses_remaining integer NULL,
  source_type text NOT NULL CHECK (source_type IN ('goal','level','admin')),
  source_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reward_grants_cleaner_time
  ON gamification_reward_grants (cleaner_id, granted_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_permanent_once
  ON gamification_reward_grants (cleaner_id, reward_id)
  WHERE ends_at IS NULL AND status='active';

CREATE TABLE IF NOT EXISTS gamification_choice_eligibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL,
  choice_group_id text NOT NULL,
  source_goal_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  selected_reward_id text NULL,
  selected_at timestamptz NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','selected','expired','revoked')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_choice_elig_cleaner_status
  ON gamification_choice_eligibilities (cleaner_id, status, earned_at DESC);

CREATE TABLE IF NOT EXISTS gamification_season_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season_rules_active
  ON gamification_season_rules (enabled, start_at, end_at);

CREATE OR REPLACE VIEW gamification_active_rewards AS
SELECT *
FROM gamification_reward_grants
WHERE status='active'
  AND (ends_at IS NULL OR ends_at > now());

COMMIT;
