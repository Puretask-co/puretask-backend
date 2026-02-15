// src/routes/admin.ts
// Admin API routes matching 001_init.sql schema
import { Router, Response } from "express";
import { query } from "../db/client";
import {
  requireAuth,
  requireAdmin,
  requireSupportRole,
  requireDisputeResolveRole,
  AuthedRequest,
  authedHandler,
} from "../middleware/authCanonical";
import { validateBody } from "../lib/validation";
import { z } from "zod";
import {
  getAdminKPIs,
  resolveDispute,
  overrideJobStatus,
  getDisputes,
  getDisputeDetail,
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
  sanitizeUserForAdmin,
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
import {
  getUserRiskProfile,
  getRiskReviewQueue,
  calculateRiskScore,
  calculateRiskFlags,
  RiskFlagType,
} from "../services/riskService";
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

// All admin routes require authentication and admin role
adminRouter.use(requireAuth);
adminRouter.use(requireAdmin);

/**
 * @swagger
 * /admin/kpis:
 *   get:
 *     summary: Get admin KPIs
 *     description: Get key performance indicators for admin dashboard.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Admin KPIs
 *       401:
 *         description: Unauthorized - admin only
 */
adminRouter.get(
  "/kpis",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const kpis = await getAdminKPIs(dateFrom as string | undefined, dateTo as string | undefined);
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
  })
);

// V2 FEATURE — DISABLED FOR NOW (advanced KPIs)
// adminRouter.get("/kpis/history", requireAdmin, authedHandler(async (req: AuthedRequest, res: Response) => {
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
// adminRouter.get("/metrics/operational", requireAdmin, authedHandler(async (req: AuthedRequest, res: Response) => {
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
// adminRouter.get("/metrics/trends", requireAdmin, authedHandler(async (req: AuthedRequest, res: Response) => {
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
// adminRouter.get("/metrics/health", requireAdmin, authedHandler(async (_req: AuthedRequest, res: Response) => {
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
 * @swagger
 * /admin/jobs:
 *   get:
 *     summary: List all jobs (admin)
 *     description: List all jobs with filters for admin management.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: clientId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: cleanerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of jobs
 *       401:
 *         description: Unauthorized - admin only
 */
adminRouter.get(
  "/jobs",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
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
  })
);

/**
 * @swagger
 * /admin/jobs/{jobId}:
 *   get:
 *     summary: Get job details (admin)
 *     description: Get full job details with timeline including client, cleaner, events, dispute, payments, payout, photos, credits.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full job details
 *       401:
 *         description: Unauthorized - admin only
 */
async function handleGetJobDetails(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.get("/jobs/:jobId", requireAdmin, authedHandler(handleGetJobDetails));

/**
 * @swagger
 * /admin/jobs/{jobId}/events:
 *   get:
 *     summary: Get job events (admin)
 *     description: Get all events for a job.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Job events
 */
async function handleGetJobEvents(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { limit = "100" } = req.query;
    const events = await getJobEventsForAdmin(jobId, parseInt(limit as string, 10));
    res.json({ jobId, events, count: events.length });
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

adminRouter.get("/jobs/:jobId/events", requireAdmin, authedHandler(handleGetJobEvents));

/**
 * @swagger
 * /admin/jobs/{jobId}/override:
 *   post:
 *     summary: Override job status
 *     description: Override job status (admin only).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newStatus
 *               - reason
 *             properties:
 *               newStatus:
 *                 type: string
 *                 enum: [requested, accepted, on_my_way, in_progress, awaiting_approval, completed, disputed, cancelled]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job status overridden
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

async function handleOverrideJobStatus(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/jobs/:jobId/override",
  requireAdmin,
  validateBody(overrideJobStatusSchema),
  authedHandler(handleOverrideJobStatus)
);

/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     summary: Get all disputes
 *     description: Get all disputes with optional status filter.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of disputes
 */
adminRouter.get(
  "/disputes",
  requireSupportRole,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { status, limit = "50" } = req.query;

      const disputes = await getDisputes(status as any, parseInt(limit as string, 10));

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
  })
);

