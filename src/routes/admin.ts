// src/routes/admin.ts
// Admin API routes matching 001_init.sql schema

import { Router, Response } from "express";
import { query } from "../db/client";
import { authMiddleware, AuthedRequest } from "../middleware/auth";
import { validateBody } from "../lib/validation";
import { z } from "zod";
import {
  getAdminKPIs,
  resolveDispute,
  overrideJobStatus,
  getDisputes,
  getAllPayouts,
  getJobEventsForAdmin,
  listJobsForAdmin,
  getKpiHistory,
  getJobDetails,
} from "../services/adminService";
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  adjustUserCredits,
  getUserStats,
} from "../services/userManagementService";
import {
  findStuckJobs,
  findStuckPayouts,
  findLedgerInconsistencies,
  forceCompleteJob,
  forceCancelJob,
  reassignJob,
  adjustCredits,
  forceProcessPayout,
  runSystemHealthCheck,
} from "../services/adminRepairService";
import {
  reversePayout,
  holdPayoutForDispute,
  releaseDisputeHold,
} from "../services/payoutImprovementsService";
import {
  getPayoutReconciliationFlags,
  resolvePayoutReconciliationFlag,
} from "../services/reconciliationService";
import { sendAlert, alertTemplates } from "../lib/alerting";
import { getOpenFraudAlerts, resolveFraudAlert } from "../services/creditEconomyService";
import { processStripeRefund } from "../services/refundProcessor";
import { processChargeDispute } from "../services/chargebackProcessor";
import { env } from "../config/env";
import { updatePayoutPause } from "../services/payoutsService";
import { markObjectProcessed } from "../services/paymentService";
import { logger } from "../lib/logger";
import {
  getAdminInvoices,
  getInvoiceWithLineItems,
  adminApproveInvoice,
  adminDenyInvoice,
  InvoiceStatus,
} from "../services/invoiceService";
import {
  getOperationalMetrics,
  getMetricTrends,
  getSystemHealthSnapshot,
} from "../services/operationalMetricsService";

export const adminRouter = Router();

// All admin routes require authentication
adminRouter.use(authMiddleware);

// Middleware to check admin role
const requireAdmin = (req: AuthedRequest, res: Response, next: () => void) => {
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
adminRouter.get("/kpis", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    const kpis = await getAdminKPIs(
      dateFrom as string | undefined,
      dateTo as string | undefined
    );
    res.json({ kpis });
  } catch (error) {
    logger.error("get_admin_kpis_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "GET_KPIS_FAILED",
        message: (error as Error).message,
      },
    });
  }
});

/**
 * GET /admin/kpis/history
 * Get KPI history
 */
adminRouter.get("/kpis/history", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const history = await getKpiHistory(parseInt(days as string, 10));
    res.json({ history });
  } catch (error) {
    logger.error("get_kpi_history_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "GET_KPI_HISTORY_FAILED",
        message: (error as Error).message,
      },
    });
  }
});

// ============================================
// Operational Metrics
// ============================================

/**
 * GET /admin/metrics/operational
 * Get comprehensive operational metrics
 */
