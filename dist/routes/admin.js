"use strict";
// src/routes/admin.ts
// Admin API routes matching 001_init.sql schema
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
const payoutImprovementsService_1 = require("../services/payoutImprovementsService");
const reconciliationService_1 = require("../services/reconciliationService");
const alerting_1 = require("../lib/alerting");
const creditEconomyService_1 = require("../services/creditEconomyService");
const refundProcessor_1 = require("../services/refundProcessor");
const chargebackProcessor_1 = require("../services/chargebackProcessor");
const env_1 = require("../config/env");
const payoutsService_1 = require("../services/payoutsService");
const logger_1 = require("../lib/logger");
const invoiceService_1 = require("../services/invoiceService");
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
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/kpis", requireAdmin, async (req: AuthedRequest, res: Response) => {
//   try {
//     const { dateFrom, dateTo } = req.query;
//     const kpis = await getAdminKPIs(
//       dateFrom as string | undefined,
//       dateTo as string | undefined
//     );
//     res.json({ kpis });
//   } catch (error) {
//     logger.error("get_admin_kpis_failed", {
//       error: (error as Error).message,
//       adminId: req.user?.id,
//     });
//     res.status(500).json({
//       error: {
//         code: "GET_KPIS_FAILED",
//         message: (error as Error).message,
//       },
//     });
//   }
// });
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/kpis/history", requireAdmin, async (req: AuthedRequest, res: Response) => {
//   try {
//     const { days = "30" } = req.query;
//     const history = await getKpiHistory(parseInt(days as string, 10));
//     res.json({ history });
//   } catch (error) {
//     logger.error("get_kpi_history_failed", {
//       error: (error as Error).message,
//       adminId: req.user?.id,
//     });
//     res.status(500).json({
//       error: {
//         code: "GET_KPI_HISTORY_FAILED",
//         message: (error as Error).message,
//       },
//     });
//   }
// });
// ============================================
// Operational Metrics
// ============================================
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/metrics/operational", requireAdmin, async (req: AuthedRequest, res: Response) => {
//   try {
//     const { days = "30" } = req.query;
//     const metrics = await getOperationalMetrics(parseInt(days as string, 10));
//     res.json({ metrics });
//   } catch (error) {
//     logger.error("get_operational_metrics_failed", { error: (error as Error).message });
//     res.status(500).json({
//       error: { code: "GET_OPERATIONAL_METRICS_FAILED", message: (error as Error).message },
//     });
//   }
// });
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/metrics/trends", requireAdmin, async (req: AuthedRequest, res: Response) => {
//   try {
//     const { days = "30" } = req.query;
//     const trends = await getMetricTrends(parseInt(days as string, 10));
//     res.json({ trends });
//   } catch (error) {
//     logger.error("get_metric_trends_failed", { error: (error as Error).message });
//     res.status(500).json({
//       error: { code: "GET_METRIC_TRENDS_FAILED", message: (error as Error).message },
//     });
//   }
// });
// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/metrics/health", requireAdmin, async (_req: AuthedRequest, res: Response) => {
//   try {
//     const health = await getSystemHealthSnapshot();
//     res.json(health);
//   } catch (error) {
//     logger.error("get_system_health_failed", { error: (error as Error).message });
//     res.status(500).json({
//       error: { code: "GET_SYSTEM_HEALTH_FAILED", message: (error as Error).message },
//     });
//   }
// });
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
        // Load dispute & job context
        const disputeResult = await (0, client_1.query)(`SELECT id, job_id, client_id, status, amount_cents FROM disputes WHERE id = $1`, [disputeId]);
        const dispute = disputeResult.rows[0];
        if (!dispute) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Dispute not found" } });
        }
        if (resolution === "resolved_refund") {
            const jobResult = await (0, client_1.query)(`SELECT id, credit_amount FROM jobs WHERE id = $1`, [dispute.job_id]);
            const job = jobResult.rows[0];
            if (!job) {
                return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "Job not found" } });
            }
            await (0, chargebackProcessor_1.processChargeDispute)({
                disputeId,
                chargeId: null,
                paymentIntentId: null,
                jobId: job.id,
                clientId: dispute.client_id,
                amount: (dispute.amount_cents ?? job.credit_amount * env_1.env.CENTS_PER_CREDIT),
                currency: env_1.env.PAYOUT_CURRENCY,
                status: "lost",
                eventType: "charge.dispute.closed",
                reason: admin_notes || null,
            });
        }
        else {
            // resolved_no_refund -> just mark dispute closed
            await (0, client_1.query)(`UPDATE disputes SET status = 'resolved_no_refund', admin_notes = $2, updated_at = NOW() WHERE id = $1`, [disputeId, admin_notes || null]);
        }
        await (0, alerting_1.sendAlert)({
            level: "info",
            title: "Dispute resolved",
            message: `Dispute ${disputeId} resolved: ${resolution}`,
            details: { disputeId, resolution },
        });
        res.json({ success: true });
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
 * GET /admin/fraud/alerts
 */
