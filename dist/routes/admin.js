"use strict";
// src/routes/admin.ts
// Admin API routes matching 001_init.sql schema
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const client_1 = require("../db/client");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../lib/validation");
const zod_1 = require("zod");
const adminService_1 = require("../services/adminService");
const userManagementService_1 = require("../services/userManagementService");
const adminRepairService_1 = require("../services/adminRepairService");
const creditEconomyService_1 = require("../services/creditEconomyService");
const logger_1 = require("../lib/logger");
exports.adminRouter = (0, express_1.Router)();
// All admin routes require authentication
exports.adminRouter.use(auth_1.authMiddleware);
// Middleware to check admin role
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(403).json({
            error: { code: "FORBIDDEN", message: "Admin access required" },
        });
    }
    next();
};
/**
 * GET /admin/kpis
 * Get admin dashboard KPIs
 */
exports.adminRouter.get("/kpis", requireAdmin, async (req, res) => {
    try {
        const { dateFrom, dateTo } = req.query;
        const kpis = await (0, adminService_1.getAdminKPIs)(dateFrom, dateTo);
        res.json({ kpis });
    }
    catch (error) {
        logger_1.logger.error("get_admin_kpis_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_KPIS_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /admin/kpis/history
 * Get KPI history
 */
exports.adminRouter.get("/kpis/history", requireAdmin, async (req, res) => {
    try {
        const { days = "30" } = req.query;
        const history = await (0, adminService_1.getKpiHistory)(parseInt(days, 10));
        res.json({ history });
    }
    catch (error) {
        logger_1.logger.error("get_kpi_history_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_KPI_HISTORY_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /admin/jobs
 * List all jobs with filters (admin)
 */
exports.adminRouter.get("/jobs", requireAdmin, async (req, res) => {
    try {
        const { status, clientId, cleanerId, dateFrom, dateTo, limit = "50", offset = "0", } = req.query;
        const result = await (0, adminService_1.listJobsForAdmin)({
            status: status,
            clientId: clientId,
            cleanerId: cleanerId,
            dateFrom: dateFrom,
            dateTo: dateTo,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error("list_admin_jobs_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "LIST_JOBS_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /admin/jobs/:jobId
 * Get full job details with timeline (admin)
 * Returns: job, client, cleaner, events, dispute, payments, payout, photos, credits
 */
exports.adminRouter.get("/jobs/:jobId", requireAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const details = await (0, adminService_1.getJobDetails)(jobId);
        res.json(details);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("get_admin_job_details_failed", {
            error: err.message,
            jobId: req.params.jobId,
        });
        res.status(err.statusCode || 500).json({
            error: {
                code: "GET_JOB_DETAILS_FAILED",
                message: err.message,
            },
        });
    }
});
/**
 * GET /admin/jobs/:jobId/events
 * Get all events for a job (admin)
 */
exports.adminRouter.get("/jobs/:jobId/events", requireAdmin, async (req, res) => {
    try {
        const { jobId } = req.params;
        const { limit = "100" } = req.query;
        const events = await (0, adminService_1.getJobEventsForAdmin)(jobId, parseInt(limit, 10));
        res.json({
            jobId,
            events,
            count: events.length,
        });
    }
    catch (error) {
        logger_1.logger.error("get_admin_job_events_failed", {
            error: error.message,
            jobId: req.params.jobId,
        });
        res.status(500).json({
            error: {
                code: "GET_JOB_EVENTS_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * POST /admin/jobs/:jobId/override
 * Override job status (admin only)
 */
const overrideJobStatusSchema = zod_1.z.object({
    newStatus: zod_1.z.enum([
        "requested",
        "accepted",
        "on_my_way",
        "in_progress",
        "awaiting_approval",
        "completed",
        "disputed",
        "cancelled",
    ]),
    reason: zod_1.z.string().min(1),
});
exports.adminRouter.post("/jobs/:jobId/override", requireAdmin, (0, validation_1.validateBody)(overrideJobStatusSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { newStatus, reason } = req.body;
        const adminId = req.user.id;
        const job = await (0, adminService_1.overrideJobStatus)(jobId, newStatus, reason, adminId);
        res.json({ job });
    }
    catch (error) {
        logger_1.logger.error("override_job_status_failed", {
            error: error.message,
            jobId: req.params.jobId,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "OVERRIDE_JOB_STATUS_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /admin/disputes
 * Get all disputes
 */
exports.adminRouter.get("/disputes", requireAdmin, async (req, res) => {
    try {
        const { status, limit = "50" } = req.query;
        const disputes = await (0, adminService_1.getDisputes)(status, parseInt(limit, 10));
        res.json({
            disputes,
            count: disputes.length,
        });
    }
    catch (error) {
        logger_1.logger.error("get_disputes_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_DISPUTES_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * POST /admin/disputes/:disputeId/resolve
 * Resolve a dispute by disputeId
 */
const resolveDisputeSchema = zod_1.z.object({
    resolution: zod_1.z.enum(["resolved_refund", "resolved_no_refund"]),
    admin_notes: zod_1.z.string().optional(),
});
exports.adminRouter.post("/disputes/:disputeId/resolve", requireAdmin, (0, validation_1.validateBody)(resolveDisputeSchema), async (req, res) => {
    try {
        const { disputeId } = req.params;
        const { resolution, admin_notes } = req.body;
        // Import from disputesService for direct resolution
        const { resolveDispute: resolveDisputeService } = await Promise.resolve().then(() => __importStar(require("../services/disputesService")));
        const dispute = await resolveDisputeService(disputeId, resolution, admin_notes || "");
        res.json({ dispute });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("resolve_dispute_failed", {
            error: err.message,
            disputeId: req.params.disputeId,
            adminId: req.user?.id,
        });
        res.status(err.statusCode || 500).json({
            error: {
                code: "RESOLVE_DISPUTE_FAILED",
                message: err.message,
            },
        });
    }
});
/**
 * POST /admin/disputes/job/:jobId/resolve
 * Resolve a dispute by jobId (legacy/convenience)
 */
exports.adminRouter.post("/disputes/job/:jobId/resolve", requireAdmin, (0, validation_1.validateBody)(resolveDisputeSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { resolution, admin_notes } = req.body;
        const adminId = req.user.id;
        const dispute = await (0, adminService_1.resolveDispute)(jobId, { resolution, adminNotes: admin_notes }, adminId);
        res.json({ dispute });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("resolve_dispute_failed", {
            error: err.message,
            jobId: req.params.jobId,
            adminId: req.user?.id,
        });
        res.status(err.statusCode || 500).json({
            error: {
                code: "RESOLVE_DISPUTE_FAILED",
                message: err.message,
            },
        });
    }
});
/**
 * GET /admin/payouts
 * Get all payouts (admin view)
 */
exports.adminRouter.get("/payouts", requireAdmin, async (req, res) => {
    try {
        const { status, limit = "100" } = req.query;
        const payouts = await (0, adminService_1.getAllPayouts)(status, parseInt(limit, 10));
        res.json({
            payouts,
            count: payouts.length,
        });
    }
    catch (error) {
        logger_1.logger.error("get_admin_payouts_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_PAYOUTS_FAILED",
                message: error.message,
            },
        });
    }
});
/**
 * GET /admin/job-events
 * Get all job events (admin view)
 */
exports.adminRouter.get("/job-events", requireAdmin, async (req, res) => {
    try {
        const { limit = "200", eventType } = req.query;
        let queryText = "SELECT * FROM job_events";
        const params = [];
        let paramIndex = 1;
        if (eventType) {
            queryText += ` WHERE event_type = $${paramIndex++}`;
            params.push(eventType);
        }
        queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
        params.push(parseInt(limit, 10));
        const result = await (0, client_1.query)(queryText, params);
        res.json({ events: result.rows, count: result.rows.length });
    }
    catch (error) {
        logger_1.logger.error("get_admin_job_events_failed", {
            error: error.message,
            adminId: req.user?.id,
        });
        res.status(500).json({
            error: {
                code: "GET_JOB_EVENTS_FAILED",
                message: error.message,
            },
        });
    }
});
// ============================================
// User Management Routes
// ============================================
/**
 * GET /admin/users
 * List all users with filters
 */
exports.adminRouter.get("/users", requireAdmin, async (req, res) => {
    try {
        const { role, search, limit = "50", offset = "0" } = req.query;
        const result = await (0, userManagementService_1.listUsers)({
            role: role,
            search: search,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error("list_users_failed", { error: error.message });
        res.status(500).json({
            error: { code: "LIST_USERS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/users/stats
 * Get user statistics
 */
exports.adminRouter.get("/users/stats", requireAdmin, async (_req, res) => {
    try {
        const stats = await (0, userManagementService_1.getUserStats)();
        res.json({ stats });
    }
    catch (error) {
        logger_1.logger.error("get_user_stats_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_USER_STATS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/users/:userId
 * Get single user details
 */
exports.adminRouter.get("/users/:userId", requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await (0, userManagementService_1.getUserById)(userId);
        if (!user) {
            return res.status(404).json({
                error: { code: "USER_NOT_FOUND", message: "User not found" },
            });
        }
        res.json({ user });
    }
    catch (error) {
        logger_1.logger.error("get_user_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_USER_FAILED", message: error.message },
        });
    }
});
/**
 * POST /admin/users
 * Create a new user
 */
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    role: zod_1.z.enum(["client", "cleaner", "admin"]),
    phone: zod_1.z.string().optional(),
    defaultAddress: zod_1.z.string().optional(),
    hourlyRateCredits: zod_1.z.number().int().min(0).optional(),
});
exports.adminRouter.post("/users", requireAdmin, (0, validation_1.validateBody)(createUserSchema), async (req, res) => {
    try {
        const user = await (0, userManagementService_1.createUser)(req.body);
        res.status(201).json({ user });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("create_user_failed", { error: err.message });
        res.status(err.statusCode || 500).json({
            error: { code: "CREATE_USER_FAILED", message: err.message },
        });
    }
});
/**
 * PATCH /admin/users/:userId
 * Update user details
 */
const updateUserSchema = zod_1.z.object({
    email: zod_1.z.string().email().optional(),
    phone: zod_1.z.string().optional(),
    role: zod_1.z.enum(["client", "cleaner", "admin"]).optional(),
    defaultAddress: zod_1.z.string().optional(),
    hourlyRateCredits: zod_1.z.number().int().min(0).optional(),
    tier: zod_1.z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
});
exports.adminRouter.patch("/users/:userId", requireAdmin, (0, validation_1.validateBody)(updateUserSchema), async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await (0, userManagementService_1.updateUser)(userId, req.body);
        res.json({ user });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("update_user_failed", { error: err.message, userId: req.params.userId });
        res.status(err.statusCode || 500).json({
            error: { code: "UPDATE_USER_FAILED", message: err.message },
        });
    }
});
/**
 * DELETE /admin/users/:userId
 * Delete user (soft delete by default)
 */
exports.adminRouter.delete("/users/:userId", requireAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const { hard = "false" } = req.query;
        await (0, userManagementService_1.deleteUser)(userId, hard === "true");
        res.json({ deleted: true });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("delete_user_failed", { error: err.message, userId: req.params.userId });
        res.status(err.statusCode || 500).json({
            error: { code: "DELETE_USER_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/users/:userId/reset-password
 * Reset user password
 */
const resetPasswordSchema = zod_1.z.object({
    newPassword: zod_1.z.string().min(8),
});
exports.adminRouter.post("/users/:userId/reset-password", requireAdmin, (0, validation_1.validateBody)(resetPasswordSchema), async (req, res) => {
    try {
        const { userId } = req.params;
        const { newPassword } = req.body;
        await (0, userManagementService_1.resetUserPassword)(userId, newPassword);
        res.json({ reset: true });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("reset_password_failed", { error: err.message, userId: req.params.userId });
        res.status(err.statusCode || 500).json({
            error: { code: "RESET_PASSWORD_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/users/:userId/adjust-credits
 * Adjust user credits
 */
const adjustCreditsSchema = zod_1.z.object({
    amount: zod_1.z.number().int(),
    reason: zod_1.z.string().min(1),
});
exports.adminRouter.post("/users/:userId/adjust-credits", requireAdmin, (0, validation_1.validateBody)(adjustCreditsSchema), async (req, res) => {
    try {
        const { userId } = req.params;
        const { amount, reason } = req.body;
        const result = await (0, userManagementService_1.adjustUserCredits)(userId, amount, reason);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("adjust_credits_failed", { error: err.message, userId: req.params.userId });
        res.status(err.statusCode || 500).json({
            error: { code: "ADJUST_CREDITS_FAILED", message: err.message },
        });
    }
});
// ============================================
// System Health & Repair Tools
// ============================================
/**
 * GET /admin/system/health
 * Run comprehensive system health check
 */
exports.adminRouter.get("/system/health", requireAdmin, async (_req, res) => {
    try {
        const health = await (0, adminRepairService_1.runSystemHealthCheck)();
        res.json(health);
    }
    catch (error) {
        logger_1.logger.error("system_health_check_failed", { error: error.message });
        res.status(500).json({
            error: { code: "HEALTH_CHECK_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/system/stuck-jobs
 * Find stuck jobs
 */
exports.adminRouter.get("/system/stuck-jobs", requireAdmin, async (_req, res) => {
    try {
        const stuckJobs = await (0, adminRepairService_1.findStuckJobs)();
        res.json({ stuckJobs, count: stuckJobs.length });
    }
    catch (error) {
        logger_1.logger.error("find_stuck_jobs_failed", { error: error.message });
        res.status(500).json({
            error: { code: "FIND_STUCK_JOBS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/system/stuck-payouts
 * Find stuck payouts
 */
exports.adminRouter.get("/system/stuck-payouts", requireAdmin, async (_req, res) => {
    try {
        const stuckPayouts = await (0, adminRepairService_1.findStuckPayouts)();
        res.json({ stuckPayouts, count: stuckPayouts.length });
    }
    catch (error) {
        logger_1.logger.error("find_stuck_payouts_failed", { error: error.message });
        res.status(500).json({
            error: { code: "FIND_STUCK_PAYOUTS_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/system/ledger-issues
 * Find credit ledger inconsistencies
 */
exports.adminRouter.get("/system/ledger-issues", requireAdmin, async (_req, res) => {
    try {
        const issues = await (0, adminRepairService_1.findLedgerInconsistencies)();
        res.json({ issues, count: issues.length });
    }
    catch (error) {
        logger_1.logger.error("find_ledger_issues_failed", { error: error.message });
        res.status(500).json({
            error: { code: "FIND_LEDGER_ISSUES_FAILED", message: error.message },
        });
    }
});
/**
 * POST /admin/repair/job/:jobId/force-complete
 * Force complete a stuck job
 */
const forceCompleteSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1),
});
exports.adminRouter.post("/repair/job/:jobId/force-complete", requireAdmin, (0, validation_1.validateBody)(forceCompleteSchema), async (req, res) => {
    try {
        const result = await (0, adminRepairService_1.forceCompleteJob)(req.params.jobId, req.user.id, req.body.reason);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("force_complete_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "FORCE_COMPLETE_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/repair/job/:jobId/force-cancel
 * Force cancel a stuck job
 */
const forceCancelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1),
    refundCredits: zod_1.z.boolean().optional().default(true),
});
exports.adminRouter.post("/repair/job/:jobId/force-cancel", requireAdmin, (0, validation_1.validateBody)(forceCancelSchema), async (req, res) => {
    try {
        const result = await (0, adminRepairService_1.forceCancelJob)(req.params.jobId, req.user.id, req.body.reason, req.body.refundCredits);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("force_cancel_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "FORCE_CANCEL_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/repair/job/:jobId/reassign
 * Reassign a job to different cleaner
 */
const reassignSchema = zod_1.z.object({
    newCleanerId: zod_1.z.string().uuid(),
    reason: zod_1.z.string().min(1),
});
exports.adminRouter.post("/repair/job/:jobId/reassign", requireAdmin, (0, validation_1.validateBody)(reassignSchema), async (req, res) => {
    try {
        const result = await (0, adminRepairService_1.reassignJob)(req.params.jobId, req.body.newCleanerId, req.user.id, req.body.reason);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("reassign_job_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "REASSIGN_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/repair/payout/:payoutId/force-process
 * Force process a stuck payout
 */
exports.adminRouter.post("/repair/payout/:payoutId/force-process", requireAdmin, async (req, res) => {
    try {
        const result = await (0, adminRepairService_1.forceProcessPayout)(req.params.payoutId, req.user.id);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("force_process_payout_failed", { error: err.message, payoutId: req.params.payoutId });
        res.status(err.statusCode || 500).json({
            error: { code: "FORCE_PROCESS_FAILED", message: err.message },
        });
    }
});
/**
 * POST /admin/repair/credits/:userId/adjust
 * Adjust user credits directly
 */
const repairCreditsSchema = zod_1.z.object({
    amount: zod_1.z.number().int(),
    reason: zod_1.z.string().min(1),
});
exports.adminRouter.post("/repair/credits/:userId/adjust", requireAdmin, (0, validation_1.validateBody)(repairCreditsSchema), async (req, res) => {
    try {
        const result = await (0, adminRepairService_1.adjustCredits)(req.params.userId, req.body.amount, req.body.reason, req.user.id);
        res.json(result);
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("repair_credits_failed", { error: err.message, userId: req.params.userId });
        res.status(err.statusCode || 500).json({
            error: { code: "REPAIR_CREDITS_FAILED", message: err.message },
        });
    }
});
// ============================================
// Fraud Alerts
// ============================================
/**
 * GET /admin/fraud-alerts
 * Get open fraud alerts
 */
exports.adminRouter.get("/fraud-alerts", requireAdmin, async (_req, res) => {
    try {
        const alerts = await (0, creditEconomyService_1.getOpenFraudAlerts)();
        res.json({ alerts, count: alerts.length });
    }
    catch (error) {
        logger_1.logger.error("get_fraud_alerts_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_FRAUD_ALERTS_FAILED", message: error.message },
        });
    }
});
/**
 * POST /admin/fraud-alerts/:alertId/resolve
 * Resolve a fraud alert
 */
const resolveFraudSchema = zod_1.z.object({
    resolution: zod_1.z.enum(["resolved", "false_positive"]),
    notes: zod_1.z.string().optional(),
});
exports.adminRouter.post("/fraud-alerts/:alertId/resolve", requireAdmin, (0, validation_1.validateBody)(resolveFraudSchema), async (req, res) => {
    try {
        await (0, creditEconomyService_1.resolveFraudAlert)(req.params.alertId, req.user.id, req.body.resolution, req.body.notes);
        res.json({ resolved: true });
    }
    catch (error) {
        logger_1.logger.error("resolve_fraud_alert_failed", { error: error.message });
        res.status(500).json({
            error: { code: "RESOLVE_FRAUD_ALERT_FAILED", message: error.message },
        });
    }
});
exports.default = exports.adminRouter;
