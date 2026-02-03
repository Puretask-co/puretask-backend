// src/routes/manager.ts
// Manager dashboard API routes
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { logger } from "../lib/logger";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../middleware/authCanonical";
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
managerRouter.use(requireAuth);
managerRouter.use(requireAdmin);

managerRouter.use(requireAdmin);

// ============================================
// Dashboard Overview
// ============================================

/**
 * @swagger
 * /manager/overview:
 *   get:
 *     summary: Get manager dashboard overview
 *     description: Get complete dashboard overview with all KPIs.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview
 *       401:
 *         description: Unauthorized - admin only
 */
managerRouter.get("/overview", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const overview = await getDashboardOverview();
    res.json({ overview });
  } catch (error) {
    logger.error("get_overview_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_OVERVIEW_FAILED", message: (error as Error).message },
    });
  }
}));

/**
 * @swagger
 * /manager/alerts:
 *   get:
 *     summary: Get active alerts
 *     description: Get active alerts that need attention.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active alerts
 */
managerRouter.get("/alerts", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const alerts = await getActiveAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    logger.error("get_alerts_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_ALERTS_FAILED", message: (error as Error).message },
    });
  }
}));

// ============================================
// Supply & Demand
// ============================================

/**
 * @swagger
 * /manager/heatmap:
 *   get:
 *     summary: Get supply/demand heatmap
 *     description: Get supply/demand heatmap by hour and day.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Supply/demand heatmap
 */
managerRouter.get("/heatmap", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const heatmap = await getSupplyDemandHeatmap();
    res.json({ heatmap });
  } catch (error) {
    logger.error("get_heatmap_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_HEATMAP_FAILED", message: (error as Error).message },
    });
  }
}));

// ============================================
// Cleaner Analytics
// ============================================

/**
 * @swagger
 * /manager/tiers:
 *   get:
 *     summary: Get tier distribution
 *     description: Get cleaner tier distribution and metrics.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tier distribution
 */
managerRouter.get("/tiers", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const distribution = await getTierDistribution();
    res.json({ distribution });
  } catch (error) {
    logger.error("get_tiers_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_TIERS_FAILED", message: (error as Error).message },
    });
  }
}));

// ============================================
// Retention Analytics
// ============================================

/**
 * GET /manager/retention
 * Get retention cohort analysis
 */
managerRouter.get("/retention", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const cohorts = await getRetentionCohorts();
    res.json({ cohorts });
  } catch (error) {
    logger.error("get_retention_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_RETENTION_FAILED", message: (error as Error).message },
    });
  }
}));

// ============================================
// Operational Stats
// ============================================

/**
 * @swagger
 * /manager/support-stats:
 *   get:
 *     summary: Get support stats
 *     description: Get support ticket statistics.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support statistics
 */
managerRouter.get("/support-stats", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const stats = await getTicketStats();
    res.json({ stats });
  } catch (error) {
    logger.error("get_support_stats_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_SUPPORT_STATS_FAILED", message: (error as Error).message },
    });
  }
}));

/**
 * @swagger
 * /manager/background-check-stats:
 *   get:
 *     summary: Get background check stats
 *     description: Get background check statistics.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Background check statistics
 */
managerRouter.get("/background-check-stats", authedHandler(async (_req: AuthedRequest, res: Response) => {
  try {
    const stats = await getBackgroundCheckStats();
    res.json({ stats });
  } catch (error) {
    logger.error("get_bgcheck_stats_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_BGCHECK_STATS_FAILED", message: (error as Error).message },
    });
  }
}));

/**
 * @swagger
 * /manager/full-report:
 *   get:
 *     summary: Get full manager report
 *     description: Get comprehensive manager report combining all metrics.
 *     tags: [Manager]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Full manager report
 */
managerRouter.get("/full-report", authedHandler(async (_req: AuthedRequest, res: Response) => {
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
}));

export default managerRouter;

