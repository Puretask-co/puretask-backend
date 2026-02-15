// src/routes/cancellation.ts
// REST API endpoints for Cancellation System (Task 4.5)

import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { CancellationServiceV2 } from "../core/cancellationService";
import { coreDb } from "../core/db";
import { computeHoursBeforeStart, computeWindow, getTimeBucket } from "../core/timeBuckets";
import { CancellationType } from "../core/types";
import { query } from "../db/client";
import { env } from "../config/env";

const cancellationRouter = Router();

// All routes require auth
cancellationRouter.use(requireAuth);

// ============================================
// POST /cancellations/jobs/:id - Client cancels job
// ============================================

/**
 * @swagger
 * /cancellations/jobs/{jobId}:
 *   post:
 *     summary: Cancel job (client)
 *     description: Client cancels a job. Cancellation fees apply based on time before start.
 *     tags: [Cancellations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reasonCode: { type: 'string' }
 *               useGraceIfAvailable: { type: 'boolean' }
 *               isEmergency: { type: 'boolean' }
 *               afterRescheduleDeclined: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Job cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean' }
 *                 cancellation:
 *                   type: object
 *                   properties:
 *                     jobId: { type: 'string' }
 *                     type: { type: 'string' }
 *                     window: { type: 'string' }
 *                     feePct: { type: 'number' }
 *                     feeCredits: { type: 'number' }
 *                     refundCredits: { type: 'number' }
 *                     graceUsed: { type: 'boolean' }
 *       400:
 *         description: Invalid cancellation (locked window, invalid status)
 *       403:
 *         description: Forbidden - not your job
 */
cancellationRouter.post(
  "/jobs/:jobId",
  authedHandler(async (req: AuthedRequest, res) => {
    const jobId = Number(req.params.jobId);
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== "client") {
      res.status(401).json({ error: "Unauthorized - only clients can cancel jobs" });
      return;
    }

    try {
      const schema = z.object({
        reasonCode: z.string().optional(),
        useGraceIfAvailable: z.boolean().optional(),
        isEmergency: z.boolean().optional(),
        afterRescheduleDeclined: z.boolean().optional(),
      });

      const body = schema.parse(req.body);

      // Get job details
      const job = await getJobDetails(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      // Verify client owns this job
      if (job.clientId !== Number(userId)) {
        res.status(403).json({ error: "Not authorized to cancel this job" });
        return;
      }

      // Validate job status
      if (["cancelled", "completed"].includes(job.status)) {
        res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
        return;
      }

      const now = new Date();
      const hoursBefore = computeHoursBeforeStart(job.startTime, now);

      // Enforce lock window unless marked emergency
      if (!body.isEmergency && hoursBefore < env.CANCELLATION_LOCK_HOURS) {
        res.status(400).json({
          error: `Cancellation locked within ${env.CANCELLATION_LOCK_HOURS}h of start; contact support or mark emergency.`,
        });
        return;
      }

      // Check if this is a no-show situation (at/after start time)
      if (hoursBefore <= 0) {
        res.status(400).json({
          error:
            "Cancellation not allowed after job start time. Use no-show endpoint if applicable.",
        });
        return;
      }

      // Determine cancellation type
      let type: CancellationType = "client_cancel_normal";
      if (body.afterRescheduleDeclined) {
        type = "client_cancel_after_reschedule_declined";
      }

      // Process cancellation
      const result = await CancellationServiceV2.processCancellation({
        jobId,
        clientId: job.clientId,
        cleanerId: job.cleanerId,
        scheduledStart: job.startTime,
        now,
        actor: "client",
        type,
        reasonCode: body.reasonCode || null,
        wasRescheduleContext: body.afterRescheduleDeclined || false,
        jobStatusAtCancellation: job.status,
        heldCredits: job.heldCredits,
        isEmergency: body.isEmergency || false,
      });

      logger.info("job_cancelled_by_client_via_api", {
        jobId,
        clientId: job.clientId,
        feePct: result.feeBreakdown.feePct,
        graceUsed: result.feeBreakdown.graceUsed,
      });

      res.json({
        success: true,
        cancellation: {
          jobId,
          type: result.type,
          window: result.feeBreakdown.window,
          feePct: result.feeBreakdown.feePct,
          feeCredits: result.feeBreakdown.feeCredits,
          refundCredits: result.feeBreakdown.refundCredits,
          graceUsed: result.feeBreakdown.graceUsed,
          cleanerCompCredits: result.feeBreakdown.cleanerCompCredits,
        },
      });
    } catch (err) {
      logger.error("client_cancel_error", {
        jobId,
        error: (err as Error).message,
      });
      res.status(400).json({ error: (err as Error).message });
    }
  })
);

