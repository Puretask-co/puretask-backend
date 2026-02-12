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
 * GET /analytics/dashboard
 * Get comprehensive dashboard metrics
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
 * GET /analytics/revenue/trend
 * Get revenue over time
 */
analyticsRouter.get("/revenue/trend", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * GET /analytics/revenue/by-period
 * Get revenue breakdown by day/week/month
 */
analyticsRouter.get("/revenue/by-period", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

// ============================================
// Jobs
// ============================================

/**
 * GET /analytics/jobs/trend
 * Get job count over time
 */
analyticsRouter.get("/jobs/trend", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * GET /analytics/jobs/status
 * Get job status breakdown
 */
analyticsRouter.get("/jobs/status", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

// ============================================
// Users
// ============================================

/**
 * GET /analytics/users/signups
 * Get user signup trend
 */
analyticsRouter.get("/users/signups", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

// ============================================
// Leaderboards / Top Performers
// ============================================

/**
 * GET /analytics/top/clients
 * Get top clients by spending
 */
analyticsRouter.get("/top/clients", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * GET /analytics/top/cleaners
 * Get top cleaners by earnings
 */
analyticsRouter.get("/top/cleaners", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

/**
 * GET /analytics/top/rated-cleaners
 * Get top rated cleaners
 */
analyticsRouter.get("/top/rated-cleaners", ...requireAdmin, async (req: JWTAuthedRequest, res: Response) => {
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
});

// ============================================
// Credit Economy
// ============================================

/**
 * GET /analytics/credits/health
 * Get credit economy health metrics
 */
analyticsRouter.get("/credits/health", ...requireAdmin, async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const health = await getCreditEconomyHealth();
    res.json({ health });
  } catch (error) {
    logger.error("analytics_credit_health_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "ANALYTICS_ERROR", message: (error as Error).message },
    });
  }
});

// ============================================
// Full Report
// ============================================

/**
 * GET /analytics/report
 * Generate comprehensive analytics report
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