exports.adminRouter.get("/fraud/alerts", requireAdmin, async (_req, res) => {
    try {
        const alerts = await (0, creditEconomyService_1.getOpenFraudAlerts)();
        res.json({ alerts, count: alerts.length });
    }
    catch (error) {
        res.status(500).json({ error: { code: "FRAUD_ALERTS_FAILED", message: error.message } });
    }
});
/**
 * POST /admin/fraud/alerts/:alertId/resolve
 */
exports.adminRouter.post("/fraud/alerts/:alertId/resolve", requireAdmin, async (req, res) => {
    try {
        const { alertId } = req.params;
        const { resolution, notes } = req.body;
        if (!resolution) {
            return res.status(400).json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
        }
        await (0, creditEconomyService_1.resolveFraudAlert)(alertId, req.user.id, resolution, notes);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: { code: "FRAUD_RESOLVE_FAILED", message: error.message } });
    }
});
/**
 * POST /admin/payouts/:payoutId/reverse
 */
exports.adminRouter.post("/payouts/:payoutId/reverse", requireAdmin, async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { reason } = req.body;
        if (!reason) {
            return res
                .status(400)
                .json({ error: { code: "MISSING_REASON", message: "Reason is required" } });
        }
        const adjustment = await (0, payoutImprovementsService_1.reversePayout)({
            payoutId,
            reason,
            initiatedBy: req.user.id,
        });
        await (0, alerting_1.sendAlert)(alerting_1.alertTemplates.payoutReversed(payoutId, reason, req.user.id));
        res.json({ success: true, adjustment });
    }
    catch (error) {
        const err = error;
        res
            .status(err.statusCode || 500)
            .json({ error: { code: "PAYOUT_REVERSE_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/payouts/:payoutId/hold
 */
exports.adminRouter.post("/payouts/:payoutId/hold", requireAdmin, async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { reason } = req.body;
        const payout = await (0, client_1.query)(`SELECT cleaner_id, job_id, amount_cents FROM payouts WHERE id = $1`, [payoutId]);
        const row = payout.rows[0];
        if (!row) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found" } });
        }
        const adjustment = await (0, payoutImprovementsService_1.holdPayoutForDispute)({
            cleanerId: row.cleaner_id,
            jobId: row.job_id || "",
            amountCents: row.amount_cents,
            reason: reason || "Admin hold",
        });
        await (0, alerting_1.sendAlert)(alerting_1.alertTemplates.payoutHold(payoutId, row.cleaner_id, row.job_id, row.amount_cents));
        res.json({ success: true, adjustment });
    }
    catch (error) {
        const err = error;
        res
            .status(err.statusCode || 500)
            .json({ error: { code: "PAYOUT_HOLD_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/payouts/hold/:adjustmentId/release
 */
exports.adminRouter.post("/payouts/hold/:adjustmentId/release", requireAdmin, async (req, res) => {
    try {
        const { adjustmentId } = req.params;
        const { resolution } = req.body;
        if (!resolution) {
            return res
                .status(400)
                .json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
        }
        await (0, payoutImprovementsService_1.releaseDisputeHold)(adjustmentId, resolution);
        await (0, alerting_1.sendAlert)({
            level: "info",
            title: "Payout hold resolved",
            message: `Hold ${adjustmentId} resolved as ${resolution}`,
            details: { adjustmentId, resolution },
        });
        res.json({ success: true });
    }
    catch (error) {
        const err = error;
        res
            .status(err.statusCode || 500)
            .json({ error: { code: "PAYOUT_HOLD_RELEASE_FAILED", message: err.message } });
    }
});
/**
 * GET /admin/payouts/reconciliation/flags
 */
exports.adminRouter.get("/payouts/reconciliation/flags", requireAdmin, async (_req, res) => {
    try {
        const flags = await (0, reconciliationService_1.getPayoutReconciliationFlags)();
        res.json({ flags });
    }
    catch (error) {
        const err = error;
        res.status(500).json({ error: { code: "RECON_FLAGS_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/payouts/reconciliation/:payoutId/resolve
 */
exports.adminRouter.post("/payouts/reconciliation/:payoutId/resolve", requireAdmin, async (req, res) => {
    try {
        const { payoutId } = req.params;
        const { status, note } = req.body;
        if (!status) {
            return res
                .status(400)
                .json({ error: { code: "MISSING_STATUS", message: "status required" } });
        }
        await (0, reconciliationService_1.resolvePayoutReconciliationFlag)({ payoutId, status, note, resolvedBy: req.user.id });
        await (0, alerting_1.sendAlert)(alerting_1.alertTemplates.reconFlagResolved(payoutId, status, note));
        res.json({ success: true });
    }
    catch (error) {
        const err = error;
        res.status(500).json({ error: { code: "RECON_RESOLVE_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/payouts/:cleanerId/pause
 * Toggle payout pause for a cleaner
 */
exports.adminRouter.post("/payouts/:cleanerId/pause", requireAdmin, async (req, res) => {
    try {
        const { cleanerId } = req.params;
        const { paused } = req.body;
        if (paused === undefined) {
            return res.status(400).json({ error: { code: "MISSING_PARAM", message: "paused required" } });
        }
        await (0, payoutsService_1.updatePayoutPause)(cleanerId, !!paused);
        await (0, client_1.query)(`
        UPDATE cleaner_profiles
        SET payout_paused_at = CASE WHEN $2 THEN NOW() ELSE payout_paused_at END,
            payout_paused_by = CASE WHEN $2 THEN $3 ELSE payout_paused_by END
        WHERE user_id = $1
      `, [cleanerId, !!paused, req.user.id]);
        await (0, alerting_1.sendAlert)({
            level: "info",
            title: "Payout pause toggled",
            message: `Cleaner ${cleanerId} payout pause set to ${!!paused}`,
            details: { cleanerId, paused: !!paused },
        });
        res.json({ success: true, paused: !!paused });
    }
    catch (error) {
        const err = error;
        res.status(500).json({ error: { code: "PAYOUT_PAUSE_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/refunds/:jobId/approve
 * Approve and execute a refund to client (credit refund)
 */
const approveRefundSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3),
});
exports.adminRouter.post("/refunds/:jobId/approve", requireAdmin, (0, validation_1.validateBody)(approveRefundSchema), async (req, res) => {
    try {
        const { jobId } = req.params;
        const { reason } = req.body;
        const jobResult = await (0, client_1.query)(`SELECT id, client_id, credit_amount FROM jobs WHERE id = $1`, [jobId]);
        const job = jobResult.rows[0];
        if (!job) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
        }
        // Drive through refundProcessor to keep ledger/payout consistency
        await (0, refundProcessor_1.processStripeRefund)({
            chargeId: "admin_manual_refund",
            paymentIntentId: "admin_manual_refund",
            jobId: job.id,
            clientId: job.client_id,
            purpose: "job_charge",
            amount: job.credit_amount * env_1.env.CENTS_PER_CREDIT,
            currency: env_1.env.PAYOUT_CURRENCY,
        });
        // Mark job cancelled for clarity
        await (0, client_1.query)(`UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [job.id]);
        await (0, alerting_1.sendAlert)({
            level: "warning",
            title: "Refund approved",
            message: `Refund approved for job ${jobId}`,
            details: { jobId, adminId: req.user.id, reason },
        });
        res.json({ success: true, jobId, message: "Refund processed successfully" });
    }
    catch (error) {
        const err = error;
        res
            .status(err.statusCode || 500)
            .json({ error: { code: "REFUND_APPROVAL_FAILED", message: err.message } });
    }
});
/**
 * POST /admin/disputes/:disputeId/route
 * Route a dispute to a queue or admin by updating metadata
 */
const DISPUTE_ROUTE_QUEUES = ["ops", "finance", "trust_safety", "support"];
const routeDisputeSchema = zod_1.z.object({
    routeTo: zod_1.z.enum(DISPUTE_ROUTE_QUEUES),
    note: zod_1.z.string().optional(),
});
exports.adminRouter.post("/disputes/:disputeId/route", requireAdmin, (0, validation_1.validateBody)(routeDisputeSchema), async (req, res) => {
    try {
        const { disputeId } = req.params;
        const { routeTo, note } = req.body;
        await (0, client_1.query)(`
          UPDATE disputes
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('routed_to', $2, 'route_note', $3),
              updated_at = NOW()
          WHERE id = $1
        `, [disputeId, routeTo, note || null]);
        await (0, alerting_1.sendAlert)(alerting_1.alertTemplates.disputeRouted(disputeId, routeTo, note, DISPUTE_ROUTE_QUEUES));
        res.json({ success: true });
    }
    catch (error) {
        const err = error;
        res.status(500).json({ error: { code: "DISPUTE_ROUTE_FAILED", message: err.message } });
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
// ============================================
// Invoice Management
// ============================================
/**
 * GET /admin/invoices
 * List all invoices (admin view)
 */
exports.adminRouter.get("/invoices", requireAdmin, async (req, res) => {
    try {
        const { status, requiresApproval, limit = "50", offset = "0" } = req.query;
        const result = await (0, invoiceService_1.getAdminInvoices)({
            status: status,
            requiresApproval: requiresApproval === "true" ? true : requiresApproval === "false" ? false : undefined,
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        res.json({
            invoices: result.invoices,
            pagination: {
                total: result.total,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_admin_invoices_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_INVOICES_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/invoices/pending-approval
 * Get invoices requiring admin approval
 */
exports.adminRouter.get("/invoices/pending-approval", requireAdmin, async (req, res) => {
    try {
        const { limit = "50", offset = "0" } = req.query;
        const result = await (0, invoiceService_1.getAdminInvoices)({
            status: "pending_approval",
            limit: parseInt(limit, 10),
            offset: parseInt(offset, 10),
        });
        res.json({
            invoices: result.invoices,
            pagination: {
                total: result.total,
                limit: parseInt(limit, 10),
                offset: parseInt(offset, 10),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("get_pending_invoices_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_PENDING_INVOICES_FAILED", message: error.message },
        });
    }
});
/**
 * GET /admin/invoices/:invoiceId
 * Get single invoice with full details
 */
exports.adminRouter.get("/invoices/:invoiceId", requireAdmin, async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await (0, invoiceService_1.getInvoiceWithLineItems)(invoiceId);
        if (!invoice) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Invoice not found" },
            });
        }
        res.json({ invoice });
    }
    catch (error) {
        logger_1.logger.error("get_admin_invoice_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_INVOICE_FAILED", message: error.message },
        });
    }
});
/**
 * PATCH /admin/invoices/:invoiceId/approve
 * Approve an invoice pending approval
 */
const approveInvoiceSchema = zod_1.z.object({
    autoSend: zod_1.z.boolean().optional().default(true),
});
exports.adminRouter.patch("/invoices/:invoiceId/approve", requireAdmin, (0, validation_1.validateBody)(approveInvoiceSchema), async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { autoSend } = req.body;
        const adminId = req.user.id;
        const invoice = await (0, invoiceService_1.adminApproveInvoice)(invoiceId, adminId, autoSend);
        await (0, alerting_1.sendAlert)({
            level: "info",
            title: "Invoice approved",
            message: `Invoice ${invoice.invoice_number} approved by admin`,
            details: {
                invoiceId,
                invoiceNumber: invoice.invoice_number,
                cleanerId: invoice.cleaner_id,
                clientId: invoice.client_id,
                totalCents: invoice.total_cents,
                autoSend,
            },
        });
        res.json({ invoice });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("approve_invoice_failed", { error: err.message, invoiceId: req.params.invoiceId });
        res.status(err.statusCode || 500).json({
            error: { code: "APPROVE_INVOICE_FAILED", message: err.message },
        });
    }
});
/**
 * PATCH /admin/invoices/:invoiceId/deny
 * Deny an invoice pending approval
 */
const denyInvoiceSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3),
});
exports.adminRouter.patch("/invoices/:invoiceId/deny", requireAdmin, (0, validation_1.validateBody)(denyInvoiceSchema), async (req, res) => {
    try {
        const { invoiceId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;
        const invoice = await (0, invoiceService_1.adminDenyInvoice)(invoiceId, adminId, reason);
        await (0, alerting_1.sendAlert)({
            level: "warning",
            title: "Invoice denied",
            message: `Invoice ${invoice.invoice_number} denied: ${reason}`,
            details: {
                invoiceId,
                invoiceNumber: invoice.invoice_number,
                cleanerId: invoice.cleaner_id,
                reason,
            },
        });
        res.json({ invoice });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("deny_invoice_failed", { error: err.message, invoiceId: req.params.invoiceId });
        res.status(err.statusCode || 500).json({
            error: { code: "DENY_INVOICE_FAILED", message: err.message },
        });
    }
});
exports.default = exports.adminRouter;
