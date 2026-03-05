// src/routes/tracking.ts
// Job live tracking API endpoints

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { requireOwnership } from "../lib/ownership";
import { requireIdempotency } from "../lib/idempotency";
import { sendSuccess } from "../lib/response";
import {
  getJobTrackingState,
  startEnRoute,
  markArrived,
  checkIn,
  checkOut,
  updateCleanerLocation,
  disputeJob,
} from "../services/jobTrackingService";

const trackingRouter = Router();

// All routes require auth
trackingRouter.use(requireAuth);

// ============================================
// Client Tracking View
// ============================================

/**
 * @swagger
 * /tracking/{jobId}:
 *   get:
 *     summary: Get job tracking state
 *     description: Get full job tracking state including location, status, and timeline.
 *     tags: [Tracking]
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
 *         description: Job tracking state
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tracking:
 *                   type: object
 *                   properties:
 *                     jobId: { type: 'string', format: 'uuid' }
 *                     status: { type: 'string' }
 *                     cleanerLocation: { type: 'object', nullable: true }
 *                     timeline: { type: 'array', items: { type: 'object' } }
 */
trackingRouter.get("/:jobId", requireOwnership("job", "jobId"), async (req: AuthedRequest, res: Response) => {
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
 * @swagger
 * /tracking/{jobId}/en-route:
 *   post:
 *     summary: Start en route
 *     description: Cleaner starts heading to job location.
 *     tags: [Tracking]
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
 *               - location
 *             properties:
 *               location:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude: { type: 'number', minimum: -90, maximum: 90 }
 *                   longitude: { type: 'number', minimum: -180, maximum: 180 }
 *                   accuracy: { type: 'number' }
 *                   heading: { type: 'number' }
 *                   speed: { type: 'number' }
 *     responses:
 *       200:
 *         description: En route started
 *       403:
 *         description: Forbidden - cleaners only
 */
trackingRouter.post(
  "/:jobId/en-route",
  requireOwnership("job", "jobId"),
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
 * @swagger
 * /tracking/{jobId}/arrived:
 *   post:
 *     summary: Mark arrived
 *     description: Cleaner arrives at job location.
 *     tags: [Tracking]
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
 *               - location
 *             properties:
 *               location:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude: { type: 'number' }
 *                   longitude: { type: 'number' }
 *                   accuracy: { type: 'number' }
 *     responses:
 *       200:
 *         description: Arrived successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
trackingRouter.post(
  "/:jobId/arrived",
  requireOwnership("job", "jobId"),
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
 * @swagger
 * /tracking/{jobId}/check-in:
 *   post:
 *     summary: Check in to job
 *     description: Cleaner checks in with before photos and location.
 *     tags: [Tracking]
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
 *               - location
 *               - beforePhotos
 *             properties:
 *               location:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *               beforePhotos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 minItems: 1
 *     responses:
 *       200:
 *         description: Checked in successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
const checkInSchema = z.object({
  location: locationSchema,
  beforePhotos: z.array(z.string().url()).min(1, "At least one before photo required"),
  accuracyM: z.number().optional(),
  source: z.enum(["device", "manual_override"]).optional(),
});

trackingRouter.post(
  "/:jobId/check-in",
  requireOwnership("job", "jobId"),
  validateBody(checkInSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await checkIn(req.params.jobId, req.user.id, req.body.location, req.body.beforePhotos);
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
 * @swagger
 * /tracking/{jobId}/check-out:
 *   post:
 *     summary: Check out from job
 *     description: Cleaner checks out with after photos and notes.
 *     tags: [Tracking]
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
 *               - afterPhotos
 *             properties:
 *               afterPhotos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uri
 *                 minItems: 1
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Checked out successfully
 *       403:
 *         description: Forbidden - cleaners only
 */
const checkOutSchema = z.object({
  afterPhotos: z.array(z.string().url()).min(1, "At least one after photo required"),
  notes: z.string().optional(),
});

trackingRouter.post(
  "/:jobId/check-out",
  requireOwnership("job", "jobId"),
  validateBody(checkOutSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      await checkOut(req.params.jobId, req.user.id, req.body.afterPhotos, req.body.notes);
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
 * @swagger
 * /tracking/{jobId}/location:
 *   post:
 *     summary: Update cleaner location
 *     description: Update cleaner's location during job (for live tracking).
 *     tags: [Tracking]
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
 *               - location
 *             properties:
 *               location:
 *                 type: object
 *                 required:
 *                   - latitude
 *                   - longitude
 *                 properties:
 *                   latitude: { type: 'number' }
 *                   longitude: { type: 'number' }
 *                   accuracy: { type: 'number' }
 *                   heading: { type: 'number' }
 *                   speed: { type: 'number' }
 *     responses:
 *       200:
 *         description: Location updated
 *       403:
 *         description: Forbidden - cleaners only
 */
trackingRouter.post(
  "/:jobId/location",
  requireOwnership("job", "jobId"),
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
 * @swagger
 * /tracking/{jobId}/approve:
 *   post:
 *     summary: Approve completed job
 *     description: Client approves completed job, releases escrow, and optionally leaves rating/tip.
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: header
 *         name: Idempotency-Key
 *         schema:
 *           type: string
 *         description: Prevents duplicate approvals
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               tip:
 *                 type: integer
 *                 minimum: 0
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job approved successfully
 *       403:
 *         description: Forbidden - clients only
 */
const approveSchema = z.object({
  rating: z.number().int().min(1).max(5),
  tip: z.number().int().min(0).optional(),
  feedback: z.string().optional(),
});

trackingRouter.post(
  "/:jobId/approve",
  requireOwnership("job", "jobId"),
  requireIdempotency,
  validateBody(approveSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      // B2/R2: Single lifecycle path — use state machine instead of tracking direct UPDATE
      const { applyStatusTransition } = await import("../services/jobsService");
      await applyStatusTransition({
        jobId: req.params.jobId,
        eventType: "client_approved",
        payload: { rating: req.body.rating, tip: req.body.tip, feedback: req.body.feedback },
        requesterId: req.user.id,
        role: "client",
      });
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
 * @swagger
 * /tracking/{jobId}/dispute:
 *   post:
 *     summary: Dispute job
 *     description: Client disputes a completed job and requests refund.
 *     tags: [Tracking]
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
 *               - requestedRefund
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 10
 *               requestedRefund:
 *                 type: string
 *                 enum: [full, partial, none]
 *     responses:
 *       200:
 *         description: Dispute created
 *       403:
 *         description: Forbidden - clients only
 */
const DISPUTE_CATEGORIES = [
  "missed_area",
  "quality_issue",
  "damages_claim",
  "no_show",
  "other",
] as const;
const disputeSchema = z.object({
  reason: z.string().min(10),
  requestedRefund: z.enum(["full", "partial", "none"]),
  category: z.enum(DISPUTE_CATEGORIES).optional(),
});

trackingRouter.post(
  "/:jobId/dispute",
  requireOwnership("job", "jobId"),
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
        req.body.requestedRefund,
        req.body.category
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
