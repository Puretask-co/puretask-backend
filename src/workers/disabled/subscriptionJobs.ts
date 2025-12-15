// src/workers/subscriptionJobs.ts
// Worker to create jobs from cleaning subscriptions
//
// Run daily: node dist/workers/subscriptionJobs.js

import { pool, query } from "../../db/client";
import { logger } from "../../lib/logger";
import {
  getSubscriptionsDueForJobCreation,
  markSubscriptionJobCreated,
} from "../../services/premiumService";
import { createJob } from "../../services/jobsService";

/**
 * Main worker function
 */
async function main(): Promise<void> {
  logger.info("subscription_jobs_worker_started");

  try {
    const subscriptions = await getSubscriptionsDueForJobCreation();
    logger.info("subscriptions_to_process", { count: subscriptions.length });

    let created = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        // Calculate scheduled times based on subscription settings
        const scheduledStart = new Date(sub.next_job_date!);
        if (sub.preferred_time) {
          const [hours, minutes] = sub.preferred_time.split(":").map(Number);
          scheduledStart.setHours(hours, minutes, 0, 0);
        } else {
          scheduledStart.setHours(9, 0, 0, 0); // Default 9 AM
        }

        const scheduledEnd = new Date(scheduledStart);
        scheduledEnd.setHours(scheduledEnd.getHours() + 3); // Default 3 hour job

        // Create the job
        const job = await createJob({
          clientId: sub.client_id,
          scheduledStartAt: scheduledStart.toISOString(),
          scheduledEndAt: scheduledEnd.toISOString(),
          address: sub.address,
          latitude: sub.latitude ?? undefined,
          longitude: sub.longitude ?? undefined,
          creditAmount: sub.credit_amount,
        });

        // Assign preferred cleaner if set
        if (sub.cleaner_id) {
          await query(
            `UPDATE jobs SET cleaner_id = $2, status = 'accepted', updated_at = NOW() WHERE id = $1`,
            [job.id, sub.cleaner_id]
          );
        }

        // Mark subscription job as created
        await markSubscriptionJobCreated(sub.id, job.id);

        created++;
        logger.info("subscription_job_created", {
          subscriptionId: sub.id,
          jobId: job.id,
          scheduledStart: scheduledStart.toISOString(),
        });
      } catch (err) {
        failed++;
        logger.error("subscription_job_creation_failed", {
          subscriptionId: sub.id,
          error: (err as Error).message,
        });
      }
    }

    logger.info("subscription_jobs_worker_completed", { created, failed });
  } catch (error) {
    logger.error("subscription_jobs_worker_failed", {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    throw error;
  } finally {
    await pool.end();
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

export { main as runSubscriptionJobs };

