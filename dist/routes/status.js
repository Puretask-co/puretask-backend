"use strict";
// src/routes/status.ts
// Operational status endpoints for monitoring
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
// Track server start time
const SERVER_START = Date.now();
// ============================================
// GET /status/summary
// Quick operational health summary
// ============================================
router.get("/summary", async (_req, res) => {
    try {
        const alerts = [];
        let status = "ok";
        // 1. Open payout reconciliation flags
        const payoutFlagsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM payout_reconciliation_flags WHERE status = 'open'`, []);
        const openPayoutFlags = parseInt(payoutFlagsResult.rows[0]?.count || "0", 10);
        if (openPayoutFlags > 10) {
            alerts.push(`${openPayoutFlags} open payout reconciliation flags`);
            status = "warning";
        }
        // 2. Failed webhooks in last 24h
        const webhookResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM stripe_events WHERE processed = false AND created_at >= NOW() - INTERVAL '24 hours'`, []);
        const failedWebhooks24h = parseInt(webhookResult.rows[0]?.count || "0", 10);
        if (failedWebhooks24h > 5) {
            alerts.push(`${failedWebhooks24h} failed webhooks in last 24h`);
            if (failedWebhooks24h > 20)
                status = "critical";
            else if (status === "ok")
                status = "warning";
        }
        // 3. Stuck jobs (in active state for > 4 hours without update)
        const stuckJobsResult = await (0, client_1.query)(`
        SELECT COUNT(*) as count FROM jobs 
        WHERE status IN ('accepted', 'on_my_way', 'in_progress')
        AND updated_at < NOW() - INTERVAL '4 hours'
      `, []);
        const stuckJobs = parseInt(stuckJobsResult.rows[0]?.count || "0", 10);
        if (stuckJobs > 0) {
            alerts.push(`${stuckJobs} potentially stuck jobs`);
            if (stuckJobs > 5)
                status = "critical";
            else if (status !== "critical")
                status = "warning";
        }
        // 4. Payout-paused cleaners
        const pausedCleanersResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM cleaner_profiles WHERE payout_paused = true`, []);
        const pausedCleaners = parseInt(pausedCleanersResult.rows[0]?.count || "0", 10);
        if (pausedCleaners > 5) {
            alerts.push(`${pausedCleaners} cleaners with paused payouts`);
        }
        // 5. Pending payouts (bonus metric)
        const pendingPayoutsResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM payouts WHERE status = 'pending'`, []);
        const pendingPayouts = parseInt(pendingPayoutsResult.rows[0]?.count || "0", 10);
        if (pendingPayouts > 50) {
            alerts.push(`${pendingPayouts} payouts pending`);
        }
        // 6. Open disputes (bonus metric)
        const disputesResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`, []);
        const openDisputes = parseInt(disputesResult.rows[0]?.count || "0", 10);
        if (openDisputes > 10) {
            alerts.push(`${openDisputes} open disputes`);
        }
        // 7. Open fraud alerts (bonus metric)
        const fraudResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM fraud_alerts WHERE status = 'open'`, []);
        const openFraudAlerts = parseInt(fraudResult.rows[0]?.count || "0", 10);
        if (openFraudAlerts > 0) {
            alerts.push(`${openFraudAlerts} open fraud alerts`);
            if (status !== "critical")
                status = "warning";
        }
        const summary = {
            timestamp: new Date().toISOString(),
            status,
            metrics: {
                openPayoutFlags,
                failedWebhooks24h,
                stuckJobs,
                pausedCleaners,
                pendingPayouts,
                openDisputes,
                openFraudAlerts,
            },
            alerts,
            uptimeSeconds: Math.floor((Date.now() - SERVER_START) / 1000),
        };
        // Log for monitoring systems
        logger_1.logger.info("status_summary_check", {
            status: summary.status,
            metrics: summary.metrics,
            alertCount: alerts.length,
        });
        // Return appropriate HTTP status
        const httpStatus = status === "critical" ? 503 : status === "warning" ? 200 : 200;
        res.status(httpStatus).json(summary);
    }
    catch (error) {
        logger_1.logger.error("status_summary_failed", { error });
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: "critical",
            error: "Failed to fetch status summary",
            alerts: ["Status check failed - database may be unavailable"],
        });
    }
});
// ============================================
// GET /status/ping
// Simple liveness check
// ============================================
router.get("/ping", (_req, res) => {
    res.json({ pong: true, timestamp: new Date().toISOString() });
});
// ============================================
// GET /status/ready
// Readiness check (includes DB)
// ============================================
router.get("/ready", async (_req, res) => {
    try {
        const start = Date.now();
        await (0, client_1.query)("SELECT 1", []);
        const dbLatency = Date.now() - start;
        res.json({
            ready: true,
            timestamp: new Date().toISOString(),
            checks: {
                database: { ok: true, latencyMs: dbLatency },
            },
        });
    }
    catch (error) {
        logger_1.logger.error("readiness_check_failed", { error });
        res.status(503).json({
            ready: false,
            timestamp: new Date().toISOString(),
            checks: {
                database: { ok: false, error: "Connection failed" },
            },
        });
    }
});
exports.default = router;
