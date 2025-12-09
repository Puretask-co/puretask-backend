"use strict";
// src/services/adminService.ts
// Admin service matching 001_init.sql schema
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminKPIs = getAdminKPIs;
exports.getDisputes = getDisputes;
exports.resolveDispute = resolveDispute;
exports.overrideJobStatus = overrideJobStatus;
exports.getAllPayouts = getAllPayouts;
exports.getJobEventsForAdmin = getJobEventsForAdmin;
exports.listJobsForAdmin = listJobsForAdmin;
exports.saveKpiSnapshot = saveKpiSnapshot;
exports.getKpiHistory = getKpiHistory;
exports.getJobDetails = getJobDetails;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const events_1 = require("../lib/events");
/**
 * Get admin KPIs dashboard data
 */
async function getAdminKPIs(dateFrom, dateTo) {
    const dateFilter = dateFrom && dateTo
        ? `AND created_at >= $1::timestamptz AND created_at <= $2::timestamptz`
        : "";
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];
    // Total jobs
    const totalJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE 1=1 ${dateFilter}`, params);
    const totalJobs = parseInt(totalJobsResult.rows[0]?.count || "0", 10);
    // Active jobs (not terminal)
    const activeJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE status NOT IN ('completed', 'cancelled', 'disputed') ${dateFilter}`, params);
    const activeJobs = parseInt(activeJobsResult.rows[0]?.count || "0", 10);
    // Completed jobs
    const completedJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE status = 'completed' ${dateFilter}`, params);
    const completedJobs = parseInt(completedJobsResult.rows[0]?.count || "0", 10);
    // Disputed jobs
    const disputedJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE status = 'disputed' ${dateFilter}`, params);
    const disputedJobs = parseInt(disputedJobsResult.rows[0]?.count || "0", 10);
    // Cancelled jobs
    const cancelledJobsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs WHERE status = 'cancelled' ${dateFilter}`, params);
    const cancelledJobs = parseInt(cancelledJobsResult.rows[0]?.count || "0", 10);
    // Total credits escrowed (from credit_ledger - job_escrow entries)
    const creditsResult = await (0, client_1.query)(`SELECT COALESCE(SUM(ABS(delta_credits)), 0) as total FROM credit_ledger WHERE reason = 'job_escrow' ${dateFilter}`, params);
    const totalCreditsEscrowed = parseFloat(creditsResult.rows[0]?.total || "0");
    // Total payouts
    const payoutsResult = await (0, client_1.query)(`SELECT COALESCE(SUM(amount_cents), 0) as total FROM payouts WHERE status = 'paid' ${dateFilter}`, params);
    const totalPayouts = parseFloat(payoutsResult.rows[0]?.total || "0") / 100; // Convert cents to dollars
    // Active cleaners
    const cleanersResult = await (0, client_1.query)(`SELECT COUNT(DISTINCT cleaner_id) as count FROM jobs WHERE cleaner_id IS NOT NULL AND status NOT IN ('cancelled') ${dateFilter}`, params);
    const activeCleaners = parseInt(cleanersResult.rows[0]?.count || "0", 10);
    // Active clients
    const clientsResult = await (0, client_1.query)(`SELECT COUNT(DISTINCT client_id) as count FROM jobs WHERE 1=1 ${dateFilter}`, params);
    const activeClients = parseInt(clientsResult.rows[0]?.count || "0", 10);
    // Average job rating
    const ratingResult = await (0, client_1.query)(`SELECT COALESCE(AVG(rating), 0) as avg FROM jobs WHERE rating IS NOT NULL ${dateFilter}`, params);
    const avgJobRating = parseFloat(ratingResult.rows[0]?.avg || "0");
    // Average job duration (actual_end_at - actual_start_at)
    const durationResult = await (0, client_1.query)(`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (actual_end_at - actual_start_at)) / 3600), 0) as avg FROM jobs WHERE actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL ${dateFilter}`, params);
    const avgJobDuration = parseFloat(durationResult.rows[0]?.avg || "0");
    return {
        totalJobs,
        activeJobs,
        completedJobs,
        disputedJobs,
        cancelledJobs,
        totalCreditsEscrowed,
        totalPayouts,
        activeCleaners,
        activeClients,
        avgJobRating,
        avgJobDuration,
    };
}
/**
 * Get all disputes from disputes table
 */
async function getDisputes(status, limit = 50) {
    const statusFilter = status ? "WHERE d.status = $1" : "";
    const params = status ? [status, limit] : [limit];
    const result = await (0, client_1.query)(`
      SELECT d.*, j.credit_amount, j.address
      FROM disputes d
      JOIN jobs j ON d.job_id = j.id
      ${statusFilter}
      ORDER BY d.created_at DESC
      LIMIT $${params.length}
    `, params);
    return result.rows;
}
/**
 * Resolve a dispute
 */
async function resolveDispute(jobId, resolution, adminId) {
    // Get dispute
    const disputeResult = await (0, client_1.query)(`SELECT * FROM disputes WHERE job_id = $1 AND status = 'open'`, [jobId]);
    if (disputeResult.rows.length === 0) {
        throw new Error("Dispute not found or already resolved");
    }
    const dispute = disputeResult.rows[0];
    // Update dispute status
    const updatedResult = await (0, client_1.query)(`
      UPDATE disputes
      SET status = $2,
          admin_notes = $3,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [dispute.id, resolution.resolution, resolution.adminNotes || null]);
    const updated = updatedResult.rows[0];
    // Update job status based on resolution
    const newJobStatus = resolution.resolution === "resolved_refund" ? "cancelled" : "completed";
    await (0, client_1.query)(`UPDATE jobs SET status = $2, updated_at = NOW() WHERE id = $1`, [jobId, newJobStatus]);
    // Publish event
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "admin",
        actorId: adminId,
        eventName: resolution.resolution === "resolved_refund" ? "dispute_resolved_refund" : "dispute_resolved_no_refund",
        payload: {
            disputeId: dispute.id,
            resolution: resolution.resolution,
            adminNotes: resolution.adminNotes,
        },
    });
    logger_1.logger.info("dispute_resolved", {
        disputeId: dispute.id,
        jobId,
        resolution: resolution.resolution,
        adminId,
    });
    return updated;
}
/**
 * Override job status (admin only)
 */