/**
 * @swagger
 * /cancellations/jobs/{jobId}/cleaner:
 *   post:
 *     summary: Cancel job (cleaner)
 *     description: Cleaner cancels a job. Client receives full refund.
 *     tags: [Cancellations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reasonCode: { type: 'string' }
 *               isEmergency: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Job cancelled
 *       400:
 *         description: Invalid cancellation
 *       403:
 *         description: Forbidden - cleaners only
 */
cancellationRouter.post(
  "/jobs/:jobId/cleaner",
  authedHandler(async (req: AuthedRequest, res) => {
    const jobId = Number(req.params.jobId);
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId || userRole !== "cleaner") {
      res.status(401).json({ error: "Unauthorized - only cleaners can use this endpoint" });
      return;
    }

    try {
      const schema = z.object({
        reasonCode: z.string().optional(),
        isEmergency: z.boolean().optional(),
      });

      const body = schema.parse(req.body);

      // Get job details
      const job = await getJobDetails(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      // Verify cleaner owns this job
      if (job.cleanerId !== Number(userId)) {
        res.status(403).json({ error: "Not authorized to cancel this job" });
        return;
      }

      // Validate job status
      if (["cancelled", "completed"].includes(job.status)) {
        res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
        return;
      }

      const now = new Date();
      const hoursBefore = computeHoursBeforeStart(job.startTime, now);

      if (!body.isEmergency && hoursBefore < env.CANCELLATION_LOCK_HOURS) {
        res.status(400).json({
          error: `Cancellation locked within ${env.CANCELLATION_LOCK_HOURS}h of start; contact support or mark emergency.`,
        });
        return;
      }

      // Determine cancellation type
      const type: CancellationType = body.isEmergency
        ? "cleaner_cancel_emergency"
        : "cleaner_cancel_normal";

      // Process cancellation
      const result = await CancellationServiceV2.processCancellation({
        jobId,
        clientId: job.clientId,
        cleanerId: job.cleanerId,
        scheduledStart: job.startTime,
        now,
        actor: "cleaner",
        type,
        reasonCode: body.reasonCode || null,
        wasRescheduleContext: false,
        jobStatusAtCancellation: job.status,
        heldCredits: job.heldCredits,
        isEmergency: body.isEmergency || false,
      });

      logger.info("job_cancelled_by_cleaner_via_api", {
        jobId,
        cleanerId: job.cleanerId,
        isEmergency: body.isEmergency,
      });

      res.json({
        success: true,
        cancellation: {
          jobId,
          type: result.type,
          refundCredits: result.feeBreakdown.refundCredits,
          message: "Client will receive a full refund.",
        },
      });
    } catch (err) {
      logger.error("cleaner_cancel_error", {
        jobId,
        error: (err as Error).message,
      });
      res.status(400).json({ error: (err as Error).message });
    }
  })
);

/**
 * @swagger
 * /cancellations/no-shows:
 *   post:
 *     summary: Mark no-show
 *     description: Mark a client or cleaner as no-show for a job.
 *     tags: [Cancellations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - noShowType
 *             properties:
 *               jobId:
 *                 type: integer
 *               noShowType:
 *                 type: string
 *                 enum: [client, cleaner]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: No-show recorded
 *       403:
 *         description: Forbidden - insufficient permissions
 */
