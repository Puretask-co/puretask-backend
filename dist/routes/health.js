"use strict";
// src/routes/health.ts
// Health check endpoint for load balancers and monitoring
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("../db/client");
const env_1 = require("../config/env");
const healthRouter = (0, express_1.Router)();
/**
 * GET /health
 * Basic health check - always returns 200 if server is running
 */
healthRouter.get("/", (_req, res) => {
    res.json({
        ok: true,
        status: "ok",
        service: "puretask-backend",
        time: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        env: env_1.env.NODE_ENV,
    });
});
/**
 * GET /health/ready
 * Readiness check - verifies database connectivity
 */
healthRouter.get("/ready", async (_req, res) => {
    try {
        // Test database connection
        const result = await client_1.pool.query("SELECT 1 as connected");
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
    }
    catch (error) {
        res.status(503).json({
            status: "not_ready",
            database: "error",
            error: error.message,
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
exports.default = healthRouter;