async function overrideJobStatus(jobId, newStatus, reason, adminId) {
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw new Error("Job not found");
    }
    const job = jobResult.rows[0];
    // Update status
    const updatedResult = await (0, client_1.query)(`
      UPDATE jobs
      SET status = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [jobId, newStatus]);
    const updated = updatedResult.rows[0];
    // Publish override event
    await (0, events_1.publishEvent)({
        jobId,
        actorType: "admin",
        actorId: adminId,
        eventName: "job_overridden",
        payload: {
            previousStatus: job.status,
            newStatus,
            reason,
        },
    });
    logger_1.logger.warn("job_status_overridden", {
        jobId,
        previousStatus: job.status,
        newStatus,
        reason,
        adminId,
    });
    return updated;
}
/**
 * Get all payouts (admin view)
 */
async function getAllPayouts(status, limit = 100) {
    const statusFilter = status ? "WHERE status = $1" : "";
    const params = status ? [status, limit] : [limit];
    const result = await (0, client_1.query)(`
      SELECT *
      FROM payouts
      ${statusFilter}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `, params);
    return result.rows;
}
/**
 * Get job events for admin
 */
async function getJobEventsForAdmin(jobId, limit = 100) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM job_events
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [jobId, limit]);
    return result.rows;
}
/**
 * List all jobs with filters (admin)
 */
async function listJobsForAdmin(filters) {
    const { status, clientId, cleanerId, dateFrom, dateTo, limit = 50, offset = 0, } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (status) {
        conditions.push(`status = $${paramIndex++}`);
        params.push(status);
    }
    if (clientId) {
        conditions.push(`client_id = $${paramIndex++}`);
        params.push(clientId);
    }
    if (cleanerId) {
        conditions.push(`cleaner_id = $${paramIndex++}`);
        params.push(cleanerId);
    }
    if (dateFrom) {
        conditions.push(`created_at >= $${paramIndex++}::timestamptz`);
        params.push(dateFrom);
    }
    if (dateTo) {
        conditions.push(`created_at <= $${paramIndex++}::timestamptz`);
        params.push(dateTo);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // Get total count
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM jobs ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || "0", 10);
    // Get jobs
    const jobsResult = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);
    return {
        jobs: jobsResult.rows,
        total,
    };
}
/**
 * Save KPI snapshot (called by worker)
 */
async function saveKpiSnapshot() {
    const today = new Date().toISOString().split("T")[0];
    const kpis = await getAdminKPIs();
    const result = await (0, client_1.query)(`
      INSERT INTO kpi_snapshots (
        date,
        total_jobs,
        completed_jobs,
        disputed_jobs,
        cancelled_jobs
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (date) DO UPDATE SET
        total_jobs = EXCLUDED.total_jobs,
        completed_jobs = EXCLUDED.completed_jobs,
        disputed_jobs = EXCLUDED.disputed_jobs,
        cancelled_jobs = EXCLUDED.cancelled_jobs
      RETURNING *
    `, [today, kpis.totalJobs, kpis.completedJobs, kpis.disputedJobs, kpis.cancelledJobs]);
    return result.rows[0];
}
/**
 * Get KPI history
 */
async function getKpiHistory(days = 30) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM kpi_snapshots
      WHERE date >= CURRENT_DATE - INTERVAL '1 day' * $1
      ORDER BY date DESC
    `, [days]);
    return result.rows;
}
/**
 * Get complete job details with full timeline
 * Includes: job, client, cleaner, events, dispute, payments, payout, photos, credits
 */
