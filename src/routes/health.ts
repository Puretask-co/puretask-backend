// src/routes/health.ts
// Health check endpoint for load balancers and monitoring

import { Router } from "express";
import { pool } from "../db/client";
import { logger } from "../lib/logger";
import { getWorkerHealth } from "../lib/workerMetrics";

const healthRouter = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     description: Always returns 200 if server is running. Used by load balancers and monitoring.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: puretask-backend
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    status: "ok",
    service: "puretask-backend",
    timestamp: new Date().toISOString(),
  });
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Verifies database connectivity. Returns 503 if database is not connected.
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ready
 *                 database:
 *                   type: string
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       503:
 *         description: Service is not ready
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: not_ready
 *                 database:
 *                   type: string
 *                   example: disconnected
 */
healthRouter.get("/ready", async (_req, res) => {
  try {
    // Test database connection
    const result = await pool.query("SELECT 1 as connected");
    const dbConnected = result.rows[0]?.connected === 1;

    if (!dbConnected) {
      return res.status(503).json({
        status: "not_ready",
        database: "disconnected",
      });
    }

    res.json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("health_check_db_error", { error: (error as Error).message });
    res.status(503).json({
      status: "not_ready",
      database: "error",
    });
  }
});

/**
 * GET /health/live
 * Liveness check - verifies server is responsive
 */
healthRouter.get("/live", (_req, res) => {
  res.json({
    status: "alive",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

/**
 * GET /health/workers
 * Worker health check - metrics and alerts
 */
healthRouter.get("/workers", async (_req, res) => {
  try {
    const health = await getWorkerHealth();
    const statusCode = health.healthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error("worker_health_check_failed", { error: (error as Error).message });
    res.status(503).json({
      healthy: false,
      error: (error as Error).message,
    });
  }
});

export default healthRouter;
