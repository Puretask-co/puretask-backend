"use strict";
// src/routes/analytics.ts
// Analytics API routes - Revenue reports, trends, and business metrics
// V2 FEATURE — DISABLED FOR NOW
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const jwtAuth_1 = require("../middleware/jwtAuth");
const logger_1 = require("../lib/logger");
const analyticsService_1 = require("../services/analyticsService");
const analyticsRouter = (0, express_1.Router)();
// All analytics routes require admin access
const requireAdmin = [auth_1.authMiddleware, (0, jwtAuth_1.requireRole)("admin")];
/**
 * Helper to parse time range from query
 */
function parseTimeRange(query) {
    const valid = ["day", "week", "month", "quarter", "year", "all"];
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
analyticsRouter.get("/dashboard", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const metrics = await (0, analyticsService_1.getDashboardMetrics)(timeRange);
        res.json({ timeRange, metrics });
    }
    catch (error) {
        logger_1.logger.error("analytics_dashboard_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/revenue/trend", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const trend = await (0, analyticsService_1.getRevenueTrend)(timeRange);
        res.json({ timeRange, trend });
    }
    catch (error) {
        logger_1.logger.error("analytics_revenue_trend_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
        });
    }
});
/**
 * GET /analytics/revenue/by-period
 * Get revenue breakdown by day/week/month
 */
analyticsRouter.get("/revenue/by-period", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const groupBy = req.query.groupBy || "day";
        const data = await (0, analyticsService_1.getRevenueByPeriod)(groupBy, timeRange);
        res.json({ timeRange, groupBy, data });
    }
    catch (error) {
        logger_1.logger.error("analytics_revenue_period_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/jobs/trend", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const trend = await (0, analyticsService_1.getJobTrend)(timeRange);
        res.json({ timeRange, trend });
    }
    catch (error) {
        logger_1.logger.error("analytics_job_trend_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
        });
    }
});
/**
 * GET /analytics/jobs/status
 * Get job status breakdown
 */
analyticsRouter.get("/jobs/status", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const breakdown = await (0, analyticsService_1.getJobStatusBreakdown)(timeRange);
        res.json({ timeRange, breakdown });
    }
    catch (error) {
        logger_1.logger.error("analytics_job_status_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/users/signups", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const role = req.query.role || "all";
        const trend = await (0, analyticsService_1.getUserSignupTrend)(role, timeRange);
        res.json({ timeRange, role, trend });
    }
    catch (error) {
        logger_1.logger.error("analytics_user_signups_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/top/clients", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const topClients = await (0, analyticsService_1.getTopClients)(limit, timeRange);
        res.json({ timeRange, limit, data: topClients });
    }
    catch (error) {
        logger_1.logger.error("analytics_top_clients_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
        });
    }
});
/**
 * GET /analytics/top/cleaners
 * Get top cleaners by earnings
 */
analyticsRouter.get("/top/cleaners", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const topCleaners = await (0, analyticsService_1.getTopCleaners)(limit, timeRange);
        res.json({ timeRange, limit, data: topCleaners });
    }
    catch (error) {
        logger_1.logger.error("analytics_top_cleaners_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
        });
    }
});
/**
 * GET /analytics/top/rated-cleaners
 * Get top rated cleaners
 */
analyticsRouter.get("/top/rated-cleaners", ...requireAdmin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const topRated = await (0, analyticsService_1.getTopRatedCleaners)(limit);
        res.json({ limit, data: topRated });
    }
    catch (error) {
        logger_1.logger.error("analytics_top_rated_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/credits/health", ...requireAdmin, async (_req, res) => {
    try {
        const health = await (0, analyticsService_1.getCreditEconomyHealth)();
        res.json({ health });
    }
    catch (error) {
        logger_1.logger.error("analytics_credit_health_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
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
analyticsRouter.get("/report", ...requireAdmin, async (req, res) => {
    try {
        const timeRange = parseTimeRange(req.query);
        const report = await (0, analyticsService_1.generateFullReport)(timeRange);
        res.json(report);
    }
    catch (error) {
        logger_1.logger.error("analytics_report_failed", { error: error.message });
        res.status(500).json({
            error: { code: "ANALYTICS_ERROR", message: error.message },
        });
    }
});
exports.default = analyticsRouter;