cancellationRouter.post(
  "/no-shows",
  authedHandler(async (req: AuthedRequest, res) => {
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const schema = z.object({
        jobId: z.number(),
        noShowType: z.enum(["client", "cleaner"]),
        notes: z.string().optional(),
      });

      const body = schema.parse(req.body);
      const { jobId, noShowType, notes } = body;

      // Get job details
      const job = await getJobDetails(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      // Validate permissions
      if (noShowType === "client" && userRole !== "cleaner" && userRole !== "admin") {
        res.status(403).json({ error: "Only cleaners or admins can mark client no-shows" });
        return;
      }

      if (noShowType === "cleaner" && userRole !== "client" && userRole !== "admin") {
        res.status(403).json({ error: "Only clients or admins can mark cleaner no-shows" });
        return;
      }

      const now = new Date();

      // Determine cancellation type
      const type: CancellationType = noShowType === "client" ? "client_no_show" : "cleaner_no_show";

      // Process no-show
      const result = await CancellationServiceV2.processCancellation({
        jobId,
        clientId: job.clientId,
        cleanerId: job.cleanerId,
        scheduledStart: job.startTime,
        now,
        actor: noShowType === "client" ? "client" : "cleaner",
        type,
        reasonCode: notes || null,
        wasRescheduleContext: false,
        jobStatusAtCancellation: job.status,
        heldCredits: job.heldCredits,
        isEmergency: false,
      });

      logger.info("no_show_marked_via_api", {
        jobId,
        noShowType,
        markedBy: userId,
      });

      if (noShowType === "client") {
        res.json({
          success: true,
          noShow: {
            jobId,
            type: "client_no_show",
            feeCredits: result.feeBreakdown.feeCredits,
            cleanerCompCredits: result.feeBreakdown.cleanerCompCredits,
            message: "Client no-show recorded. Cleaner will be compensated.",
          },
        });
      } else {
        res.json({
          success: true,
          noShow: {
            jobId,
            type: "cleaner_no_show",
            refundCredits: result.feeBreakdown.refundCredits,
            bonusCredits: result.feeBreakdown.bonusCreditsToClient,
            message: "Cleaner no-show recorded. Client will receive full refund + bonus credits.",
          },
        });
      }
    } catch (err) {
      logger.error("no_show_mark_error", {
        error: (err as Error).message,
      });
      res.status(400).json({ error: (err as Error).message });
    }
  })
);

/**
 * @swagger
 * /cancellations/jobs/{jobId}/preview:
 *   get:
 *     summary: Preview cancellation fees
 *     description: Preview cancellation fees and refund amount before cancelling.
 *     tags: [Cancellations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cancellation preview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId: { type: 'string' }
 *                 hoursBefore: { type: 'number' }
 *                 window: { type: 'string' }
 *                 bucket: { type: 'string' }
 *                 heldCredits: { type: 'number' }
 *                 feePct: { type: 'number' }
 *                 feeCredits: { type: 'number' }
 *                 refundCredits: { type: 'number' }
 *                 graceRemaining: { type: 'number' }
 *                 canUseGrace: { type: 'boolean' }
 *                 message: { type: 'string' }
 *       404:
 *         description: Job not found
 */
cancellationRouter.get(
  "/jobs/:jobId/preview",
  authedHandler(async (req: AuthedRequest, res) => {
    const jobId = Number(req.params.jobId);
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      // Get job details
      const job = await getJobDetails(jobId);
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      const now = new Date();
      const hoursBefore = computeHoursBeforeStart(job.startTime, now);
      const window = computeWindow(hoursBefore);
      const bucket = getTimeBucket(hoursBefore);

      // Calculate fees
      let feePct = 0;
      if (window === "50%") feePct = 50;
      if (window === "100%") feePct = 100;

      const feeCredits = Math.round((job.heldCredits * feePct) / 100);
      const refundCredits = job.heldCredits - feeCredits;

      // Check grace availability
      const graceRemaining = await coreDb.clients.getGraceRemaining(job.clientId);
      const canUseGrace = graceRemaining > 0 && feePct > 0 && hoursBefore > 0;

      res.json({
        jobId,
        hoursBefore: Math.round(hoursBefore * 10) / 10,
        window,
        bucket,
        heldCredits: job.heldCredits,
        feePct,
        feeCredits,
        refundCredits,
        graceRemaining,
        canUseGrace,
        feeIfGraceUsed: 0,
        refundIfGraceUsed: job.heldCredits,
        message:
          window === "free"
            ? "Free cancellation - no fees apply"
            : canUseGrace
              ? `${feePct}% fee (${feeCredits} credits) or use grace cancellation for free`
              : `${feePct}% fee applies (${feeCredits} credits)`,
      });
    } catch (err) {
      logger.error("cancel_preview_error", {
        jobId,
        error: (err as Error).message,
      });
      res.status(500).json({ error: (err as Error).message });
    }
  })
);

// ============================================
// Helper Functions
// ============================================

async function getJobDetails(jobId: number): Promise<{
  clientId: number;
  cleanerId: number;
  startTime: Date;
  endTime: Date;
  status: string;
  heldCredits: number;
} | null> {
  const result = await query<{
    client_id: string;
    cleaner_id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    status: string;
    credit_amount: string;
  }>(
    `SELECT client_id, cleaner_id, scheduled_start_at, scheduled_end_at, status, credit_amount
     FROM jobs WHERE id = $1`,
    [String(jobId)]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    clientId: Number(row.client_id),
    cleanerId: Number(row.cleaner_id),
    startTime: new Date(row.scheduled_start_at),
    endTime: new Date(row.scheduled_end_at),
    status: row.status,
    heldCredits: Number(row.credit_amount || 0),
  };
}

export { cancellationRouter };