/**
 * @swagger
 * /admin/disputes/{disputeId}:
 *   get:
 *     summary: Get dispute detail
 *     description: Full dispute detail with job, events, photos, timeline for admin resolution UI.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Dispute detail with full timeline
 *       404:
 *         description: Dispute not found
 */
adminRouter.get(
  "/disputes/:disputeId",
  requireSupportRole,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { disputeId } = req.params;
      const detail = await getDisputeDetail(disputeId);
      if (!detail) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Dispute not found" },
        });
        return;
      }
      res.json(detail);
    } catch (error) {
      logger.error("get_dispute_detail_failed", {
        error: (error as Error).message,
        disputeId: req.params.disputeId,
      });
      res.status(500).json({
        error: {
          code: "GET_DISPUTE_DETAIL_FAILED",
          message: (error as Error).message,
        },
      });
    }
  })
);

/**
 * @swagger
 * /admin/disputes/{disputeId}/resolve:
 *   post:
 *     summary: Resolve dispute
 *     description: Resolve a dispute by disputeId.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [resolved_refund, resolved_no_refund]
 *               admin_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute resolved
 */
const resolveDisputeSchema = z.object({
  resolution: z.enum(["resolved_refund", "resolved_no_refund"]),
  admin_notes: z.string().optional(),
});

async function handleResolveDisputeById(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { disputeId } = req.params;
    const { resolution, admin_notes } = req.body;
    const disputeResult = await query<{
      id: string;
      job_id: string;
      client_id: string;
      status: string;
      amount_cents?: number | null;
    }>(`SELECT id, job_id, client_id, status, amount_cents FROM disputes WHERE id = $1`, [
      disputeId,
    ]);
    const dispute = disputeResult.rows[0];
    if (!dispute) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Dispute not found" } });
      return;
    }
    if (resolution === "resolved_refund") {
      const jobResult = await query<{ id: string; credit_amount: number }>(
        `SELECT id, credit_amount FROM jobs WHERE id = $1`,
        [dispute.job_id]
      );
      const job = jobResult.rows[0];
      if (!job) {
        res.status(404).json({ error: { code: "JOB_NOT_FOUND", message: "Job not found" } });
        return;
      }
      await processChargeDispute({
        disputeId,
        chargeId: null,
        paymentIntentId: null,
        jobId: job.id,
        clientId: dispute.client_id,
        amount: dispute.amount_cents ?? job.credit_amount * env.CENTS_PER_CREDIT,
        currency: env.PAYOUT_CURRENCY,
        status: "lost",
        eventType: "charge.dispute.closed",
        reason: admin_notes || null,
      });
    } else {
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

adminRouter.post(
  "/disputes/:disputeId/resolve",
  requireDisputeResolveRole,
  validateBody(resolveDisputeSchema),
  authedHandler(handleResolveDisputeById)
);

/**
 * POST /admin/disputes/job/:jobId/resolve
 * Resolve a dispute by jobId (legacy/convenience)
 */
async function handleResolveDisputeByJobId(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { resolution, admin_notes } = req.body;
    const adminId = req.user!.id;
    const dispute = await resolveDispute(jobId, { resolution, adminNotes: admin_notes }, adminId);
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

adminRouter.post(
  "/disputes/job/:jobId/resolve",
  requireDisputeResolveRole,
  validateBody(resolveDisputeSchema),
  authedHandler(handleResolveDisputeByJobId)
);

/**
 * @swagger
 * /admin/payouts:
 *   get:
 *     summary: Get all payouts
 *     description: Get all payouts with optional status filter.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: List of payouts
 */
adminRouter.get(
  "/payouts",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { status, limit = "100" } = req.query;

      const payouts = await getAllPayouts(status as any, parseInt(limit as string, 10));

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
  })
);

