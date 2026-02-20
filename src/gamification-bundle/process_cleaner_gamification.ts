import { ProgressionService } from "../services/progression_service";
import { withClient } from "../db/client";

/**
 * Worker blueprint: recompute and persist progress.
 * Trigger: after relevant events OR cron.
 */
export async function processCleanerGamification(cleaner_id: string) {
  const service = new ProgressionService();

  await withClient(async (client) => {
    const { rows: lvlRows } = await client.query(
      `SELECT current_level FROM cleaner_level_status WHERE cleaner_id=$1`,
      [cleaner_id]
    );
    const current_level = lvlRows?.[0]?.current_level ?? 1;

    const { levelEval, goalProgress } = await service.getCleanerProgression(cleaner_id, current_level);

    for (const gp of goalProgress) {
      await client.query(
        `INSERT INTO cleaner_goal_progress (cleaner_id, goal_id, current_value, progress_ratio, completed, updated_at)
         VALUES ($1, $2, $3::jsonb, $4, $5, now())
         ON CONFLICT (cleaner_id, goal_id)
         DO UPDATE SET current_value=EXCLUDED.current_value, progress_ratio=EXCLUDED.progress_ratio, completed=EXCLUDED.completed, updated_at=now()`,
        [cleaner_id, gp.goal_id, JSON.stringify({ value: gp.current_value, remaining: gp.remaining }), gp.progress_ratio, gp.complete]
      );
    }

    await client.query(
      `INSERT INTO cleaner_level_status (cleaner_id, current_level, paused, pause_reasons, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now())
       ON CONFLICT (cleaner_id)
       DO UPDATE SET paused=EXCLUDED.paused, pause_reasons=EXCLUDED.pause_reasons, updated_at=now()`,
      [cleaner_id, current_level, levelEval.paused, JSON.stringify(levelEval.pause_reasons)]
    );

    if (levelEval.eligible_for_level > current_level) {
      await client.query(`UPDATE cleaner_level_status SET current_level=$1, updated_at=now() WHERE cleaner_id=$2`,
        [levelEval.eligible_for_level, cleaner_id]
      );
    }
  });
}
