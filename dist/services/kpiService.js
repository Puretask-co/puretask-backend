"use strict";
// src/services/kpiService.ts
// KPI aggregation service for daily metrics
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDailyKpiSnapshot = createDailyKpiSnapshot;
exports.getExtendedDailyMetrics = getExtendedDailyMetrics;
exports.getKpiSnapshots = getKpiSnapshots;
exports.getLatestKpiSnapshot = getLatestKpiSnapshot;
exports.getKpiGrowth = getKpiGrowth;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Core KPI Functions
// ============================================
/**
 * Aggregates KPIs for a given date (defaults to current_date) and
 * inserts/updates a snapshot row into kpi_snapshots.
 *
 * Idempotent per date due to UNIQUE(date) constraint; we upsert.
 */
async function createDailyKpiSnapshot(date) {
    // Use current_date if no date provided
    const targetDateRes = await (0, client_1.query)(`SELECT COALESCE($1::date, current_date)::text AS date`, [date ?? null]);
    const targetDate = targetDateRes.rows[0].date;
    // Aggregate metrics using a single efficient query
    const metricsResult = await (0, client_1.query)(`
      WITH daily_created AS (
        -- Jobs created on this date
        SELECT COUNT(*) AS total_jobs
        FROM jobs
        WHERE created_at::date = $1::date
      ),
      status_on_date AS (
        -- Jobs that transitioned to specific statuses on this date
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed' AND updated_at::date = $1::date) AS completed_jobs,
          COUNT(*) FILTER (WHERE status = 'disputed' AND updated_at::date = $1::date) AS disputed_jobs,
          COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at::date = $1::date) AS cancelled_jobs
        FROM jobs
      )
      SELECT
        COALESCE(daily_created.total_jobs, 0)::int AS total_jobs,
        COALESCE(status_on_date.completed_jobs, 0)::int AS completed_jobs,
        COALESCE(status_on_date.disputed_jobs, 0)::int AS disputed_jobs,
        COALESCE(status_on_date.cancelled_jobs, 0)::int AS cancelled_jobs
      FROM daily_created, status_on_date
    `, [targetDate]);
    const metrics = metricsResult.rows[0];
    // Upsert into kpi_snapshots
    const result = await (0, client_1.query)(`
      INSERT INTO kpi_snapshots (
        date,
        total_jobs,
        completed_jobs,
        disputed_jobs,
        cancelled_jobs
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (date) DO UPDATE
      SET total_jobs = EXCLUDED.total_jobs,
          completed_jobs = EXCLUDED.completed_jobs,
          disputed_jobs = EXCLUDED.disputed_jobs,
          cancelled_jobs = EXCLUDED.cancelled_jobs
      RETURNING *
    `, [
        targetDate,
        metrics.total_jobs,
        metrics.completed_jobs,
        metrics.disputed_jobs,
        metrics.cancelled_jobs,
    ]);
    const snapshot = result.rows[0];
    logger_1.logger.info("kpi_snapshot_created", {
        date: snapshot.date,
        total_jobs: snapshot.total_jobs,
        completed_jobs: snapshot.completed_jobs,
        disputed_jobs: snapshot.disputed_jobs,
        cancelled_jobs: snapshot.cancelled_jobs,
    });
    return snapshot;
}
/**
 * Get extended metrics for a date (not stored, computed on demand)
 */
