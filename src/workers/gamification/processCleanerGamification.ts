/**
 * PureTask Gamification — Process Cleaner Gamification Worker
 * Recomputes progression, updates level status, grants rewards.
 * Trigger: after job completion, rating, event ingestion, or cron.
 */

import { withTransaction } from "../../db/client";
import type { PoolClient } from "pg";
import { isGamificationEnabled } from "../../lib/gamificationFeatureFlags";
import { getCleanerProgression } from "../../services/gamificationProgressionService";
import {
  expireRewards,
  expireChoices,
  grantRewardsForGoal,
} from "../../services/gamificationRewardService";
import { BadgeService } from "../../services/badgeService";
import { logger } from "../../lib/logger";

const badgeService = new BadgeService();

/**
 * Process gamification for a cleaner: recompute progress, update level, grant rewards
 */
export async function processCleanerGamification(cleanerId: string): Promise<void> {
  const startMs = Date.now();
  if (!(await isGamificationEnabled({ region_id: null }))) {
    logger.debug("gamification_skipped_disabled", { cleanerId });
    return;
  }
  logger.info("gamification_worker_run", { cleanerId });

  // Step 8: Expire time-based rewards and choices (idempotent, safe to run before each process)
  await expireRewards();
  await expireChoices();

  await withTransaction(async (client: PoolClient) => {
    const levelRow = await client.query<{ current_level: number }>(
      `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (levelRow.rows.length === 0) {
      await client.query(
        `INSERT INTO cleaner_level_progress (cleaner_id, current_level)
         VALUES ($1, 1)
         ON CONFLICT (cleaner_id) DO NOTHING`,
        [cleanerId]
      );
      return;
    }

    const currentLevel = levelRow.rows[0].current_level;
    const { levelEval, goalProgress } = await getCleanerProgression(cleanerId, currentLevel);

    for (const gp of goalProgress) {
      await client.query(
        `INSERT INTO cleaner_goal_progress (cleaner_id, goal_id, current_value, progress_ratio, completed, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now())
         ON CONFLICT (cleaner_id, goal_id)
         DO UPDATE SET current_value = EXCLUDED.current_value, progress_ratio = EXCLUDED.progress_ratio, completed = EXCLUDED.completed, updated_at = now()`,
        [
          cleanerId,
          gp.goal_id,
          JSON.stringify({ value: gp.current_value, remaining: gp.remaining }),
          gp.progress_ratio,
          gp.complete,
        ]
      );
    }

    await client.query(
      `UPDATE cleaner_level_progress
       SET maintenance_paused = $2, maintenance_paused_reason = $3, updated_at = now()
       WHERE cleaner_id = $1`,
      [
        cleanerId,
        levelEval.paused,
        levelEval.pause_reasons.length > 0 ? levelEval.pause_reasons.join("; ") : null,
      ]
    );

    if (levelEval.eligible_for_level > currentLevel) {
      await client.query(
        `UPDATE cleaner_level_progress
         SET current_level = $2, level_reached_at = now(), updated_at = now()
         WHERE cleaner_id = $1`,
        [cleanerId, levelEval.eligible_for_level]
      );
      logger.info("cleaner_level_up", {
        cleanerId,
        fromLevel: currentLevel,
        toLevel: levelEval.eligible_for_level,
      });
    }

    for (const gp of goalProgress.filter((g) => g.complete && g.goal_id)) {
      await grantRewardsForGoal(client, cleanerId, gp.goal_id);
    }

    // Step 14: Award eligible badges from metric snapshot
    try {
      const metricSnapshot = await badgeService.buildMetricSnapshot(cleanerId);
      const { newly_awarded } = await badgeService.awardEligibleBadges({
        cleaner_id: cleanerId,
        metric_snapshot: metricSnapshot,
      });
      if (newly_awarded.length > 0) {
        logger.info("gamification_badges_awarded", { cleanerId, newly_awarded });
      }
    } catch (err) {
      logger.warn("gamification_badge_award_failed", { cleanerId, error: (err as Error).message });
    }
  });

  const durationMs = Date.now() - startMs;
  logger.info("gamification_worker_complete", { cleanerId, durationMs });
}
