// src/routes/tracking.ts
// Job live tracking API endpoints

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { requireIdempotency } from "../lib/idempotency";
import { sendSuccess } from "../lib/response";
import {
  getJobTrackingState,
  startEnRoute,
  markArrived,
  checkIn,
  checkOut,
  updateCleanerLocation,
  approveJob,
  disputeJob,
} from "../services/jobTrackingService";

const trackingRouter = Router();

// All routes require auth
trackingRouter.use(requireAuth);

// ============================================
// Client Tracking View
// ============================================

/**
 * GET /tracking/:jobId
 * Get full job tracking state (for client)
 */
trackingRouter.get("/:jobId", async (req: AuthedRequest, res: Response) => {
  try {
    const state = await getJobTrackingState(req.params.jobId);
    res.json({ tracking: state });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("get_tracking_failed", { error: err.message, jobId: req.params.jobId });
    res.status(err.statusCode || 500).json({
      error: { code: "GET_TRACKING_FAILED", message: err.message },
    });
  }
});

// ============================================
// Cleaner Actions
// ============================================

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  heading: z.number().optional(),
  speed: z.number().optional(),
});

/**
 * POST /tracking/:jobId/en-route
 * Cleaner starts heading to job
 */
trackingRouter.post(
  "/:jobId/en-route",
  validateBody(z.object({ location: locationSchema })),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await startEnRoute(req.params.jobId, req.user.id, req.body.location);
      res.json({ success: true, status: "on_my_way" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("en_route_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "EN_ROUTE_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /tracking/:jobId/arrived
 * Cleaner arrives at location
 */
trackingRouter.post(
  "/:jobId/arrived",
  validateBody(z.object({ location: locationSchema })),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await markArrived(req.params.jobId, req.user.id, req.body.location);
      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("arrived_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "ARRIVED_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /tracking/:jobId/check-in
 * Cleaner checks in with before photos
 */
const checkInSchema = z.object({
  location: locationSchema,
  beforePhotos: z.array(z.string().url()).min(1, "At least one before photo required"),
});

trackingRouter.post(
  "/:jobId/check-in",
  validateBody(checkInSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await checkIn(
        req.params.jobId,
        req.user.id,
        req.body.location,
        req.body.beforePhotos
      );
      res.json({ success: true, status: "in_progress" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("check_in_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "CHECK_IN_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /tracking/:jobId/check-out
 * Cleaner checks out with after photos
 */
const checkOutSchema = z.object({
  afterPhotos: z.array(z.string().url()).min(1, "At least one after photo required"),
  notes: z.string().optional(),
});

trackingRouter.post(
  "/:jobId/check-out",
  validateBody(checkOutSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await checkOut(
        req.params.jobId,
        req.user.id,
        req.body.afterPhotos,
        req.body.notes
      );
      res.json({ success: true, status: "awaiting_approval" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("check_out_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "CHECK_OUT_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /tracking/:jobId/location
 * Update cleaner location during job
 */
trackingRouter.post(
  "/:jobId/location",
  validateBody(z.object({ location: locationSchema })),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await updateCleanerLocation(req.params.jobId, req.user.id, req.body.location);
      res.json({ success: true });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res.status(err.statusCode || 500).json({
        error: { code: "LOCATION_UPDATE_FAILED", message: err.message },
      });
    }
  }
);

// ============================================
// Client Actions
// ============================================

/**
 * POST /tracking/:jobId/approve
 * Client approves completed job (releases escrow)
 * Supports Idempotency-Key header to prevent double approval
 */
const approveSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tip: z.number().int().min(0).optional(),
  feedback: z.string().optional(),
});

trackingRouter.post(
  "/:jobId/approve",
  requireIdempotency,
  validateBody(approveSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      await approveJob(
        req.params.jobId,
        req.user.id,
        req.body.rating,
        req.body.tip,
        req.body.feedback
      );
      sendSuccess(res, { success: true, status: "completed" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("approve_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "APPROVE_FAILED", message: err.message },
      });
    }
  }
);

/**
 * POST /tracking/:jobId/dispute
 * Client disputes job
 */
const disputeSchema = z.object({
  reason: z.string().min(10),
  requestedRefund: z.enum(["full", "partial", "none"]),
});

trackingRouter.post(
  "/:jobId/dispute",
  validateBody(disputeSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      await disputeJob(
        req.params.jobId,
        req.user.id,
        req.body.reason,
        req.body.requestedRefund
      );
      res.json({ success: true, status: "disputed" });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("dispute_failed", { error: err.message, jobId: req.params.jobId });
      res.status(err.statusCode || 500).json({
        error: { code: "DISPUTE_FAILED", message: err.message },
      });
    }
  }
);

export default trackingRouter;

