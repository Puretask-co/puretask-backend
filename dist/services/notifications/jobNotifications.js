"use strict";
// src/services/notifications/jobNotifications.ts
// Job-specific notification handlers
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyJobRequested = void 0;
exports.notifyJobCreated = notifyJobCreated;
exports.notifyJobAccepted = notifyJobAccepted;
exports.notifyCleanerOnTheWay = notifyCleanerOnTheWay;
exports.notifyJobStarted = notifyJobStarted;
exports.notifyJobCompleted = notifyJobCompleted;
exports.notifyJobApproved = notifyJobApproved;
exports.notifyJobDisputed = notifyJobDisputed;
exports.notifyJobCancelled = notifyJobCancelled;
exports.notifyCreditsLow = notifyCreditsLow;
exports.notifyPayoutProcessed = notifyPayoutProcessed;
exports.notifyWelcome = notifyWelcome;
const client_1 = require("../../db/client");
const logger_1 = require("../../lib/logger");
const notificationService_1 = require("./notificationService");
// ============================================
// Helpers
// ============================================
/**
 * Get user name from email (first part before @)
 */
async function getUserName(userId) {
    const result = await (0, client_1.query)(`SELECT email FROM users WHERE id = $1`, [userId]);
    const email = result.rows[0]?.email || "Customer";
    return email.split("@")[0];
}
/**
 * Get cleaner details
 */
async function getCleanerDetails(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT u.email, cp.reliability_score
      FROM users u
      LEFT JOIN cleaner_profiles cp ON u.id = cp.user_id
      WHERE u.id = $1
    `, [cleanerId]);
    return {
        name: result.rows[0]?.email?.split("@")[0] || "Cleaner",
        reliabilityScore: result.rows[0]?.reliability_score ?? null,
    };
}
/**
 * Format date for display
 */
function formatDate(dateString) {
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
async function notifyJobCreated(job) {
    const clientName = await getUserName(job.client_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.created", {
        jobId: job.id,
        clientName,
        address: job.address,
        scheduledDate: formatDate(job.scheduled_start_at),
        creditAmount: job.credit_amount,
    });
}
/**
 * Notify client when cleaner accepts job
 */
async function notifyJobAccepted(job) {
    if (!job.cleaner_id) {
        logger_1.logger.warn("notifyJobAccepted: No cleaner_id", { jobId: job.id });
        return;
    }
    const clientName = await getUserName(job.client_id);
    const cleaner = await getCleanerDetails(job.cleaner_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.accepted", {
        jobId: job.id,
        clientName,
        cleanerName: cleaner.name,
        address: job.address,
        scheduledDate: formatDate(job.scheduled_start_at),
    }, ["email", "push"] // Send both email and push
    );
}
/**
 * Notify client when cleaner is on the way
 */
async function notifyCleanerOnTheWay(job) {
    if (!job.cleaner_id)
        return;
    const clientName = await getUserName(job.client_id);
    const cleaner = await getCleanerDetails(job.cleaner_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.on_my_way", {
        jobId: job.id,
        clientName,
        cleanerName: cleaner.name,
        address: job.address,
    }, ["sms", "push"] // SMS and push for urgency
    );
}
/**
 * Notify client when cleaner starts the job
 */
async function notifyJobStarted(job) {
    if (!job.cleaner_id)
        return;
    const clientName = await getUserName(job.client_id);
    const cleaner = await getCleanerDetails(job.cleaner_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.started", {
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
    }, ["push"]);
}
/**
 * Notify client when job is completed (awaiting approval)
 */
async function notifyJobCompleted(job) {
    if (!job.cleaner_id)
        return;
    const clientName = await getUserName(job.client_id);
    const cleaner = await getCleanerDetails(job.cleaner_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.completed", {
        jobId: job.id,
        clientName,
        cleanerName: cleaner.name,
        address: job.address,
        creditAmount: job.credit_amount,
    }, ["email", "sms", "push"] // All channels for important action needed
    );
}
/**
 * Notify cleaner when client approves job
 */
async function notifyJobApproved(job) {
    // Notify client
    const clientName = await getUserName(job.client_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.approved", {
        jobId: job.id,
        clientName,
        address: job.address,
        rating: job.rating,
        creditAmount: job.credit_amount,
    });
    // Notify cleaner
    if (job.cleaner_id) {
        await (0, notificationService_1.sendNotificationToUser)(job.cleaner_id, "job.approved", {
            jobId: job.id,
            rating: job.rating,
            creditAmount: job.credit_amount,
        });
    }
}
/**
 * Notify when job is disputed
 */
async function notifyJobDisputed(job) {
    const clientName = await getUserName(job.client_id);
    // Notify client
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.disputed", {
        jobId: job.id,
        clientName,
        address: job.address,
    });
    // Also notify cleaner if assigned
    if (job.cleaner_id) {
        await (0, notificationService_1.sendNotificationToUser)(job.cleaner_id, "job.disputed", {
            jobId: job.id,
            address: job.address,
        });
    }
}
/**
 * Notify client when job is cancelled
 */
async function notifyJobCancelled(job, creditsRefunded) {
    const clientName = await getUserName(job.client_id);
    await (0, notificationService_1.sendNotificationToUser)(job.client_id, "job.cancelled", {
        jobId: job.id,
        clientName,
        address: job.address,
        scheduledDate: formatDate(job.scheduled_start_at),
        creditsRefunded: creditsRefunded ?? job.credit_amount,
    });
    // Also notify cleaner if was assigned
    if (job.cleaner_id) {
        await (0, notificationService_1.sendNotificationToUser)(job.cleaner_id, "job.cancelled", {
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
async function notifyCreditsLow(userId, currentBalance) {
    const userName = await getUserName(userId);
    await (0, notificationService_1.sendNotificationToUser)(userId, "credits.low", {
        clientName: userName,
        currentBalance,
    });
}
/**
 * Notify cleaner when payout is processed
 */
async function notifyPayoutProcessed(options) {
    const cleanerName = await getUserName(options.cleanerId);
    await (0, notificationService_1.sendNotificationToUser)(options.cleanerId, "payout.processed", {
        cleanerName,
        amount: options.amountCents,
        jobsCount: options.jobsCount,
        transferId: options.transferId,
    }, ["email", "push"]);
}
/**
 * Send welcome notification to new user
 */
async function notifyWelcome(userId, name) {
    await (0, notificationService_1.sendNotificationToUser)(userId, "welcome", { name });
}
// Legacy exports for backwards compatibility
exports.notifyJobRequested = notifyJobCreated;
