"use strict";
// src/services/cleanerJobsService.ts
// Cleaner jobs service matching 001_init.sql schema
Object.defineProperty(exports, "__esModule", { value: true });
exports.listJobsForCleaner = listJobsForCleaner;
exports.listAvailableJobsForCleaner = listAvailableJobsForCleaner;
exports.getActiveJobForCleaner = getActiveJobForCleaner;
exports.getCleanerJobStats = getCleanerJobStats;
exports.getUpcomingJobsForCleaner = getUpcomingJobsForCleaner;
const client_1 = require("../db/client");
/**
 * List jobs assigned to a cleaner
 */
async function listJobsForCleaner(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      WHERE cleaner_id = $1
      ORDER BY scheduled_start_at ASC NULLS LAST, created_at DESC
    `, [cleanerId]);
    return result.rows;
}
/**
 * List available jobs (requested status, no cleaner assigned)
 */
async function listAvailableJobsForCleaner() {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      WHERE status = 'requested' AND cleaner_id IS NULL
      ORDER BY scheduled_start_at ASC
    `);
    return result.rows;
}
/**
 * Get cleaner's active job (if any)
 */
async function getActiveJobForCleaner(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      WHERE cleaner_id = $1
        AND status IN ('accepted', 'on_my_way', 'in_progress')
      ORDER BY scheduled_start_at ASC
      LIMIT 1
    `, [cleanerId]);
    return result.rows[0] ?? null;
}
/**
 * Get cleaner's job stats
 */
async function getCleanerJobStats(cleanerId) {
    const result = await (0, client_1.query)(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_jobs,
        COALESCE(AVG(rating) FILTER (WHERE rating IS NOT NULL), 0) as avg_rating,
        COALESCE(SUM(credit_amount) FILTER (WHERE status = 'completed'), 0) as total_earnings
      FROM jobs
      WHERE cleaner_id = $1
    `, [cleanerId]);
    const row = result.rows[0];
    return {
        totalJobs: parseInt(row?.total_jobs || "0", 10),
        completedJobs: parseInt(row?.completed_jobs || "0", 10),
        cancelledJobs: parseInt(row?.cancelled_jobs || "0", 10),
        avgRating: parseFloat(row?.avg_rating || "0"),
        totalEarnings: parseFloat(row?.total_earnings || "0"),
    };
}
/**
 * Get upcoming jobs for a cleaner
 */
async function getUpcomingJobsForCleaner(cleanerId, limit = 10) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM jobs
      WHERE cleaner_id = $1
        AND status IN ('accepted', 'on_my_way')
        AND scheduled_start_at >= NOW()
      ORDER BY scheduled_start_at ASC
      LIMIT $2
    `, [cleanerId, limit]);
    return result.rows;
}
