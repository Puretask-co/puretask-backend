-- Step 8 — Reward granting + choice rewards idempotency (v1.4)
-- Requires Step 6 tables (gamification_reward_grants, gamification_choice_eligibilities).
BEGIN;

-- Idempotency: prevent duplicate grants for same cleaner+reward+source
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_source
  ON gamification_reward_grants (cleaner_id, reward_id, source_type, source_id);

-- Ensure only one open choice eligibility per goal (per cleaner)
CREATE UNIQUE INDEX IF NOT EXISTS uq_choice_open_per_goal
  ON gamification_choice_eligibilities (cleaner_id, source_goal_id)
  WHERE status='open';

-- Auto-expire choices that are too old (configurable); use a column for TTL
ALTER TABLE gamification_choice_eligibilities
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_choice_expires
  ON gamification_choice_eligibilities (status, expires_at);

COMMIT;
