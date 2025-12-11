"use strict";
// src/services/operationalMetricsService.ts
// Operational health metrics for monitoring key business flows
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOperationalMetrics = getOperationalMetrics;
exports.getMetricTrends = getMetricTrends;
exports.getSystemHealthSnapshot = getSystemHealthSnapshot;
exports.logOperationalSnapshot = logOperationalSnapshot;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
// ============================================
// Core Metrics Function
// ============================================
async function getOperationalMetrics(daysBack = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();
    // Job metrics
    const jobMetrics = await (0, client_1.query)(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
        COUNT(*) FILTER (WHERE status = 'disputed') AS disputed,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND EXISTS (
          SELECT 1 FROM job_events je 
          WHERE je.job_id = jobs.id 
          AND je.event_type = 'job_cancelled' 
          AND je.metadata->>'reason' = 'no_show'
        )) AS no_show_cancelled,
        AVG(EXTRACT(EPOCH FROM (actual_end_at - actual_start_at)) / 3600) 
          FILTER (WHERE actual_start_at IS NOT NULL AND actual_end_at IS NOT NULL) AS avg_duration_hours
      FROM jobs
      WHERE created_at >= $1 AND created_at <= $2
    `, [startStr, endStr]);
    const jm = jobMetrics.rows[0];
    const totalJobs = parseInt(jm.total || "0", 10);
    const completedJobs = parseInt(jm.completed || "0", 10);
    const cancelledJobs = parseInt(jm.cancelled || "0", 10);
    const disputedJobs = parseInt(jm.disputed || "0", 10);
    const noShowCancelled = parseInt(jm.no_show_cancelled || "0", 10);
    // Payout metrics
    const payoutMetrics = await (0, client_1.query)(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'paid') AS paid,
        COUNT(*) FILTER (WHERE status = 'failed') AS failed,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(DISTINCT prf.payout_id) AS with_flags,
        COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS total_amount
      FROM payouts p
      LEFT JOIN payout_reconciliation_flags prf ON prf.payout_id = p.id
      WHERE p.created_at >= $1 AND p.created_at <= $2
    `, [startStr, endStr]);
    const pm = payoutMetrics.rows[0];
    const totalPayouts = parseInt(pm.total || "0", 10);
    const paidPayouts = parseInt(pm.paid || "0", 10);
    const failedPayouts = parseInt(pm.failed || "0", 10);
    const pendingPayouts = parseInt(pm.pending || "0", 10);
    const payoutsWithFlags = parseInt(pm.with_flags || "0", 10);
    const totalPayoutCents = parseInt(pm.total_amount || "0", 10);
    // Stripe metrics
    const stripeMetrics = await (0, client_1.query)(`
      WITH event_stats AS (
        SELECT
          COUNT(*) AS events_received,
          COUNT(*) FILTER (WHERE processed = false) AS events_failed
        FROM stripe_events
        WHERE created_at >= $1 AND created_at <= $2
      ),
      pi_stats AS (
        SELECT
          COUNT(*) AS pi_created,
          COUNT(*) FILTER (WHERE status = 'succeeded') AS pi_succeeded,
          COUNT(*) FILTER (WHERE status IN ('canceled', 'failed', 'requires_payment_method')) AS pi_failed
        FROM payment_intents
        WHERE created_at >= $1 AND created_at <= $2
      )
      SELECT * FROM event_stats, pi_stats
    `, [startStr, endStr]);
    const sm = stripeMetrics.rows[0];
    const webhookEventsReceived = parseInt(sm.events_received || "0", 10);
    const webhookEventsFailed = parseInt(sm.events_failed || "0", 10);
    const piCreated = parseInt(sm.pi_created || "0", 10);
    const piSucceeded = parseInt(sm.pi_succeeded || "0", 10);
    const piFailed = parseInt(sm.pi_failed || "0", 10);
    // Cleaner metrics
    const cleanerMetrics = await (0, client_1.query)(`
      SELECT
        COUNT(DISTINCT cp.user_id) AS active,
        AVG(cp.reliability_score) AS avg_reliability,
        COUNT(*) FILTER (WHERE cp.low_flexibility_badge = true) AS with_low_flex,
        (SELECT COUNT(*) FROM jobs WHERE cleaner_id IS NOT NULL AND created_at >= $1) AS total_jobs
      FROM cleaner_profiles cp
      WHERE EXISTS (
        SELECT 1 FROM jobs j 
        WHERE j.cleaner_id = cp.user_id 
        AND j.created_at >= $1 AND j.created_at <= $2
      )
    `, [startStr, endStr]);
    const cm = cleanerMetrics.rows[0];
    const activeCleaners = parseInt(cm.active || "0", 10);
    const avgReliability = parseFloat(cm.avg_reliability || "0");
    const withLowFlex = parseInt(cm.with_low_flex || "0", 10);
    const cleanerTotalJobs = parseInt(cm.total_jobs || "0", 10);
    // Client metrics
    const clientMetrics = await (0, client_1.query)(`
      SELECT
        COUNT(DISTINCT j.client_id) AS active,
        AVG(COALESCE(crs.score, 0)) AS avg_risk,
        COUNT(*) FILTER (WHERE crs.risk_band IN ('high', 'critical')) AS high_risk
      FROM jobs j
      LEFT JOIN client_risk_scores crs ON crs.client_id = j.client_id
      WHERE j.created_at >= $1 AND j.created_at <= $2
    `, [startStr, endStr]);
    const clm = clientMetrics.rows[0];
    const activeClients = parseInt(clm.active || "0", 10);
    const avgRiskScore = parseFloat(clm.avg_risk || "0");
    const highRiskClients = parseInt(clm.high_risk || "0", 10);
    // Alert metrics
    const alertMetrics = await (0, client_1.query)(`
      SELECT
        (SELECT COUNT(*) FROM fraud_alerts WHERE status = 'open' AND created_at >= $1) AS fraud_open,
        (SELECT COUNT(*) FROM fraud_alerts WHERE status != 'open' AND created_at >= $1) AS fraud_resolved,
        (SELECT COUNT(*) FROM disputes WHERE status = 'open' AND created_at >= $1) AS disputes_open,
        (SELECT COUNT(*) FROM disputes WHERE status != 'open' AND created_at >= $1) AS disputes_resolved
    `, [startStr]);
    const am = alertMetrics.rows[0];
    // Calculate rates
    const noShowRate = totalJobs > 0 ? (noShowCancelled / totalJobs) * 100 : 0;
    const completionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;
    const disputeRatePer100 = totalJobs > 0 ? (disputedJobs / totalJobs) * 100 : 0;
    const reconciliationFlagRate = totalPayouts > 0 ? (payoutsWithFlags / totalPayouts) * 100 : 0;
    const webhookFailureRate = webhookEventsReceived > 0 ? (webhookEventsFailed / webhookEventsReceived) * 100 : 0;
    const paymentSuccessRate = piCreated > 0 ? (piSucceeded / piCreated) * 100 : 0;
    const lowFlexBadgeRate = activeCleaners > 0 ? (withLowFlex / activeCleaners) * 100 : 0;
    const highRiskRate = activeClients > 0 ? (highRiskClients / activeClients) * 100 : 0;
    return {
        period: {
            start: startStr,
            end: endStr,
            days: daysBack,
        },
        jobs: {
            total: totalJobs,
            completed: completedJobs,
            cancelled: cancelledJobs,
            disputed: disputedJobs,
            noShowCancelled,
            noShowRate: Math.round(noShowRate * 100) / 100,
            completionRate: Math.round(completionRate * 100) / 100,
            disputeRate: Math.round(disputeRatePer100 * 100) / 100,
            avgDurationHours: Math.round(parseFloat(jm.avg_duration_hours || "0") * 100) / 100,
        },
        payouts: {
            total: totalPayouts,
            paid: paidPayouts,
            failed: failedPayouts,
            pending: pendingPayouts,
            withReconciliationFlags: payoutsWithFlags,
            reconciliationFlagRate: Math.round(reconciliationFlagRate * 100) / 100,
            totalAmountCents: totalPayoutCents,
            avgPayoutCents: paidPayouts > 0 ? Math.round(totalPayoutCents / paidPayouts) : 0,
        },
        stripe: {
            webhookEventsReceived,
            webhookEventsFailed,
            webhookFailureRate: Math.round(webhookFailureRate * 100) / 100,
            paymentIntentsCreated: piCreated,
            paymentIntentsSucceeded: piSucceeded,
            paymentIntentsFailed: piFailed,
            paymentSuccessRate: Math.round(paymentSuccessRate * 100) / 100,
        },
        cleaners: {
            active: activeCleaners,
            avgReliabilityScore: Math.round(avgReliability * 100) / 100,
            withLowFlexBadge: withLowFlex,
            lowFlexBadgeRate: Math.round(lowFlexBadgeRate * 100) / 100,
            avgJobsPerCleaner: activeCleaners > 0 ? Math.round((cleanerTotalJobs / activeCleaners) * 100) / 100 : 0,
        },
        clients: {
            active: activeClients,
            avgRiskScore: Math.round(avgRiskScore * 100) / 100,
            highRiskCount: highRiskClients,
            highRiskRate: Math.round(highRiskRate * 100) / 100,
            avgJobsPerClient: activeClients > 0 ? Math.round((totalJobs / activeClients) * 100) / 100 : 0,
        },
        alerts: {
            fraudAlertsOpen: parseInt(am.fraud_open || "0", 10),
            fraudAlertsResolved: parseInt(am.fraud_resolved || "0", 10),
            disputesOpen: parseInt(am.disputes_open || "0", 10),
            disputesResolved: parseInt(am.disputes_resolved || "0", 10),
        },
    };
}
// ============================================
// Trend Metrics (Daily Breakdown)
// ============================================
async function getMetricTrends(daysBack = 30) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    const startStr = startDate.toISOString();
    const endStr = endDate.toISOString();
    // Daily job metrics
    const jobTrends = await (0, client_1.query)(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND EXISTS (
          SELECT 1 FROM job_events je 
          WHERE je.job_id = jobs.id 
          AND je.event_type = 'job_cancelled' 
          AND je.metadata->>'reason' = 'no_show'
        )) AS no_show,
        COUNT(*) FILTER (WHERE status = 'disputed') AS disputed
      FROM jobs
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startStr, endStr]);
    // Daily payout metrics
    const payoutTrends = await (0, client_1.query)(`
      SELECT
        DATE(p.created_at) AS date,
        COUNT(*) AS total,
        COUNT(DISTINCT prf.payout_id) AS with_flags,
        COUNT(*) FILTER (WHERE p.status = 'paid') AS paid
      FROM payouts p
      LEFT JOIN payout_reconciliation_flags prf ON prf.payout_id = p.id
      WHERE p.created_at >= $1 AND p.created_at <= $2
      GROUP BY DATE(p.created_at)
      ORDER BY date
    `, [startStr, endStr]);
    // Daily webhook metrics
    const webhookTrends = await (0, client_1.query)(`
      SELECT
        DATE(created_at) AS date,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE processed = false) AS failed
      FROM stripe_events
      WHERE created_at >= $1 AND created_at <= $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [startStr, endStr]);
    // Build trend arrays
    const noShowRate = jobTrends.rows.map((row) => ({
        date: row.date,
        value: parseInt(row.total, 10) > 0
            ? Math.round((parseInt(row.no_show, 10) / parseInt(row.total, 10)) * 10000) / 100
            : 0,
    }));
    const disputeRate = jobTrends.rows.map((row) => ({
        date: row.date,
        value: parseInt(row.total, 10) > 0
            ? Math.round((parseInt(row.disputed, 10) / parseInt(row.total, 10)) * 10000) / 100
            : 0,
    }));
    const reconciliationFlagRate = payoutTrends.rows.map((row) => ({
        date: row.date,
        value: parseInt(row.total, 10) > 0
            ? Math.round((parseInt(row.with_flags, 10) / parseInt(row.total, 10)) * 10000) / 100
            : 0,
    }));
    const webhookFailureRate = webhookTrends.rows.map((row) => ({
        date: row.date,
        value: parseInt(row.total, 10) > 0
            ? Math.round((parseInt(row.failed, 10) / parseInt(row.total, 10)) * 10000) / 100
            : 0,
    }));
    const payoutSuccessRate = payoutTrends.rows.map((row) => ({
        date: row.date,
        value: parseInt(row.total, 10) > 0
            ? Math.round((parseInt(row.paid, 10) / parseInt(row.total, 10)) * 10000) / 100
            : 0,
    }));
    return {
        noShowRate,
        disputeRate,
        reconciliationFlagRate,
        webhookFailureRate,
        payoutSuccessRate,
    };
}
async function getSystemHealthSnapshot() {
    const alerts = [];
    let overallStatus = "healthy";
    // Database check
    const dbStart = Date.now();
    let dbStatus = "ok";
    try {
        await (0, client_1.query)("SELECT 1", []);
    }
    catch {
        dbStatus = "error";
        overallStatus = "critical";
        alerts.push("Database connection failed");
    }
    const dbLatency = Date.now() - dbStart;
    // Stripe webhook health (last 1 hour)
    const webhookHealth = await (0, client_1.query)(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE processed = false) AS failed
      FROM stripe_events
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `, []);
    const webhookTotal = parseInt(webhookHealth.rows[0]?.total || "0", 10);
    const webhookFailed = parseInt(webhookHealth.rows[0]?.failed || "0", 10);
    const webhookFailRate = webhookTotal > 0 ? (webhookFailed / webhookTotal) * 100 : 0;
    let webhookStatus = "ok";
    if (webhookFailRate > 10) {
        webhookStatus = "error";
        overallStatus = "critical";
        alerts.push(`High Stripe webhook failure rate: ${webhookFailRate.toFixed(1)}%`);
    }
    else if (webhookFailRate > 5) {
        webhookStatus = "degraded";
        if (overallStatus === "healthy")
            overallStatus = "degraded";
        alerts.push(`Elevated Stripe webhook failure rate: ${webhookFailRate.toFixed(1)}%`);
    }
    // Payout processing health
    const payoutHealth = await (0, client_1.query)(`
      SELECT
        COUNT(*) AS pending,
        EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 3600 AS oldest_hours
      FROM payouts
      WHERE status = 'pending'
    `, []);
    const pendingPayouts = parseInt(payoutHealth.rows[0]?.pending || "0", 10);
    const oldestPendingHours = parseFloat(payoutHealth.rows[0]?.oldest_hours || "0");
    let payoutStatus = "ok";
    if (oldestPendingHours > 48) {
        payoutStatus = "error";
        if (overallStatus !== "critical")
            overallStatus = "critical";
        alerts.push(`Payouts stuck for ${oldestPendingHours.toFixed(0)} hours`);
    }
    else if (oldestPendingHours > 24 || pendingPayouts > 100) {
        payoutStatus = "degraded";
        if (overallStatus === "healthy")
            overallStatus = "degraded";
        alerts.push(`${pendingPayouts} payouts pending, oldest ${oldestPendingHours.toFixed(1)}h`);
    }
    // Stuck jobs check
    const stuckJobs = await (0, client_1.query)(`
      SELECT COUNT(*) AS count
      FROM jobs
      WHERE status IN ('accepted', 'on_my_way', 'in_progress')
      AND updated_at < NOW() - INTERVAL '4 hours'
    `, []);
    const stuckCount = parseInt(stuckJobs.rows[0]?.count || "0", 10);
    let jobStatus = "ok";
    if (stuckCount > 10) {
        jobStatus = "error";
        if (overallStatus !== "critical")
            overallStatus = "critical";
        alerts.push(`${stuckCount} jobs potentially stuck`);
    }
    else if (stuckCount > 0) {
        jobStatus = "degraded";
        if (overallStatus === "healthy")
            overallStatus = "degraded";
        alerts.push(`${stuckCount} jobs may be stuck`);
    }
    // Reconciliation flags
    const reconFlags = await (0, client_1.query)(`
      SELECT COUNT(*) AS count
      FROM payout_reconciliation_flags
      WHERE status = 'open'
    `, []);
    const unresolvedFlags = parseInt(reconFlags.rows[0]?.count || "0", 10);
    let reconStatus = "ok";
    if (unresolvedFlags > 20) {
        reconStatus = "error";
        if (overallStatus === "healthy")
            overallStatus = "degraded";
        alerts.push(`${unresolvedFlags} unresolved reconciliation flags`);
    }
    else if (unresolvedFlags > 5) {
        reconStatus = "warning";
        alerts.push(`${unresolvedFlags} reconciliation flags need attention`);
    }
    return {
        timestamp: new Date().toISOString(),
        status: overallStatus,
        checks: {
            database: { status: dbStatus, latencyMs: dbLatency },
            stripeWebhooks: { status: webhookStatus, failureRateLast1h: Math.round(webhookFailRate * 100) / 100 },
            payoutProcessing: { status: payoutStatus, pendingCount: pendingPayouts, oldestPendingHours: Math.round(oldestPendingHours * 100) / 100 },
            jobProcessing: { status: jobStatus, stuckCount },
            reconciliation: { status: reconStatus, unresolvedFlags },
        },
        alerts,
    };
}
// ============================================
// Log Operational Metrics Periodically
// ============================================
async function logOperationalSnapshot() {
    try {
        const metrics = await getOperationalMetrics(1); // Last 24 hours
        const health = await getSystemHealthSnapshot();
        logger_1.logger.info("operational_metrics_snapshot", {
            period: "24h",
            jobs: metrics.jobs,
            payouts: metrics.payouts,
            stripe: metrics.stripe,
            systemStatus: health.status,
            alerts: health.alerts,
        });
    }
    catch (error) {
        logger_1.logger.error("operational_metrics_snapshot_failed", { error });
    }
}
