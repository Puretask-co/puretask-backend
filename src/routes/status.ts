// src/routes/status.ts
// Operational status endpoints for monitoring

import { Router, Request, Response } from "express";
import { query } from "../db/client";
import { logger } from "../lib/logger";

const router = Router();

// ============================================
// Types
// ============================================

interface StatusSummary {
  timestamp: string;
  status: "ok" | "warning" | "critical";
  metrics: {
    openPayoutFlags: number;
    failedWebhooks24h: number;
    stuckJobs: number;
    pausedCleaners: number;
    pendingPayouts: number;
    openDisputes: number;
    openFraudAlerts: number;
  };
  alerts: string[];
  uptimeSeconds: number;
}

// Track server start time
const SERVER_START = Date.now();

// ============================================
// GET /status/summary
// Quick operational health summary
// ============================================

/**
 * @swagger
 * /status/summary:
 *   get:
 *     summary: Get operational health summary
 *     description: Get quick operational health summary with metrics and alerts for monitoring.
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Status summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 status:
 *                   type: string
 *                   enum: [ok, warning, critical]
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     openPayoutFlags: { type: 'number' }
 *                     failedWebhooks24h: { type: 'number' }
 *                     stuckJobs: { type: 'number' }
 *                     pausedCleaners: { type: 'number' }
 *                     pendingPayouts: { type: 'number' }
 *                     openDisputes: { type: 'number' }
 *                     openFraudAlerts: { type: 'number' }
 *                 alerts:
 *                   type: array
 *                   items: { type: 'string' }
 *                 uptimeSeconds: { type: 'number' }
 *       503:
 *         description: Critical status
 */
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const alerts: string[] = [];
    let status: "ok" | "warning" | "critical" = "ok";

    // 1. Open payout reconciliation flags
    const payoutFlagsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM payout_reconciliation_flags WHERE status = 'open'`,
      []
    );
    const openPayoutFlags = parseInt(payoutFlagsResult.rows[0]?.count || "0", 10);
    if (openPayoutFlags > 10) {
      alerts.push(`${openPayoutFlags} open payout reconciliation flags`);
      status = "warning";
    }

    // 2. Failed webhooks in last 24h
    const webhookResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM stripe_events WHERE processed = false AND created_at >= NOW() - INTERVAL '24 hours'`,
      []
    );
    const failedWebhooks24h = parseInt(webhookResult.rows[0]?.count || "0", 10);
    if (failedWebhooks24h > 5) {
      alerts.push(`${failedWebhooks24h} failed webhooks in last 24h`);
      if (failedWebhooks24h > 20) status = "critical";
      else if (status === "ok") status = "warning";
    }

    // 3. Stuck jobs (in active state for > 4 hours without update)
    const stuckJobsResult = await query<{ count: string }>(
      `
        SELECT COUNT(*) as count FROM jobs 
        WHERE status IN ('accepted', 'on_my_way', 'in_progress')
        AND updated_at < NOW() - INTERVAL '4 hours'
      `,
      []
    );
    const stuckJobs = parseInt(stuckJobsResult.rows[0]?.count || "0", 10);
    if (stuckJobs > 0) {
      alerts.push(`${stuckJobs} potentially stuck jobs`);
      if (stuckJobs > 5) status = "critical";
      else if (status !== "critical") status = "warning";
    }

    // 4. Payout-paused cleaners
    const pausedCleanersResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM cleaner_profiles WHERE payout_paused = true`,
      []
    );
    const pausedCleaners = parseInt(pausedCleanersResult.rows[0]?.count || "0", 10);
    if (pausedCleaners > 5) {
      alerts.push(`${pausedCleaners} cleaners with paused payouts`);
    }

    // 5. Pending payouts (bonus metric)
    const pendingPayoutsResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM payouts WHERE status = 'pending'`,
      []
    );
    const pendingPayouts = parseInt(pendingPayoutsResult.rows[0]?.count || "0", 10);
    if (pendingPayouts > 50) {
      alerts.push(`${pendingPayouts} payouts pending`);
    }

    // 6. Open disputes (bonus metric)
    const disputesResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`,
      []
    );
    const openDisputes = parseInt(disputesResult.rows[0]?.count || "0", 10);
    if (openDisputes > 10) {
      alerts.push(`${openDisputes} open disputes`);
    }

    // 7. Open fraud alerts (bonus metric)
    const fraudResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM fraud_alerts WHERE status = 'open'`,
      []
    );
    const openFraudAlerts = parseInt(fraudResult.rows[0]?.count || "0", 10);
    if (openFraudAlerts > 0) {
      alerts.push(`${openFraudAlerts} open fraud alerts`);
      if (status !== "critical") status = "warning";
    }

    const summary: StatusSummary = {
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
    logger.info("status_summary_check", {
      status: summary.status,
      metrics: summary.metrics,
      alertCount: alerts.length,
    });

    // Return appropriate HTTP status
    const httpStatus = status === "critical" ? 503 : status === "warning" ? 200 : 200;
    res.status(httpStatus).json(summary);
  } catch (error) {
    logger.error("status_summary_failed", { error });
    res.status(500).json({
      timestamp: new Date().toISOString(),
      status: "critical",
      error: "Failed to fetch status summary",
      alerts: ["Status check failed - database may be unavailable"],
    });
  }
});

/**
 * @swagger
 * /status/ping:
 *   get:
 *     summary: Liveness check
 *     description: Simple ping endpoint for liveness checks.
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Service is alive
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 pong: { type: 'boolean', example: true }
 *                 timestamp: { type: 'string', format: 'date-time' }
 */
router.get("/ping", (_req: Request, res: Response) => {
  res.json({ pong: true, timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /status/ready:
 *   get:
 *     summary: Readiness check
 *     description: Check if service is ready to accept requests, including database connectivity.
 *     tags: [Status]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ready: { type: 'boolean', example: true }
 *                 timestamp: { type: 'string', format: 'date-time' }
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         ok: { type: 'boolean' }
 *                         latencyMs: { type: 'number' }
 *       503:
 *         description: Service is not ready
 */
router.get("/ready", async (_req: Request, res: Response) => {
  try {
    const start = Date.now();
    await query("SELECT 1", []);
    const dbLatency = Date.now() - start;

    res.json({
      ready: true,
      timestamp: new Date().toISOString(),
      checks: {
        database: { ok: true, latencyMs: dbLatency },
      },
    });
  } catch (error) {
    logger.error("readiness_check_failed", { error });
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      checks: {
        database: { ok: false, error: "Connection failed" },
      },
    });
  }
});

export default router;