/**
 * @swagger
 * /admin/job-events:
 *   get:
 *     summary: Get all job events
 *     description: Get all job events with optional event type filter.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 200
 *       - in: query
 *         name: eventType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of job events
 */
adminRouter.get(
  "/job-events",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
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
  })
);

// ============================================
// User Management Routes
// ============================================

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: List all users
 *     description: List all users with filters.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, cleaner, admin]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of users
 */
adminRouter.get(
  "/users",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { role, search, limit = "50", offset = "0" } = req.query;

      const result = await listUsers({
        role: role as any,
        search: search as string,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10),
      });

      // Sanitize users to exclude password_hash
      const sanitizedUsers = result.users.map((user) => sanitizeUserForAdmin(user));
      res.json({ users: sanitizedUsers, total: result.total });
    } catch (error) {
      logger.error("list_users_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "LIST_USERS_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/users/stats:
 *   get:
 *     summary: Get user statistics
 *     description: Get user statistics.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics
 */
adminRouter.get(
  "/users/stats",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const stats = await getUserStats();
      res.json({ stats });
    } catch (error) {
      logger.error("get_user_stats_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "GET_USER_STATS_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/users/{userId}:
 *   get:
 *     summary: Get user details
 *     description: Get single user details.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
adminRouter.get(
  "/users/:userId",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await getUserById(userId);

      if (!user) {
        res.status(404).json({
          error: { code: "USER_NOT_FOUND", message: "User not found" },
        });
        return;
      }

      // Sanitize user to exclude password_hash
      res.json({ user: sanitizeUserForAdmin(user) });
    } catch (error) {
      logger.error("get_user_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "GET_USER_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create user
 *     description: Create a new user.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email: { type: 'string', format: 'email' }
 *               password: { type: 'string', minLength: 8 }
 *               role: { type: 'string', enum: ['client', 'cleaner', 'admin'] }
 *               phone: { type: 'string' }
 *               defaultAddress: { type: 'string' }
 *               hourlyRateCredits: { type: 'integer', minimum: 0 }
 *     responses:
 *       201:
 *         description: User created
 */
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["client", "cleaner", "admin"]),
  phone: z.string().optional(),
  defaultAddress: z.string().optional(),
  hourlyRateCredits: z.number().int().min(0).optional(),
});

async function handleCreateUser(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const user = await createUser(req.body);
    res.status(201).json({ user: sanitizeUserForAdmin(user) });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("create_user_failed", { error: err.message });
    res.status(err.statusCode || 500).json({
      error: { code: "CREATE_USER_FAILED", message: err.message },
    });
  }
}

adminRouter.post(
  "/users",
  requireAdmin,
  validateBody(createUserSchema),
  authedHandler(handleCreateUser)
);

/**
 * @swagger
 * /admin/users/{userId}:
 *   patch:
 *     summary: Update user
 *     description: Update user details.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: 'string', format: 'email' }
 *               phone: { type: 'string' }
 *               role: { type: 'string', enum: ['client', 'cleaner', 'admin'] }
 *               defaultAddress: { type: 'string' }
 *               hourlyRateCredits: { type: 'integer', minimum: 0 }
 *               tier: { type: 'string', enum: ['bronze', 'silver', 'gold', 'platinum'] }
 *     responses:
 *       200:
 *         description: User updated
 */
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().optional(),
  role: z.enum(["client", "cleaner", "admin"]).optional(),
  defaultAddress: z.string().optional(),
  hourlyRateCredits: z.number().int().min(0).optional(),
  tier: z.enum(["bronze", "silver", "gold", "platinum"]).optional(),
});

async function handleUpdateUser(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { userId } = req.params;
    const user = await updateUser(userId, req.body);
    res.json({ user: sanitizeUserForAdmin(user) });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("update_user_failed", { error: err.message, userId: req.params.userId });
    res.status(err.statusCode || 500).json({
      error: { code: "UPDATE_USER_FAILED", message: err.message },
    });
  }
}