adminRouter.get("/metrics/operational", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const metrics = await getOperationalMetrics(parseInt(days as string, 10));
    res.json({ metrics });
  } catch (error) {
    logger.error("get_operational_metrics_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_OPERATIONAL_METRICS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/metrics/trends
 * Get metric trends over time
 */
adminRouter.get("/metrics/trends", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const trends = await getMetricTrends(parseInt(days as string, 10));
    res.json({ trends });
  } catch (error) {
    logger.error("get_metric_trends_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_METRIC_TRENDS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/metrics/health
 * Get real-time system health snapshot
 */
adminRouter.get("/metrics/health", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const health = await getSystemHealthSnapshot();
    res.json(health);
  } catch (error) {
    logger.error("get_system_health_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_SYSTEM_HEALTH_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/jobs
 * List all jobs with filters (admin)
 */
adminRouter.get("/jobs", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const {
      status,
      clientId,
      cleanerId,
      dateFrom,
      dateTo,
      limit = "50",
      offset = "0",
    } = req.query;

    const result = await listJobsForAdmin({
      status: status as any,
      clientId: clientId as string | undefined,
      cleanerId: cleanerId as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json(result);
  } catch (error) {
    logger.error("list_admin_jobs_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "LIST_JOBS_FAILED",
        message: (error as Error).message,
      },
    });
  }
});

/**
 * GET /admin/jobs/:jobId
 * Get full job details with timeline (admin)
 * Returns: job, client, cleaner, events, dispute, payments, payout, photos, credits
 */
adminRouter.get(
  "/jobs/:jobId",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const details = await getJobDetails(jobId);
      res.json(details);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("get_admin_job_details_failed", {
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
  }
);

/**
 * GET /admin/jobs/:jobId/events
 * Get all events for a job (admin)
 */
adminRouter.get(
  "/jobs/:jobId/events",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { limit = "100" } = req.query;

      const events = await getJobEventsForAdmin(
        jobId,
        parseInt(limit as string, 10)
      );

      res.json({
        jobId,
        events,
        count: events.length,
      });
    } catch (error) {
      logger.error("get_admin_job_events_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
      });
      res.status(500).json({
        error: {
          code: "GET_JOB_EVENTS_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * POST /admin/jobs/:jobId/override
 * Override job status (admin only)
 */
const overrideJobStatusSchema = z.object({
  newStatus: z.enum([
    "requested",
    "accepted",
    "on_my_way",
    "in_progress",
    "awaiting_approval",
    "completed",
    "disputed",
    "cancelled",
  ]),
  reason: z.string().min(1),
});

adminRouter.post(
  "/jobs/:jobId/override",
  requireAdmin,
  validateBody(overrideJobStatusSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { newStatus, reason } = req.body;
      const adminId = req.user!.id;

      const job = await overrideJobStatus(jobId, newStatus, reason, adminId);

      res.json({ job });
    } catch (error) {
      logger.error("override_job_status_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
        adminId: req.user?.id,
      });
      res.status(500).json({
        error: {
          code: "OVERRIDE_JOB_STATUS_FAILED",
          message: (error as Error).message,
        },
      });
    }
  }
);

/**
 * GET /admin/disputes
 * Get all disputes
 */
adminRouter.get("/disputes", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { status, limit = "50" } = req.query;

    const disputes = await getDisputes(
      status as any,
      parseInt(limit as string, 10)
    );

    res.json({
      disputes,
      count: disputes.length,
    });
  } catch (error) {
    logger.error("get_disputes_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "GET_DISPUTES_FAILED",
        message: (error as Error).message,
      },
    });
  }
});

/**
 * POST /admin/disputes/:disputeId/resolve
 * Resolve a dispute by disputeId
 */
const resolveDisputeSchema = z.object({
  resolution: z.enum(["resolved_refund", "resolved_no_refund"]),
  admin_notes: z.string().optional(),
});

adminRouter.post(
  "/disputes/:disputeId/resolve",
  requireAdmin,
  validateBody(resolveDisputeSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { disputeId } = req.params;
      const { resolution, admin_notes } = req.body;

      // Load dispute & job context
      const disputeResult = await query<{ id: string; job_id: string; client_id: string; status: string; amount_cents?: number | null }>(
        `SELECT id, job_id, client_id, status, amount_cents FROM disputes WHERE id = $1`,
        [disputeId]
      );
      const dispute = disputeResult.rows[0];
      if (!dispute) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Dispute not found" } });
      }

      if (resolution === "resolved_refund") {
        const jobResult = await query<{ id: string; credit_amount: number }>(
          `SELECT id, credit_amount FROM jobs WHERE id = $1`,
          [dispute.job_id]
        );
        const job = jobResult.rows[0];
        if (!job) {
          return res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "Job not found" } });
        }

        await processChargeDispute({
          disputeId,
          chargeId: null,
          paymentIntentId: null,
          jobId: job.id,
          clientId: dispute.client_id,
          amount: (dispute.amount_cents ?? job.credit_amount * env.CENTS_PER_CREDIT),
          currency: env.PAYOUT_CURRENCY,
          status: "lost",
          eventType: "charge.dispute.closed",
          reason: admin_notes || null,
        });
      } else {
        // resolved_no_refund -> just mark dispute closed
        await query(
          `UPDATE disputes SET status = 'resolved_no_refund', admin_notes = $2, updated_at = NOW() WHERE id = $1`,
          [disputeId, admin_notes || null]
        );
      }

      await sendAlert({
        level: "info",
        title: "Dispute resolved",
        message: `Dispute ${disputeId} resolved: ${resolution}`,
        details: { disputeId, resolution },
      });

      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("resolve_dispute_failed", {
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
  }
);

