-- Migration 053: Badge System (Step 14)
-- Badge definitions, earned badges, achievement feed.
-- Uses TEXT for cleaner_id to match users.id; see DB/neon/ for UUID variant.

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

CREATE UNIQUE INDEX IF NOT EXISTS uq_cleaner_badge_once
  ON cleaner_badges (cleaner_id, badge_id);

CREATE INDEX IF NOT EXISTS idx_cleaner_badges_cleaner_time
  ON cleaner_badges (cleaner_id, earned_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_feed_cleaner_time
  ON cleaner_achievement_feed (cleaner_id, created_at DESC);

-- Seed core badges (aligns with Metrics Contract: jobs.completed.count, ratings.five_star.count)
INSERT INTO badge_definitions (id, name, description, category, icon_key, is_profile_visible, sort_order, trigger)
VALUES
  ('badge_first_job', 'First Job Completed', 'Completed your first job on PureTask.', 'core', 'first_job', true, 10, '{"type":"metric","metric":"jobs.completed.count","op":">=","target":1}'::jsonb),
  ('badge_first_5star', 'First 5-Star Rating', 'Received your first 5-star rating.', 'core', 'star', true, 20, '{"type":"metric","metric":"ratings.five_star.count","op":">=","target":1}'::jsonb),
  ('badge_jobs_50', '50 Jobs Completed', 'Completed 50 jobs.', 'core', 'jobs_50', true, 90, '{"type":"metric","metric":"jobs.completed.count","op":">=","target":50}'::jsonb),
  ('badge_jobs_100', '100 Jobs Completed', 'Completed 100 jobs.', 'core', 'jobs_100', true, 100, '{"type":"metric","metric":"jobs.completed.count","op":">=","target":100}'::jsonb),
  ('badge_25_five_star', '25 Five-Star Club', 'Earned 25 five-star ratings.', 'core', 'stars_25', true, 70, '{"type":"metric","metric":"ratings.five_star.count","op":">=","target":25}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon_key = EXCLUDED.icon_key,
  is_profile_visible = EXCLUDED.is_profile_visible,
  sort_order = EXCLUDED.sort_order,
  trigger = EXCLUDED.trigger,
  updated_at = now();

SELECT 'Migration 053 Completed' AS status;
