// src/routes/jobs.ts
// Job routes matching 001_init.sql schema

import { Router } from "express";
import { z } from "zod";
import { jwtAuthMiddleware, type JWTAuthedRequest } from "../middleware/jwtAuth";
import { requireIdempotency } from "../lib/idempotency";
import { sendSuccess, sendCreated } from "../lib/response";
import { asyncHandler, sendError } from "../lib/errors";
import {
  createJob,
  getJob,
  getJobForClient,
  updateJob,
  deleteJob,
  listJobsForClient,
  listJobsForCleaner,
  listAvailableJobs,
  getEvents,
  applyStatusTransition,
} from "../services/jobsService";
import { findMatchingCleaners, broadcastJobToCleaners } from "../services/jobMatchingService";
import { createJobPaymentIntent, hasActivePaymentIntentForJob } from "../services/paymentService";
import { getUserCreditBalance } from "../services/creditsService";
import { getClientStripeCustomerId } from "../services/userManagementService";
import { logger } from "../lib/logger";
import { env } from "../config/env";

const jobsRouter = Router();

// All routes require auth
jobsRouter.use(jwtAuthMiddleware);

// Helpers
function getRole(req: JWTAuthedRequest): "client" | "cleaner" | "admin" {
  return (req.user?.role ?? "client") as "client" | "cleaner" | "admin";
}

/**
 * POST /jobs
 * Create a new job (client)
 * Supports Idempotency-Key header to prevent duplicate bookings
 */
const createJobSchema = z.object({
  scheduled_start_at: z.string(), // ISO string
  scheduled_end_at: z.string(), // ISO string
  address: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  credit_amount: z.number().positive(),
  client_notes: z.string().optional(),
});

jobsRouter.post(
  "/",
  requireIdempotency,
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const body = createJobSchema.parse(req.body);

    const job = await createJob({
      clientId: req.user!.id,
      scheduledStartAt: body.scheduled_start_at,
      scheduledEndAt: body.scheduled_end_at,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      creditAmount: body.credit_amount,
      clientNotes: body.client_notes,
    });

    sendCreated(res, { job }, `/jobs/${job.id}`);
  })
);

/**
 * GET /jobs
 * List jobs for the current user:
 * - client -> their jobs
 * - cleaner -> their assigned jobs + available jobs
 * - admin -> use /admin/jobs instead
 */
jobsRouter.get(
  "/",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const role = getRole(req);

    if (role === "client") {
      const jobs = await listJobsForClient(req.user!.id);
      return sendSuccess(res, { jobs });
    }

    if (role === "cleaner") {
      const assigned = await listJobsForCleaner(req.user!.id);
      const available = await listAvailableJobs();
      return sendSuccess(res, { assigned, available });
    }

    // Admin should use /admin/jobs
    const jobs = await listJobsForClient(req.user!.id);
    return sendSuccess(res, { jobs });
  })
);

/**
 * GET /jobs/:jobId
 */
jobsRouter.get(
  "/:jobId",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return sendError(res, {
        code: "NOT_FOUND",
        message: "Job not found",
        statusCode: 404,
      } as any);
    }

    // Access control
    const role = getRole(req);
    if (role === "client" && job.client_id !== req.user!.id) {
      return sendError(res, {
        code: "FORBIDDEN",
        message: "Not your job",
        statusCode: 403,
      } as any);
    }
    if (role === "cleaner" && job.cleaner_id !== req.user!.id && job.status !== "requested") {
      return sendError(res, {
        code: "FORBIDDEN",
        message: "Not your job",
        statusCode: 403,
      } as any);
    }

    sendSuccess(res, { job });
  })
);

/**
 * PATCH /jobs/:jobId
 * Update job details (client only, only when status = 'requested')
 */
