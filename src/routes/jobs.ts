// src/routes/jobs.ts
// Job routes matching 001_init.sql schema

import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { requireAuth, requireRole, type AuthedRequest } from "../middleware/authCanonical";
import { requireOwnership } from "../lib/ownership";
import { addJobPhoto, getJobPhotoCounts } from "../services/photosService";
import { getStorageConfig } from "../lib/storage";
import { logJobEvent, getJobTimelineOrdered } from "../services/jobEvents";
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
import { getUserCreditBalance, getJobCreditEntries } from "../services/creditsService";
import { getClientStripeCustomerId } from "../services/userManagementService";
import { query } from "../db/client";
import type {
  JobDetailsResponse,
  JobDetailsCleaner,
  JobDetailsCheckin,
  JobDetailsPhoto,
  JobDetailsPaymentIntent,
  JobDetailsPayout,
} from "../types/jobDetails";
import { logger } from "../lib/logger";
import { env } from "../config/env";

const jobsRouter = Router();

// --------------- Job details helpers (GET /jobs/:jobId/details) ---------------

async function getCleanerComposite(cleanerUserId: string): Promise<JobDetailsCleaner | null> {
  const cleanerRow = await query<{
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    base_rate_cph: string | null;
    reliability_score: string | null;
    tier: string | null;
    avg_rating: string | null;
    jobs_completed: string | null;
  }>(
    `SELECT u.id, u.email, cp.first_name, cp.last_name, cp.avatar_url, cp.bio, cp.base_rate_cph,
            cp.reliability_score, cp.tier, cp.avg_rating, cp.jobs_completed
     FROM users u
     LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1 AND u.role = 'cleaner' LIMIT 1`,
    [cleanerUserId]
  );
  if (cleanerRow.rows.length === 0) return null;
  const c = cleanerRow.rows[0];
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || c.email || "Cleaner";
  const [level, badges] = await Promise.all([
    getCleanerLevel(cleanerUserId).catch(() => null),
    getCleanerBadges(cleanerUserId).catch(() => []),
  ]);
  return {
    id: c.id,
    email: c.email,
    name,
    avatar_url: c.avatar_url,
    bio: c.bio,
    base_rate_cph: c.base_rate_cph != null ? parseFloat(c.base_rate_cph) : null,
    reliability_score: c.reliability_score != null ? Number(c.reliability_score) : null,
    tier: c.tier ?? null,
    avg_rating: c.avg_rating != null ? Number(c.avg_rating) : null,
    jobs_completed: c.jobs_completed != null ? parseInt(c.jobs_completed, 10) : 0,
    ...(level != null && { level }),
    ...(badges.length > 0 && { badges }),
  };
}

async function getJobPhotos(jobId: string): Promise<JobDetailsPhoto[]> {
  const r = await query<JobDetailsPhoto>(
    `SELECT id, job_id, uploaded_by, type, url, thumbnail_url, created_at
     FROM job_photos WHERE job_id = $1 ORDER BY type ASC, created_at ASC`,
    [jobId]
  );
  return r.rows;
}

async function getJobCheckins(jobId: string): Promise<JobDetailsCheckin[]> {
  const r = await query<JobDetailsCheckin>(
    `SELECT id, job_id, cleaner_id, type, lat, lng,
            distance_from_job_meters, is_within_radius, created_at
     FROM job_checkins WHERE job_id = $1 ORDER BY created_at ASC`,
    [jobId]
  );
  return r.rows;
}

async function getJobLedgerEntries(jobId: string) {
  return getJobCreditEntries(jobId);
}