adminRouter.patch(
  "/users/:userId",
  requireAdmin,
  validateBody(updateUserSchema),
  authedHandler(handleUpdateUser)
);

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Delete user
 *     description: Delete user (soft delete by default).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: hard
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: User deleted
 */
adminRouter.delete(
  "/users/:userId",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
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
  })
);

/**
 * @swagger
 * /admin/users/{userId}/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Reset user password.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword: { type: 'string', minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset
 */
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

async function handleResetPassword(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/users/:userId/reset-password",
  requireAdmin,
  validateBody(resetPasswordSchema),
  authedHandler(handleResetPassword)
);

/**
 * @swagger
 * /admin/users/{userId}/adjust-credits:
 *   post:
 *     summary: Adjust user credits
 *     description: Adjust user credits.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reason
 *             properties:
 *               amount: { type: 'integer' }
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Credits adjusted
 */
const adjustCreditsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1),
});

async function handleAdjustUserCredits(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/users/:userId/adjust-credits",
  requireAdmin,
  validateBody(adjustCreditsSchema),
  authedHandler(handleAdjustUserCredits)
);

// ============================================
// System Health & Repair Tools
// ============================================

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     summary: System health check
 *     description: Run comprehensive system health check.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 */
adminRouter.get(
  "/system/health",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const health = await runSystemHealthCheck();
      res.json(health);
    } catch (error) {
      logger.error("system_health_check_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "HEALTH_CHECK_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/fraud/alerts:
 *   get:
 *     summary: Get fraud alerts
 *     description: Get open fraud alerts.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of fraud alerts
 */
adminRouter.get(
  "/fraud/alerts",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const alerts = await getOpenFraudAlerts();
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      res
        .status(500)
        .json({ error: { code: "FRAUD_ALERTS_FAILED", message: (error as Error).message } });
    }
  })
);

/**
 * @swagger
 * /admin/fraud/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve fraud alert
 *     description: Resolve a fraud alert.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [resolved, false_positive]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Fraud alert resolved
 */
adminRouter.post(
  "/fraud/alerts/:alertId/resolve",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { alertId } = req.params;
      const { resolution, notes } = req.body as {
        resolution?: "resolved" | "false_positive";
        notes?: string;
      };
      if (!resolution) {
        res
          .status(400)
          .json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
        return;
      }
      await resolveFraudAlert(alertId, req.user!.id, resolution, notes);
      res.json({ success: true });
    } catch (error) {
      res
        .status(500)
        .json({ error: { code: "FRAUD_RESOLVE_FAILED", message: (error as Error).message } });
    }
  })
);

/**
 * @swagger
 * /admin/payouts/{payoutId}/reverse:
 *   post:
 *     summary: Reverse payout
 *     description: Reverse a payout.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Payout reversed
 */
async function handleReversePayout(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { payoutId } = req.params;
    const { reason } = req.body as { reason?: string };
    if (!reason) {
      res.status(400).json({ error: { code: "MISSING_REASON", message: "Reason is required" } });
      return;
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

adminRouter.post("/payouts/:payoutId/reverse", requireAdmin, authedHandler(handleReversePayout));

async function handleHoldPayout(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { payoutId } = req.params;
    const { reason } = req.body as { reason?: string };
    const payout = await query<{ cleaner_id: string; job_id: string | null; amount_cents: number }>(
      `SELECT cleaner_id, job_id, amount_cents FROM payouts WHERE id = $1`,
      [payoutId]
    );
    const row = payout.rows[0];
    if (!row) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Payout not found" } });
      return;
    }
    const adjustment = await holdPayoutForDispute({
      cleanerId: row.cleaner_id,
      jobId: row.job_id || "",
      amountCents: row.amount_cents,
      reason: reason || "Admin hold",
    });
    await sendAlert(
      alertTemplates.payoutHold(payoutId, row.cleaner_id, row.job_id, row.amount_cents)
    );
    res.json({ success: true, adjustment });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "PAYOUT_HOLD_FAILED", message: err.message } });
  }
}

