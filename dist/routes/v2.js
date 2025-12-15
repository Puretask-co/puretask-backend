"use strict";
// src/routes/v2.ts
// V2 API routes: Properties, Teams, Calendar, AI, Goals
// V2 FEATURE — DISABLED FOR NOW
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../lib/validation");
const logger_1 = require("../lib/logger");
const auth_1 = require("../middleware/auth");
// Services
const propertiesService_1 = require("../services/propertiesService");
const teamsService_1 = require("../services/teamsService");
const calendarService_1 = require("../services/calendarService");
const aiService_1 = require("../services/aiService");
const cleanerGoalsService_1 = require("../services/cleanerGoalsService");
const v2Router = (0, express_1.Router)();
// All V2 routes require authentication
v2Router.use(auth_1.authMiddleware);
// ============================================
// Properties
// ============================================
/**
 * POST /v2/properties
 * Create a new property
 */
const createPropertySchema = zod_1.z.object({
    label: zod_1.z.string().min(1),
    address_line1: zod_1.z.string().min(1),
    address_line2: zod_1.z.string().optional(),
    city: zod_1.z.string().min(1),
    state_region: zod_1.z.string().optional(),
    postal_code: zod_1.z.string().optional(),
    country_code: zod_1.z.string().default("US"),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
    notes: zod_1.z.string().optional(),
    bedrooms: zod_1.z.number().int().optional(),
    bathrooms: zod_1.z.number().optional(),
    square_feet: zod_1.z.number().int().optional(),
    has_pets: zod_1.z.boolean().optional(),
    has_kids: zod_1.z.boolean().optional(),
});
v2Router.post("/properties", (0, validation_1.validateBody)(createPropertySchema), async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const property = await (0, propertiesService_1.createProperty)(req.user.id, req.body);
        res.status(201).json({ property });
    }
    catch (error) {
        const err = error;
        logger_1.logger.error("create_property_failed", { error: err.message });
        res.status(err.statusCode || 500).json({ error: { code: "CREATE_PROPERTY_FAILED", message: err.message } });
    }
});
/**
 * GET /v2/properties
 * Get all client properties
 */
v2Router.get("/properties", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const properties = await (0, propertiesService_1.getClientProperties)(req.user.id);
        res.json({ properties });
    }
    catch (error) {
        logger_1.logger.error("get_properties_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_PROPERTIES_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/properties/:id
 * Get property by ID
 */
v2Router.get("/properties/:id", async (req, res) => {
    try {
        const property = await (0, propertiesService_1.getPropertyById)(Number(req.params.id), req.user?.role === "client" ? req.user.id : undefined);
        if (!property) {
            return res.status(404).json({ error: { code: "NOT_FOUND", message: "Property not found" } });
        }
        res.json({ property });
    }
    catch (error) {
        logger_1.logger.error("get_property_failed", { error: error.message });
        res.status(500).json({ error: { code: "GET_PROPERTY_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/properties/:id/suggestions
 * Get cleaning suggestions for a property
 */
v2Router.get("/properties/:id/suggestions", async (req, res) => {
    try {
        const suggestions = await (0, propertiesService_1.getPropertySuggestions)(Number(req.params.id));
        res.json({ suggestions });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "GET_SUGGESTIONS_FAILED", message: err.message } });
    }
});
/**
 * PATCH /v2/properties/:id
 * Update property
 */
v2Router.patch("/properties/:id", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const property = await (0, propertiesService_1.updateProperty)(Number(req.params.id), req.user.id, req.body);
        res.json({ property });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "UPDATE_PROPERTY_FAILED", message: err.message } });
    }
});
/**
 * DELETE /v2/properties/:id
 * Delete property
 */
v2Router.delete("/properties/:id", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        await (0, propertiesService_1.deleteProperty)(Number(req.params.id), req.user.id);
        res.json({ deleted: true });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "DELETE_PROPERTY_FAILED", message: err.message } });
    }
});
// ============================================
// One-Tap Rebook
// ============================================
/**
 * GET /v2/jobs/:id/rebook-data
 * Get data for rebooking a completed job
 */