const updateJobSchema = z
  .object({
    scheduled_start_at: z.string().optional(),
    scheduled_end_at: z.string().optional(),
    address: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    client_notes: z.string().optional(),
  })
  .refine(
    (data) =>
      data.scheduled_start_at !== undefined ||
      data.scheduled_end_at !== undefined ||
      data.address !== undefined ||
      data.client_notes !== undefined,
    { message: "At least one field must be provided" }
  );

jobsRouter.patch(
  "/:jobId",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const body = updateJobSchema.parse(req.body);

    const updated = await updateJob({
      jobId,
      clientId: req.user!.id,
      scheduledStartAt: body.scheduled_start_at,
      scheduledEndAt: body.scheduled_end_at,
      address: body.address,
      latitude: body.latitude,
      longitude: body.longitude,
      clientNotes: body.client_notes,
    });

    if (!updated) {
      return sendError(res, {
        code: "NOT_FOUND",
        message: "Job not found or cannot be updated",
        statusCode: 404,
      } as any);
    }

    sendSuccess(res, { job: updated });
  })
);

/**
 * DELETE /jobs/:jobId
 * Cancel a job (client only)
 */
jobsRouter.delete(
  "/:jobId",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const deleted = await deleteJob(jobId, req.user!.id);

    if (!deleted) {
      return sendError(res, {
        code: "NOT_FOUND",
        message: "Job not found or cannot be cancelled",
        statusCode: 404,
      } as any);
    }

    sendSuccess(res, { cancelled: true, job: deleted });
  })
);

/**
 * GET /jobs/:jobId/events
 * Returns job events history
 */
jobsRouter.get(
  "/:jobId/events",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const events = await getEvents(jobId);
    sendSuccess(res, { events });
  })
);

/**
 * POST /jobs/:jobId/transition
 * Apply a status transition to a job
 * Body: { event_type: JobEventType, payload?: {} }
 */
const transitionJobSchema = z.object({
  event_type: z.enum([
    "job_created",
    "job_accepted",
    "cleaner_on_my_way",
    "job_started",
    "job_completed",
    "client_approved",
    "client_disputed",
    "dispute_resolved_refund",
    "dispute_resolved_no_refund",
    "job_cancelled",
  ]),
  payload: z.record(z.unknown()).optional(),
});

jobsRouter.post(
  "/:jobId/transition",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const body = transitionJobSchema.parse(req.body);

    const updated = await applyStatusTransition({
      jobId,
      eventType: body.event_type,
      payload: body.payload ?? {},
      requesterId: req.user!.id,
      role: getRole(req),
    });

    sendSuccess(res, { job: updated });
  })
);

/**
 * POST /jobs/:jobId/pay
 * Create a PaymentIntent for direct job charge (pay at booking)
 * 
 * This is a convenience endpoint that proxies to the payment service.
 * NOTE: Direct card payments include a surcharge (NON_CREDIT_SURCHARGE_PERCENT).
 *       Use wallet credits to avoid the surcharge.
 * 
 * Body: { stripeCustomerId?: string }
 */
