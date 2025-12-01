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
import { logger } from "../lib/logger";

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

      // Import from disputesService for direct resolution
      const { resolveDispute: resolveDisputeService } = await import("../services/disputesService");
      
      const dispute = await resolveDisputeService(
        disputeId,
        resolution,
        admin_notes || ""
      );

      res.json({ dispute });
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
