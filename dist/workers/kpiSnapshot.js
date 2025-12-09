"use strict";
// src/workers/kpiSnapshot.ts
// Worker to capture KPI snapshots for historical tracking
// Uses kpi_snapshots table from 001_init.sql
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureDailySnapshot = captureDailySnapshot;
exports.getKPISnapshots = getKPISnapshots;
exports.runKPISnapshotWorker = runKPISnapshotWorker;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
/**
 * Get job counts by status for a date range
 */
async function getJobCountsByStatus(dateFrom, dateTo) {
    const dateFilter = dateFrom && dateTo
        ? `AND created_at >= $1::timestamptz AND created_at <= $2::timestamptz`
        : "";
    const params = dateFrom && dateTo ? [dateFrom, dateTo] : [];
    const result = await (0, client_1.query)(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'disputed') as disputed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
      FROM jobs
      WHERE 1=1 ${dateFilter}
    `, params);
    const row = result.rows[0];
    return {
        total: parseInt(row?.total || "0", 10),
        completed: parseInt(row?.completed || "0", 10),
        disputed: parseInt(row?.disputed || "0", 10),
        cancelled: parseInt(row?.cancelled || "0", 10),
    };
}
/**
 * Capture a daily KPI snapshot
 */
async function captureDailySnapshot(date) {
    const snapshotDate = date || new Date();
    const dateStr = snapshotDate.toISOString().split("T")[0];
    const dateFrom = `${dateStr}T00:00:00Z`;
    const dateTo = `${dateStr}T23:59:59Z`;
    // Get job counts for the day
    const counts = await getJobCountsByStatus(dateFrom, dateTo);
    // Insert or update snapshot using 001_init.sql schema
    const result = await (0, client_1.query)(`
      INSERT INTO kpi_snapshots (
        date,
        total_jobs,
        completed_jobs,
        disputed_jobs,
        cancelled_jobs
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (date)
      DO UPDATE SET
        total_jobs = EXCLUDED.total_jobs,
        completed_jobs = EXCLUDED.completed_jobs,
        disputed_jobs = EXCLUDED.disputed_jobs,
        cancelled_jobs = EXCLUDED.cancelled_jobs
      RETURNING *
    `, [
        dateStr,
        counts.total,
        counts.completed,
        counts.disputed,
        counts.cancelled,
    ]);
    const snapshot = result.rows[0];
    logger_1.logger.info("kpi_snapshot_captured", {
        date: dateStr,
        totalJobs: counts.total,
        completedJobs: counts.completed,
        disputedJobs: counts.disputed,
        cancelledJobs: counts.cancelled,
    });
    return snapshot;
}
/**
 * Get historical KPI snapshots
 */
async function getKPISnapshots(days = 30) {
    const result = await (0, client_1.query)(`
      SELECT *
      FROM kpi_snapshots
      WHERE date >= CURRENT_DATE - INTERVAL '1 day' * $1
      ORDER BY date DESC
    `, [days]);
    return result.rows;
}
/**
 * Main worker function
 */
async function runKPISnapshotWorker() {
    logger_1.logger.info("kpi_snapshot_worker_started");
    try {
        const snapshot = await captureDailySnapshot();
        logger_1.logger.info("kpi_snapshot_worker_completed", {
            snapshotId: snapshot.id,
            date: snapshot.date,
        });
        return snapshot;
    }
    catch (error) {
        logger_1.logger.error("kpi_snapshot_worker_failed", {
            error: error.message,
        });
        throw error;
    }
}
// Run if executed directly
if (require.main === module) {
    runKPISnapshotWorker()
        .then((snapshot) => {
        console.log("KPI snapshot worker completed:", snapshot);
        process.exit(0);
    })
        .catch((error) => {
        console.error("KPI snapshot worker failed:", error);
        process.exit(1);
    });
}