/**
 * POST /admin/disputes/job/:jobId/resolve
 * Resolve a dispute by jobId (legacy/convenience)
 */
adminRouter.post(
  "/disputes/job/:jobId/resolve",
  requireAdmin,
  validateBody(resolveDisputeSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { resolution, admin_notes } = req.body;
      const adminId = req.user!.id;

      const dispute = await resolveDispute(
        jobId,
        { resolution, adminNotes: admin_notes },
        adminId
      );

      res.json({ dispute });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("resolve_dispute_failed", {
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
  }
);

/**
 * GET /admin/payouts
 * Get all payouts (admin view)
 */
adminRouter.get("/payouts", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { status, limit = "100" } = req.query;

    const payouts = await getAllPayouts(
      status as any,
      parseInt(limit as string, 10)
    );

    res.json({
      payouts,
      count: payouts.length,
    });
  } catch (error) {
    logger.error("get_admin_payouts_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "GET_PAYOUTS_FAILED",
        message: (error as Error).message,
      },
    });
  }
});

/**
 * GET /admin/job-events
 * Get all job events (admin view)
 */
adminRouter.get("/job-events", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { limit = "200", eventType } = req.query;

    let queryText = "SELECT * FROM job_events";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (eventType) {
      queryText += ` WHERE event_type = $${paramIndex++}`;
      params.push(eventType);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramIndex++}`;
    params.push(parseInt(limit as string, 10));

    const result = await query(queryText, params);
    res.json({ events: result.rows, count: result.rows.length });
  } catch (error) {
    logger.error("get_admin_job_events_failed", {
      error: (error as Error).message,
      adminId: req.user?.id,
    });
    res.status(500).json({
      error: {
        code: "GET_JOB_EVENTS_FAILED",
        message: (error as Error).message,
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
adminRouter.get("/users", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { role, search, limit = "50", offset = "0" } = req.query;

    const result = await listUsers({
      role: role as any,
      search: search as string,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json(result);
  } catch (error) {
    logger.error("list_users_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "LIST_USERS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/users/stats
 * Get user statistics
 */
adminRouter.get("/users/stats", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const stats = await getUserStats();
    res.json({ stats });
  } catch (error) {
    logger.error("get_user_stats_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_USER_STATS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/users/:userId
 * Get single user details
 */
adminRouter.get("/users/:userId", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }

    res.json({ user });
  } catch (error) {
    logger.error("get_user_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_USER_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * POST /admin/users
 * Create a new user
 */
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["client", "cleaner", "admin"]),
  phone: z.string().optional(),
  defaultAddress: z.string().optional(),
  hourlyRateCredits: z.number().int().min(0).optional(),
});

adminRouter.post(
  "/users",
  requireAdmin,
  validateBody(createUserSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const user = await createUser(req.body);
      res.status(201).json({ user });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("create_user_failed", { error: err.message });
      res.status(err.statusCode || 500).json({
        error: { code: "CREATE_USER_FAILED", message: err.message },
      });
    }
  }
);

/**
 * PATCH /admin/users/:userId
 * Update user details
 */
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["client", "cleaner", "admin"]).optional(),
  defaultAddress: z.string().optional(),
  hourlyRateCredits: z.number().int().min(0).optional(),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
});

adminRouter.patch(
  "/users/:userId",
  requireAdmin,
  validateBody(updateUserSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await updateUser(userId, req.body);
      res.json({ user });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("update_user_failed", { error: err.message, userId: req.params.userId });
      res.status(err.statusCode || 500).json({
        error: { code: "UPDATE_USER_FAILED", message: err.message },
      });
    }
  }
);

/**
 * DELETE /admin/users/:userId
 * Delete user (soft delete by default)
 */
adminRouter.delete("/users/:userId", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { hard = "false" } = req.query;

    await deleteUser(userId, hard === "true");
    res.json({ deleted: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("delete_user_failed", { error: err.message, userId: req.params.userId });
    res.status(err.statusCode || 500).json({
      error: { code: "DELETE_USER_FAILED", message: err.message },
    });
  }
});

/**
 * POST /admin/users/:userId/reset-password
 * Reset user password
 */
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

adminRouter.post(
  "/users/:userId/reset-password",
  requireAdmin,
  validateBody(resetPasswordSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { newPassword } = req.body;

      await resetUserPassword(userId, newPassword);
      res.json({ reset: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("reset_password_failed", { error: err.message, userId: req.params.userId });
      res.status(err.statusCode || 500).json({
        error: { code: "RESET_PASSWORD_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /admin/users/:userId/adjust-credits
 * Adjust user credits
 */
const adjustCreditsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1),
});

adminRouter.post(
  "/users/:userId/adjust-credits",
  requireAdmin,
  validateBody(adjustCreditsSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;

      const result = await adjustUserCredits(userId, amount, reason);
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("adjust_credits_failed", { error: err.message, userId: req.params.userId });
      res.status(err.statusCode || 500).json({
        error: { code: "ADJUST_CREDITS_FAILED", message: err.message },
      });
    }
  }
);

// ============================================
// System Health & Repair Tools
// ============================================

/**
 * GET /admin/system/health
 * Run comprehensive system health check
 */
adminRouter.get("/system/health", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const health = await runSystemHealthCheck();
    res.json(health);
  } catch (error) {
    logger.error("system_health_check_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "HEALTH_CHECK_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/fraud/alerts
 */
adminRouter.get("/fraud/alerts", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const alerts = await getOpenFraudAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    res.status(500).json({ error: { code: "FRAUD_ALERTS_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /admin/fraud/alerts/:alertId/resolve
 */
adminRouter.post("/fraud/alerts/:alertId/resolve", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolution, notes } = req.body as { resolution?: "resolved" | "false_positive"; notes?: string };
    if (!resolution) {
      return res.status(400).json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
    }
    await resolveFraudAlert(alertId, req.user!.id, resolution, notes);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: { code: "FRAUD_RESOLVE_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /admin/payouts/:payoutId/reverse
 */
adminRouter.post(
  "/payouts/:payoutId/reverse",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { payoutId } = req.params;
      const { reason } = req.body as { reason?: string };
      if (!reason) {
        return res
          .status(400)
          .json({ error: { code: "MISSING_REASON", message: "Reason is required" } });
      }
      const adjustment = await reversePayout({
        payoutId,
        reason,
        initiatedBy: req.user!.id,
      });
      await sendAlert(alertTemplates.payoutReversed(payoutId, reason, req.user!.id));
      res.json({ success: true, adjustment });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "PAYOUT_REVERSE_FAILED", message: err.message } });
    }
  }
);

/**
 * POST /admin/payouts/:payoutId/hold
 */
adminRouter.post(
  "/payouts/:payoutId/hold",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { payoutId } = req.params;
      const { reason } = req.body as { reason?: string };
      const payout = await query<{
        cleaner_id: string;
        job_id: string | null;
        amount_cents: number;
      }>(`SELECT cleaner_id, job_id, amount_cents FROM payouts WHERE id = $1`, [payoutId]);
      const row = payout.rows[0];
      if (!row) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found" } });
      }
      const adjustment = await holdPayoutForDispute({
        cleanerId: row.cleaner_id,
        jobId: row.job_id || "",
        amountCents: row.amount_cents,
        reason: reason || "Admin hold",
      });
      await sendAlert(alertTemplates.payoutHold(payoutId, row.cleaner_id, row.job_id, row.amount_cents));
      res.json({ success: true, adjustment });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "PAYOUT_HOLD_FAILED", message: err.message } });
    }
  }
);

/**
 * POST /admin/payouts/hold/:adjustmentId/release
 */
adminRouter.post(
  "/payouts/hold/:adjustmentId/release",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { adjustmentId } = req.params;
      const { resolution } = req.body as { resolution?: "refund" | "release" };
      if (!resolution) {
        return res
          .status(400)
          .json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
      }
      await releaseDisputeHold(adjustmentId, resolution);
      await sendAlert({
        level: "info",
        title: "Payout hold resolved",
        message: `Hold ${adjustmentId} resolved as ${resolution}`,
        details: { adjustmentId, resolution },
      });
      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "PAYOUT_HOLD_RELEASE_FAILED", message: err.message } });
    }
  }
);

/**
 * GET /admin/payouts/reconciliation/flags
 */
adminRouter.get(
  "/payouts/reconciliation/flags",
  requireAdmin,
  async (_req: AuthedRequest, res: Response) => {
    try {
      const flags = await getPayoutReconciliationFlags();
      res.json({ flags });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: { code: "RECON_FLAGS_FAILED", message: err.message } });
    }
  }
);

/**
 * POST /admin/payouts/reconciliation/:payoutId/resolve
 */
adminRouter.post(
  "/payouts/reconciliation/:payoutId/resolve",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const { payoutId } = req.params;
      const { status, note } = req.body as { status?: "resolved" | "ignored"; note?: string };
      if (!status) {
        return res
          .status(400)
          .json({ error: { code: "MISSING_STATUS", message: "status required" } });
      }
      await resolvePayoutReconciliationFlag({ payoutId, status, note, resolvedBy: req.user!.id });
      await sendAlert(alertTemplates.reconFlagResolved(payoutId, status, note));
      res.json({ success: true });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: { code: "RECON_RESOLVE_FAILED", message: err.message } });
    }
  }
);

/**
 * POST /admin/payouts/:cleanerId/pause
 * Toggle payout pause for a cleaner
 */
adminRouter.post("/payouts/:cleanerId/pause", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { cleanerId } = req.params;
    const { paused } = req.body as { paused?: boolean };
    if (paused === undefined) {
      return res.status(400).json({ error: { code: "MISSING_PARAM", message: "paused required" } });
    }
    await updatePayoutPause(cleanerId, !!paused);
    await query(
      `
        UPDATE cleaner_profiles
        SET payout_paused_at = CASE WHEN $2 THEN NOW() ELSE payout_paused_at END,
            payout_paused_by = CASE WHEN $2 THEN $3 ELSE payout_paused_by END
        WHERE user_id = $1
      `,
      [cleanerId, !!paused, req.user!.id]
    );
    await sendAlert({
      level: "info",
      title: "Payout pause toggled",
      message: `Cleaner ${cleanerId} payout pause set to ${!!paused}`,
      details: { cleanerId, paused: !!paused },
    });
    res.json({ success: true, paused: !!paused });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: { code: "PAYOUT_PAUSE_FAILED", message: err.message } });
  }
});

/**
 * POST /admin/refunds/:jobId/approve
 * Approve and execute a refund to client (credit refund)
 */
const approveRefundSchema = z.object({
  reason: z.string().min(3),
});

adminRouter.post(
  "/refunds/:jobId/approve",
  requireAdmin,
  validateBody(approveRefundSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const { reason } = req.body;

      const jobResult = await query<{ id: string; client_id: string; credit_amount: number }>(
        `SELECT id, client_id, credit_amount FROM jobs WHERE id = $1`,
        [jobId]
      );
      const job = jobResult.rows[0];
      if (!job) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
      }

      // Drive through refundProcessor to keep ledger/payout consistency
      await processStripeRefund({
        chargeId: "admin_manual_refund",
        paymentIntentId: "admin_manual_refund",
        jobId: job.id,
        clientId: job.client_id,
        purpose: "job_charge",
        amount: job.credit_amount * env.CENTS_PER_CREDIT,
        currency: env.PAYOUT_CURRENCY,
      });

      // Mark job cancelled for clarity
      await query(`UPDATE jobs SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [job.id]);

      await sendAlert({
        level: "warning",
        title: "Refund approved",
        message: `Refund approved for job ${jobId}`,
        details: { jobId, adminId: req.user!.id, reason },
      });

      res.json({ success: true, jobId, message: "Refund processed successfully" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "REFUND_APPROVAL_FAILED", message: err.message } });
    }
  }
);

