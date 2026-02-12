-- Migration 048: Gamification reward grants & choice eligibilities (Step 6)
-- Adds: gamification_reward_grants, gamification_choice_eligibilities, cleaner_goal_progress
-- Uses TEXT for cleaner_id to match users.id; see DB/neon/ for UUID variant

-- 0) Goal progress cache (engine-computed progress per goal)
CREATE TABLE IF NOT EXISTS cleaner_goal_progress (
  cleaner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL,
  current_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress_ratio NUMERIC(5,4) NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cleaner_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_cleaner_goal_progress_cleaner
  ON cleaner_goal_progress (cleaner_id);

-- 1) Reward grants (source-of-truth for active + historical rewards from engine)
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

CREATE INDEX IF NOT EXISTS idx_gamification_reward_grants_cleaner_time
  ON gamification_reward_grants (cleaner_id, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_gamification_reward_grants_reward
  ON gamification_reward_grants (reward_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_gamification_reward_grants_permanent_once
  ON gamification_reward_grants (cleaner_id, reward_id)
  WHERE ends_at IS NULL AND status = 'active';

-- 2) Choice reward eligibility + selection
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

CREATE INDEX IF NOT EXISTS idx_gamification_choice_elig_cleaner_status
  ON gamification_choice_eligibilities (cleaner_id, status, earned_at DESC);

-- 3) Helper view: active rewards
CREATE OR REPLACE VIEW gamification_active_rewards AS
SELECT *
FROM gamification_reward_grants
WHERE status = 'active'
  AND (ends_at IS NULL OR ends_at > now());

COMMENT ON TABLE gamification_reward_grants IS 'Reward grants from gamification engine (goal/level/admin)';
COMMENT ON TABLE gamification_choice_eligibilities IS 'Choice reward eligibility: cleaner picks one from group';

SELECT 'Migration 048 Completed' AS status;
