"use strict";
// src/workers/subscriptionJobs.ts
// Worker to create jobs from cleaning subscriptions
//
// Run daily: node dist/workers/subscriptionJobs.js
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSubscriptionJobs = main;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const premiumService_1 = require("../services/premiumService");
const jobsService_1 = require("../services/jobsService");
/**
 * Main worker function
 */
async function main() {
    logger_1.logger.info("subscription_jobs_worker_started");
    try {
        const subscriptions = await (0, premiumService_1.getSubscriptionsDueForJobCreation)();
        logger_1.logger.info("subscriptions_to_process", { count: subscriptions.length });
        let created = 0;
        let failed = 0;
        for (const sub of subscriptions) {
            try {
                // Calculate scheduled times based on subscription settings
                const scheduledStart = new Date(sub.next_job_date);
                if (sub.preferred_time) {
                    const [hours, minutes] = sub.preferred_time.split(":").map(Number);
                    scheduledStart.setHours(hours, minutes, 0, 0);
                }
                else {
                    scheduledStart.setHours(9, 0, 0, 0); // Default 9 AM
                }
                const scheduledEnd = new Date(scheduledStart);
                scheduledEnd.setHours(scheduledEnd.getHours() + 3); // Default 3 hour job
                // Create the job
                const job = await (0, jobsService_1.createJob)(sub.client_id, {
                    scheduled_start_at: scheduledStart.toISOString(),
                    scheduled_end_at: scheduledEnd.toISOString(),
                    address: sub.address,
                    latitude: sub.latitude ?? undefined,
                    longitude: sub.longitude ?? undefined,
                    credit_amount: sub.credit_amount,
                });
                // Assign preferred cleaner if set
                if (sub.cleaner_id) {
                    await (0, client_1.query)(`UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`, [job.id, sub.cleaner_id]);
                }
                // Mark subscription job as created
                await (0, premiumService_1.markSubscriptionJobCreated)(sub.id, job.id);
                created++;
                logger_1.logger.info("subscription_job_created", {
                    subscriptionId: sub.id,
                    jobId: job.id,
                    scheduledStart: scheduledStart.toISOString(),
                });
            }
            catch (err) {
                failed++;
                logger_1.logger.error("subscription_job_creation_failed", {
                    subscriptionId: sub.id,
                    error: err.message,
                });
            }
        }
        logger_1.logger.info("subscription_jobs_worker_completed", { created, failed });
    }
    catch (error) {
        logger_1.logger.error("subscription_jobs_worker_failed", {
            error: error.message,
            stack: error.stack,
        });
        throw error;
    }
    finally {
        await client_1.pool.end();
    }
}
// Run if executed directly
if (require.main === module) {
    main()
        .then(() => {
        console.log("Subscription jobs worker completed");
        process.exit(0);
    })
        .catch((error) => {
        console.error("Subscription jobs worker failed:", error);
        process.exit(1);
    });
}
