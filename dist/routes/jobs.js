"use strict";
// src/routes/jobs.ts
// Job routes matching 001_init.sql schema
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const jwtAuth_1 = require("../middleware/jwtAuth");
const jobsService_1 = require("../services/jobsService");
const paymentService_1 = require("../services/paymentService");
const creditsService_1 = require("../services/creditsService");
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const env_1 = require("../config/env");
const jobsRouter = (0, express_1.Router)();
// All routes require auth
jobsRouter.use(jwtAuth_1.jwtAuthMiddleware);
// Helpers
function getRole(req) {
    return (req.user?.role ?? "client");
}
/**
 * POST /jobs
 * Create a new job (client)
 */
jobsRouter.post("/", async (req, res) => {
    try {
        const schema = zod_1.z.object({
            scheduled_start_at: zod_1.z.string(), // ISO string
            scheduled_end_at: zod_1.z.string(), // ISO string
            address: zod_1.z.string().min(1),
            latitude: zod_1.z.number().optional(),
            longitude: zod_1.z.number().optional(),
            credit_amount: zod_1.z.number().positive(),
            client_notes: zod_1.z.string().optional(),
        });
        const body = schema.parse(req.body);
        const job = await (0, jobsService_1.createJob)({
            clientId: req.user.id,
            scheduledStartAt: body.scheduled_start_at,
            scheduledEndAt: body.scheduled_end_at,
            address: body.address,
            latitude: body.latitude,
            longitude: body.longitude,
            creditAmount: body.credit_amount,
            clientNotes: body.client_notes,
        });
        res.status(201).json({ job });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("POST /jobs failed", { error: error.message });
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
jobsRouter.get("/", async (req, res) => {
    try {
        const role = getRole(req);
        if (role === "client") {
            const jobs = await (0, jobsService_1.listJobsForClient)(req.user.id);
            return res.json({ jobs });
        }
        if (role === "cleaner") {
            const assigned = await (0, jobsService_1.listJobsForCleaner)(req.user.id);
            const available = await (0, jobsService_1.listAvailableJobs)();
            return res.json({ assigned, available });
        }
        // Admin should use /admin/jobs
        const jobs = await (0, jobsService_1.listJobsForClient)(req.user.id);
        return res.json({ jobs });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("GET /jobs failed", { error: error.message });
        res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
        });
    }
});
/**
 * GET /jobs/:jobId
 */
jobsRouter.get("/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await (0, jobsService_1.getJob)(jobId);
        if (!job) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Job not found" },
            });
        }
        // Access control
        const role = getRole(req);
        if (role === "client" && job.client_id !== req.user.id) {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message: "Not your job" },
            });
        }
        if (role === "cleaner" && job.cleaner_id !== req.user.id && job.status !== "requested") {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message: "Not your job" },
            });
        }
        res.json({ job });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("GET /jobs/:jobId failed", { error: error.message });
        res.status(500).json({
            error: { code: "INTERNAL_SERVER_ERROR", message: "Unexpected error" },
        });
    }
});
/**
 * PATCH /jobs/:jobId
 * Update job details (client only, only when status = 'requested')
 */
jobsRouter.patch("/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const schema = zod_1.z
            .object({
            scheduled_start_at: zod_1.z.string().optional(),
            scheduled_end_at: zod_1.z.string().optional(),
            address: zod_1.z.string().optional(),
            latitude: zod_1.z.number().optional(),
            longitude: zod_1.z.number().optional(),
            client_notes: zod_1.z.string().optional(),
        })
            .refine((data) => data.scheduled_start_at !== undefined ||
            data.scheduled_end_at !== undefined ||
            data.address !== undefined ||
            data.client_notes !== undefined, { message: "At least one field must be provided" });
        const body = schema.parse(req.body);
        const updated = await (0, jobsService_1.updateJob)({
            jobId,
            clientId: req.user.id,
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
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("PATCH /jobs/:jobId failed", { error: error.message });
        res.status(400).json({
            error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
        });
    }
});
/**
 * DELETE /jobs/:jobId
 * Cancel a job (client only)
 */