/**
 * @swagger
 * /admin/payouts/{payoutId}/hold:
 *   post:
 *     summary: Hold payout
 *     description: Hold a payout for dispute.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Payout held
 */
adminRouter.post("/payouts/:payoutId/hold", requireAdmin, authedHandler(handleHoldPayout));

/**
 * @swagger
 * /admin/payouts/hold/{adjustmentId}/release:
 *   post:
 *     summary: Release payout hold
 *     description: Release a payout hold.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adjustmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [refund, release]
 *     responses:
 *       200:
 *         description: Payout hold released
 */
async function handleReleasePayoutHold(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { adjustmentId } = req.params;
    const { resolution } = req.body as { resolution?: "refund" | "release" };
    if (!resolution) {
      res
        .status(400)
        .json({ error: { code: "MISSING_RESOLUTION", message: "resolution required" } });
      return;
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

adminRouter.post(
  "/payouts/hold/:adjustmentId/release",
  requireAdmin,
  authedHandler(handleReleasePayoutHold)
);

async function handleGetReconFlags(_req: AuthedRequest, res: Response): Promise<void> {
  try {
    const flags = await getPayoutReconciliationFlags();
    res.json({ flags });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: { code: "RECON_FLAGS_FAILED", message: err.message } });
  }
}

/**
 * @swagger
 * /admin/payouts/reconciliation/flags:
 *   get:
 *     summary: Get payout reconciliation flags
 *     description: Get payout reconciliation flags.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of reconciliation flags
 */
adminRouter.get("/payouts/reconciliation/flags", requireAdmin, authedHandler(handleGetReconFlags));

/**
 * @swagger
 * /admin/payouts/reconciliation/{payoutId}/resolve:
 *   post:
 *     summary: Resolve reconciliation flag
 *     description: Resolve a payout reconciliation flag.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [resolved, ignored]
 *               note: { type: 'string' }
 *     responses:
 *       200:
 *         description: Reconciliation flag resolved
 */
async function handleResolveReconFlag(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { payoutId } = req.params;
    const { status, note } = req.body as { status?: "resolved" | "ignored"; note?: string };
    if (!status) {
      res.status(400).json({ error: { code: "MISSING_STATUS", message: "status required" } });
      return;
    }
    await resolvePayoutReconciliationFlag({ payoutId, status, note, resolvedBy: req.user!.id });
    await sendAlert(alertTemplates.reconFlagResolved(payoutId, status, note));
    res.json({ success: true });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: { code: "RECON_RESOLVE_FAILED", message: err.message } });
  }
}

adminRouter.post(
  "/payouts/reconciliation/:payoutId/resolve",
  requireAdmin,
  authedHandler(handleResolveReconFlag)
);

/**
 * @swagger
 * /admin/payouts/{cleanerId}/pause:
 *   post:
 *     summary: Pause cleaner payouts
 *     description: Toggle payout pause for a cleaner.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cleanerId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paused
 *             properties:
 *               paused: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Payout pause toggled
 */
adminRouter.post(
  "/payouts/:cleanerId/pause",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { cleanerId } = req.params;
      const { paused } = req.body as { paused?: boolean };
      if (paused === undefined) {
        res.status(400).json({ error: { code: "MISSING_PARAM", message: "paused required" } });
        return;
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
  })
);

/**
 * @swagger
 * /admin/refunds/{jobId}/approve:
 *   post:
 *     summary: Approve refund
 *     description: Approve and execute a refund to client (credit refund).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason: { type: 'string', minLength: 3 }
 *     responses:
 *       200:
 *         description: Refund approved and processed
 */
const approveRefundSchema = z.object({
  reason: z.string().min(3),
});

