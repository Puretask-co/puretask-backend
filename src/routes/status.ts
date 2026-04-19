// src/routes/status.ts
// Operational status endpoints for monitoring

import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { isN8nWebhookConfigured, isN8nApiConfigured } from "../lib/n8nClient";
import { checkDatabaseReady, getStatusMetrics } from "../services/statusService";

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
    n8nWebhookConfigured: boolean;
    n8nApiConfigured: boolean;
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
 *                     n8nWebhookConfigured: { type: 'boolean' }
 *                     n8nApiConfigured: { type: 'boolean' }
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

    const {
      openPayoutFlags,
      failedWebhooks24h,
      stuckJobs,
      pausedCleaners,
      pendingPayouts,
      openDisputes,
      openFraudAlerts,
    } = await getStatusMetrics();
    if (openPayoutFlags > 10) {
      alerts.push(`${openPayoutFlags} open payout reconciliation flags`);
      status = "warning";
    }

    // 2. Failed webhooks in last 24h
    if (failedWebhooks24h > 5) {
      alerts.push(`${failedWebhooks24h} failed webhooks in last 24h`);
      if (failedWebhooks24h > 20) status = "critical";
      else if (status === "ok") status = "warning";
    }

    // 3. Stuck jobs (in active state for > 4 hours without update)
    if (stuckJobs > 0) {
      alerts.push(`${stuckJobs} potentially stuck jobs`);
      if (stuckJobs > 5) status = "critical";
      else if (status !== "critical") status = "warning";
    }

    // 4. Payout-paused cleaners
    if (pausedCleaners > 5) {
      alerts.push(`${pausedCleaners} cleaners with paused payouts`);
    }

    // 5. Pending payouts (bonus metric)
    if (pendingPayouts > 50) {
      alerts.push(`${pendingPayouts} payouts pending`);
    }

    // 6. Open disputes (bonus metric)
    if (openDisputes > 10) {
      alerts.push(`${openDisputes} open disputes`);
    }

    // 7. Open fraud alerts (bonus metric)
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
        n8nWebhookConfigured: isN8nWebhookConfigured(),
        n8nApiConfigured: isN8nApiConfigured(),
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
    const dbLatency = await checkDatabaseReady();

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
