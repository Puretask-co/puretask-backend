// src/services/backupService.ts
// Logical backup service for creating point-in-time snapshots

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface BackupSnapshot {
  id: string;
  label: string;
  created_at: string;
  metadata: BackupMetadata;
  data: BackupData;
}

export interface BackupMetadata {
  version: number;
  source: string;
  environment?: string;
  notes?: string;
}

export interface BackupData {
  // User metrics
  user_count: number;
  client_count: number;
  cleaner_count: number;
  admin_count: number;
  
  // Job metrics
  job_count: number;
  jobs_by_status: Record<string, number>;
  
  // Financial metrics
  credit_ledger_entries: number;
  total_credit_supply: number;
  
  // Payout metrics
  total_payouts: number;
  pending_payouts: number;
  paid_payouts: number;
  failed_payouts: number;
  total_paid_cents: number;
  
  // Dispute metrics
  total_disputes: number;
  open_disputes: number;
  resolved_refund_disputes: number;
  resolved_no_refund_disputes: number;
  
  // Timestamp
  snapshot_at: string;
}

export type BackupLabel = 
  | "daily-summary"
  | "weekly-summary"
  | "monthly-summary"
  | "pre-deploy"
  | "post-deploy"
  | "manual";

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
export async function runBackupJob(label: BackupLabel = "daily-summary", notes?: string): Promise<BackupSnapshot> {
  // Aggregate all important metrics in a single efficient query
  const aggregateResult = await query<{
    user_count: string;
    client_count: string;
    cleaner_count: string;
    admin_count: string;
    job_count: string;
    credit_ledger_entries: string;
    total_credit_supply: string;
    total_payouts: string;
    pending_payouts: string;
    paid_payouts: string;
    failed_payouts: string;
    total_paid_cents: string;
    total_disputes: string;
    open_disputes: string;
    resolved_refund_disputes: string;
    resolved_no_refund_disputes: string;
  }>(
    `
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
    `
  );

  const agg = aggregateResult.rows[0];

  // Get jobs by status breakdown
  const statusResult = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM jobs GROUP BY status`
  );
  
  const jobsByStatus: Record<string, number> = {};
  for (const row of statusResult.rows) {
    jobsByStatus[row.status] = Number(row.count);
  }

  // Build the backup data
  const data: BackupData = {
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

  const metadata: BackupMetadata = {
    version: 1,
    source: "backup-worker",
    environment: process.env.NODE_ENV || "development",
    notes,
  };

  // Insert into backups table
  const result = await query<{
    id: string;
    label: string;
    created_at: string;
    metadata: string;
    data: string;
  }>(
    `
      INSERT INTO backups (label, metadata, data)
      VALUES ($1, $2::jsonb, $3::jsonb)
      RETURNING id, label, created_at::text, metadata::text, data::text
    `,
    [label, JSON.stringify(metadata), JSON.stringify(data)]
  );

  const row = result.rows[0];

  const snapshot: BackupSnapshot = {
    id: row.id,
    label: row.label,
    created_at: row.created_at,
    metadata: JSON.parse(row.metadata),
    data: JSON.parse(row.data),
  };

  logger.info("backup_snapshot_created", {
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
export async function getBackupsByLabel(
  label: BackupLabel,
  limit = 10
): Promise<BackupSnapshot[]> {
  const result = await query<{
    id: string;
    label: string;
    created_at: string;
    metadata: string;
    data: string;
  }>(
    `
      SELECT id, label, created_at::text, metadata::text, data::text
      FROM backups
      WHERE label = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [label, limit]
  );

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
export async function getLatestBackup(): Promise<BackupSnapshot | null> {
  const result = await query<{
    id: string;
    label: string;
    created_at: string;
    metadata: string;
    data: string;
  }>(
    `
      SELECT id, label, created_at::text, metadata::text, data::text
      FROM backups
      ORDER BY created_at DESC
      LIMIT 1
    `
  );

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
export function compareBackups(
  older: BackupSnapshot,
  newer: BackupSnapshot
): Record<string, { old: number; new: number; change: number; pct: string }> {
  const metrics: (keyof BackupData)[] = [
    "user_count",
    "client_count",
    "cleaner_count",
    "job_count",
    "credit_ledger_entries",
    "total_credit_supply",
    "pending_payouts",
    "open_disputes",
  ];

  const comparison: Record<string, { old: number; new: number; change: number; pct: string }> = {};

  for (const metric of metrics) {
    const oldVal = older.data[metric] as number;
    const newVal = newer.data[metric] as number;
    const change = newVal - oldVal;
    const pct = oldVal > 0 ? ((change / oldVal) * 100).toFixed(2) + "%" : "N/A";

    comparison[metric] = { old: oldVal, new: newVal, change, pct };
  }

  return comparison;
}

/**
 * Clean up old backups, keeping only the most recent N per label
 */
export async function cleanupOldBackups(keepPerLabel = 30): Promise<number> {
  const result = await query<{ deleted_count: string }>(
    `
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
    `,
    [keepPerLabel]
  );

  const deletedCount = result.rows.length;

  if (deletedCount > 0) {
    logger.info("old_backups_cleaned", { deleted_count: deletedCount });
  }

  return deletedCount;
}

