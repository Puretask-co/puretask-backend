-- Migration 055: Ops / Support diagnostic views (Step 17)
-- For quick gamification diagnosis by support/admin.

-- Quick snapshot by cleaner (from cleaner_level_progress)
CREATE OR REPLACE VIEW ops_cleaner_gamification_snapshot AS
SELECT
  clp.cleaner_id,
  clp.current_level AS level,
  clp.maintenance_paused AS paused,
  CASE
    WHEN clp.maintenance_paused_reason IS NOT NULL AND trim(clp.maintenance_paused_reason) <> ''
    THEN regexp_split_to_array(trim(clp.maintenance_paused_reason), $$\s*;\s*$$)
    ELSE ARRAY[]::text[]
  END AS pause_reasons,
  clp.updated_at
FROM cleaner_level_progress clp;

-- Goals completion counts by cleaner
CREATE OR REPLACE VIEW ops_cleaner_goal_counts AS
SELECT
  cleaner_id,
  COUNT(*) FILTER (WHERE completed = true) AS goals_complete_total,
  COUNT(*) FILTER (WHERE completed = false) AS goals_in_progress_total,
  COUNT(*) AS goals_total
FROM cleaner_goal_progress
GROUP BY cleaner_id;

-- Active rewards summary per cleaner
CREATE OR REPLACE VIEW ops_cleaner_active_rewards_summary AS
SELECT
  car.cleaner_id,
  array_agg(car.reward_id ORDER BY car.reward_id) AS active_reward_ids,
  COUNT(*) AS active_reward_count
FROM gamification_cleaner_active_rewards car
GROUP BY car.cleaner_id;

SELECT 'Migration 055 Completed' AS status;