jobsRouter.delete("/:jobId", async (req, res) => {
    try {
        const { jobId } = req.params;
        const deleted = await (0, jobsService_1.deleteJob)(jobId, req.user.id);
        if (!deleted) {
            return res.status(404).json({
                error: { code: "NOT_FOUND", message: "Job not found or cannot be cancelled" },
            });
        }
        res.json({ cancelled: true, job: deleted });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("DELETE /jobs/:jobId failed", { error: error.message });
        res.status(400).json({
            error: { code: "BAD_REQUEST", message: error.message ?? "Error" },
        });
    }
});
/**
 * GET /jobs/:jobId/events
 * Returns job events history
 */
jobsRouter.get("/:jobId/events", async (req, res) => {
    try {
        const { jobId } = req.params;
        const events = await (0, jobsService_1.getEvents)(jobId);
        res.json({ events });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("GET /jobs/:jobId/events failed", { error: error.message });
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
jobsRouter.post("/:jobId/transition", async (req, res) => {
    try {
        const { jobId } = req.params;
        const schema = zod_1.z.object({
            event_type: zod_1.z.enum([
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
            payload: zod_1.z.record(zod_1.z.unknown()).optional(),
        });
        const body = schema.parse(req.body);
        const updated = await (0, jobsService_1.applyStatusTransition)({
            jobId,
            eventType: body.event_type,
            payload: body.payload ?? {},
            requesterId: req.user.id,
            role: getRole(req),
        });
        res.json({ job: updated });
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("POST /jobs/:jobId/transition failed", { error: error.message });
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
jobsRouter.post("/:jobId/pay", async (req, res) => {
    try {
        const { jobId } = req.params;
        const clientId = req.user.id;
        // Ensure client role
        const role = getRole(req);
        if (role !== "client") {
            return res.status(403).json({
                error: { code: "FORBIDDEN", message: "Only clients can pay for jobs" },
            });
        }
        // Get job with ownership check
        const job = await (0, jobsService_1.getJobForClient)(jobId, clientId);
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
        const existingPis = await (0, client_1.query)(`
        SELECT status
        FROM payment_intents
        WHERE job_id = $1
          AND purpose = 'job_charge'
      `, [jobId]);
        const hasActivePi = existingPis.rows.some((pi) => ["requires_payment_method", "requires_confirmation", "requires_action", "processing", "succeeded"].includes(pi.status));
        if (hasActivePi) {
            return res.status(400).json({
                error: {
                    code: "PAYMENT_EXISTS",
                    message: "Payment for this job already exists or has been processed",
                },
            });
        }
        // Get Stripe customer ID from client_profiles (optional)
        const customerResult = await (0, client_1.query)(`SELECT stripe_customer_id FROM client_profiles WHERE user_id = $1`, [clientId]);
        const stripeCustomerId = req.body?.stripeCustomerId || customerResult.rows[0]?.stripe_customer_id;
        // Create payment intent with surcharge
        const result = await (0, paymentService_1.createJobPaymentIntent)({
            job,
            clientId,
            clientStripeCustomerId: stripeCustomerId ?? undefined,
        });
        // Calculate pricing breakdown for response
        const baseAmountCents = job.credit_amount * env_1.env.CENTS_PER_CREDIT;
        const surchargePercent = env_1.env.NON_CREDIT_SURCHARGE_PERCENT;
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
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("POST /jobs/:jobId/pay failed", { error: error.message, jobId: req.params.jobId });
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
jobsRouter.get("/:jobId/pricing", async (req, res) => {
    try {
        const { jobId } = req.params;
        const clientId = req.user.id;
        // Get job with ownership check
        const job = await (0, jobsService_1.getJobForClient)(jobId, clientId);
        // Get client's current credit balance
        const balance = await (0, creditsService_1.getUserCreditBalance)(clientId);
        // Calculate pricing
        const credits = job.credit_amount;
        const baseAmountCents = credits * env_1.env.CENTS_PER_CREDIT;
        const surchargePercent = env_1.env.NON_CREDIT_SURCHARGE_PERCENT;
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
    }
    catch (err) {
        const error = err;
        logger_1.logger.error("GET /jobs/:jobId/pricing failed", {
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
exports.default = jobsRouter;
