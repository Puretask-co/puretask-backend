-- Migration 054: Seasonal Challenges Engine (Step 15)
-- Time-bounded multipliers + region targeting + auditability.
-- Uses TEXT for cleaner_id to match users.id; see DB/neon/ for UUID variant.

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

CREATE INDEX IF NOT EXISTS idx_season_rules_active_time
  ON season_rules (is_enabled, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS season_application_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id TEXT NOT NULL REFERENCES season_rules(id) ON DELETE CASCADE,
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  region_id TEXT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_season_app_cleaner_time
  ON season_application_log (cleaner_id, applied_at DESC);

-- Seed default seasons (optional)
INSERT INTO season_rules (id, name, description, starts_at, ends_at, is_enabled, regions, rule)
VALUES
  ('season_weekend_warrior_month', 'Weekend Warrior Month', 'Weekend jobs count double toward progress.', '2026-02-01T00:00:00Z', '2026-02-28T23:59:59Z', true, NULL, '{"multipliers":[{"metric_key":"jobs.completed.count","multiplier":2}],"ui":{"banner_copy":"Weekend Warrior: Weekend jobs count 2× this month"}}'::jsonb),
  ('season_spring_refresh', 'Spring Refresh', 'Deep cleans get a progress boost.', '2026-03-01T00:00:00Z', '2026-04-30T23:59:59Z', true, NULL, '{"multipliers":[{"metric_key":"jobs.completed.count","multiplier":1.5}],"ui":{"banner_copy":"Spring Refresh: Deep cleans count 1.5× toward progress"}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT 'Migration 054 Completed' AS status;
