// src/routes/manager.ts
// Manager dashboard API routes
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { logger } from "../lib/logger";
import { jwtAuthMiddleware, JWTAuthedRequest } from "../middleware/jwtAuth";
import {
  getDashboardOverview,
  getSupplyDemandHeatmap,
  getTierDistribution,
  getRetentionCohorts,
  getActiveAlerts,
} from "../services/managerDashboardService";
import { getTicketStats } from "../services/supportService";
import { getBackgroundCheckStats } from "../services/backgroundCheckService";

const managerRouter = Router();

// All routes require auth and admin role
managerRouter.use(jwtAuthMiddleware);

const requireAdmin = (req: JWTAuthedRequest, res: Response, next: () => void) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Admin access required" },
    });
  }
  next();
};

managerRouter.use(requireAdmin);

// ============================================
// Dashboard Overview
// ============================================

/**
 * GET /manager/overview
 * Get complete dashboard overview with all KPIs
 */
managerRouter.get("/overview", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const overview = await getDashboardOverview();
    res.json({ overview });
  } catch (error) {
    logger.error("get_overview_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_OVERVIEW_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /manager/alerts
 * Get active alerts that need attention
 */
managerRouter.get("/alerts", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const alerts = await getActiveAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    logger.error("get_alerts_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_ALERTS_FAILED", message: (error as Error).message },
    });
  }
});

// ============================================
// Supply & Demand
// ============================================

/**
 * GET /manager/heatmap
 * Get supply/demand heatmap by hour and day
 */
managerRouter.get("/heatmap", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const heatmap = await getSupplyDemandHeatmap();
    res.json({ heatmap });
  } catch (error) {
    logger.error("get_heatmap_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_HEATMAP_FAILED", message: (error as Error).message },
    });
  }
});

// ============================================
// Cleaner Analytics
// ============================================

/**
 * GET /manager/tiers
 * Get cleaner tier distribution and metrics
 */
managerRouter.get("/tiers", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const distribution = await getTierDistribution();
    res.json({ distribution });
  } catch (error) {
    logger.error("get_tiers_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_TIERS_FAILED", message: (error as Error).message },
    });
  }
});

// ============================================
// Retention Analytics
// ============================================

/**
 * GET /manager/retention
 * Get retention cohort analysis
 */
managerRouter.get("/retention", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const cohorts = await getRetentionCohorts();
    res.json({ cohorts });
  } catch (error) {
    logger.error("get_retention_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_RETENTION_FAILED", message: (error as Error).message },
    });
  }
});

// ============================================
// Operational Stats
// ============================================

/**
 * GET /manager/support-stats
 * Get support ticket statistics
 */
managerRouter.get("/support-stats", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const stats = await getTicketStats();
    res.json({ stats });
  } catch (error) {
    logger.error("get_support_stats_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_SUPPORT_STATS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /manager/background-check-stats
 * Get background check statistics
 */
managerRouter.get("/background-check-stats", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const stats = await getBackgroundCheckStats();
    res.json({ stats });
  } catch (error) {
    logger.error("get_bgcheck_stats_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_BGCHECK_STATS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /manager/full-report
 * Get comprehensive report combining all metrics
 */
managerRouter.get("/full-report", async (_req: JWTAuthedRequest, res: Response) => {
  try {
    const [overview, alerts, heatmap, tiers, retention, supportStats, bgCheckStats] =
      await Promise.all([
        getDashboardOverview(),
        getActiveAlerts(),
        getSupplyDemandHeatmap(),
        getTierDistribution(),
        getRetentionCohorts(),
        getTicketStats(),
        getBackgroundCheckStats(),
      ]);

    res.json({
      generatedAt: new Date().toISOString(),
      overview,
      alerts,
      heatmap,
      tiers,
      retention,
      supportStats,
      bgCheckStats,
    });
  } catch (error) {
    logger.error("get_full_report_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_REPORT_FAILED", message: (error as Error).message },
    });
  }
});

export default managerRouter;

