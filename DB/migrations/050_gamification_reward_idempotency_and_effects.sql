-- Migration 050: Gamification Step 8+9 — Reward idempotency, choice TTL, effects views
-- Step 8: Idempotency indexes, choice expires_at
-- Step 9: Views for active effects, gamification_use_reward function

-- === Step 8: Idempotency ===
-- Prevent duplicate grants for same cleaner+reward+source
CREATE UNIQUE INDEX IF NOT EXISTS uq_reward_grants_source
  ON gamification_reward_grants (cleaner_id, reward_id, source_type, source_id);

-- Only one open choice eligibility per goal per cleaner
CREATE UNIQUE INDEX IF NOT EXISTS uq_choice_open_per_goal
  ON gamification_choice_eligibilities (cleaner_id, source_goal_id)
  WHERE status = 'open';

-- Choice TTL (auto-expire unclaimed choices)
ALTER TABLE gamification_choice_eligibilities
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_choice_expires
  ON gamification_choice_eligibilities (status, expires_at);

-- === Step 9: Active reward effects views ===
-- Alias for existing view (048 has gamification_active_rewards)
CREATE OR REPLACE VIEW gamification_active_reward_grants AS
SELECT *
FROM gamification_reward_grants
WHERE status = 'active'
  AND (ends_at IS NULL OR ends_at > now());

-- Flattened view for effect aggregation (cleaner_id, reward_id, meta)
CREATE OR REPLACE VIEW gamification_cleaner_active_rewards AS
SELECT cleaner_id,
       reward_id,
       granted_at,
       ends_at,
       uses_remaining,
       meta
FROM gamification_active_reward_grants;

-- Decrement uses_remaining; set status='expired' when uses run out
CREATE OR REPLACE FUNCTION gamification_use_reward(grant_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE gamification_reward_grants
  SET uses_remaining = CASE
      WHEN uses_remaining IS NULL THEN NULL
      WHEN uses_remaining <= 1 THEN 0
      ELSE uses_remaining - 1
    END,
    status = CASE
      WHEN uses_remaining IS NULL THEN status
      WHEN uses_remaining <= 1 THEN 'expired'
      ELSE status
    END
  WHERE id = grant_id AND status = 'active';
END;
$$;

SELECT 'Migration 050 Completed' AS status;
