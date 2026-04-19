import { query } from "../db/client";

export interface StatusMetrics {
  openPayoutFlags: number;
  failedWebhooks24h: number;
  stuckJobs: number;
  pausedCleaners: number;
  pendingPayouts: number;
  openDisputes: number;
  openFraudAlerts: number;
}

async function count(sql: string): Promise<number> {
  const result = await query<{ count: string }>(sql, []);
  return parseInt(result.rows[0]?.count || "0", 10);
}

export async function getStatusMetrics(): Promise<StatusMetrics> {
  const [
    openPayoutFlags,
    failedWebhooks24h,
    stuckJobs,
    pausedCleaners,
    pendingPayouts,
    openDisputes,
    openFraudAlerts,
  ] = await Promise.all([
    count(`SELECT COUNT(*) as count FROM payout_reconciliation_flags WHERE status = 'open'`),
    count(
      `SELECT COUNT(*) as count FROM stripe_events WHERE processed = false AND created_at >= NOW() - INTERVAL '24 hours'`
    ),
    count(
      `SELECT COUNT(*) as count FROM jobs
       WHERE status IN ('accepted', 'on_my_way', 'in_progress')
         AND updated_at < NOW() - INTERVAL '4 hours'`
    ),
    count(`SELECT COUNT(*) as count FROM cleaner_profiles WHERE payout_paused = true`),
    count(`SELECT COUNT(*) as count FROM payouts WHERE status = 'pending'`),
    count(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`),
    count(`SELECT COUNT(*) as count FROM fraud_alerts WHERE status = 'open'`),
  ]);

  return {
    openPayoutFlags,
    failedWebhooks24h,
    stuckJobs,
    pausedCleaners,
    pendingPayouts,
    openDisputes,
    openFraudAlerts,
  };
}

export async function checkDatabaseReady(): Promise<number> {
  const start = Date.now();
  await query("SELECT 1", []);
  return Date.now() - start;
}
