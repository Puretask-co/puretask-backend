"use strict";
// src/routes/reschedule.ts
// REST API endpoints for Rescheduling System (Task 3.10)
Object.defineProperty(exports, "__esModule", { value: true });
exports.rescheduleRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../lib/logger");
const rescheduleService_1 = require("../core/rescheduleService");
const db_1 = require("../core/db");
const config_1 = require("../core/config");
const client_1 = require("../db/client");
const rescheduleRouter = (0, express_1.Router)();
exports.rescheduleRouter = rescheduleRouter;
// All routes require auth
rescheduleRouter.use(auth_1.authMiddleware);
// ============================================
// POST /reschedules/job/:jobId - Create reschedule request
// ============================================
rescheduleRouter.post("/job/:jobId", async (req, res) => {
    const jobId = Number(req.params.jobId);
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const schema = zod_1.z.object({
            newStartTime: zod_1.z.string(), // ISO datetime
            reasonCode: zod_1.z.string().optional(),
            isEmergency: zod_1.z.boolean().optional(),
        });
        const body = schema.parse(req.body);
        const newStartTime = new Date(body.newStartTime);
        if (isNaN(newStartTime.getTime())) {
            return res.status(400).json({ error: "Invalid newStartTime" });
        }
        // Get job details
        const jobData = await db_1.coreDb.jobs.getWithClientProfile(jobId);
        if (!jobData) {
            return res.status(404).json({ error: "Job not found" });
        }
        // Determine requestedBy based on user role
        const requestedBy = userRole === 'cleaner' ? 'cleaner' : 'client';
        // Verify user owns this job
        const job = await getJobForUser(jobId, Number(userId), requestedBy);
        if (!job) {
            return res.status(403).json({ error: "Not authorized to reschedule this job" });
        }
        // Check if reschedule limit reached
        const existingCount = await db_1.coreDb.rescheduleEvents.countForJob(jobId);
        if (existingCount >= config_1.RESCHEDULE_CONFIG.reasonable.maxPreviousReschedules + 1) {
            return res.status(400).json({
                error: "Maximum reschedules reached for this job. Please cancel and create a new booking."
            });
        }
        // Create reschedule request
        const result = await rescheduleService_1.RescheduleServiceV2.createRequest({
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
        logger_1.logger.info("reschedule_request_created_via_api", {
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
    }
    catch (err) {
        logger_1.logger.error("reschedule_request_error", {
            jobId,
            error: err.message,
        });
        return res.status(400).json({ error: err.message });
    }
});
// ============================================
// POST /reschedules/:id/accept - Accept reschedule
// ============================================
rescheduleRouter.post("/:id/accept", async (req, res) => {
    const rescheduleId = Number(req.params.id);
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        // Get reschedule event
        const reschedule = await db_1.coreDb.rescheduleEvents.findById(rescheduleId);
        if (!reschedule) {
            return res.status(404).json({ error: "Reschedule request not found" });
        }
        // Determine actor
        const actor = userRole === 'cleaner' ? 'cleaner' : 'client';
        // Verify this user is the requestedTo party
        if (actor !== reschedule.requestedTo) {
            return res.status(403).json({ error: "Only the receiving party can respond" });
        }
        // Accept the reschedule
        const result = await rescheduleService_1.RescheduleServiceV2.respond({
            rescheduleEvent: reschedule,
            action: 'accept',
            actor,
        });
        logger_1.logger.info("reschedule_accepted_via_api", {
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
    }
    catch (err) {
        logger_1.logger.error("reschedule_accept_error", {
            rescheduleId,
            error: err.message,
        });
        return res.status(400).json({ error: err.message });
    }
});
// ============================================
// POST /reschedules/:id/decline - Decline reschedule
// ============================================
rescheduleRouter.post("/:id/decline", async (req, res) => {
    const rescheduleId = Number(req.params.id);
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    try {
        const schema = zod_1.z.object({
            declineReasonCode: zod_1.z.string().optional(),
        });
        const body = schema.parse(req.body);
        // Get reschedule event
        const reschedule = await db_1.coreDb.rescheduleEvents.findById(rescheduleId);
        if (!reschedule) {
            return res.status(404).json({ error: "Reschedule request not found" });
        }
        // Determine actor
        const actor = userRole === 'cleaner' ? 'cleaner' : 'client';
        // Verify this user is the requestedTo party
        if (actor !== reschedule.requestedTo) {
            return res.status(403).json({ error: "Only the receiving party can respond" });
        }
        // Decline the reschedule
        const result = await rescheduleService_1.RescheduleServiceV2.respond({
            rescheduleEvent: reschedule,
            action: 'decline',
            actor,
            declineReasonCode: body.declineReasonCode || null,
        });
        logger_1.logger.info("reschedule_declined_via_api", {
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
    }
    catch (err) {
        logger_1.logger.error("reschedule_decline_error", {
            rescheduleId,
            error: err.message,
        });
        return res.status(400).json({ error: err.message });
    }
});
// ============================================
// GET /reschedules/:id - Get reschedule status
// ============================================
rescheduleRouter.get("/:id", async (req, res) => {
    const rescheduleId = Number(req.params.id);
    try {
        const reschedule = await db_1.coreDb.rescheduleEvents.findById(rescheduleId);
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
    }
    catch (err) {
        logger_1.logger.error("reschedule_get_error", {
            rescheduleId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// GET /reschedules/job/:jobId - Get reschedules for a job
// ============================================
rescheduleRouter.get("/job/:jobId", async (req, res) => {
    const jobId = Number(req.params.jobId);
    try {
        const reschedules = await db_1.coreDb.rescheduleEvents.getPendingForJob(jobId);
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
    }
    catch (err) {
        logger_1.logger.error("reschedules_list_error", {
            jobId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// Helper Functions
// ============================================
async function getJobForUser(jobId, userId, role) {
    const field = role === 'client' ? 'client_id' : 'cleaner_id';
    const result = await (0, client_1.query)(`SELECT cleaner_id, status, credit_amount
     FROM jobs WHERE id = $1 AND ${field} = $2`, [String(jobId), String(userId)]);
    if (result.rows.length === 0)
        return null;
    return {
        cleanerId: Number(result.rows[0].cleaner_id),
        status: result.rows[0].status,
        heldCredits: Number(result.rows[0].credit_amount || 0),
    };
}
