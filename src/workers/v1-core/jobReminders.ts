// src/workers/v1-core/jobReminders.ts
// Worker to send job reminder notifications
// - 24h before: Email + Push to client
// - 2h before: SMS + Push to cleaner

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { sendNotificationToUser } from "../../services/notifications/notificationService";
import { buildClientJobUrl, buildCheckInUrl } from "../../lib/urlBuilder";

const BATCH_SIZE = 100;

interface JobForReminder {
  id: string;
  client_id: string;
  cleaner_id: string | null;
  status: string;
  scheduled_start_at: string;
  address: string;
  credit_amount: number;
}

/**
 * Find jobs that need 24h reminder (to client)
 * - Status is 'accepted' or 'on_my_way'
 * - scheduled_start_at is between 24-25 hours from now
 * - No reminder sent yet (tracked via job_events)
 */
async function findJobsFor24hReminder(): Promise<JobForReminder[]> {
  const result = await query<JobForReminder>(
    `
      SELECT j.id, j.client_id, j.cleaner_id, j.status, j.scheduled_start_at, j.address, j.credit_amount
      FROM jobs j
      LEFT JOIN job_events je ON je.job_id = j.id 
        AND je.event_type = 'job_reminder_24h_sent'
      WHERE j.status IN ('accepted', 'on_my_way')
        AND j.scheduled_start_at BETWEEN NOW() + INTERVAL '24 hours' AND NOW() + INTERVAL '25 hours'
        AND je.id IS NULL  -- No reminder sent yet
      ORDER BY j.scheduled_start_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Find jobs that need 2h reminder (to cleaner)
 * - Status is 'accepted' or 'on_my_way'
 * - scheduled_start_at is between 2-2.5 hours from now
 * - No reminder sent yet
 */
async function findJobsFor2hReminder(): Promise<JobForReminder[]> {
  const result = await query<JobForReminder>(
    `
      SELECT j.id, j.client_id, j.cleaner_id, j.status, j.scheduled_start_at, j.address, j.credit_amount
      FROM jobs j
      LEFT JOIN job_events je ON je.job_id = j.id 
        AND je.event_type = 'job_reminder_2h_sent'
      WHERE j.status IN ('accepted', 'on_my_way')
        AND j.cleaner_id IS NOT NULL
        AND j.scheduled_start_at BETWEEN NOW() + INTERVAL '2 hours' AND NOW() + INTERVAL '2.5 hours'
        AND je.id IS NULL  -- No reminder sent yet
      ORDER BY j.scheduled_start_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Send 24h reminder to client
 */
async function send24hReminder(job: JobForReminder): Promise<void> {
  const scheduledTime = new Date(job.scheduled_start_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(job.client_id, "job.reminder_24h", {
    jobId: job.id,
    address: job.address,
    scheduledTime,
    scheduledDate: new Date(job.scheduled_start_at).toLocaleDateString(),
    creditAmount: job.credit_amount,
    jobUrl,
    timeZoneLabel: "local time", // TODO: Get actual timezone from job
  }, ["email", "push"]);

  // Mark reminder as sent
  await query(
    `
      INSERT INTO job_events (job_id, event_type, actor_type, actor_id, payload)
      VALUES ($1, 'job_reminder_24h_sent', 'system', NULL, '{}'::jsonb)
    `,
    [job.id]
  );

  logger.info("job_reminder_24h_sent", {
    jobId: job.id,
    clientId: job.client_id,
    scheduledStartAt: job.scheduled_start_at,
  });
}

/**
 * Send 2h reminder to cleaner
 */
async function send2hReminder(job: JobForReminder): Promise<void> {
  if (!job.cleaner_id) return;

  const scheduledTime = new Date(job.scheduled_start_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const checkInUrl = buildCheckInUrl(job.id);

  await sendNotificationToUser(job.cleaner_id, "job.reminder_2h", {
    jobId: job.id,
    address: job.address,
    scheduledTime,
    creditAmount: job.credit_amount,
    checkInUrl,
    timeZoneLabel: "local time", // TODO: Get actual timezone from job
    // TODO: Generate shortUrl for SMS (when short link service is implemented)
  }, ["sms", "push"]);

  // Mark reminder as sent
  await query(
    `
      INSERT INTO job_events (job_id, event_type, actor_type, actor_id, payload)
      VALUES ($1, 'job_reminder_2h_sent', 'system', NULL, '{}'::jsonb)
    `,
    [job.id]
  );

  logger.info("job_reminder_2h_sent", {
    jobId: job.id,
    cleanerId: job.cleaner_id,
    scheduledStartAt: job.scheduled_start_at,
  });
}

/**
 * Main worker function
 */
export async function runJobRemindersWorker(): Promise<{
  reminders24h: number;
  reminders2h: number;
  failed: number;
}> {
  logger.info("job_reminders_worker_started");

  let reminders24h = 0;
  let reminders2h = 0;
  let failed = 0;

  try {
    // Send 24h reminders
    const jobs24h = await findJobsFor24hReminder();
    for (const job of jobs24h) {
      try {
        await send24hReminder(job);
        reminders24h++;
      } catch (error) {
        logger.error("job_reminder_24h_failed", {
          jobId: job.id,
          error: (error as Error).message,
        });
        failed++;
      }
    }

    // Send 2h reminders
    const jobs2h = await findJobsFor2hReminder();
    for (const job of jobs2h) {
      try {
        await send2hReminder(job);
        reminders2h++;
      } catch (error) {
        logger.error("job_reminder_2h_failed", {
          jobId: job.id,
          error: (error as Error).message,
        });
        failed++;
      }
    }

    logger.info("job_reminders_worker_completed", {
      reminders24h,
      reminders2h,
      failed,
    });

    return { reminders24h, reminders2h, failed };
  } catch (error) {
    logger.error("job_reminders_worker_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runJobRemindersWorker()
    .then((result) => {
      console.log("Job reminders worker completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("Job reminders worker failed:", error);
      process.exit(1);
    });
}
