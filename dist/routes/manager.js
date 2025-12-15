"use strict";
// src/routes/manager.ts
// Manager dashboard API routes
// V2 FEATURE — DISABLED FOR NOW
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const logger_1 = require("../lib/logger");
const auth_1 = require("../middleware/auth");
const managerDashboardService_1 = require("../services/managerDashboardService");
const supportService_1 = require("../services/supportService");
const backgroundCheckService_1 = require("../services/backgroundCheckService");
const managerRouter = (0, express_1.Router)();
// All routes require auth and admin role
managerRouter.use(auth_1.authMiddleware);
const requireAdmin = (req, res, next) => {
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
managerRouter.get("/overview", async (_req, res) => {
    try {
        const overview = await (0, managerDashboardService_1.getDashboardOverview)();
        res.json({ overview });
    }
    catch (error) {
        logger_1.logger.error("get_overview_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_OVERVIEW_FAILED", message: error.message },
        });
    }
});
/**
 * GET /manager/alerts
 * Get active alerts that need attention
 */
managerRouter.get("/alerts", async (_req, res) => {
    try {
        const alerts = await (0, managerDashboardService_1.getActiveAlerts)();
        res.json({ alerts, count: alerts.length });
    }
    catch (error) {
        logger_1.logger.error("get_alerts_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_ALERTS_FAILED", message: error.message },
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
managerRouter.get("/heatmap", async (_req, res) => {
    try {
        const heatmap = await (0, managerDashboardService_1.getSupplyDemandHeatmap)();
        res.json({ heatmap });
    }
    catch (error) {
        logger_1.logger.error("get_heatmap_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_HEATMAP_FAILED", message: error.message },
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
managerRouter.get("/tiers", async (_req, res) => {
    try {
        const distribution = await (0, managerDashboardService_1.getTierDistribution)();
        res.json({ distribution });
    }
    catch (error) {
        logger_1.logger.error("get_tiers_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_TIERS_FAILED", message: error.message },
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
managerRouter.get("/retention", async (_req, res) => {
    try {
        const cohorts = await (0, managerDashboardService_1.getRetentionCohorts)();
        res.json({ cohorts });
    }
    catch (error) {
        logger_1.logger.error("get_retention_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_RETENTION_FAILED", message: error.message },
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
managerRouter.get("/support-stats", async (_req, res) => {
    try {
        const stats = await (0, supportService_1.getTicketStats)();
        res.json({ stats });
    }
    catch (error) {
        logger_1.logger.error("get_support_stats_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_SUPPORT_STATS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /manager/background-check-stats
 * Get background check statistics
 */
managerRouter.get("/background-check-stats", async (_req, res) => {
    try {
        const stats = await (0, backgroundCheckService_1.getBackgroundCheckStats)();
        res.json({ stats });
    }
    catch (error) {
        logger_1.logger.error("get_bgcheck_stats_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_BGCHECK_STATS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /manager/full-report
 * Get comprehensive report combining all metrics
 */
managerRouter.get("/full-report", async (_req, res) => {
    try {
        const [overview, alerts, heatmap, tiers, retention, supportStats, bgCheckStats] = await Promise.all([
            (0, managerDashboardService_1.getDashboardOverview)(),
            (0, managerDashboardService_1.getActiveAlerts)(),
            (0, managerDashboardService_1.getSupplyDemandHeatmap)(),
            (0, managerDashboardService_1.getTierDistribution)(),
            (0, managerDashboardService_1.getRetentionCohorts)(),
            (0, supportService_1.getTicketStats)(),
            (0, backgroundCheckService_1.getBackgroundCheckStats)(),
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
    }
    catch (error) {
        logger_1.logger.error("get_full_report_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_REPORT_FAILED", message: error.message },
        });
    }
});
exports.default = managerRouter;