v2Router.get("/jobs/:id/rebook-data", async (req, res) => {
    try {
        if (req.user?.role !== "client") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
        }
        const data = await (0, propertiesService_1.getRebookData)(req.params.id, req.user.id);
        res.json(data);
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "GET_REBOOK_DATA_FAILED", message: err.message } });
    }
});
// ============================================
// Teams
// ============================================
/**
 * POST /v2/teams
 * Create a team
 */
const createTeamSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
});
v2Router.post("/teams", (0, validation_1.validateBody)(createTeamSchema), async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const team = await (0, teamsService_1.createTeam)(req.user.id, req.body.name, req.body.description);
        res.status(201).json({ team });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "CREATE_TEAM_FAILED", message: err.message } });
    }
});
/**
 * GET /v2/teams/my
 * Get my team (as owner)
 */
v2Router.get("/teams/my", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const team = await (0, teamsService_1.getCleanerTeam)(req.user.id);
        res.json({ team });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_TEAM_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/teams/memberships
 * Get teams I belong to
 */
v2Router.get("/teams/memberships", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const memberships = await (0, teamsService_1.getCleanerMemberships)(req.user.id);
        res.json({ memberships });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_MEMBERSHIPS_FAILED", message: error.message } });
    }
});
/**
 * POST /v2/teams/:id/members
 * Invite member to team
 */
const inviteMemberSchema = zod_1.z.object({
    cleanerId: zod_1.z.string().uuid(),
    role: zod_1.z.enum(["lead", "member"]).optional(),
});
v2Router.post("/teams/:id/members", (0, validation_1.validateBody)(inviteMemberSchema), async (req, res) => {
    try {
        const member = await (0, teamsService_1.inviteTeamMember)(Number(req.params.id), req.user.id, req.body.cleanerId, req.body.role);
        res.status(201).json({ member });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "INVITE_FAILED", message: err.message } });
    }
});
/**
 * POST /v2/teams/:id/accept
 * Accept team invitation
 */
v2Router.post("/teams/:id/accept", async (req, res) => {
    try {
        const member = await (0, teamsService_1.acceptTeamInvitation)(Number(req.params.id), req.user.id);
        res.json({ member });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "ACCEPT_FAILED", message: err.message } });
    }
});
/**
 * POST /v2/teams/:id/decline
 * Decline team invitation
 */
v2Router.post("/teams/:id/decline", async (req, res) => {
    try {
        await (0, teamsService_1.declineTeamInvitation)(Number(req.params.id), req.user.id);
        res.json({ declined: true });
    }
    catch (error) {
        res.status(500).json({ error: { code: "DECLINE_FAILED", message: error.message } });
    }
});
/**
 * DELETE /v2/teams/:id/members/:memberId
 * Remove team member
 */
v2Router.delete("/teams/:id/members/:memberId", async (req, res) => {
    try {
        await (0, teamsService_1.removeTeamMember)(Number(req.params.id), req.user.id, req.params.memberId);
        res.json({ removed: true });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "REMOVE_FAILED", message: err.message } });
    }
});
/**
 * POST /v2/teams/:id/leave
 * Leave a team
 */
v2Router.post("/teams/:id/leave", async (req, res) => {
    try {
        await (0, teamsService_1.leaveTeam)(Number(req.params.id), req.user.id);
        res.json({ left: true });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "LEAVE_FAILED", message: err.message } });
    }
});
/**
 * GET /v2/teams/:id/stats
 * Get team statistics
 */
v2Router.get("/teams/:id/stats", async (req, res) => {
    try {
        const stats = await (0, teamsService_1.getTeamStats)(Number(req.params.id));
        res.json({ stats });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_STATS_FAILED", message: error.message } });
    }
});
// ============================================
// Calendar
// ============================================
/**
 * GET /v2/calendar/google/connect
 * Get Google OAuth URL
 */
v2Router.get("/calendar/google/connect", async (req, res) => {
    try {
        const url = (0, calendarService_1.getGoogleConnectUrl)(req.user.id);
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_URL_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/calendar/google/callback
 * Handle Google OAuth callback
 */
v2Router.get("/calendar/google/callback", async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code || !state) {
            return res.status(400).json({ error: { code: "INVALID_CALLBACK", message: "Missing code or state" } });
        }
        const connection = await (0, calendarService_1.handleGoogleCallback)(code, state);
        res.json({ connected: true, email: connection.email });
    }
    catch (error) {
        const err = error;
        res.status(err.statusCode || 500).json({ error: { code: "CALLBACK_FAILED", message: err.message } });
    }
});
/**
 * GET /v2/calendar/connection
 * Get current calendar connection
 */