async function getJobDetails(jobId) {
    // Get job
    const jobResult = await (0, client_1.query)(`SELECT * FROM jobs WHERE id = $1`, [jobId]);
    if (jobResult.rows.length === 0) {
        throw Object.assign(new Error("Job not found"), { statusCode: 404 });
    }
    const job = jobResult.rows[0];
    // Get client info
    const clientResult = await (0, client_1.query)(`SELECT id, email FROM users WHERE id = $1`, [job.client_id]);
    const client = clientResult.rows[0] ?? null;
    // Get cleaner info
    let cleaner = null;
    if (job.cleaner_id) {
        const cleanerResult = await (0, client_1.query)(`SELECT id, email FROM users WHERE id = $1`, [job.cleaner_id]);
        cleaner = cleanerResult.rows[0] ?? null;
    }
    // Get events
    const eventsResult = await (0, client_1.query)(`SELECT * FROM job_events WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]);
    const events = eventsResult.rows;
    // Get dispute
    const disputeResult = await (0, client_1.query)(`SELECT * FROM disputes WHERE job_id = $1`, [jobId]);
    const dispute = disputeResult.rows[0] ?? null;
    // Get payment intents
    const paymentsResult = await (0, client_1.query)(`SELECT id, stripe_payment_intent_id, status, amount_cents, 
            COALESCE(purpose, 'job_charge') as purpose, created_at 
     FROM payment_intents 
     WHERE job_id = $1 
     ORDER BY created_at ASC`, [jobId]);
    const paymentIntents = paymentsResult.rows;
    // Get payout
    const payoutResult = await (0, client_1.query)(`SELECT * FROM payouts WHERE job_id = $1`, [jobId]);
    const payout = payoutResult.rows[0] ?? null;
    // Get photos
    const photosResult = await (0, client_1.query)(`SELECT id, type, url, created_at FROM job_photos WHERE job_id = $1 ORDER BY created_at ASC`, [jobId]);
    const photos = photosResult.rows;
    // Get credit entries
    const creditsResult = await (0, client_1.query)(`SELECT id, delta_credits, reason, created_at 
     FROM credit_ledger 
     WHERE job_id = $1 
     ORDER BY created_at ASC`, [jobId]);
    const creditEntries = creditsResult.rows;
    return {
        job,
        client,
        cleaner,
        events,
        dispute,
        paymentIntents,
        payout,
        photos,
        creditEntries,
    };
}