async function handleApproveRefund(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const jobResult = await query<{ id: string; client_id: string; credit_amount: number }>(
      `SELECT id, client_id, credit_amount FROM jobs WHERE id = $1`,
      [jobId]
    );
    const job = jobResult.rows[0];
    if (!job) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Job not found" } });
      return;
    }
    await processStripeRefund({
      chargeId: "admin_manual_refund",
      paymentIntentId: "admin_manual_refund",
      jobId: job.id,
      clientId: job.client_id,
      purpose: "job_charge",
      amount: job.credit_amount * env.CENTS_PER_CREDIT,
      currency: env.PAYOUT_CURRENCY,
    });
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

adminRouter.post(
  "/refunds/:jobId/approve",
  requireAdmin,
  validateBody(approveRefundSchema),
  authedHandler(handleApproveRefund)
);

/**
 * @swagger
 * /admin/disputes/{disputeId}/route:
 *   post:
 *     summary: Route dispute
 *     description: Route a dispute to a queue or admin by updating metadata.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - routeTo
 *             properties:
 *               routeTo:
 *                 type: string
 *                 enum: [ops, finance, trust_safety, support]
 *               note: { type: 'string' }
 *     responses:
 *       200:
 *         description: Dispute routed
 */
const DISPUTE_ROUTE_QUEUES = ["ops", "finance", "trust_safety", "support"] as const;
export const routeDisputeSchema = z.object({
  routeTo: z.enum(DISPUTE_ROUTE_QUEUES),
  note: z.string().optional(),
});

async function handleRouteDispute(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/disputes/:disputeId/route",
  requireAdmin,
  validateBody(routeDisputeSchema),
  authedHandler(handleRouteDispute)
);

/**
 * @swagger
 * /admin/system/stuck-jobs:
 *   get:
 *     summary: Find stuck jobs
 *     description: Find jobs that are stuck in active states.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stuck jobs
 */
