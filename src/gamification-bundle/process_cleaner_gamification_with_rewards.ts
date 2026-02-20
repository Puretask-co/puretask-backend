import { ProgressionService } from "../services/progression_service";
import { RewardGrantService } from "../services/reward_grant_service";
import { withClient } from "../db/client";

/**
 * Worker: recompute, persist, level up, and grant rewards.
 * Idempotent reward granting.
 */
export async function processCleanerGamification(cleaner_id: string) {
  const service = new ProgressionService();
  const rewardService = new RewardGrantService();

  // First: expire time-based items (cheap, safe)
  await rewardService.expireRewards();
  await rewardService.expireChoices();

  await withClient(async (client) => {
    const { rows: lvlRows } = await client.query(
      `SELECT current_level FROM cleaner_level_status WHERE cleaner_id=$1`,
      [cleaner_id]
    );
    const current_level = lvlRows?.[0]?.current_level ?? 1;

    const { levelEval, goalProgress } = await service.getCleanerProgression(cleaner_id, current_level);

    // Persist goal progress
    for (const gp of goalProgress) {
      await client.query(
        `INSERT INTO cleaner_goal_progress (cleaner_id, goal_id, current_value, progress_ratio, completed, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now())
         ON CONFLICT (cleaner_id, goal_id)
         DO UPDATE SET current_value=EXCLUDED.current_value, progress_ratio=EXCLUDED.progress_ratio, completed=EXCLUDED.completed, updated_at=now()`,
        [cleaner_id, gp.goal_id, JSON.stringify({ value: gp.current_value, remaining: gp.remaining }), gp.progress_ratio, gp.complete]
      );
    }

    // Persist pause status
    await client.query(
      `INSERT INTO cleaner_level_status (cleaner_id, current_level, paused, pause_reasons, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now())
       ON CONFLICT (cleaner_id)
       DO UPDATE SET paused=EXCLUDED.paused, pause_reasons=EXCLUDED.pause_reasons, updated_at=now()`,
      [cleaner_id, current_level, levelEval.paused, JSON.stringify(levelEval.pause_reasons)]
    );

    // Level-up
    if (levelEval.eligible_for_level > current_level) {
      await client.query(
        `UPDATE cleaner_level_status SET current_level=$1, updated_at=now() WHERE cleaner_id=$2`,
        [levelEval.eligible_for_level, cleaner_id]
      );
    }

    // Determine newly completed goals: compare persisted state in DB
    const { rows: completedRows } = await client.query(
      `SELECT goal_id FROM cleaner_goal_progress WHERE cleaner_id=$1 AND completed=true`,
      [cleaner_id]
    );
    const completed_goal_ids = (completedRows ?? []).map((r:any)=>String(r.goal_id));

    // Grant rewards (idempotent)
    await rewardService.grantForCompletedGoals(cleaner_id, completed_goal_ids);
  });
}
