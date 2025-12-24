// src/routes/health.ts
// Health check endpoint for load balancers and monitoring

import { Router } from "express";
import { pool } from "../db/client";
import { logger } from "../lib/logger";

const healthRouter = Router();

/**
 * GET /health
 * Basic health check - always returns 200 if server is running
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
 * GET /health/ready
 * Readiness check - verifies database connectivity
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

export default healthRouter;
