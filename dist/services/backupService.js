"use strict";
// src/services/backupService.ts
// Logical backup service for creating point-in-time snapshots
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackupJob = runBackupJob;
exports.getBackupsByLabel = getBackupsByLabel;
exports.getLatestBackup = getLatestBackup;
exports.compareBackups = compareBackups;
exports.cleanupOldBackups = cleanupOldBackups;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Core Backup Functions
// ============================================
/**
 * Creates a logical backup snapshot by aggregating key counts and
 * inserting them into the backups table as JSON.
 *
 * This is NOT a full DB backup, but a reliable summary of state.
 * Use Neon/pg_dump for actual database backups.
 */
async function runBackupJob(label = "daily-summary", notes) {
    // Aggregate all important metrics in a single efficient query
    const aggregateResult = await (0, client_1.query)(`
      WITH users_agg AS (
        SELECT
          COUNT(*) AS user_count,
          COUNT(*) FILTER (WHERE role = 'client') AS client_count,
          COUNT(*) FILTER (WHERE role = 'cleaner') AS cleaner_count,
          COUNT(*) FILTER (WHERE role = 'admin') AS admin_count
        FROM users
      ),
      jobs_agg AS (
        SELECT COUNT(*) AS job_count
        FROM jobs
      ),
      credits_agg AS (
        SELECT
          COUNT(*) AS credit_ledger_entries,
          COALESCE(SUM(delta_credits), 0) AS total_credit_supply
        FROM credit_ledger
      ),
      payouts_agg AS (
        SELECT
          COUNT(*) AS total_payouts,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_payouts,
          COUNT(*) FILTER (WHERE status = 'paid') AS paid_payouts,
          COUNT(*) FILTER (WHERE status = 'failed') AS failed_payouts,
          COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS total_paid_cents
        FROM payouts
      ),
      disputes_agg AS (
        SELECT
          COUNT(*) AS total_disputes,
          COUNT(*) FILTER (WHERE status = 'open') AS open_disputes,
          COUNT(*) FILTER (WHERE status = 'resolved_refund') AS resolved_refund_disputes,
          COUNT(*) FILTER (WHERE status = 'resolved_no_refund') AS resolved_no_refund_disputes
        FROM disputes
      )
      SELECT
        users_agg.user_count,
        users_agg.client_count,
        users_agg.cleaner_count,
        users_agg.admin_count,
        jobs_agg.job_count,
        credits_agg.credit_ledger_entries,
        credits_agg.total_credit_supply,
        payouts_agg.total_payouts,
        payouts_agg.pending_payouts,
        payouts_agg.paid_payouts,
        payouts_agg.failed_payouts,
        payouts_agg.total_paid_cents,
        disputes_agg.total_disputes,
        disputes_agg.open_disputes,
        disputes_agg.resolved_refund_disputes,
        disputes_agg.resolved_no_refund_disputes
      FROM users_agg, jobs_agg, credits_agg, payouts_agg, disputes_agg
    `);
    const agg = aggregateResult.rows[0];
    // Get jobs by status breakdown
    const statusResult = await (0, client_1.query)(`SELECT status, COUNT(*)::text as count FROM jobs GROUP BY status`);
    const jobsByStatus = {};
    for (const row of statusResult.rows) {
        jobsByStatus[row.status] = Number(row.count);
    }
    // Build the backup data
    const data = {
        user_count: Number(agg.user_count),
        client_count: Number(agg.client_count),
        cleaner_count: Number(agg.cleaner_count),
        admin_count: Number(agg.admin_count),
        job_count: Number(agg.job_count),
        jobs_by_status: jobsByStatus,
        credit_ledger_entries: Number(agg.credit_ledger_entries),
        total_credit_supply: Number(agg.total_credit_supply),
        total_payouts: Number(agg.total_payouts),
        pending_payouts: Number(agg.pending_payouts),
        paid_payouts: Number(agg.paid_payouts),
        failed_payouts: Number(agg.failed_payouts),
        total_paid_cents: Number(agg.total_paid_cents),
        total_disputes: Number(agg.total_disputes),
        open_disputes: Number(agg.open_disputes),
        resolved_refund_disputes: Number(agg.resolved_refund_disputes),
        resolved_no_refund_disputes: Number(agg.resolved_no_refund_disputes),
        snapshot_at: new Date().toISOString(),
    };
    const metadata = {
        version: 1,
        source: "backup-worker",
        environment: process.env.NODE_ENV || "development",
        notes,
    };
    // Insert into backups table
    const result = await (0, client_1.query)(`
      INSERT INTO backups (label, metadata, data)
      VALUES ($1, $2::jsonb, $3::jsonb)
      RETURNING id, label, created_at::text, metadata::text, data::text
    `, [label, JSON.stringify(metadata), JSON.stringify(data)]);
    const row = result.rows[0];
    const snapshot = {
        id: row.id,
        label: row.label,
        created_at: row.created_at,
        metadata: JSON.parse(row.metadata),
        data: JSON.parse(row.data),
    };
    logger_1.logger.info("backup_snapshot_created", {
        id: snapshot.id,
        label: snapshot.label,
        created_at: snapshot.created_at,
        user_count: data.user_count,
        job_count: data.job_count,
        total_credit_supply: data.total_credit_supply,
    });
    return snapshot;
}
/**
 * Get backup snapshots by label
 */
