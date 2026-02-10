// src/workers/v1-core/noShowDetection.ts
// Worker to detect and notify about no-shows
// - Checks for jobs past scheduled_start_at with no check-in
// - Sends warning to cleaner after 15 minutes

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { sendNotificationToUser } from "../../services/notifications/notificationService";
import { buildCheckInUrl, buildSupportUrl } from "../../lib/urlBuilder";
import { publishEvent } from "../../lib/events";

const NO_SHOW_GRACE_MINUTES = 15;
const BATCH_SIZE = 100;

interface NoShowJob {
  id: string;
  cleaner_id: string | null;
  status: string;
  scheduled_start_at: string;
  address: string;
}

/**
 * Find jobs that are potential no-shows
 * - Status is 'accepted' or 'on_my_way'
 * - scheduled_start_at is past by NO_SHOW_GRACE_MINUTES
 * - No check-in event (job_started) exists
 * - No no-show warning sent yet
 */
async function findNoShowJobs(): Promise<NoShowJob[]> {
  const result = await query<NoShowJob>(
    `
      SELECT j.id, j.cleaner_id, j.status, j.scheduled_start_at, j.address
      FROM jobs j
      LEFT JOIN job_events je_checkin ON je_checkin.job_id = j.id 
        AND je_checkin.event_type = 'job_started'
      LEFT JOIN job_events je_warning ON je_warning.job_id = j.id 
        AND je_warning.event_type = 'job_no_show_warning_sent'
      WHERE j.status IN ('accepted', 'on_my_way')
        AND j.cleaner_id IS NOT NULL
        AND j.scheduled_start_at < NOW() - INTERVAL '${NO_SHOW_GRACE_MINUTES} minutes'
        AND je_checkin.id IS NULL  -- No check-in
        AND je_warning.id IS NULL  -- No warning sent yet
      ORDER BY j.scheduled_start_at ASC
      LIMIT $1
    `,
    [BATCH_SIZE]
  );

  return result.rows;
}

/**
 * Send no-show warning to cleaner
 */
async function sendNoShowWarning(job: NoShowJob): Promise<void> {
  if (!job.cleaner_id) return;

  const scheduledTime = new Date(job.scheduled_start_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const checkInUrl = buildCheckInUrl(job.id);
  const supportUrl = buildSupportUrl();

  await sendNotificationToUser(job.cleaner_id, "job.no_show_warning", {
    jobId: job.id,
    address: job.address,
    scheduledTime,
    checkInUrl,
    supportUrl,
    timeZoneLabel: "local time", // TODO: Get actual timezone from job
    // TODO: Generate shortUrl for SMS (when short link service is implemented)
  }, ["sms", "push"]);

  // Mark warning as sent
  await query(
    `
      INSERT INTO job_events (job_id, event_type, actor_type, actor_id, payload)
      VALUES ($1, 'job_no_show_warning_sent', 'system', NULL, '{}'::jsonb)
    `,
    [job.id]
  );

  // Publish event for tracking
  await publishEvent({
    jobId: job.id,
    actorType: "system",
    actorId: undefined,
    eventName: "job_no_show_warning",
    payload: {
      scheduledStartAt: job.scheduled_start_at,
      graceMinutes: NO_SHOW_GRACE_MINUTES,
    },
  });

  logger.warn("job_no_show_warning_sent", {
    jobId: job.id,
    cleanerId: job.cleaner_id,
    scheduledStartAt: job.scheduled_start_at,
    minutesPast: NO_SHOW_GRACE_MINUTES,
  });
}

/**
 * Main worker function
 */
export async function runNoShowDetectionWorker(): Promise<{
  warningsSent: number;
  failed: number;
}> {
  logger.info("no_show_detection_worker_started", {
    graceMinutes: NO_SHOW_GRACE_MINUTES,
  });

  let warningsSent = 0;
  let failed = 0;

  try {
    const noShowJobs = await findNoShowJobs();

    for (const job of noShowJobs) {
      try {
        await sendNoShowWarning(job);
        warningsSent++;
      } catch (error) {
        logger.error("no_show_warning_failed", {
          jobId: job.id,
          error: (error as Error).message,
        });
        failed++;
      }
    }

    logger.info("no_show_detection_worker_completed", {
      warningsSent,
      failed,
    });

    return { warningsSent, failed };
  } catch (error) {
    logger.error("no_show_detection_worker_failed", {
      error: (error as Error).message,
    });
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  runNoShowDetectionWorker()
    .then((result) => {
      console.log("No-show detection worker completed:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("No-show detection worker failed:", error);
      process.exit(1);
    });
}
