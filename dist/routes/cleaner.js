"use strict";
// src/routes/cleaner.ts
// Cleaner-specific routes (onboarding, profile, availability)
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const jwtAuth_1 = require("../middleware/jwtAuth");
const cleanerOnboardingService_1 = require("../services/cleanerOnboardingService");
const payoutsService_1 = require("../services/payoutsService");
const availabilityService_1 = require("../services/availabilityService");
// V2 FEATURE — DISABLED FOR NOW (reliability)
// import { getCleanerReliabilityInfo } from "../services/reliabilityService";
const cleanerRouter = (0, express_1.Router)();
// All routes require authentication as cleaner
cleanerRouter.use(jwtAuth_1.jwtAuthMiddleware);
cleanerRouter.use((0, jwtAuth_1.requireRole)("cleaner", "admin"));
/**
 * GET /cleaner/profile
 * Get cleaner profile and stats
 */
cleanerRouter.get("/profile", async (req, res) => {
    try {
        const profile = await (0, cleanerOnboardingService_1.getCleanerProfile)(req.user.id);
        if (!profile) {
            return res.status(404).json({
                error: { code: "PROFILE_NOT_FOUND", message: "Profile not found" },
            });
        }
        res.json({ profile });
    }
    catch (error) {
        logger_1.logger.error("get_cleaner_profile_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_PROFILE_FAILED", message: "Failed to get profile" },
        });
    }
});
/**
 * PATCH /cleaner/profile
 * Update cleaner profile
 */
const updateProfileSchema = zod_1.z.object({
    baseRateCph: zod_1.z.number().positive().optional(),
    deepAddonCph: zod_1.z.number().positive().optional(),
    moveoutAddonCph: zod_1.z.number().positive().optional(),
    bio: zod_1.z.string().max(500).optional(),
    serviceAreas: zod_1.z.array(zod_1.z.string()).optional(),
});
cleanerRouter.patch("/profile", (0, validation_1.validateBody)(updateProfileSchema), async (req, res) => {
    try {
        const user = await (0, cleanerOnboardingService_1.updateCleanerProfile)(req.user.id, req.body);
        res.json({
            profile: {
                id: user.id,
                baseRateCph: user.base_rate_cph,
                deepAddonCph: user.deep_addon_cph,
                moveoutAddonCph: user.moveout_addon_cph,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("update_cleaner_profile_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(400).json({
            error: { code: "UPDATE_FAILED", message: error.message },
        });
    }
});
/**
 * POST /cleaner/stripe/connect
 * Create or get Stripe Connect onboarding link
 */
cleanerRouter.post("/stripe/connect", async (req, res) => {
    try {
        const result = await (0, cleanerOnboardingService_1.createStripeConnectAccount)(req.user.id);
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error("stripe_connect_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "CONNECT_FAILED", message: "Failed to create Connect account" },
        });
    }
});
/**
 * GET /cleaner/stripe/status
 * Get Stripe Connect account status
 */
cleanerRouter.get("/stripe/status", async (req, res) => {
    try {
        const status = await (0, cleanerOnboardingService_1.getStripeConnectStatus)(req.user.id);
        res.json(status);
    }
    catch (error) {
        logger_1.logger.error("get_stripe_status_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_STATUS_FAILED", message: "Failed to get status" },
        });
    }
});
/**
 * GET /cleaner/stripe/dashboard
 * Get Stripe Express dashboard link
 */
cleanerRouter.get("/stripe/dashboard", async (req, res) => {
    try {
        const url = await (0, cleanerOnboardingService_1.getStripeDashboardLink)(req.user.id);
        res.json({ url });
    }
    catch (error) {
        logger_1.logger.error("get_stripe_dashboard_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        if (error.message === "No Stripe Connect account found") {
            return res.status(404).json({
                error: { code: "NO_ACCOUNT", message: "Complete onboarding first" },
            });
        }
        res.status(500).json({
            error: { code: "GET_DASHBOARD_FAILED", message: "Failed to get dashboard link" },
        });
    }
});
/**
 * GET /cleaner/availability
 * Get cleaner availability schedule
 */