v2Router.get("/calendar/connection", async (req, res) => {
    try {
        const connection = await (0, calendarService_1.getUserCalendarConnection)(req.user.id);
        res.json({ connection });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_CONNECTION_FAILED", message: error.message } });
    }
});
/**
 * DELETE /v2/calendar/connection
 * Disconnect calendar
 */
v2Router.delete("/calendar/connection", async (req, res) => {
    try {
        await (0, calendarService_1.disconnectCalendar)(req.user.id);
        res.json({ disconnected: true });
    }
    catch (error) {
        res.status(500).json({ error: { code: "DISCONNECT_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/calendar/ics-url
 * Get ICS feed URL for Apple Calendar
 */
v2Router.get("/calendar/ics-url", async (req, res) => {
    try {
        const url = (0, calendarService_1.generateICSFeedUrl)(req.user.id);
        res.json({ url });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_ICS_URL_FAILED", message: error.message } });
    }
});
// ============================================
// AI Features
// ============================================
/**
 * POST /v2/ai/checklist
 * Generate AI cleaning checklist
 */
const checklistSchema = zod_1.z.object({
    bedrooms: zod_1.z.number().int().min(0),
    bathrooms: zod_1.z.number().min(0),
    square_feet: zod_1.z.number().int().optional(),
    has_pets: zod_1.z.boolean(),
    has_kids: zod_1.z.boolean(),
    cleaning_type: zod_1.z.enum(["basic", "deep", "moveout"]),
    special_notes: zod_1.z.string().optional(),
});
v2Router.post("/ai/checklist", (0, validation_1.validateBody)(checklistSchema), async (req, res) => {
    try {
        const checklist = await (0, aiService_1.generateChecklist)(req.body);
        res.json({ checklist });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GENERATE_CHECKLIST_FAILED", message: error.message } });
    }
});
/**
 * POST /v2/ai/dispute-suggestion
 * Generate AI dispute resolution suggestion (admin only)
 */
v2Router.post("/ai/dispute-suggestion", async (req, res) => {
    try {
        if (req.user?.role !== "admin") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only" } });
        }
        const suggestion = await (0, aiService_1.generateDisputeSuggestion)(req.body);
        res.json({ suggestion });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GENERATE_SUGGESTION_FAILED", message: error.message } });
    }
});
// ============================================
// Cleaner Goals & Route Optimization
// ============================================
/**
 * GET /v2/cleaner/goals
 * Get cleaner's goals
 */
v2Router.get("/cleaner/goals", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        let goals = await (0, cleanerGoalsService_1.getCleanerGoals)(req.user.id);
        // Auto-create default goals if none exist
        if (goals.length === 0) {
            goals = await (0, cleanerGoalsService_1.createDefaultMonthlyGoals)(req.user.id);
        }
        res.json({ goals });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_GOALS_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/cleaner/route-suggestions
 * Get route optimization suggestions
 */
v2Router.get("/cleaner/route-suggestions", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const date = req.query.date ? new Date(req.query.date) : new Date();
        const suggestions = await (0, cleanerGoalsService_1.getRouteSuggestions)(req.user.id, date);
        res.json({ suggestions });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_ROUTE_SUGGESTIONS_FAILED", message: error.message } });
    }
});
/**
 * GET /v2/cleaner/reliability-breakdown
 * Get detailed reliability breakdown
 */
v2Router.get("/cleaner/reliability-breakdown", async (req, res) => {
    try {
        if (req.user?.role !== "cleaner") {
            return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
        }
        const breakdown = await (0, cleanerGoalsService_1.getReliabilityBreakdown)(req.user.id);
        res.json({ breakdown });
    }
    catch (error) {
        res.status(500).json({ error: { code: "GET_BREAKDOWN_FAILED", message: error.message } });
    }
});
exports.default = v2Router;
