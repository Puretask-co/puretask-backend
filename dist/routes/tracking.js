"use strict";
// src/routes/tracking.ts
// Job live tracking API endpoints
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const auth_1 = require("../middleware/auth");
const jobTrackingService_1 = require("../services/jobTrackingService");
const trackingRouter = (0, express_1.Router)();
// All routes require auth
trackingRouter.use(auth_1.authMiddleware);
// ============================================
// Client Tracking View
// ============================================
/**
 * GET /tracking/:jobId
 * Get full job tracking state (for client)
 */
trackingRouter.get("/:jobId", async (req, res) => {
    try {
        const state = await (0, jobTrackingService_1.getJobTrackingState)(req.params.jobId);
        res.json({ tracking: state });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("get_tracking_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "GET_TRACKING_FAILED", message: err.message },
        });
    }
});
// ============================================
// Cleaner Actions
// ============================================
const locationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
    accuracy: zod_1.z.number().optional(),
    heading: zod_1.z.number().optional(),
    speed: zod_1.z.number().optional(),
});
/**
 * POST /tracking/:jobId/en-route
 * Cleaner starts heading to job
 */
trackingRouter.post("/:jobId/en-route", (0, validation_1.validateBody)(zod_1.z.object({ location: locationSchema })), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        await (0, jobTrackingService_1.startEnRoute)(req.params.jobId, req.user.id, req.body.location);
        res.json({ success: true, status: "on_my_way" });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("en_route_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "EN_ROUTE_FAILED", message: err.message },
        });
    }
});
/**
 * POST /tracking/:jobId/arrived
 * Cleaner arrives at location
 */
trackingRouter.post("/:jobId/arrived", (0, validation_1.validateBody)(zod_1.z.object({ location: locationSchema })), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        await (0, jobTrackingService_1.markArrived)(req.params.jobId, req.user.id, req.body.location);
        res.json({ success: true });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("arrived_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "ARRIVED_FAILED", message: err.message },
        });
    }
});
/**
 * POST /tracking/:jobId/check-in
 * Cleaner checks in with before photos
 */
const checkInSchema = zod_1.z.object({
    location: locationSchema,
    beforePhotos: zod_1.z.array(zod_1.z.string().url()).min(1, "At least one before photo required"),
});
trackingRouter.post("/:jobId/check-in", (0, validation_1.validateBody)(checkInSchema), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        await (0, jobTrackingService_1.checkIn)(req.params.jobId, req.user.id, req.body.location, req.body.beforePhotos);
        res.json({ success: true, status: "in_progress" });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("check_in_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "CHECK_IN_FAILED", message: err.message },
        });
    }
});
/**
 * POST /tracking/:jobId/check-out
 * Cleaner checks out with after photos
 */
const checkOutSchema = zod_1.z.object({
    afterPhotos: zod_1.z.array(zod_1.z.string().url()).min(1, "At least one after photo required"),
    notes: zod_1.z.string().optional(),
});
trackingRouter.post("/:jobId/check-out", (0, validation_1.validateBody)(checkOutSchema), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        await (0, jobTrackingService_1.checkOut)(req.params.jobId, req.user.id, req.body.afterPhotos, req.body.notes);
        res.json({ success: true, status: "awaiting_approval" });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("check_out_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "CHECK_OUT_FAILED", message: err.message },
        });
    }
});
/**
 * POST /tracking/:jobId/location
 * Update cleaner location during job
 */
trackingRouter.post("/:jobId/location", (0, validation_1.validateBody)(zod_1.z.object({ location: locationSchema })), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        await (0, jobTrackingService_1.updateCleanerLocation)(req.params.jobId, req.user.id, req.body.location);
        res.json({ success: true });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({
            error: { code: "LOCATION_UPDATE_FAILED", message: err.message },
        });
    }
});
// ============================================
// Client Actions
// ============================================
/**
 * POST /tracking/:jobId/approve
 * Client approves completed job
 */
const approveSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    tip: zod_1.z.number().int().min(0).optional(),
    feedback: zod_1.z.string().optional(),
});
trackingRouter.post("/:jobId/approve", (0, validation_1.validateBody)(approveSchema), async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        await (0, jobTrackingService_1.approveJob)(req.params.jobId, req.user.id, req.body.rating, req.body.tip, req.body.feedback);
        res.json({ success: true, status: "completed" });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("approve_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "APPROVE_FAILED", message: err.message },
        });
    }
});
/**
 * POST /tracking/:jobId/dispute
 * Client disputes job
 */
const disputeSchema = zod_1.z.object({
    reason: zod_1.z.string().min(10),
    requestedRefund: zod_1.z.enum(["full", "partial", "none"]),
});
trackingRouter.post("/:jobId/dispute", (0, validation_1.validateBody)(disputeSchema), async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        await (0, jobTrackingService_1.disputeJob)(req.params.jobId, req.user.id, req.body.reason, req.body.requestedRefund);
        res.json({ success: true, status: "disputed" });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("dispute_failed", { error: err.message, jobId: req.params.jobId });
        res.status(err.statusCode || 500).json({
            error: { code: "DISPUTE_FAILED", message: err.message },
        });
    }
});
exports.default = trackingRouter;