cleanerRouter.get("/availability", async (req, res) => {
    try {
        const availability = await (0, cleanerOnboardingService_1.getCleanerAvailability)(req.user.id);
        res.json({ availability });
    }
    catch (error) {
        logger_1.logger.error("get_availability_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_AVAILABILITY_FAILED", message: "Failed to get availability" },
        });
    }
});
/**
 * PUT /cleaner/availability
 * Update cleaner availability schedule
 */
const availabilitySchema = zod_1.z.object({
    monday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    tuesday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    wednesday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    thursday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    friday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    saturday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
    sunday: zod_1.z.array(zod_1.z.object({ start: zod_1.z.string(), end: zod_1.z.string() })).optional(),
});
cleanerRouter.put("/availability", (0, validation_1.validateBody)(availabilitySchema), async (req, res) => {
    try {
        await (0, cleanerOnboardingService_1.updateCleanerAvailability)(req.user.id, req.body);
        res.json({ success: true, availability: req.body });
    }
    catch (error) {
        logger_1.logger.error("update_availability_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(400).json({
            error: { code: "UPDATE_FAILED", message: error.message },
        });
    }
});
/**
 * GET /cleaner/payouts
 * Get payout history
 */
cleanerRouter.get("/payouts", async (req, res) => {
    try {
        const { limit = "50" } = req.query;
        const payouts = await (0, payoutsService_1.getCleanerPayouts)(req.user.id, parseInt(limit, 10));
        res.json({ payouts });
    }
    catch (error) {
        logger_1.logger.error("get_payouts_failed", {
            error: error.message,
            userId: req.user?.id,
        });
        res.status(500).json({
            error: { code: "GET_PAYOUTS_FAILED", message: "Failed to get payouts" },
        });
    }
});
// ============================================
// Time Off Management
// ============================================
/**
 * GET /cleaner/time-off
 * Get time off entries
 */
cleanerRouter.get("/time-off", async (req, res) => {
    try {
        const timeOff = await (0, availabilityService_1.getTimeOff)(req.user.id, true);
        res.json({ timeOff });
    }
    catch (error) {
        logger_1.logger.error("get_time_off_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_TIME_OFF_FAILED", message: "Failed to get time off" },
        });
    }
});
/**
 * POST /cleaner/time-off
 * Add time off
 */
const addTimeOffSchema = zod_1.z.object({
    startDate: zod_1.z.string(),
    endDate: zod_1.z.string(),
    allDay: zod_1.z.boolean().optional().default(true),
    startTime: zod_1.z.string().optional(),
    endTime: zod_1.z.string().optional(),
    reason: zod_1.z.string().optional(),
});
cleanerRouter.post("/time-off", (0, validation_1.validateBody)(addTimeOffSchema), async (req, res) => {
    try {
        const timeOff = await (0, availabilityService_1.addTimeOff)({
            cleanerId: req.user.id,
            ...req.body,
        });
        res.status(201).json({ timeOff });
    }
    catch (error) {
        logger_1.logger.error("add_time_off_failed", { error: error.message });
        res.status(400).json({
            error: { code: "ADD_TIME_OFF_FAILED", message: error.message },
        });
    }
});
/**
 * DELETE /cleaner/time-off/:id
 * Delete time off entry
 */
cleanerRouter.delete("/time-off/:id", async (req, res) => {
    try {
        await (0, availabilityService_1.deleteTimeOff)(req.user.id, req.params.id);
        res.json({ deleted: true });
    }
    catch (error) {
        logger_1.logger.error("delete_time_off_failed", { error: error.message });
        res.status(500).json({
            error: { code: "DELETE_TIME_OFF_FAILED", message: "Failed to delete" },
        });
    }
});
// ============================================
// Service Areas
// ============================================
/**
 * GET /cleaner/service-areas
 * Get service areas
 */
cleanerRouter.get("/service-areas", async (req, res) => {
    try {
        const areas = await (0, availabilityService_1.getServiceAreas)(req.user.id);
        res.json({ serviceAreas: areas });
    }
    catch (error) {
        logger_1.logger.error("get_service_areas_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_AREAS_FAILED", message: "Failed to get areas" },
        });
    }
});
/**
 * POST /cleaner/service-areas
 * Add service area
 */