jobsRouter.post(
  "/:jobId/pay",
  requireIdempotency,
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    try {
      const { jobId } = req.params;
      const clientId = req.user!.id;

      // Ensure client role
      const role = getRole(req);
      if (role !== "client") {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: "Only clients can pay for jobs" },
        });
      }

      // Get job with ownership check
      const job = await getJobForClient(jobId, clientId);

      // Only allow payment for jobs in 'requested' status
      if (job.status !== "requested") {
        return res.status(400).json({
          error: {
            code: "INVALID_STATUS",
            message: "Job is not in payable state (expected 'requested')",
            currentStatus: job.status,
          },
        });
      }

      // Check if there's already an active payment intent for this job
      const hasActivePi = await hasActivePaymentIntentForJob(jobId);

      if (hasActivePi) {
        return sendError(res, {
          code: "PAYMENT_EXISTS",
          message: "Payment for this job already exists or has been processed",
          statusCode: 400,
        } as any);
      }

      // Get Stripe customer ID from client profile (optional)
      const stripeCustomerId = req.body?.stripeCustomerId || (await getClientStripeCustomerId(clientId));

      // Create payment intent with surcharge
      const result = await createJobPaymentIntent({
        job,
        clientId,
        clientStripeCustomerId: stripeCustomerId ?? undefined,
      });

      // Calculate pricing breakdown for response
      const baseAmountCents = job.credit_amount * env.CENTS_PER_CREDIT;
      const surchargePercent = env.NON_CREDIT_SURCHARGE_PERCENT;
      const surchargeAmountCents = result.amountCents - baseAmountCents;

      sendSuccess(res, {
        clientSecret: result.clientSecret,
        paymentIntentId: result.stripePaymentIntentId,
        jobId: result.jobId,
        credits: result.credits,
        // Pricing breakdown
        pricing: {
          baseAmountCents,
          surchargePercent,
          surchargeAmountCents,
          totalAmountCents: result.amountCents,
          totalAmountFormatted: `$${(result.amountCents / 100).toFixed(2)}`,
        },
        // Helpful message
        pricingNote: surchargePercent > 0
          ? `Includes ${surchargePercent}% convenience fee. Use wallet credits to save $${(surchargeAmountCents / 100).toFixed(2)}!`
          : undefined,
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      logger.error("POST /jobs/:jobId/pay failed", { error: error.message, jobId: req.params.jobId });

      if (error.statusCode === 403) {
        return res.status(403).json({
          error: { code: "FORBIDDEN", message: error.message },
        });
      }

      if (error.statusCode === 404) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: error.message },
        });
      }

      res.status(error.statusCode || 500).json({
        error: { code: "PAYMENT_FAILED", message: error.message ?? "Error" },
      });
    }
  })
);

/**
 * GET /jobs/:jobId/candidates
 * V1 CORE FEATURE: Get top matched cleaners for client to review and select
 * Returns top 5-10 cleaners ranked by match score (reliability, tier, distance, etc.)
 * Client can then select top 3 to send offers to
 */
jobsRouter.get(
  "/:jobId/candidates",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const clientId = req.user!.id;
    const role = getRole(req);

    // Only clients can view candidates for their jobs
    if (role !== "client") {
      return sendError(res, {
        code: "FORBIDDEN",
        message: "Only clients can view job candidates",
        statusCode: 403,
      } as any);
    }

    // Get job with ownership check
    const job = await getJobForClient(jobId, clientId);

    // Only allow viewing candidates for jobs in 'requested' status
    if (job.status !== "requested") {
      return sendError(res, {
        code: "INVALID_STATUS",
        message: "Candidates can only be viewed for jobs in 'requested' status",
        statusCode: 400,
        details: { currentStatus: job.status },
      } as any);
    }

    // Get top matched cleaners (limit to 10, client will select top 3)
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const matchResult = await findMatchingCleaners(job, {
      limit: Math.min(limit, 10), // Cap at 10
      minReliability: 50, // Minimum reliability threshold
      autoAssign: false, // V1: Never auto-assign, client must select
    });

    sendSuccess(res, {
      jobId,
      candidates: matchResult.candidates,
      totalFound: matchResult.candidates.length,
      message: "Select up to 3 cleaners to send job offers to",
    });
  })
);

/**
 * POST /jobs/:jobId/offer
 * V1 CORE FEATURE: Client selects cleaners to send job offers to
 * Body: { cleanerIds: string[] } (up to 3 cleaner IDs)
 * Sends job offers to selected cleaners. First cleaner to accept wins.
 */
