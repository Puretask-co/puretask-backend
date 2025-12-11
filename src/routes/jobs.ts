// src/routes/jobs.ts
// Job routes matching 001_init.sql schema

import { Router } from "express";
import { z } from "zod";
import { jwtAuthMiddleware, type JWTAuthedRequest } from "../middleware/jwtAuth";
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
import { createJobPaymentIntent } from "../services/paymentService";
import { getUserCreditBalance } from "../services/creditsService";
import { query } from "../db/client";
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
 */
jobsRouter.post("/", async (req: JWTAuthedRequest, res) => {
  try {
    const schema = z.object({
      scheduled_start_at: z.string(), // ISO string
      scheduled_end_at: z.string(), // ISO string
      address: z.string().min(1),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      credit_amount: z.number().positive(),
      client_notes: z.string().optional(),
    });

    const body = schema.parse(req.body);

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

    res.status(201).json({ job });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("POST /jobs failed", { error: error.message });
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
    });
  }
});

/**
 * GET /jobs
 * List jobs for the current user:
 * - client -> their jobs
 * - cleaner -> their assigned jobs + available jobs
 * - admin -> use /admin/jobs instead
 */
jobsRouter.get("/", async (req: JWTAuthedRequest, res) => {
  try {
    const role = getRole(req);

    if (role === "client") {
      const jobs = await listJobsForClient(req.user!.id);
      return res.json({ jobs });
    }

    if (role === "cleaner") {
      const assigned = await listJobsForCleaner(req.user!.id);
      const available = await listAvailableJobs();
      return res.json({ assigned, available });
    }

    // Admin should use /admin/jobs
    const jobs = await listJobsForClient(req.user!.id);
    return res.json({ jobs });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("GET /jobs failed", { error: error.message });
    res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
    });
  }
});

/**
 * GET /jobs/:jobId
 */
jobsRouter.get("/:jobId", async (req: JWTAuthedRequest, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);

    if (!job) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Job not found" },
      });
    }

    // Access control
    const role = getRole(req);
    if (role === "client" && job.client_id !== req.user!.id) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Not your job" },
      });
    }
    if (role === "cleaner" && job.cleaner_id !== req.user!.id && job.status !== "requested") {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: "Not your job" },
      });
    }

    res.json({ job });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("GET /jobs/:jobId failed", { error: error.message });
    res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
    });
  }
});

/**
 * PATCH /jobs/:jobId
 * Update job details (client only, only when status = 'requested')
 */
jobsRouter.patch("/:jobId", async (req: JWTAuthedRequest, res) => {
  try {
    const { jobId } = req.params;

    const schema = z
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

    const body = schema.parse(req.body);

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
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Job not found or cannot be updated" },
      });
    }

    res.json({ job: updated });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("PATCH /jobs/:jobId failed", { error: error.message });
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
    });
  }
});

/**
 * DELETE /jobs/:jobId
 * Cancel a job (client only)
 */
jobsRouter.delete("/:jobId", async (req: JWTAuthedRequest, res) => {
  try {
    const { jobId } = req.params;

    const deleted = await deleteJob(jobId, req.user!.id);

    if (!deleted) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Job not found or cannot be cancelled" },
      });
    }

    res.json({ cancelled: true, job: deleted });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("DELETE /jobs/:jobId failed", { error: error.message });
    res.status(400).json({
      error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
    });
  }
});

/**
 * GET /jobs/:jobId/events
 * Returns job events history
 */
jobsRouter.get("/:jobId/events", async (req: JWTAuthedRequest, res) => {
  try {
    const { jobId } = req.params;
    const events = await getEvents(jobId);
    res.json({ events });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("GET /jobs/:jobId/events failed", { error: error.message });
    res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
    });
  }
});

/**
 * POST /jobs/:jobId/transition
 * Apply a status transition to a job
 * Body: { event_type: JobEventType, payload?: {} }
 */
jobsRouter.post("/:jobId/transition", async (req: JWTAuthedRequest, res) => {
  try {
    const { jobId } = req.params;

    const schema = z.object({
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

    const body = schema.parse(req.body);

    const updated = await applyStatusTransition({
      jobId,
      eventType: body.event_type,
      payload: body.payload ?? {},
      requesterId: req.user!.id,
      role: getRole(req),
    });

    res.json({ job: updated });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error("POST /jobs/:jobId/transition failed", { error: error.message });

    if (error.message?.includes("FORBIDDEN")) {
      return res.status(403).json({
        error: { code: "FORBIDDEN", message: error.message },
      });
    }

    if (error.message?.includes("Invalid transition") || error.message?.includes("cannot trigger")) {
      return res.status(400).json({
        error: { code: "BAD_TRANSITION", message: error.message },
      });
    }

    res.status(400).json({
      error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
    });
  }
});

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
jobsRouter.post("/:jobId/pay", async (req: JWTAuthedRequest, res) => {
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

    // Check if there's already an existing job_charge PI for this job
    const existingPis = await query<{ status: string }>(
      `
        SELECT status
        FROM payment_intents
        WHERE job_id = $1
          AND purpose = 'job_charge'
      `,
      [jobId]
    );

    const hasActivePi = existingPis.rows.some((pi) =>
      ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "succeeded"].includes(pi.status)
    );

    if (hasActivePi) {
      return res.status(400).json({
        error: {
          code: "PAYMENT_EXISTS",
          message: "Payment for this job already exists or has been processed",
        },
      });
    }

    // Get Stripe customer ID from client_profiles (optional)
    const customerResult = await query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM client_profiles WHERE user_id = $1`,
      [clientId]
    );
    const stripeCustomerId = req.body?.stripeCustomerId || customerResult.rows[0]?.stripe_customer_id;

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

    res.json({
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
});

/**
 * GET /jobs/:jobId/pricing
 * Get pricing breakdown for a job
 * Shows both wallet price and card price (with surcharge)
 */
jobsRouter.get("/:jobId/pricing", async (req: JWTAuthedRequest, res) => {
  try {
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

    res.json({
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
  } catch (err: unknown) {
    const error = err as Error & { statusCode?: number };
    logger.error("GET /jobs/:jobId/pricing failed", {
      error: error.message,
      jobId: req.params.jobId,
    });

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
      error: { code: "PRICING_FAILED", message: error.message ?? "Error" },
    });
  }
});

export default jobsRouter;
