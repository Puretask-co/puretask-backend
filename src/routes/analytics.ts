// src/routes/analytics.ts
// Analytics API routes - Revenue reports, trends, and business metrics
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { jwtAuthMiddleware, JWTAuthedRequest, requireRole } from "../middleware/jwtAuth";
import { logger } from "../lib/logger";
import {
  getDashboardMetrics,
  getRevenueTrend,
  getRevenueByPeriod,
  getJobTrend,
  getJobStatusBreakdown,
  getUserSignupTrend,
  getTopClients,
  getTopCleaners,
  getTopRatedCleaners,
  getCreditEconomyHealth,
  generateFullReport,
  TimeRange,
} from "../services/analyticsService";

const analyticsRouter = Router();

// All analytics routes require admin access
const requireAdmin = [jwtAuthMiddleware, requireRole("admin")];

/**
 * Helper to parse time range from query
 */
function parseTimeRange(query: any): TimeRange {
  const valid: TimeRange[] = ["day", "week", "month", "quarter", "year", "all"];
  const range = query.timeRange || query.range || "month";
  return valid.includes(range) ? range : "month";
}

// ============================================
// Dashboard
// ============================================

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard metrics
 *     description: Get comprehensive dashboard metrics for admin analytics.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *           default: month
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *       401:
 *         description: Unauthorized - admin only
 */
analyticsRouter.get("/dashboard", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
  try {
    const timeRange = parseTimeRange(req.query);
    const metrics = await getDashboardMetrics(timeRange);
    res.json({ timeRange, metrics });
  } catch (error) {
    logger.error("analytics_dashboard_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
    });
  }
});

// ============================================
// Revenue
// ============================================

/**
 * @swagger
 * /analytics/revenue/trend:
 *   get:
 *     summary: Get revenue trend
 *     description: Get revenue trend over time.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *     responses:
 *       200:
 *         description: Revenue trend data
 */
analyticsRouter.get(
  "/revenue/trend",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const trend = await getRevenueTrend(timeRange);
      res.json({ timeRange, trend });
    } catch (error) {
      logger.error("analytics_revenue_trend_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

/**
 * @swagger
 * /analytics/revenue/by-period:
 *   get:
 *     summary: Get revenue by period
 *     description: Get revenue breakdown grouped by day, week, or month.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *     responses:
 *       200:
 *         description: Revenue by period
 */
analyticsRouter.get(
  "/revenue/by-period",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const groupBy = (req.query.groupBy as "day" | "week" | "month") || "day";
      const data = await getRevenueByPeriod(groupBy, timeRange);
      res.json({ timeRange, groupBy, data });
    } catch (error) {
      logger.error("analytics_revenue_period_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Jobs
// ============================================

/**
 * @swagger
 * /analytics/jobs/trend:
 *   get:
 *     summary: Get job trend
 *     description: Get job count trend over time.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *     responses:
 *       200:
 *         description: Job trend data
 */
analyticsRouter.get(
  "/jobs/trend",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const trend = await getJobTrend(timeRange);
      res.json({ timeRange, trend });
    } catch (error) {
      logger.error("analytics_job_trend_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

/**
 * @swagger
 * /analytics/jobs/status:
 *   get:
 *     summary: Get job status breakdown
 *     description: Get breakdown of jobs by status.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *     responses:
 *       200:
 *         description: Job status breakdown
 */
analyticsRouter.get(
  "/jobs/status",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const breakdown = await getJobStatusBreakdown(timeRange);
      res.json({ timeRange, breakdown });
    } catch (error) {
      logger.error("analytics_job_status_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Users
// ============================================

/**
 * @swagger
 * /analytics/users/signups:
 *   get:
 *     summary: Get user signup trend
 *     description: Get user signup trend over time, optionally filtered by role.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, cleaner, all]
 *           default: all
 *     responses:
 *       200:
 *         description: User signup trend
 */
analyticsRouter.get(
  "/users/signups",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const role = (req.query.role as "client" | "cleaner" | "all") || "all";
      const trend = await getUserSignupTrend(role, timeRange);
      res.json({ timeRange, role, trend });
    } catch (error) {
      logger.error("analytics_user_signups_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Leaderboards / Top Performers
// ============================================

/**
 * @swagger
 * /analytics/top/clients:
 *   get:
 *     summary: Get top clients
 *     description: Get top clients by spending.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Top clients list
 */
analyticsRouter.get(
  "/top/clients",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const topClients = await getTopClients(limit, timeRange);
      res.json({ timeRange, limit, data: topClients });
    } catch (error) {
      logger.error("analytics_top_clients_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

/**
 * @swagger
 * /analytics/top/cleaners:
 *   get:
 *     summary: Get top cleaners
 *     description: Get top cleaners by earnings.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Top cleaners list
 */
analyticsRouter.get(
  "/top/cleaners",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const timeRange = parseTimeRange(req.query);
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const topCleaners = await getTopCleaners(limit, timeRange);
      res.json({ timeRange, limit, data: topCleaners });
    } catch (error) {
      logger.error("analytics_top_cleaners_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

/**
 * @swagger
 * /analytics/top/rated-cleaners:
 *   get:
 *     summary: Get top rated cleaners
 *     description: Get top rated cleaners by average rating.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Top rated cleaners list
 */
analyticsRouter.get(
  "/top/rated-cleaners",
  ...requireAdmin,
  async (req: JWTAuthedRequest, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
      const topRated = await getTopRatedCleaners(limit);
      res.json({ limit, data: topRated });
    } catch (error) {
      logger.error("analytics_top_rated_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Credit Economy
// ============================================

/**
 * @swagger
 * /analytics/credits/health:
 *   get:
 *     summary: Get credit economy health
 *     description: Get credit economy health metrics.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit economy health metrics
 */
analyticsRouter.get(
  "/credits/health",
  ...requireAdmin,
  async (_req: JWTAuthedRequest, res: Response) => {
    try {
      const health = await getCreditEconomyHealth();
      res.json({ health });
    } catch (error) {
      logger.error("analytics_credit_health_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Full Report
// ============================================

/**
 * @swagger
 * /analytics/report:
 *   get:
 *     summary: Generate full analytics report
 *     description: Generate comprehensive analytics report with all metrics.
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year, all]
 *     responses:
 *       200:
 *         description: Full analytics report
 */
analyticsRouter.get("/report", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
  try {
    const timeRange = parseTimeRange(req.query);
    const report = await generateFullReport(timeRange);
    res.json(report);
  } catch (error) {
    logger.error("analytics_report_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
    });
  }
});

export default analyticsRouter;