/**
 * POST /admin/disputes/:disputeId/route
 * Route a dispute to a queue or admin by updating metadata
 */
const DISPUTE_ROUTE_QUEUES = ["ops", "finance", "trust_safety", "support"] as const;
const routeDisputeSchema = z.object({
  routeTo: z.enum(DISPUTE_ROUTE_QUEUES),
  note: z.string().optional(),
});

adminRouter.post(
  "/disputes/:disputeId/route",
  requireAdmin,
  validateBody(routeDisputeSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { disputeId } = req.params;
      const { routeTo, note } = req.body;

      await query(
        `
          UPDATE disputes
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('routed_to', $2, 'route_note', $3),
              updated_at = NOW()
          WHERE id = $1
        `,
        [disputeId, routeTo, note || null]
      );

      await sendAlert(alertTemplates.disputeRouted(disputeId, routeTo, note, DISPUTE_ROUTE_QUEUES));

      res.json({ success: true });
    } catch (error) {
      const err = error as Error;
      res.status(500).json({ error: { code: "DISPUTE_ROUTE_FAILED", message: err.message } });
    }
  }
);

/**
 * GET /admin/system/stuck-jobs
 * Find stuck jobs
 */
adminRouter.get("/system/stuck-jobs", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const stuckJobs = await findStuckJobs();
    res.json({ stuckJobs, count: stuckJobs.length });
  } catch (error) {
    logger.error("find_stuck_jobs_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "FIND_STUCK_JOBS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/system/stuck-payouts
 * Find stuck payouts
 */
adminRouter.get("/system/stuck-payouts", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const stuckPayouts = await findStuckPayouts();
    res.json({ stuckPayouts, count: stuckPayouts.length });
  } catch (error) {
    logger.error("find_stuck_payouts_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "FIND_STUCK_PAYOUTS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/system/ledger-issues
 * Find credit ledger inconsistencies
 */
adminRouter.get("/system/ledger-issues", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const issues = await findLedgerInconsistencies();
    res.json({ issues, count: issues.length });
  } catch (error) {
    logger.error("find_ledger_issues_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "FIND_LEDGER_ISSUES_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * POST /admin/repair/job/:jobId/force-complete
 * Force complete a stuck job
 */
const forceCompleteSchema = z.object({
  reason: z.string().min(1),
});

adminRouter.post(
  "/repair/job/:jobId/force-complete",
  requireAdmin,
  validateBody(forceCompleteSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await forceCompleteJob(req.params.jobId, req.user!.id, req.body.reason);
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("force_complete_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "FORCE_COMPLETE_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /admin/repair/job/:jobId/force-cancel
 * Force cancel a stuck job
 */
const forceCancelSchema = z.object({
  reason: z.string().min(1),
  refundCredits: z.boolean().optional().default(true),
});

adminRouter.post(
  "/repair/job/:jobId/force-cancel",
  requireAdmin,
  validateBody(forceCancelSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await forceCancelJob(
        req.params.jobId,
        req.user!.id,
        req.body.reason,
        req.body.refundCredits
      );
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("force_cancel_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "FORCE_CANCEL_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /admin/repair/job/:jobId/reassign
 * Reassign a job to different cleaner
 */
const reassignSchema = z.object({
  newCleanerId: z.string().uuid(),
  reason: z.string().min(1),
});

adminRouter.post(
  "/repair/job/:jobId/reassign",
  requireAdmin,
  validateBody(reassignSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await reassignJob(
        req.params.jobId,
        req.body.newCleanerId,
        req.user!.id,
        req.body.reason
      );
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("reassign_job_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "REASSIGN_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /admin/repair/payout/:payoutId/force-process
 * Force process a stuck payout
 */
adminRouter.post(
  "/repair/payout/:payoutId/force-process",
  requireAdmin,
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await forceProcessPayout(req.params.payoutId, req.user!.id);
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("force_process_payout_failed", { error: err.message, payoutId: req.params.payoutId });
      res.status(err.statusCode || 500).json({
        error: { code: "FORCE_PROCESS_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /admin/repair/credits/:userId/adjust
 * Adjust user credits directly
 */
const repairCreditsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1),
});

adminRouter.post(
  "/repair/credits/:userId/adjust",
  requireAdmin,
  validateBody(repairCreditsSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const result = await adjustCredits(
        req.params.userId,
        req.body.amount,
        req.body.reason,
        req.user!.id
      );
      res.json(result);
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("repair_credits_failed", { error: err.message, userId: req.params.userId });
      res.status(err.statusCode || 500).json({
        error: { code: "REPAIR_CREDITS_FAILED", message: err.message },
      });
    }
  }
);

// ============================================
// Fraud Alerts
// ============================================

/**
 * GET /admin/fraud-alerts
 * Get open fraud alerts
 */
adminRouter.get("/fraud-alerts", requireAdmin, async (_req: AuthedRequest, res: Response) => {
  try {
    const alerts = await getOpenFraudAlerts();
    res.json({ alerts, count: alerts.length });
  } catch (error) {
    logger.error("get_fraud_alerts_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_FRAUD_ALERTS_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * POST /admin/fraud-alerts/:alertId/resolve
 * Resolve a fraud alert
 */
const resolveFraudSchema = z.object({
  resolution: z.enum(["resolved", "false_positive"]),
  notes: z.string().optional(),
});

adminRouter.post(
  "/fraud-alerts/:alertId/resolve",
  requireAdmin,
  validateBody(resolveFraudSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      await resolveFraudAlert(
        req.params.alertId,
        req.user!.id,
        req.body.resolution,
        req.body.notes
      );
      res.json({ resolved: true });
    } catch (error) {
      logger.error("resolve_fraud_alert_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "RESOLVE_FRAUD_ALERT_FAILED", message: (error as Error).message },
      });
    }
  }
);

// ============================================
// Invoice Management
// ============================================

/**
 * GET /admin/invoices
 * List all invoices (admin view)
 */
adminRouter.get("/invoices", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { status, requiresApproval, limit = "50", offset = "0" } = req.query;

    const result = await getAdminInvoices({
      status: status as InvoiceStatus | undefined,
      requiresApproval: requiresApproval === "true" ? true : requiresApproval === "false" ? false : undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      invoices: result.invoices,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    logger.error("get_admin_invoices_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_INVOICES_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/invoices/pending-approval
 * Get invoices requiring admin approval
 */
adminRouter.get("/invoices/pending-approval", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { limit = "50", offset = "0" } = req.query;

    const result = await getAdminInvoices({
      status: "pending_approval" as InvoiceStatus,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });

    res.json({
      invoices: result.invoices,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      },
    });
  } catch (error) {
    logger.error("get_pending_invoices_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_PENDING_INVOICES_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * GET /admin/invoices/:invoiceId
 * Get single invoice with full details
 */
adminRouter.get("/invoices/:invoiceId", requireAdmin, async (req: AuthedRequest, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const invoice = await getInvoiceWithLineItems(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Invoice not found" },
      });
    }

    res.json({ invoice });
  } catch (error) {
    logger.error("get_admin_invoice_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "GET_INVOICE_FAILED", message: (error as Error).message },
    });
  }
});

/**
 * PATCH /admin/invoices/:invoiceId/approve
 * Approve an invoice pending approval
 */
const approveInvoiceSchema = z.object({
  autoSend: z.boolean().optional().default(true),
});

adminRouter.patch(
  "/invoices/:invoiceId/approve",
  requireAdmin,
  validateBody(approveInvoiceSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { autoSend } = req.body;
      const adminId = req.user!.id;

      const invoice = await adminApproveInvoice(invoiceId, adminId, autoSend);

      await sendAlert({
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
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("approve_invoice_failed", { error: err.message, invoiceId: req.params.invoiceId });
      res.status(err.statusCode || 500).json({
        error: { code: "APPROVE_INVOICE_FAILED", message: err.message },
      });
    }
  }
);

/**
 * PATCH /admin/invoices/:invoiceId/deny
 * Deny an invoice pending approval
 */
const denyInvoiceSchema = z.object({
  reason: z.string().min(3),
});

adminRouter.patch(
  "/invoices/:invoiceId/deny",
  requireAdmin,
  validateBody(denyInvoiceSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const { reason } = req.body;
      const adminId = req.user!.id;

      const invoice = await adminDenyInvoice(invoiceId, adminId, reason);

      await sendAlert({
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
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("deny_invoice_failed", { error: err.message, invoiceId: req.params.invoiceId });
      res.status(err.statusCode || 500).json({
        error: { code: "DENY_INVOICE_FAILED", message: err.message },
      });
    }
  }
);

export default adminRouter;