const addServiceAreaSchema = zod_1.z.object({
    zipCode: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    radiusMiles: zod_1.z.number().int().positive().optional(),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
});
cleanerRouter.post("/service-areas", (0, validation_1.validateBody)(addServiceAreaSchema), async (req, res) => {
    try {
        const area = await (0, availabilityService_1.addServiceArea)({
            cleanerId: req.user.id,
            ...req.body,
        });
        res.status(201).json({ serviceArea: area });
    }
    catch (error) {
        logger_1.logger.error("add_service_area_failed", { error: error.message });
        res.status(400).json({
            error: { code: "ADD_AREA_FAILED", message: error.message },
        });
    }
});
/**
 * DELETE /cleaner/service-areas/:id
 * Delete service area
 */
cleanerRouter.delete("/service-areas/:id", async (req, res) => {
    try {
        await (0, availabilityService_1.deleteServiceArea)(req.user.id, req.params.id);
        res.json({ deleted: true });
    }
    catch (error) {
        logger_1.logger.error("delete_service_area_failed", { error: error.message });
        res.status(500).json({
            error: { code: "DELETE_AREA_FAILED", message: "Failed to delete" },
        });
    }
});
// ============================================
// Preferences
// ============================================
/**
 * GET /cleaner/preferences
 * Get cleaner preferences
 */
cleanerRouter.get("/preferences", async (req, res) => {
    try {
        const preferences = await (0, availabilityService_1.getPreferences)(req.user.id);
        res.json({ preferences });
    }
    catch (error) {
        logger_1.logger.error("get_preferences_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_PREFS_FAILED", message: "Failed to get preferences" },
        });
    }
});
/**
 * PUT /cleaner/preferences
 * Update cleaner preferences
 */
const updatePreferencesSchema = zod_1.z.object({
    max_jobs_per_day: zod_1.z.number().int().min(1).max(20).optional(),
    min_job_duration_h: zod_1.z.number().min(0.5).max(8).optional(),
    max_job_duration_h: zod_1.z.number().min(1).max(12).optional(),
    accepts_pets: zod_1.z.boolean().optional(),
    accepts_deep_clean: zod_1.z.boolean().optional(),
    accepts_move_out: zod_1.z.boolean().optional(),
    has_own_supplies: zod_1.z.boolean().optional(),
    has_vehicle: zod_1.z.boolean().optional(),
    notes: zod_1.z.string().max(500).optional(),
});
cleanerRouter.put("/preferences", (0, validation_1.validateBody)(updatePreferencesSchema), async (req, res) => {
    try {
        const preferences = await (0, availabilityService_1.setPreferences)(req.user.id, req.body);
        res.json({ preferences });
    }
    catch (error) {
        logger_1.logger.error("update_preferences_failed", { error: error.message });
        res.status(400).json({
            error: { code: "UPDATE_PREFS_FAILED", message: error.message },
        });
    }
});
// ============================================
// Schedule View
// ============================================
/**
 * GET /cleaner/schedule/:date
 * Get cleaner's schedule for a specific date
 */
cleanerRouter.get("/schedule/:date", async (req, res) => {
    try {
        const date = new Date(req.params.date);
        if (isNaN(date.getTime())) {
            return res.status(400).json({
                error: { code: "INVALID_DATE", message: "Invalid date format" },
            });
        }
        const schedule = await (0, availabilityService_1.getCleanerSchedule)(req.user.id, date);
        res.json({ date: req.params.date, schedule });
    }
    catch (error) {
        logger_1.logger.error("get_schedule_failed", { error: error.message });
        res.status(500).json({
            error: { code: "GET_SCHEDULE_FAILED", message: "Failed to get schedule" },
        });
    }
});
// ============================================
// Reliability Score (V2 FEATURE — DISABLED FOR NOW)
// ============================================
// cleanerRouter.get("/reliability", async (req: JWTAuthedRequest, res: Response) => {
//   try {
//    const reliability = await getCleanerReliabilityInfo(req.user!.id);
//     res.json({ reliability });
//   } catch (error) {
//     logger.error("get_reliability_failed", { error: (error as Error).message });
//     res.status(500).json({
//       error: { code: "GET_RELIABILITY_FAILED", message: "Failed to get reliability" },
//     });
//   }
// });
exports.default = cleanerRouter;
