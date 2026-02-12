// src/services/notifications/jobNotifications.ts
// Job-specific notification handlers

import { query } from "../../db/client";
import { logger } from "../../lib/logger";
import { sendNotificationToUser, sendNotification } from "./notificationService";
import {
  buildClientJobUrl,
  buildCleanerJobUrl,
  buildCheckInUrl,
  buildPaymentUrl,
  buildSupportUrl,
} from "../../lib/urlBuilder";
import type { Job } from "../../types/db";
import type { NotificationType, NotificationChannel } from "./types";

// ============================================
// Helpers
// ============================================

/**
 * Get user name from email (first part before @)
 */
async function getUserName(userId: string): Promise<string> {
  const result = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = $1`,
    [userId]
  );
  const email = result.rows[0]?.email || "Customer";
  return email.split("@")[0];
}

/**
 * Get user role
 */
async function getUserRole(userId: string): Promise<"client" | "cleaner" | "admin" | null> {
  const result = await query<{ role: "client" | "cleaner" | "admin" }>(
    `SELECT role FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0]?.role || null;
}

/**
 * Get cleaner details
 */
async function getCleanerDetails(cleanerId: string): Promise<{
  name: string;
  reliabilityScore: number | null;
}> {
  const result = await query<{ email: string; reliability_score: number }>(
    `
      SELECT u.email, cp.reliability_score
      FROM users u
      LEFT JOIN cleaner_profiles cp ON u.id = cp.user_id
      WHERE u.id = $1
    `,
    [cleanerId]
  );
  return {
    name: result.rows[0]?.email?.split("@")[0] || "Cleaner",
    reliabilityScore: result.rows[0]?.reliability_score ?? null,
  };
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ============================================
// Job Lifecycle Notifications
// ============================================

/**
 * Notify client when job is created
 */
export async function notifyJobCreated(job: Job): Promise<void> {
  const clientName = await getUserName(job.client_id);
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(job.client_id, "job.created", {
    jobId: job.id,
    clientName,
    address: job.address,
    scheduledDate: formatDate(job.scheduled_start_at),
    creditAmount: job.credit_amount,
    jobUrl,
  });
}

/**
 * Notify client when cleaner accepts job
 */
export async function notifyJobAccepted(job: Job): Promise<void> {
  if (!job.cleaner_id) {
    logger.warn("notifyJobAccepted: No cleaner_id", { jobId: job.id });
    return;
  }

  const clientName = await getUserName(job.client_id);
  const cleaner = await getCleanerDetails(job.cleaner_id);
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(
    job.client_id,
    "job.accepted",
    {
      jobId: job.id,
      clientName,
      cleanerName: cleaner.name,
      address: job.address,
      scheduledDate: formatDate(job.scheduled_start_at),
      jobUrl,
    },
    ["email", "push"] // Send both email and push
  );
}

/**
 * Notify client when cleaner is on the way
 */
export async function notifyCleanerOnTheWay(job: Job): Promise<void> {
  if (!job.cleaner_id) return;

  const clientName = await getUserName(job.client_id);
  const cleaner = await getCleanerDetails(job.cleaner_id);
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(
    job.client_id,
    "job.on_my_way",
    {
      jobId: job.id,
      clientName,
      cleanerName: cleaner.name,
      address: job.address,
      jobUrl,
    },
    ["sms", "push"] // SMS and push for urgency
  );
}

/**
 * Notify client when cleaner starts the job
 */
export async function notifyJobStarted(job: Job): Promise<void> {
  if (!job.cleaner_id) return;

  const clientName = await getUserName(job.client_id);
  const cleaner = await getCleanerDetails(job.cleaner_id);
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(
    job.client_id,
    "job.started",
    {
      jobId: job.id,
      clientName,
      cleanerName: cleaner.name,
      address: job.address,
      startTime: job.actual_start_at
        ? new Date(job.actual_start_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })
        : "Now",
      jobUrl,
    },
    ["push"]
  );
}

