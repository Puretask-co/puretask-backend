// src/workers/goalChecker.ts
// Check and award completed cleaner goals
//
// Run nightly: node dist/workers/goalChecker.js

import { pool, query } from "../../db/client";
import { logger } from "../../lib/logger";
import { updateGoalProgress, createDefaultMonthlyGoals } from "../../services/cleanerGoalsService";

async function main(): Promise<void> {
  logger.info("goal_checker_worker_started");

  try {
    // Get all active cleaners
    const cleanersResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'cleaner'`
    );

    let goalsCreated = 0;
    let goalsUpdated = 0;
    let goalsAwarded = 0;

    const currentMonth = new Date().toISOString().slice(0, 7) + "-01";

    for (const cleaner of cleanersResult.rows) {
      try {
        // Ensure cleaner has goals for current month
        const existingGoals = await query(
          `SELECT id FROM cleaner_goals WHERE cleaner_id = $1 AND month = $2::date`,
          [cleaner.id, currentMonth]
        );

        if (existingGoals.rows.length === 0) {
          await createDefaultMonthlyGoals(cleaner.id);
          goalsCreated++;
        }

        // Update progress
        await updateGoalProgress(cleaner.id);
        goalsUpdated++;

        // Check for awarded goals
        const awardedResult = await query<{ count: string }>(
          `
            SELECT COUNT(*)::text as count 
            FROM cleaner_goals 
            WHERE cleaner_id = $1 AND month = $2::date AND is_awarded = true
          `,
          [cleaner.id, currentMonth]
        );
        goalsAwarded += Number(awardedResult.rows[0]?.count || 0);
      } catch (err) {
        logger.error("goal_check_cleaner_failed", {
          cleanerId: cleaner.id,
          error: (err as Error).message,
        });
      }
    }

    logger.info("goal_checker_worker_completed", {
      cleanersProcessed: cleanersResult.rows.length,
      goalsCreated,
      goalsUpdated,
      goalsAwarded,
    });
  } catch (error) {
    logger.error("goal_checker_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log("Goal checker worker completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Goal checker worker failed:", error);
      process.exit(1);
    });
}

export { main as runGoalChecker };