async function getBackupsByLabel(label, limit = 10) {
    const result = await (0, client_1.query)(`
      SELECT id, label, created_at::text, metadata::text, data::text
      FROM backups
      WHERE label = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [label, limit]);
    return result.rows.map((row) => ({
        id: row.id,
        label: row.label,
        created_at: row.created_at,
        metadata: JSON.parse(row.metadata),
        data: JSON.parse(row.data),
    }));
}
/**
 * Get the latest backup
 */
async function getLatestBackup() {
    const result = await (0, client_1.query)(`
      SELECT id, label, created_at::text, metadata::text, data::text
      FROM backups
      ORDER BY created_at DESC
      LIMIT 1
    `);
    if (result.rows.length === 0) {
        return null;
    }
    const row = result.rows[0];
    return {
        id: row.id,
        label: row.label,
        created_at: row.created_at,
        metadata: JSON.parse(row.metadata),
        data: JSON.parse(row.data),
    };
}
/**
 * Compare two backup snapshots
 */
function compareBackups(older, newer) {
    const metrics = [
        "user_count",
        "client_count",
        "cleaner_count",
        "job_count",
        "credit_ledger_entries",
        "total_credit_supply",
        "pending_payouts",
        "open_disputes",
    ];
    const comparison = {};
    for (const metric of metrics) {
        const oldVal = older.data[metric];
        const newVal = newer.data[metric];
        const change = newVal - oldVal;
        const pct = oldVal > 0 ? ((change / oldVal) * 100).toFixed(2) + "%" : "N/A";
        comparison[metric] = { old: oldVal, new: newVal, change, pct };
    }
    return comparison;
}
/**
 * Clean up old backups, keeping only the most recent N per label
 */
async function cleanupOldBackups(keepPerLabel = 30) {
    const result = await (0, client_1.query)(`
      WITH ranked AS (
        SELECT id, label,
          ROW_NUMBER() OVER (PARTITION BY label ORDER BY created_at DESC) as rn
        FROM backups
      ),
      to_delete AS (
        SELECT id FROM ranked WHERE rn > $1
      )
      DELETE FROM backups
      WHERE id IN (SELECT id FROM to_delete)
      RETURNING id
    `, [keepPerLabel]);
    const deletedCount = result.rows.length;
    if (deletedCount > 0) {
        logger_1.logger.info("old_backups_cleaned", { deleted_count: deletedCount });
    }
    return deletedCount;
}