adminRouter.get(
  "/system/stuck-jobs",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const stuckJobs = await findStuckJobs();
      res.json({ stuckJobs, count: stuckJobs.length });
    } catch (error) {
      logger.error("find_stuck_jobs_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "FIND_STUCK_JOBS_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/system/stuck-payouts:
 *   get:
 *     summary: Find stuck payouts
 *     description: Find payouts that are stuck.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stuck payouts
 */
adminRouter.get(
  "/system/stuck-payouts",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const stuckPayouts = await findStuckPayouts();
      res.json({ stuckPayouts, count: stuckPayouts.length });
    } catch (error) {
      logger.error("find_stuck_payouts_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "FIND_STUCK_PAYOUTS_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/system/ledger-issues:
 *   get:
 *     summary: Find ledger issues
 *     description: Find credit ledger inconsistencies.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ledger issues
 */
adminRouter.get(
  "/system/ledger-issues",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const issues = await findLedgerInconsistencies();
      res.json({ issues, count: issues.length });
    } catch (error) {
      logger.error("find_ledger_issues_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "FIND_LEDGER_ISSUES_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/repair/job/{jobId}/force-complete:
 *   post:
 *     summary: Force complete job
 *     description: Force complete a stuck job.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Job force completed
 */
const forceCompleteSchema = z.object({
  reason: z.string().min(1),
});

async function handleForceCompleteJob(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/repair/job/:jobId/force-complete",
  requireAdmin,
  validateBody(forceCompleteSchema),
  authedHandler(handleForceCompleteJob)
);

/**
 * @swagger
 * /admin/repair/job/{jobId}/force-cancel:
 *   post:
 *     summary: Force cancel job
 *     description: Force cancel a stuck job.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason: { type: 'string' }
 *               refundCredits: { type: 'boolean', default: true }
 *     responses:
 *       200:
 *         description: Job force cancelled
 */
const forceCancelSchema = z.object({
  reason: z.string().min(1),
  refundCredits: z.boolean().optional().default(true),
});

async function handleForceCancelJob(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/repair/job/:jobId/force-cancel",
  requireAdmin,
  validateBody(forceCancelSchema),
  authedHandler(handleForceCancelJob)
);

/**
 * @swagger
 * /admin/repair/job/{jobId}/reassign:
 *   post:
 *     summary: Reassign job
 *     description: Reassign a job to different cleaner.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newCleanerId
 *               - reason
 *             properties:
 *               newCleanerId: { type: 'string', format: 'uuid' }
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Job reassigned
 */
const reassignSchema = z.object({
  newCleanerId: z.string().uuid(),
  reason: z.string().min(1),
});

async function handleReassignJob(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/repair/job/:jobId/reassign",
  requireAdmin,
  validateBody(reassignSchema),
  authedHandler(handleReassignJob)
);

async function handleForceProcessPayout(req: AuthedRequest, res: Response): Promise<void> {
  try {
    const result = await forceProcessPayout(req.params.payoutId, req.user!.id);
    res.json(result);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("force_process_payout_failed", {
      error: err.message,
      payoutId: req.params.payoutId,
    });
    res.status(err.statusCode || 500).json({
      error: { code: "FORCE_PROCESS_FAILED", message: err.message },
    });
  }
}

/**
 * @swagger
 * /admin/repair/payout/{payoutId}/force-process:
 *   post:
 *     summary: Force process payout
 *     description: Force process a stuck payout.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: payoutId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payout force processed
 */
adminRouter.post(
  "/repair/payout/:payoutId/force-process",
  requireAdmin,
  authedHandler(handleForceProcessPayout)
);

/**
 * @swagger
 * /admin/repair/credits/{userId}/adjust:
 *   post:
 *     summary: Adjust credits (repair)
 *     description: Adjust user credits directly (repair tool).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - reason
 *             properties:
 *               amount: { type: 'integer' }
 *               reason: { type: 'string' }
 *     responses:
 *       200:
 *         description: Credits adjusted
 */
const repairCreditsSchema = z.object({
  amount: z.number().int(),
  reason: z.string().min(1),
});

async function handleRepairCredits(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.post(
  "/repair/credits/:userId/adjust",
  requireAdmin,
  validateBody(repairCreditsSchema),
  authedHandler(handleRepairCredits)
);

// ============================================
// Fraud Alerts
// ============================================

/**
 * @swagger
 * /admin/fraud-alerts:
 *   get:
 *     summary: Get fraud alerts
 *     description: Get open fraud alerts.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of fraud alerts
 */
adminRouter.get(
  "/fraud-alerts",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const alerts = await getOpenFraudAlerts();
      res.json({ alerts, count: alerts.length });
    } catch (error) {
      logger.error("get_fraud_alerts_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "GET_FRAUD_ALERTS_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/fraud-alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve fraud alert
 *     description: Resolve a fraud alert.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [resolved, false_positive]
 *               notes: { type: 'string' }
 *     responses:
 *       200:
 *         description: Fraud alert resolved
 */
const resolveFraudSchema = z.object({
  resolution: z.enum(["resolved", "false_positive"]),
  notes: z.string().optional(),
});

async function handleResolveFraudAlert(req: AuthedRequest, res: Response): Promise<void> {
  try {
    await resolveFraudAlert(req.params.alertId, req.user!.id, req.body.resolution, req.body.notes);
    res.json({ resolved: true });
  } catch (error) {
    logger.error("resolve_fraud_alert_failed", { error: (error as Error).message });
    res.status(500).json({
      error: { code: "RESOLVE_FRAUD_ALERT_FAILED", message: (error as Error).message },
    });
  }
}

adminRouter.post(
  "/fraud-alerts/:alertId/resolve",
  requireAdmin,
  validateBody(resolveFraudSchema),
  authedHandler(handleResolveFraudAlert)
);

// ============================================
// Invoice Management
// ============================================

/**
 * @swagger
 * /admin/invoices:
 *   get:
 *     summary: List all invoices
 *     description: List all invoices with filters.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: requiresApproval
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of invoices
 */
adminRouter.get(
  "/invoices",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { status, requiresApproval, limit = "50", offset = "0" } = req.query;

      const result = await getAdminInvoices({
        status: status as InvoiceStatus | undefined,
        requiresApproval:
          requiresApproval === "true" ? true : requiresApproval === "false" ? false : undefined,
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
  })
);

/**
 * @swagger
 * /admin/invoices/pending-approval:
 *   get:
 *     summary: Get pending approval invoices
 *     description: Get invoices requiring admin approval.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of pending invoices
 */
adminRouter.get(
  "/invoices/pending-approval",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
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
  })
);

/**
 * @swagger
 * /admin/invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice details
 *     description: Get single invoice with full details.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice details
 *       404:
 *         description: Invoice not found
 */
adminRouter.get(
  "/invoices/:invoiceId",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await getInvoiceWithLineItems(invoiceId);

      if (!invoice) {
        res.status(404).json({
          error: { code: "NOT_FOUND", message: "Invoice not found" },
        });
        return;
      }

      res.json({ invoice });
    } catch (error) {
      logger.error("get_admin_invoice_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "GET_INVOICE_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/invoices/{invoiceId}/approve:
 *   patch:
 *     summary: Approve invoice
 *     description: Approve an invoice pending approval.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoSend: { type: 'boolean', default: true }
 *     responses:
 *       200:
 *         description: Invoice approved
 */
const approveInvoiceSchema = z.object({
  autoSend: z.boolean().optional().default(true),
});

async function handleApproveInvoice(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.patch(
  "/invoices/:invoiceId/approve",
  requireAdmin,
  validateBody(approveInvoiceSchema),
  authedHandler(handleApproveInvoice)
);

/**
 * @swagger
 * /admin/invoices/{invoiceId}/deny:
 *   patch:
 *     summary: Deny invoice
 *     description: Deny an invoice pending approval.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               reason: { type: 'string', minLength: 3 }
 *     responses:
 *       200:
 *         description: Invoice denied
 */
const denyInvoiceSchema = z.object({
  reason: z.string().min(3),
});

async function handleDenyInvoice(req: AuthedRequest, res: Response): Promise<void> {
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

adminRouter.patch(
  "/invoices/:invoiceId/deny",
  requireAdmin,
  validateBody(denyInvoiceSchema),
  authedHandler(handleDenyInvoice)
);

// ============================================
// V4 FEATURE: Risk Review
// ============================================

/**
 * @swagger
 * /admin/risk/review:
 *   get:
 *     summary: Get risk review queue
 *     description: Get list of users with active risk flags for review.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Risk review queue
 */
adminRouter.get(
  "/risk/review",
  requireAdmin,
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      // For MVP, return empty queue
      // In production, this would query risk_flags table for active flags
      const queue = await getRiskReviewQueue();

      res.json({
        queue,
        count: queue.length,
        message: "Risk review queue. Query specific users for risk profiles.",
      });
    } catch (error) {
      logger.error("get_risk_review_queue_failed", { error: (error as Error).message });
      res.status(500).json({
        error: { code: "GET_RISK_QUEUE_FAILED", message: (error as Error).message },
      });
    }
  })
);

/**
 * @swagger
 * /admin/risk/{userId}:
 *   get:
 *     summary: Get user risk profile
 *     description: Get risk profile for a specific user.
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [client, cleaner]
 *           default: client
 *     responses:
 *       200:
 *         description: User risk profile
 */
adminRouter.get(
  "/risk/:userId",
  requireAdmin,
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const role = (req.query.role as "client" | "cleaner") || "client";

      const profile = await getUserRiskProfile(userId, role);

      res.json({
        profile,
        message: "User risk profile",
      });
    } catch (error) {
      logger.error("get_user_risk_profile_failed", {
        userId: req.params.userId,
        error: (error as Error).message,
      });
      res.status(500).json({
        error: { code: "GET_RISK_PROFILE_FAILED", message: (error as Error).message },
      });
    }
  })
);

export default adminRouter;