jobsRouter.post(
  "/:jobId/offer",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const clientId = req.user!.id;
    const role = getRole(req);

    // Only clients can send offers for their jobs
    if (role !== "client") {
      return sendError(res, {
        code: "FORBIDDEN",
        message: "Only clients can send job offers",
        statusCode: 403,
      } as any);
    }

    const schema = z.object({
      cleanerIds: z.array(z.string()).min(1).max(3), // V1: Client selects top 3
    });

    const body = schema.parse(req.body);

    // Get job with ownership check
    const job = await getJobForClient(jobId, clientId);

    // Only allow sending offers for jobs in 'requested' status
    if (job.status !== "requested") {
      return sendError(res, {
        code: "INVALID_STATUS",
        message: "Offers can only be sent for jobs in 'requested' status",
        statusCode: 400,
        details: { currentStatus: job.status },
      } as any);
    }

    // Check if job already has offers or is assigned
    if (job.cleaner_id) {
      return sendError(res, {
        code: "ALREADY_ASSIGNED",
        message: "Job already has a cleaner assigned",
        statusCode: 400,
      } as any);
    }

    // Verify cleaners are valid candidates (optional but recommended)
    const matchResult = await findMatchingCleaners(job, {
      limit: 10,
      minReliability: 50,
      autoAssign: false,
    });

    const validCleanerIds = matchResult.candidates.map((c) => c.cleanerId);
    const invalidIds = body.cleanerIds.filter((id) => !validCleanerIds.includes(id));

    if (invalidIds.length > 0) {
      return sendError(res, {
        code: "INVALID_CLEANERS",
        message: "Some selected cleaners are not valid candidates for this job",
        statusCode: 400,
        details: { invalidIds },
      } as any);
    }

    // Send offers to selected cleaners (30 minute expiration)
    await broadcastJobToCleaners(job, body.cleanerIds, 30);

    logger.info("job_offers_sent", {
      jobId,
      clientId,
      cleanerIds: body.cleanerIds,
      count: body.cleanerIds.length,
    });

    sendSuccess(res, {
      jobId,
      offersSent: body.cleanerIds.length,
      cleanerIds: body.cleanerIds,
      message: `Job offers sent to ${body.cleanerIds.length} cleaner(s). First to accept wins.`,
    });
  })
);

/**
 * GET /jobs/:jobId/pricing
 * Get pricing breakdown for a job
 * Shows both wallet price and card price (with surcharge)
 */
jobsRouter.get(
  "/:jobId/pricing",
  asyncHandler(async (req: JWTAuthedRequest, res) => {
    const { jobId } = req.params;
    const clientId = req.user!.id;

    // Get job with ownership check
    const job = await getJobForClient(jobId, clientId);

    // Get client's current credit balance
    const balance = await getUserCreditBalance(clientId);

    // Calculate pricing
    const credits = job.credit_amount;
    const baseAmountCents = credits * env.CENTS_PER_CREDIT;
    const surchargePercent = env.NON_CREDIT_SURCHARGE_PERCENT;
    const cardAmountCents = Math.round(baseAmountCents * (1 + surchargePercent / 100));
    const surchargeAmountCents = cardAmountCents - baseAmountCents;

    // Check if client can pay with wallet
    const canPayWithWallet = balance >= credits;
    const creditsNeeded = Math.max(0, credits - balance);

    sendSuccess(res, {
      jobId,
      credits,
      // Wallet payment option
      wallet: {
        available: canPayWithWallet,
        priceCredits: credits,
        priceCents: baseAmountCents,
        priceFormatted: `$${(baseAmountCents / 100).toFixed(2)}`,
        currentBalance: balance,
        creditsNeeded,
      },
      // Card payment option (with surcharge)
      card: {
        priceCents: cardAmountCents,
        priceFormatted: `$${(cardAmountCents / 100).toFixed(2)}`,
        baseCents: baseAmountCents,
        surchargeCents: surchargeAmountCents,
        surchargePercent,
      },
      // Comparison
      savings: {
        cents: surchargeAmountCents,
        formatted: `$${(surchargeAmountCents / 100).toFixed(2)}`,
        message: surchargePercent > 0
          ? `Save ${(surchargeAmountCents / 100).toFixed(2)} by using wallet credits!`
          : undefined,
      },
    });
  })
);

export default jobsRouter;
