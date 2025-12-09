// src/routes/cancellation.ts
// REST API endpoints for Cancellation System (Task 4.5)

import { Router } from "express";
import { z } from "zod";
import { authMiddleware, AuthedRequest } from "../middleware/auth";
import { logger } from "../lib/logger";
import { CancellationServiceV2 } from "../core/cancellationService";
import { coreDb } from "../core/db";
import { computeHoursBeforeStart, computeWindow, getTimeBucket } from "../core/timeBuckets";
import { CancellationType } from "../core/types";
import { query } from "../db/client";
import { env } from "../config/env";

const cancellationRouter = Router();

// All routes require auth
cancellationRouter.use(authMiddleware);

// ============================================
// POST /cancellations/jobs/:id - Client cancels job
// ============================================

cancellationRouter.post("/jobs/:jobId", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || userRole !== 'client') {
    return res.status(401).json({ error: "Unauthorized - only clients can cancel jobs" });
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
      return res.status(404).json({ error: "Job not found" });
    }

    // Verify client owns this job
    if (job.clientId !== Number(userId)) {
      return res.status(403).json({ error: "Not authorized to cancel this job" });
    }

    // Validate job status
    if (['cancelled', 'completed'].includes(job.status)) {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    const now = new Date();
    const hoursBefore = computeHoursBeforeStart(job.startTime, now);

    // Enforce lock window unless marked emergency
    if (!body.isEmergency && hoursBefore < env.CANCELLATION_LOCK_HOURS) {
      return res.status(400).json({
        error: `Cancellation locked within ${env.CANCELLATION_LOCK_HOURS}h of start; contact support or mark emergency.`,
      });
    }

    // Check if this is a no-show situation (at/after start time)
    if (hoursBefore <= 0) {
      return res.status(400).json({ 
        error: "Cancellation not allowed after job start time. Use no-show endpoint if applicable." 
      });
    }

    // Determine cancellation type
    let type: CancellationType = 'client_cancel_normal';
    if (body.afterRescheduleDeclined) {
      type = 'client_cancel_after_reschedule_declined';
    }

    // Process cancellation
    const result = await CancellationServiceV2.processCancellation({
      jobId,
      clientId: job.clientId,
      cleanerId: job.cleanerId,
      scheduledStart: job.startTime,
      now,
      actor: 'client',
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

    return res.json({
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
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// POST /cancellations/jobs/:id/cleaner - Cleaner cancels job
// ============================================

cancellationRouter.post("/jobs/:jobId/cleaner", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || userRole !== 'cleaner') {
    return res.status(401).json({ error: "Unauthorized - only cleaners can use this endpoint" });
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
      return res.status(404).json({ error: "Job not found" });
    }

    // Verify cleaner owns this job
    if (job.cleanerId !== Number(userId)) {
      return res.status(403).json({ error: "Not authorized to cancel this job" });
    }

    // Validate job status
    if (['cancelled', 'completed'].includes(job.status)) {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    const now = new Date();
    const hoursBefore = computeHoursBeforeStart(job.startTime, now);

    if (!body.isEmergency && hoursBefore < env.CANCELLATION_LOCK_HOURS) {
      return res.status(400).json({
        error: `Cancellation locked within ${env.CANCELLATION_LOCK_HOURS}h of start; contact support or mark emergency.`,
      });
    }

    // Determine cancellation type
    const type: CancellationType = body.isEmergency 
      ? 'cleaner_cancel_emergency' 
      : 'cleaner_cancel_normal';

    // Process cancellation
    const result = await CancellationServiceV2.processCancellation({
      jobId,
      clientId: job.clientId,
      cleanerId: job.cleanerId,
      scheduledStart: job.startTime,
      now,
      actor: 'cleaner',
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

    return res.json({
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
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// POST /cancellations/no-shows - Mark client or cleaner no-show
// ============================================

cancellationRouter.post("/no-shows", async (req: AuthedRequest, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const schema = z.object({
      jobId: z.number(),
      noShowType: z.enum(['client', 'cleaner']),
      notes: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const { jobId, noShowType, notes } = body;

    // Get job details
    const job = await getJobDetails(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Validate permissions
    if (noShowType === 'client' && userRole !== 'cleaner' && userRole !== 'admin') {
      return res.status(403).json({ error: "Only cleaners or admins can mark client no-shows" });
    }

    if (noShowType === 'cleaner' && userRole !== 'client' && userRole !== 'admin') {
      return res.status(403).json({ error: "Only clients or admins can mark cleaner no-shows" });
    }

    const now = new Date();

    // Determine cancellation type
    const type: CancellationType = noShowType === 'client' 
      ? 'client_no_show' 
      : 'cleaner_no_show';

    // Process no-show
    const result = await CancellationServiceV2.processCancellation({
      jobId,
      clientId: job.clientId,
      cleanerId: job.cleanerId,
      scheduledStart: job.startTime,
      now,
      actor: noShowType === 'client' ? 'client' : 'cleaner',
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

    if (noShowType === 'client') {
      return res.json({
        success: true,
        noShow: {
          jobId,
          type: 'client_no_show',
          feeCredits: result.feeBreakdown.feeCredits,
          cleanerCompCredits: result.feeBreakdown.cleanerCompCredits,
          message: "Client no-show recorded. Cleaner will be compensated.",
        },
      });
    } else {
      return res.json({
        success: true,
        noShow: {
          jobId,
          type: 'cleaner_no_show',
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
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// GET /cancellations/jobs/:id/preview - Preview cancellation fees
// ============================================

cancellationRouter.get("/jobs/:jobId/preview", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get job details
    const job = await getJobDetails(jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    const now = new Date();
    const hoursBefore = computeHoursBeforeStart(job.startTime, now);
    const window = computeWindow(hoursBefore);
    const bucket = getTimeBucket(hoursBefore);

    // Calculate fees
    let feePct = 0;
    if (window === '50%') feePct = 50;
    if (window === '100%') feePct = 100;

    const feeCredits = Math.round(job.heldCredits * feePct / 100);
    const refundCredits = job.heldCredits - feeCredits;

    // Check grace availability
    const graceRemaining = await coreDb.clients.getGraceRemaining(job.clientId);
    const canUseGrace = graceRemaining > 0 && feePct > 0 && hoursBefore > 0;

    return res.json({
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
      message: window === 'free' 
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
    return res.status(500).json({ error: (err as Error).message });
  }
});

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
