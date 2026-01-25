// src/routes/reschedule.ts
// REST API endpoints for Rescheduling System (Task 3.10)

import { Router } from "express";
import { z } from "zod";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { RescheduleServiceV2 } from "../core/rescheduleService";
import { coreDb } from "../core/db";
import { RESCHEDULE_CONFIG } from "../core/config";
import { query } from "../db/client";

const rescheduleRouter = Router();

// All routes require auth
rescheduleRouter.use(requireAuth);

// ============================================
// POST /reschedules/job/:jobId - Create reschedule request
// ============================================

rescheduleRouter.post("/job/:jobId", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const schema = z.object({
      newStartTime: z.string(), // ISO datetime
      reasonCode: z.string().optional(),
      isEmergency: z.boolean().optional(),
    });

    const body = schema.parse(req.body);
    const newStartTime = new Date(body.newStartTime);

    if (isNaN(newStartTime.getTime())) {
      return res.status(400).json({ error: "Invalid newStartTime" });
    }

    // Get job details
    const jobData = await coreDb.jobs.getWithClientProfile(jobId);
    if (!jobData) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Determine requestedBy based on user role
    const requestedBy: 'client' | 'cleaner' = 
      userRole === 'cleaner' ? 'cleaner' : 'client';

    // Verify user owns this job
    const job = await getJobForUser(jobId, Number(userId), requestedBy);
    if (!job) {
      return res.status(403).json({ error: "Not authorized to reschedule this job" });
    }

    // Check if reschedule limit reached
    const existingCount = await coreDb.rescheduleEvents.countForJob(jobId);
    if (existingCount >= RESCHEDULE_CONFIG.reasonable.maxPreviousReschedules + 1) {
      return res.status(400).json({ 
        error: "Maximum reschedules reached for this job. Please cancel and create a new booking." 
      });
    }

    // Create reschedule request
    const result = await RescheduleServiceV2.createRequest({
      job: {
        id: jobId,
        clientId: jobData.clientId,
        cleanerId: job.cleanerId,
        startTime: jobData.requestedStart,
        endTime: jobData.requestedEnd,
        heldCredits: job.heldCredits || 0,
        status: job.status,
      },
      client: {
        id: jobData.clientId,
        graceCancellationsTotal: 2,
        graceCancellationsUsed: 0,
      },
      cleaner: {
        id: job.cleanerId,
        reliabilityScore: 70,
        reliabilityTier: 'Semi Pro',
        flexibilityStatus: 'normal',
        flexibilityBadgeActive: false,
      },
      requestedBy,
      newStartTime,
      reasonCode: body.reasonCode || null,
    });

    logger.info("reschedule_request_created_via_api", {
      rescheduleId: result.id,
      jobId,
      requestedBy,
      bucket: result.bucket,
    });

    return res.status(201).json({
      success: true,
      reschedule: {
        id: result.id,
        jobId: result.jobId,
        requestedBy: result.requestedBy,
        requestedTo: result.requestedTo,
        status: result.status,
        bucket: result.bucket,
        isReasonable: result.isReasonable,
        tStartOriginal: result.tStartOriginal.toISOString(),
        tStartNew: result.tStartNew.toISOString(),
      },
    });

  } catch (err) {
    logger.error("reschedule_request_error", {
      jobId,
      error: (err as Error).message,
    });
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// POST /reschedules/:id/accept - Accept reschedule
// ============================================

rescheduleRouter.post("/:id/accept", async (req: AuthedRequest, res) => {
  const rescheduleId = Number(req.params.id);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get reschedule event
    const reschedule = await coreDb.rescheduleEvents.findById(rescheduleId);
    if (!reschedule) {
      return res.status(404).json({ error: "Reschedule request not found" });
    }

    // Determine actor
    const actor: 'client' | 'cleaner' = userRole === 'cleaner' ? 'cleaner' : 'client';

    // Verify this user is the requestedTo party
    if (actor !== reschedule.requestedTo) {
      return res.status(403).json({ error: "Only the receiving party can respond" });
    }

    // Accept the reschedule
    const result = await RescheduleServiceV2.respond({
      rescheduleEvent: reschedule,
      action: 'accept',
      actor,
    });

    logger.info("reschedule_accepted_via_api", {
      rescheduleId,
      actor,
    });

    return res.json({
      success: true,
      reschedule: {
        id: result.id,
        status: result.status,
        jobUpdated: true,
        newStartTime: result.tStartNew.toISOString(),
      },
    });

  } catch (err) {
    logger.error("reschedule_accept_error", {
      rescheduleId,
      error: (err as Error).message,
    });
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// POST /reschedules/:id/decline - Decline reschedule
// ============================================

rescheduleRouter.post("/:id/decline", async (req: AuthedRequest, res) => {
  const rescheduleId = Number(req.params.id);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const schema = z.object({
      declineReasonCode: z.string().optional(),
    });

    const body = schema.parse(req.body);

    // Get reschedule event
    const reschedule = await coreDb.rescheduleEvents.findById(rescheduleId);
    if (!reschedule) {
      return res.status(404).json({ error: "Reschedule request not found" });
    }

    // Determine actor
    const actor: 'client' | 'cleaner' = userRole === 'cleaner' ? 'cleaner' : 'client';

    // Verify this user is the requestedTo party
    if (actor !== reschedule.requestedTo) {
      return res.status(403).json({ error: "Only the receiving party can respond" });
    }

    // Decline the reschedule
    const result = await RescheduleServiceV2.respond({
      rescheduleEvent: reschedule,
      action: 'decline',
      actor,
      declineReasonCode: body.declineReasonCode || null,
    });

    logger.info("reschedule_declined_via_api", {
      rescheduleId,
      actor,
      declineReasonCode: body.declineReasonCode,
    });

    return res.json({
      success: true,
      reschedule: {
        id: result.id,
        status: result.status,
        declinedBy: result.declinedBy,
        jobUpdated: false,
        message: "The original booking time remains in effect.",
      },
    });

  } catch (err) {
    logger.error("reschedule_decline_error", {
      rescheduleId,
      error: (err as Error).message,
    });
    return res.status(400).json({ error: (err as Error).message });
  }
});

// ============================================
// GET /reschedules/:id - Get reschedule status
// ============================================

rescheduleRouter.get("/:id", async (req: AuthedRequest, res) => {
  const rescheduleId = Number(req.params.id);

  try {
    const reschedule = await coreDb.rescheduleEvents.findById(rescheduleId);
    if (!reschedule) {
      return res.status(404).json({ error: "Reschedule request not found" });
    }

    return res.json({
      id: reschedule.id,
      jobId: reschedule.jobId,
      requestedBy: reschedule.requestedBy,
      requestedTo: reschedule.requestedTo,
      status: reschedule.status,
      bucket: reschedule.bucket,
      isReasonable: reschedule.isReasonable,
      tRequest: reschedule.tRequest.toISOString(),
      tStartOriginal: reschedule.tStartOriginal.toISOString(),
      tStartNew: reschedule.tStartNew.toISOString(),
      declinedBy: reschedule.declinedBy,
      declineReasonCode: reschedule.declineReasonCode,
    });

  } catch (err) {
    logger.error("reschedule_get_error", {
      rescheduleId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// GET /reschedules/job/:jobId - Get reschedules for a job
// ============================================

rescheduleRouter.get("/job/:jobId", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);

  try {
    const reschedules = await coreDb.rescheduleEvents.getPendingForJob(jobId);

    return res.json({
      jobId,
      reschedules: reschedules.map(r => ({
        id: r.id,
        requestedBy: r.requestedBy,
        requestedTo: r.requestedTo,
        status: r.status,
        bucket: r.bucket,
        isReasonable: r.isReasonable,
        tStartOriginal: r.tStartOriginal.toISOString(),
        tStartNew: r.tStartNew.toISOString(),
      })),
    });

  } catch (err) {
    logger.error("reschedules_list_error", {
      jobId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// Helper Functions
// ============================================

async function getJobForUser(
  jobId: number,
  userId: number,
  role: 'client' | 'cleaner'
): Promise<{ cleanerId: number; status: string; heldCredits: number } | null> {
  const field = role === 'client' ? 'client_id' : 'cleaner_id';
  const result = await query<{ cleaner_id: string; status: string; credit_amount: string }>(
    `SELECT cleaner_id, status, credit_amount
     FROM jobs WHERE id = $1 AND ${field} = $2`,
    [String(jobId), String(userId)]
  );

  if (result.rows.length === 0) return null;

  return {
    cleanerId: Number(result.rows[0].cleaner_id),
    status: result.rows[0].status,
    heldCredits: Number(result.rows[0].credit_amount || 0),
  };
}

export { rescheduleRouter };