async function getExtendedDailyMetrics(date) {
    const targetDateRes = await (0, client_1.query)(`SELECT COALESCE($1::date, current_date)::text AS date`, [date ?? null]);
    const targetDate = targetDateRes.rows[0].date;
    const result = await (0, client_1.query)(`
      WITH job_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE created_at::date = $1::date) AS total_jobs,
          COUNT(*) FILTER (WHERE status = 'completed' AND updated_at::date = $1::date) AS completed_jobs,
          COUNT(*) FILTER (WHERE status = 'disputed' AND updated_at::date = $1::date) AS disputed_jobs,
          COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at::date = $1::date) AS cancelled_jobs
        FROM jobs
      ),
      user_metrics AS (
        SELECT
          COUNT(*) AS new_users,
          COUNT(*) FILTER (WHERE role = 'client') AS new_clients,
          COUNT(*) FILTER (WHERE role = 'cleaner') AS new_cleaners
        FROM users
        WHERE created_at::date = $1::date
      ),
      credit_metrics AS (
        SELECT
          COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FILTER (WHERE reason = 'purchase'), 0) AS credits_purchased,
          COALESCE(ABS(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FILTER (WHERE reason = 'job_escrow')), 0) AS credits_escrowed,
          COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FILTER (WHERE reason = 'job_release'), 0) AS credits_released,
          COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END) FILTER (WHERE reason = 'refund'), 0) AS credits_refunded
        FROM credit_ledger
        WHERE created_at::date = $1::date
      ),
      payout_metrics AS (
        SELECT
          COUNT(*) FILTER (WHERE created_at::date = $1::date) AS payouts_created,
          COUNT(*) FILTER (WHERE status = 'paid' AND updated_at::date = $1::date) AS payouts_paid,
          COUNT(*) FILTER (WHERE status = 'failed' AND updated_at::date = $1::date) AS payouts_failed,
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid' AND updated_at::date = $1::date), 0) AS total_payout_cents
        FROM payouts
      )
      SELECT
        job_metrics.*,
        user_metrics.*,
        credit_metrics.*,
        payout_metrics.*
      FROM job_metrics, user_metrics, credit_metrics, payout_metrics
    `, [targetDate]);
    return result.rows[0];
}
/**
 * Get KPI snapshots for a date range
 */
async function getKpiSnapshots(options) {
    const { startDate, endDate, limit = 30 } = options;
    let whereClause = "";
    const params = [];
    let paramIndex = 1;
    if (startDate) {
        whereClause += `WHERE date >= $${paramIndex}::date`;
        params.push(startDate);
        paramIndex++;
    }
    if (endDate) {
        whereClause += whereClause ? ` AND date <= $${paramIndex}::date` : `WHERE date <= $${paramIndex}::date`;
        params.push(endDate);
        paramIndex++;
    }
    params.push(limit);
    const result = await (0, client_1.query)(`
      SELECT *
      FROM kpi_snapshots
      ${whereClause}
      ORDER BY date DESC
      LIMIT $${paramIndex}
    `, params);
    return result.rows;
}
/**
 * Get the latest KPI snapshot
 */
async function getLatestKpiSnapshot() {
    const result = await (0, client_1.query)(`SELECT * FROM kpi_snapshots ORDER BY date DESC LIMIT 1`);
    return result.rows[0] ?? null;
}
/**
 * Calculate week-over-week growth percentages
 */
async function getKpiGrowth() {
    const result = await (0, client_1.query)(`
      WITH current_week AS (
        SELECT
          COALESCE(SUM(total_jobs), 0) AS total,
          COALESCE(SUM(completed_jobs), 0) AS completed
        FROM kpi_snapshots
        WHERE date >= current_date - INTERVAL '7 days'
      ),
      previous_week AS (
        SELECT
          COALESCE(SUM(total_jobs), 0) AS total,
          COALESCE(SUM(completed_jobs), 0) AS completed
        FROM kpi_snapshots
        WHERE date >= current_date - INTERVAL '14 days'
          AND date < current_date - INTERVAL '7 days'
      )
      SELECT
        current_week.total AS current_total,
        current_week.completed AS current_completed,
        previous_week.total AS previous_total,
        previous_week.completed AS previous_completed
      FROM current_week, previous_week
    `);
    const data = result.rows[0];
    const jobsGrowth = data.previous_total > 0
        ? ((data.current_total - data.previous_total) / data.previous_total) * 100
        : 0;
    const completedGrowth = data.previous_completed > 0
        ? ((data.current_completed - data.previous_completed) / data.previous_completed) * 100
        : 0;
    return {
        jobs_growth_pct: Math.round(jobsGrowth * 100) / 100,
        completed_growth_pct: Math.round(completedGrowth * 100) / 100,
        current_week: {
            total_jobs: data.current_total,
            completed_jobs: data.current_completed,
            disputed_jobs: 0,
            cancelled_jobs: 0,
        },
        previous_week: {
            total_jobs: data.previous_total,
            completed_jobs: data.previous_completed,
            disputed_jobs: 0,
            cancelled_jobs: 0,
        },
    };
}
