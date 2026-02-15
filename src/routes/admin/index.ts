// src/routes/admin/index.ts
// Main admin router that combines all admin sub-routes

import { Router, Response } from "express";
import {
  requireAuth,
  requireAdmin,
  AuthedRequest,
  authedHandler,
} from "../../middleware/authCanonical";
import { getAdminKPIs, listJobsForAdmin } from "../../services/adminService";
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
adminRouter.use(requireAdmin);

// Root-level admin routes (before /jobs sub-router so GET /admin/jobs list is handled)
adminRouter.get(
  "/kpis",
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

adminRouter.get(
  "/jobs",
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
      logger.error("list_admin_jobs_failed", { error: (error as Error).message });
      res
        .status(500)
        .json({ error: { code: "LIST_JOBS_FAILED", message: (error as Error).message } });
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
adminRouter.use("/finance", financeRouter);
adminRouter.use("/risk", riskRouter);
adminRouter.use("/messages", messagesRouter);
adminRouter.use("/system", systemRouter);
adminRouter.use("/settings", settingsRouter);
adminRouter.use("/level-tuning", levelTuningRouter);
adminRouter.use("/gamification", gamificationControlRouter);

export default adminRouter;
