// src/routes/admin/index.ts
// Main admin router that combines all admin sub-routes

import { Router, Response } from "express";
import { z } from "zod";
import {
  requireAuth,
  requireSupportRole,
  requireAdmin,
  AuthedRequest,
  authedHandler,
} from "../../middleware/authCanonical";
import { validateQuery } from "../../lib/validation";
import { getAdminKPIs, listJobsForAdmin, getJobEventsForAdmin } from "../../services/adminService";
import { getOpsDashboard } from "../../services/opsDashboardService";
import { logger } from "../../lib/logger";
import analyticsRouter from "./analytics";
import bookingsRouter from "./bookings";
import cleanersRouter from "./cleaners";
import clientsRouter from "./clients";
import financeRouter from "./finance";
import riskRouter from "./risk";
import messagesRouter from "./messages";
import systemRouter from "./system";
import settingsRouter from "./settings";
import webhooksRouter from "./webhooks";
import jobsRouter from "./jobs";
import levelTuningRouter from "./levelTuning";
import gamificationControlRouter from "./gamificationControl";

const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.use(requireSupportRole); // support_agent, support_lead, ops_finance, admin

// Ops dashboard: unified disputes, webhooks, risk view
adminRouter.get(
  "/ops",
  authedHandler(async (_req: AuthedRequest, res: Response) => {
    try {
      const dashboard = await getOpsDashboard();
      res.json(dashboard);
    } catch (error) {
      logger.error("get_ops_dashboard_failed", { error: (error as Error).message });
      res
        .status(500)
        .json({ error: { code: "GET_OPS_FAILED", message: (error as Error).message } });
    }
  })
);

const kpisQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// Root-level admin routes (before /jobs sub-router so GET /admin/jobs list is handled)
adminRouter.get(
  "/kpis",
  validateQuery(kpisQuerySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { dateFrom, dateTo } = req.query;
      const kpis = await getAdminKPIs(dateFrom as string | undefined, dateTo as string | undefined);
      res.json({ kpis });
    } catch (error) {
      logger.error("get_admin_kpis_failed", { error: (error as Error).message });
      res
        .status(500)
        .json({ error: { code: "GET_KPIS_FAILED", message: (error as Error).message } });
    }
  })
);

const jobEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const listJobsQuerySchema = z.object({
  status: z.string().optional(),
  clientId: z.string().optional(),
  cleanerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  cursor: z.string().optional(),
});

adminRouter.get(
  "/jobs",
  validateQuery(listJobsQuerySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const q = req.query as unknown as z.infer<typeof listJobsQuerySchema>;
      const result = await listJobsForAdmin({
        status: q.status as any,
        clientId: q.clientId || undefined,
        cleanerId: q.cleanerId || undefined,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        limit: q.limit,
        offset: q.offset,
        cursor: q.cursor,
      });
      res.json(result);
    } catch (error) {
      logger.error("list_admin_jobs_failed", { error: (error as Error).message });
      res
        .status(500)
        .json({ error: { code: "LIST_JOBS_FAILED", message: (error as Error).message } });
    }
  })
);

// Admin job detail + events (before /jobs sub-router so :jobId matches)
adminRouter.get(
  "/jobs/:jobId/events",
  validateQuery(jobEventsQuerySchema),
  authedHandler(async (req: AuthedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const q = req.query as unknown as z.infer<typeof jobEventsQuerySchema>;
      const limit = q.limit;
      const events = await getJobEventsForAdmin(jobId, limit);
      res.json({ jobId, events, count: events.length });
    } catch (error) {
      logger.error("get_admin_job_events_failed", {
        error: (error as Error).message,
        jobId: req.params.jobId,
      });
      res
        .status(500)
        .json({ error: { code: "GET_JOB_EVENTS_FAILED", message: (error as Error).message } });
    }
  })
);

// Mount all admin sub-routes
adminRouter.use("/webhooks", webhooksRouter);
adminRouter.use("/jobs", jobsRouter);
adminRouter.use("/analytics", analyticsRouter);
adminRouter.use("/bookings", bookingsRouter);
adminRouter.use("/cleaners", cleanersRouter);
adminRouter.use("/clients", clientsRouter);
adminRouter.use("/finance", financeRouter); // financeRouter enforces requireFinanceRole
adminRouter.use("/risk", riskRouter);
adminRouter.use("/messages", messagesRouter);
adminRouter.use("/system", systemRouter); // systemRouter enforces requireAdmin
adminRouter.use("/settings", settingsRouter); // settingsRouter enforces requireAdmin
adminRouter.use("/level-tuning", levelTuningRouter); // levelTuningRouter enforces requireAdmin
adminRouter.use("/gamification", gamificationControlRouter); // gamificationControlRouter enforces requireAdmin

export default adminRouter;