/**
 * Notify client when job is completed (awaiting approval)
 */
export async function notifyJobCompleted(job: Job): Promise<void> {
  if (!job.cleaner_id) return;

  const clientName = await getUserName(job.client_id);
  const cleaner = await getCleanerDetails(job.cleaner_id);
  const jobUrl = buildClientJobUrl(job.id);

  await sendNotificationToUser(
    job.client_id,
    "job.completed",
    {
      jobId: job.id,
      clientName,
      cleanerName: cleaner.name,
      address: job.address,
      creditAmount: job.credit_amount,
      jobUrl,
    },
    ["email", "sms", "push"] // All channels for important action needed
  );
}

/**
 * Notify cleaner when client approves job
 */
export async function notifyJobApproved(job: Job): Promise<void> {
  // Notify client
  const clientName = await getUserName(job.client_id);
  await sendNotificationToUser(job.client_id, "job.approved", {
    jobId: job.id,
    clientName,
    address: job.address,
    rating: job.rating,
    creditAmount: job.credit_amount,
  });

  // Notify cleaner
  if (job.cleaner_id) {
    await sendNotificationToUser(job.cleaner_id, "job.approved", {
      jobId: job.id,
      rating: job.rating,
      creditAmount: job.credit_amount,
    });
  }
}

/**
 * Notify when job is disputed
 */
export async function notifyJobDisputed(job: Job): Promise<void> {
  const clientName = await getUserName(job.client_id);
  const clientJobUrl = buildClientJobUrl(job.id);
  const cleanerJobUrl = buildCleanerJobUrl(job.id);

  // Notify client
  await sendNotificationToUser(job.client_id, "job.disputed", {
    jobId: job.id,
    clientName,
    address: job.address,
    jobUrl: clientJobUrl,
  });

  // Also notify cleaner if assigned
  if (job.cleaner_id) {
    await sendNotificationToUser(job.cleaner_id, "job.disputed", {
      jobId: job.id,
      address: job.address,
      jobUrl: cleanerJobUrl,
    });
  }
}

/**
 * Notify client when job is cancelled
 */
export async function notifyJobCancelled(
  job: Job,
  creditsRefunded?: number
): Promise<void> {
  const clientName = await getUserName(job.client_id);

  await sendNotificationToUser(job.client_id, "job.cancelled", {
    jobId: job.id,
    clientName,
    address: job.address,
    scheduledDate: formatDate(job.scheduled_start_at),
    creditsRefunded: creditsRefunded ?? job.credit_amount,
  });

  // Also notify cleaner if was assigned
  if (job.cleaner_id) {
    await sendNotificationToUser(job.cleaner_id, "job.cancelled", {
      jobId: job.id,
      address: job.address,
    });
  }
}

// ============================================
// Payment Notifications
// ============================================

/**
 * Notify client when credits are purchased
 */
export async function notifyCreditsLow(
  userId: string,
  currentBalance: number
): Promise<void> {
  const userName = await getUserName(userId);

  await sendNotificationToUser(userId, "credits.low", {
    clientName: userName,
    currentBalance,
  });
}

/**
 * Notify cleaner when payout is processed
 */
export async function notifyPayoutProcessed(options: {
  cleanerId: string;
  amountCents: number;
  jobsCount: number;
  transferId: string;
}): Promise<void> {
  const cleanerName = await getUserName(options.cleanerId);

  await sendNotificationToUser(
    options.cleanerId,
    "payout.processed",
    {
      cleanerName,
      amount: options.amountCents,
      jobsCount: options.jobsCount,
      transferId: options.transferId,
    },
    ["email", "push"]
  );
}

/**
 * Send welcome notification to new user
 */
export async function notifyWelcome(userId: string, name: string): Promise<void> {
  await sendNotificationToUser(userId, "welcome", { name });
}

// Legacy exports for backwards compatibility
export const notifyJobRequested = notifyJobCreated;
