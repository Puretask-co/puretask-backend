-- Step 9 — Active Reward Effects + Ranking Enforcement (v1.5)
BEGIN;

CREATE OR REPLACE VIEW gamification_active_reward_grants AS
SELECT *
FROM gamification_reward_grants
WHERE status='active'
  AND (ends_at IS NULL OR ends_at > now());

CREATE OR REPLACE VIEW gamification_cleaner_active_rewards AS
SELECT cleaner_id,
       reward_id,
       granted_at,
       ends_at,
       uses_remaining,
       meta
FROM gamification_active_reward_grants;

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
  WHERE id=grant_id AND status='active';
END;
$$;

COMMIT;