async function getJobPaymentIntent(jobId: string): Promise<JobDetailsPaymentIntent | null> {
  const r = await query<{
    id: string;
    job_id: string | null;
    client_id: string | null;
    stripe_payment_intent_id: string;
    status: string;
    amount_cents: number;
    currency: string;
    purpose: string;
    credits_amount: number | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, job_id, client_id, stripe_payment_intent_id, status, amount_cents,
            currency, purpose, credits_amount, created_at, updated_at
     FROM payment_intents WHERE job_id = $1 AND purpose = 'job_charge'
     ORDER BY created_at DESC LIMIT 1`,
    [jobId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    job_id: row.job_id,
    client_id: row.client_id,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    status: row.status,
    amount_cents: row.amount_cents,
    currency: row.currency,
    purpose: row.purpose,
    credits_amount: row.credits_amount,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getJobPayout(jobId: string): Promise<JobDetailsPayout | null> {
  const r = await query<{
    id: string;
    cleaner_id: string;
    job_id: string | null;
    stripe_transfer_id: string | null;
    amount_credits: number;
    amount_cents: number;
    total_usd: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT id, cleaner_id, job_id, stripe_transfer_id, amount_credits, amount_cents,
            total_usd, status, created_at, updated_at
     FROM payouts WHERE job_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [jobId]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    cleaner_id: row.cleaner_id,
    job_id: row.job_id,
    stripe_transfer_id: row.stripe_transfer_id,
    amount_credits: row.amount_credits,
    amount_cents: row.amount_cents,
    total_usd: row.total_usd != null ? parseFloat(String(row.total_usd)) : 0,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function getCleanerLevel(cleanerUserId: string): Promise<number | null> {
  const r = await query<{ current_level: number }>(
    `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1 LIMIT 1`,
    [cleanerUserId]
  );
  return r.rows[0]?.current_level ?? null;
}

async function getCleanerBadges(
  cleanerUserId: string
): Promise<Array<{ id: string; name: string; icon?: string | null }>> {
  const r = await query<{ id: string; name: string; icon_key: string | null }>(
    `SELECT bd.id, bd.name, bd.icon_key
     FROM cleaner_badges cb
     JOIN badge_definitions bd ON bd.id = cb.badge_id AND bd.is_profile_visible = true
     WHERE cb.cleaner_id = $1 ORDER BY cb.earned_at DESC LIMIT 5`,
    [cleanerUserId]
  );
  return r.rows.map((b) => ({ id: b.id, name: b.name, icon: b.icon_key ?? undefined }));
}

jobsRouter.use(requireAuth);

// Helpers
function getRole(req: AuthedRequest): "client" | "cleaner" | "admin" {
  return (req.user?.role ?? "client") as "client" | "cleaner" | "admin";
}

/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Create a new job
 *     description: Create a new cleaning job. Requires client role. Supports Idempotency-Key header to prevent duplicate bookings.
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduled_start_at
 *               - scheduled_end_at
 *               - address
 *               - credit_amount
 *             properties:
 *               scheduled_start_at:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime for job start
 *                 example: "2024-02-15T10:00:00Z"
 *               scheduled_end_at:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 datetime for job end
 *                 example: "2024-02-15T14:00:00Z"
 *               address:
 *                 type: string
 *                 description: Full address for the cleaning job
 *                 example: "123 Main St, City, State 12345"
 *               latitude:
 *                 type: number
 *                 description: Latitude coordinate (optional)
 *                 example: 40.7128
 *               longitude:
 *                 type: number
 *                 description: Longitude coordinate (optional)
 *                 example: -74.0060
 *               credit_amount:
 *                 type: number
 *                 description: Number of credits to charge for this job
 *                 example: 50
 *               client_notes:
 *                 type: string
 *                 description: Optional notes from the client
 *                 example: "Please focus on the kitchen"
 *     responses:
 *       201:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     job:
 *                       $ref: '#/components/schemas/Job'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       429:
 *         description: Rate limit exceeded (duplicate request)
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
  validateBody(createJobSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = req.body as z.infer<typeof createJobSchema>;

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
 * @swagger
 * /jobs:
 *   get:
 *     summary: List jobs for current user
 *     description: |
 *       Returns jobs based on user role:
 *       - **Client**: Returns all their jobs
 *       - **Cleaner**: Returns assigned jobs and available jobs
 *       - **Admin**: Returns jobs (should use /admin/jobs instead)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 *                     assigned:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 *                       description: Assigned jobs (cleaner role only)
 *                     available:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Job'
 *                       description: Available jobs (cleaner role only)
 *       401:
 *         description: Unauthorized
 */
jobsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
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

/** GET /jobs/me — frontend alias for "my jobs" (same as GET /jobs) */
jobsRouter.get(
  "/me",
  asyncHandler(async (req: AuthedRequest, res) => {
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
    const jobs = await listJobsForClient(req.user!.id);
    return sendSuccess(res, { jobs });
  })
);

/**
 * GET /jobs/:jobId/details
 * Single-call endpoint for Job Details UI (timeline, trust viz, ledger flow, photos, checkins, payment, payout).
 * Protect with requireOwnership("job", "jobId") to prevent leaks.
 */
jobsRouter.get(
  "/:jobId/details",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const jobId = req.params.jobId;
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, {
        code: "NOT_FOUND",
        message: "Job not found",
        statusCode: 404,
      } as any);
    }

    const cleanerUserId = job.cleaner_id ?? undefined;

    const [cleaner, photos, checkins, ledgerEntries, paymentIntent, payout, clientBalance] =
      await Promise.all([
        cleanerUserId ? getCleanerComposite(cleanerUserId) : Promise.resolve(null),
        getJobPhotos(jobId),
        getJobCheckins(jobId),
        getJobLedgerEntries(jobId),
        getJobPaymentIntent(jobId),
        getJobPayout(jobId),
        job.client_id && env.CREDITS_ENABLED ? getUserCreditBalance(job.client_id) : Promise.resolve(null),
      ]);

    const credits_held = job.credit_amount ?? 0;
    const balance_after_hold = clientBalance != null ? clientBalance : 0;
    const credits: JobDetailsResponse["credits"] =
      job.client_id && env.CREDITS_ENABLED
        ? {
            credits_held,
            balance_after_hold,
            top_up_required: balance_after_hold < 0,
          }
        : undefined;

    const payload: JobDetailsResponse = {
      job,
      cleaner,
      checkins,
      photos,
      ledgerEntries,
      paymentIntent,
      payout,
      ...(credits && { credits }),
    };
    sendSuccess(res, payload);
  })
);

/**
 * GET /jobs/:jobId
 */
jobsRouter.get(
  "/:jobId",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { jobId } = req.params;
    const job = await getJob(jobId);
    if (!job) {
      return sendError(res, {
        code: "NOT_FOUND",
        message: "Job not found",
        statusCode: 404,
      } as any);
    }
    sendSuccess(res, { job });
  })
);

/** POST /jobs/:jobId/photos — add before/after photo (photoUrl from presigned or upload); cleaner only */
const addJobPhotoSchema = z.object({
  type: z.enum(["before", "after"]),
  photoUrl: z.string().url(),
});
jobsRouter.post(
  "/:jobId/photos",
  requireOwnership("job", "jobId"),
  requireRole("cleaner"),
  validateBody(addJobPhotoSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { jobId } = req.params;
    const { type, photoUrl } = req.body;
    const photo = await addJobPhoto({
      jobId,
      uploadedBy: req.user!.id,
      type,
      url: photoUrl,
    });
    sendCreated(res, { photo });
  })
);

/** POST /jobs/:jobId/photos/commit — record S3/R2 upload in DB + emit timeline event when min photos met */
const commitPhotoSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["before", "after", "client_dispute"]),
  contentType: z.string().min(3),
  bytes: z.number().int().positive(),
  publicUrl: z.string().url().optional(),
});
jobsRouter.post(
  "/:jobId/photos/commit",
  requireOwnership("job", "jobId"),
  requireAuth,
  validateBody(commitPhotoSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { jobId } = req.params;
    const parsed = req.body as z.infer<typeof commitPhotoSchema>;
    const role = req.user!.role;

    if (parsed.kind === "client_dispute" && role !== "client" && role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ error: "Only client (or admin) can upload client_dispute photos." });
    }
    if ((parsed.kind === "before" || parsed.kind === "after") && role !== "cleaner" && role !== "admin" && role !== "super_admin") {
      return res.status(403).json({ error: "Only cleaner (or admin) can upload before/after photos." });
    }

    let url = parsed.publicUrl;
    if (!url) {
      try {
        const config = getStorageConfig();
        url = config.publicBaseUrl ? `${config.publicBaseUrl.replace(/\/$/, "")}/${parsed.key}` : parsed.key;
      } catch {
        return res.status(503).json({ error: "Storage not configured; set STORAGE_* env or send publicUrl." });
      }
    }

    const photo = await addJobPhoto({
      jobId,
      uploadedBy: req.user!.id,
      type: parsed.kind,
      url,
      fileSize: parsed.bytes,
      mimeType: parsed.contentType,
      metadata: { storageKey: parsed.key },
    });

    const counts = await getJobPhotoCounts(jobId);
    const minBefore = env.MIN_BEFORE_PHOTOS ?? 1;
    const minAfter = env.MIN_AFTER_PHOTOS ?? 1;

    const eventPayload = { key: parsed.key, bytes: parsed.bytes, contentType: parsed.contentType };
    if (parsed.kind === "before" && counts.before >= minBefore) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM job_events WHERE job_id = $1 AND event_type = $2 LIMIT 1`,
        [jobId, "before_photos_uploaded"]
      );
      if (existing.rows.length === 0) {
        await logJobEvent({
          jobId,
          actorType: role === "cleaner" ? "cleaner" : "system",
          actorId: req.user!.id,
          eventType: "before_photos_uploaded",
          payload: eventPayload,
        });
      }
    }
    if (parsed.kind === "after" && counts.after >= minAfter) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM job_events WHERE job_id = $1 AND event_type = $2 LIMIT 1`,
        [jobId, "after_photos_uploaded"]
      );
      if (existing.rows.length === 0) {
        await logJobEvent({
          jobId,
          actorType: role === "cleaner" ? "cleaner" : "system",
          actorId: req.user!.id,
          eventType: "after_photos_uploaded",
          payload: eventPayload,
        });
      }
    }
    if (parsed.kind === "client_dispute") {
      await logJobEvent({
        jobId,
        actorType: "client",
        actorId: req.user!.id,
        eventType: "client_dispute_photos_uploaded",
        payload: eventPayload,
      });
    }

    sendCreated(res, { photo });
  })
);

/** GET /jobs/:jobId/timeline — events in chronological order (for stepper / client receipt) */
jobsRouter.get(
  "/:jobId/timeline",
  requireOwnership("job", "jobId"),
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { jobId } = req.params;
    const events = await getJobTimelineOrdered(jobId);
    sendSuccess(res, events);
  })
);

/**
 * @swagger
 * /jobs/{jobId}:
 *   patch:
 *     summary: Update job details
 *     description: Update job details. Client only, only when status = 'requested'.
 *     tags: [Jobs]
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
 *             properties:
 *               scheduled_start_at:
 *                 type: string
 *                 format: date-time
 *               scheduled_end_at:
 *                 type: string
 *                 format: date-time
 *               address:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               client_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job updated successfully
 *       404:
 *         description: Job not found or cannot be updated
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
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
 * @swagger
 * /jobs/{jobId}:
 *   delete:
 *     summary: Cancel a job
 *     description: Cancel a job. Client only.
 *     tags: [Jobs]
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
 *         description: Job cancelled successfully
 *       404:
 *         description: Job not found or cannot be cancelled
 */
jobsRouter.delete(
  "/:jobId",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
 * @swagger
 * /jobs/{jobId}/events:
 *   get:
 *     summary: Get job events history
 *     description: Get the complete event history for a job, showing all status transitions and actions.
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job events history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     events:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: 'string', format: 'uuid' }
 *                           job_id: { type: 'string', format: 'uuid' }
 *                           event_type: { type: 'string' }
 *                           payload: { type: 'object' }
 *                           created_at: { type: 'string', format: 'date-time' }
 *       403:
 *         description: Forbidden (not your job)
 *       404:
 *         description: Job not found
 */
jobsRouter.get(
  "/:jobId/events",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
    const { jobId } = req.params;
    const events = await getEvents(jobId);
    sendSuccess(res, { events });
  })
);

/**
 * @swagger
 * /jobs/{jobId}/transition:
 *   post:
 *     summary: Apply status transition to job
 *     description: |
 *       Apply a status transition to a job by triggering an event.
 *       Used for job lifecycle management (accept, start, complete, etc.).
 *     tags: [Jobs]
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
 *               - event_type
 *             properties:
 *               event_type:
 *                 type: string
 *                 enum:
 *                   - job_created
 *                   - job_accepted
 *                   - cleaner_on_my_way
 *                   - job_started
 *                   - job_completed
 *                   - client_approved
 *                   - client_disputed
 *                   - dispute_resolved_refund
 *                   - dispute_resolved_no_refund
 *                   - job_cancelled
 *               payload:
 *                 type: object
 *                 description: Optional event payload data
 *     responses:
 *       200:
 *         description: Status transition applied successfully
 *       400:
 *         description: Invalid transition or event type
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Job not found
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
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
  requireOwnership("job", "jobId"),
  requireIdempotency,
  asyncHandler(async (req: AuthedRequest, res) => {
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
      const stripeCustomerId =
        req.body?.stripeCustomerId || (await getClientStripeCustomerId(clientId));

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
        pricingNote:
          surchargePercent > 0
            ? `Includes ${surchargePercent}% convenience fee. Use wallet credits to save $${(surchargeAmountCents / 100).toFixed(2)}!`
            : undefined,
      });
    } catch (err: unknown) {
      const error = err as Error & { statusCode?: number };
      logger.error("POST /jobs/:jobId/pay failed", {
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
        error: { code: "PAYMENT_FAILED", message: error.message ?? "Error" },
      });
    }
  })
);

/**
 * @swagger
 * /jobs/{jobId}/candidates:
 *   get:
 *     summary: Get top matched cleaners for job
 *     description: |
 *       V1 CORE FEATURE: Get top matched cleaners for client to review and select.
 *       Returns top 5-10 cleaners ranked by match score (reliability, tier, distance, etc.).
 *       Client can then select top 3 to send offers to.
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 10
 *         description: Maximum number of candidates to return
 *     responses:
 *       200:
 *         description: List of matched cleaners
 *       400:
 *         description: Invalid status (job must be in 'requested' status)
 *       403:
 *         description: Forbidden (only clients can view candidates)
 */
jobsRouter.get(
  "/:jobId/candidates",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
 * @swagger
 * /jobs/{jobId}/offer:
 *   post:
 *     summary: Send job offers to selected cleaners
 *     description: |
 *       V1 CORE FEATURE: Client selects cleaners to send job offers to.
 *       Sends job offers to selected cleaners. First cleaner to accept wins.
 *     tags: [Jobs]
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
 *               - cleanerIds
 *             properties:
 *               cleanerIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 3
 *                 description: Up to 3 cleaner IDs to send offers to
 *     responses:
 *       200:
 *         description: Offers sent successfully
 *       400:
 *         description: Invalid request or job status
 *       403:
 *         description: Forbidden (only clients can send offers)
 */
jobsRouter.post(
  "/:jobId/offer",
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
  requireOwnership("job", "jobId"),
  asyncHandler(async (req: AuthedRequest, res) => {
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
        message:
          surchargePercent > 0
            ? `Save ${(surchargeAmountCents / 100).toFixed(2)} by using wallet credits!`
            : undefined,
      },
    });
  })
);

export default jobsRouter;
