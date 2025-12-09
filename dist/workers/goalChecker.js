"use strict";
// src/workers/goalChecker.ts
// Check and award completed cleaner goals
//
// Run nightly: node dist/workers/goalChecker.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGoalChecker = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const cleanerGoalsService_1 = require("../services/cleanerGoalsService");
async function main() {
    logger_1.logger.info("goal_checker_worker_started");
    try {
        // Get all active cleaners
        const cleanersResult = await (0, client_1.query)(`SELECT id FROM users WHERE role = 'cleaner'`);
        let goalsCreated = 0;
        let goalsUpdated = 0;
        let goalsAwarded = 0;
        const currentMonth = new Date().toISOString().slice(0, 7) + "-01";
        for (const cleaner of cleanersResult.rows) {
            try {
                // Ensure cleaner has goals for current month
                const existingGoals = await (0, client_1.query)(`SELECT id FROM cleaner_goals WHERE cleaner_id = $1 AND month = $2::date`, [cleaner.id, currentMonth]);
                if (existingGoals.rows.length === 0) {
                    await (0, cleanerGoalsService_1.createDefaultMonthlyGoals)(cleaner.id);
                    goalsCreated++;
                }
                // Update progress
                await (0, cleanerGoalsService_1.updateGoalProgress)(cleaner.id);
                goalsUpdated++;
                // Check for awarded goals
                const awardedResult = await (0, client_1.query)(`
            SELECT COUNT(*)::text as count 
            FROM cleaner_goals 
            WHERE cleaner_id = $1 AND month = $2::date AND is_awarded = true
          `, [cleaner.id, currentMonth]);
                goalsAwarded += Number(awardedResult.rows[0]?.count || 0);
            }
            catch (err) {
                logger_1.logger.error("goal_check_cleaner_failed", {
                    cleanerId: cleaner.id,
                    error: err.message,
                });
            }
        }
        logger_1.logger.info("goal_checker_worker_completed", {
            cleanersProcessed: cleanersResult.rows.length,
            goalsCreated,
            goalsUpdated,
            goalsAwarded,
        });
    }
    catch (error) {
        logger_1.logger.error("goal_checker_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
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
