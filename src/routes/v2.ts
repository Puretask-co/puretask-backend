// src/routes/v2.ts
// V2 API routes: Properties, Teams, Calendar, AI, Goals
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { authMiddleware, AuthedRequest } from "../middleware/auth";

// Services
import {
  createProperty,
  getPropertyById,
  getClientProperties,
  updateProperty,
  deleteProperty,
  getPropertySuggestions,
  getRebookData,
} from "../services/propertiesService";
import {
  createTeam,
  getCleanerTeam,
  getCleanerMemberships,
  updateTeam,
  inviteTeamMember,
  acceptTeamInvitation,
  declineTeamInvitation,
  removeTeamMember,
  leaveTeam,
  getTeamStats,
} from "../services/teamsService";
import {
  getGoogleConnectUrl,
  handleGoogleCallback,
  getUserCalendarConnection,
  disconnectCalendar,
  toggleCalendarSync,
  generateICSFeedUrl,
  generateICSContent,
} from "../services/calendarService";
import {
  generateChecklist,
  generateDisputeSuggestion,
} from "../services/aiService";
import {
  getCleanerGoals,
  createDefaultMonthlyGoals,
  getRouteSuggestions,
  getReliabilityBreakdown,
} from "../services/cleanerGoalsService";

const v2Router = Router();

// All V2 routes require authentication
v2Router.use(authMiddleware);

// ============================================
// Properties
// ============================================

/**
 * POST /v2/properties
 * Create a new property
 */
const createPropertySchema = z.object({
  label: z.string().min(1),
  address_line1: z.string().min(1),
  address_line2: z.string().optional(),
  city: z.string().min(1),
  state_region: z.string().optional(),
  postal_code: z.string().optional(),
  country_code: z.string().default("US"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  square_feet: z.number().int().optional(),
  has_pets: z.boolean().optional(),
  has_kids: z.boolean().optional(),
});

v2Router.post("/properties", validateBody(createPropertySchema), async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    const property = await createProperty(req.user.id, req.body);
    res.status(201).json({ property });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    logger.error("create_property_failed", { error: err.message });
    res.status(err.statusCode || 500).json({ error: { code: "CREATE_PROPERTY_FAILED", message: err.message } });
  }
});

/**
 * GET /v2/properties
 * Get all client properties
 */
v2Router.get("/properties", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    const properties = await getClientProperties(req.user.id);
    res.json({ properties });
  } catch (error) {
    logger.error("get_properties_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_PROPERTIES_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/properties/:id
 * Get property by ID
 */
v2Router.get("/properties/:id", async (req: AuthedRequest, res: Response) => {
  try {
    const property = await getPropertyById(Number(req.params.id), req.user?.role === "client" ? req.user.id : undefined);
    if (!property) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Property not found" } });
    }
    res.json({ property });
  } catch (error) {
    logger.error("get_property_failed", { error: (error as Error).message });
    res.status(500).json({ error: { code: "GET_PROPERTY_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/properties/:id/suggestions
 * Get cleaning suggestions for a property
 */
v2Router.get("/properties/:id/suggestions", async (req: AuthedRequest, res: Response) => {
  try {
    const suggestions = await getPropertySuggestions(Number(req.params.id));
    res.json({ suggestions });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "GET_SUGGESTIONS_FAILED", message: err.message } });
  }
});

/**
 * PATCH /v2/properties/:id
 * Update property
 */
v2Router.patch("/properties/:id", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    const property = await updateProperty(Number(req.params.id), req.user.id, req.body);
    res.json({ property });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "UPDATE_PROPERTY_FAILED", message: err.message } });
  }
});

/**
 * DELETE /v2/properties/:id
 * Delete property
 */
v2Router.delete("/properties/:id", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    await deleteProperty(Number(req.params.id), req.user.id);
    res.json({ deleted: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
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
v2Router.get("/jobs/:id/rebook-data", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "client") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
    }

    const data = await getRebookData(req.params.id, req.user.id);
    res.json(data);
  } catch (error) {
    const err = error as Error & { statusCode?: number };
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
const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

v2Router.post("/teams", validateBody(createTeamSchema), async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const team = await createTeam(req.user.id, req.body.name, req.body.description);
    res.status(201).json({ team });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "CREATE_TEAM_FAILED", message: err.message } });
  }
});

/**
 * GET /v2/teams/my
 * Get my team (as owner)
 */
v2Router.get("/teams/my", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const team = await getCleanerTeam(req.user.id);
    res.json({ team });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_TEAM_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/teams/memberships
 * Get teams I belong to
 */
v2Router.get("/teams/memberships", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const memberships = await getCleanerMemberships(req.user.id);
    res.json({ memberships });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_MEMBERSHIPS_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /v2/teams/:id/members
 * Invite member to team
 */
const inviteMemberSchema = z.object({
  cleanerId: z.string().uuid(),
  role: z.enum(["lead", "member"]).optional(),
});

v2Router.post("/teams/:id/members", validateBody(inviteMemberSchema), async (req: AuthedRequest, res: Response) => {
  try {
    const member = await inviteTeamMember(
      Number(req.params.id),
      req.user!.id,
      req.body.cleanerId,
      req.body.role
    );
    res.status(201).json({ member });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "INVITE_FAILED", message: err.message } });
  }
});

/**
 * POST /v2/teams/:id/accept
 * Accept team invitation
 */
v2Router.post("/teams/:id/accept", async (req: AuthedRequest, res: Response) => {
  try {
    const member = await acceptTeamInvitation(Number(req.params.id), req.user!.id);
    res.json({ member });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "ACCEPT_FAILED", message: err.message } });
  }
});

/**
 * POST /v2/teams/:id/decline
 * Decline team invitation
 */
v2Router.post("/teams/:id/decline", async (req: AuthedRequest, res: Response) => {
  try {
    await declineTeamInvitation(Number(req.params.id), req.user!.id);
    res.json({ declined: true });
  } catch (error) {
    res.status(500).json({ error: { code: "DECLINE_FAILED", message: (error as Error).message } });
  }
});

/**
 * DELETE /v2/teams/:id/members/:memberId
 * Remove team member
 */
v2Router.delete("/teams/:id/members/:memberId", async (req: AuthedRequest, res: Response) => {
  try {
    await removeTeamMember(Number(req.params.id), req.user!.id, req.params.memberId);
    res.json({ removed: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "REMOVE_FAILED", message: err.message } });
  }
});

/**
 * POST /v2/teams/:id/leave
 * Leave a team
 */
v2Router.post("/teams/:id/leave", async (req: AuthedRequest, res: Response) => {
  try {
    await leaveTeam(Number(req.params.id), req.user!.id);
    res.json({ left: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "LEAVE_FAILED", message: err.message } });
  }
});

/**
 * GET /v2/teams/:id/stats
 * Get team statistics
 */
v2Router.get("/teams/:id/stats", async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await getTeamStats(Number(req.params.id));
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_STATS_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Calendar
// ============================================

/**
 * GET /v2/calendar/google/connect
 * Get Google OAuth URL
 */
v2Router.get("/calendar/google/connect", async (req: AuthedRequest, res: Response) => {
  try {
    const url = getGoogleConnectUrl(req.user!.id);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_URL_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/calendar/google/callback
 * Handle Google OAuth callback
 */
v2Router.get("/calendar/google/callback", async (req: AuthedRequest, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.status(400).json({ error: { code: "INVALID_CALLBACK", message: "Missing code or state" } });
    }

    const connection = await handleGoogleCallback(code as string, state as string);
    res.json({ connected: true, email: connection.email });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res.status(err.statusCode || 500).json({ error: { code: "CALLBACK_FAILED", message: err.message } });
  }
});

/**
 * GET /v2/calendar/connection
 * Get current calendar connection
 */
v2Router.get("/calendar/connection", async (req: AuthedRequest, res: Response) => {
  try {
    const connection = await getUserCalendarConnection(req.user!.id);
    res.json({ connection });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_CONNECTION_FAILED", message: (error as Error).message } });
  }
});

/**
 * DELETE /v2/calendar/connection
 * Disconnect calendar
 */
v2Router.delete("/calendar/connection", async (req: AuthedRequest, res: Response) => {
  try {
    await disconnectCalendar(req.user!.id);
    res.json({ disconnected: true });
  } catch (error) {
    res.status(500).json({ error: { code: "DISCONNECT_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/calendar/ics-url
 * Get ICS feed URL for Apple Calendar
 */
v2Router.get("/calendar/ics-url", async (req: AuthedRequest, res: Response) => {
  try {
    const url = generateICSFeedUrl(req.user!.id);
    res.json({ url });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_ICS_URL_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// AI Features
// ============================================

/**
 * POST /v2/ai/checklist
 * Generate AI cleaning checklist
 */
const checklistSchema = z.object({
  bedrooms: z.number().int().min(0),
  bathrooms: z.number().min(0),
  square_feet: z.number().int().optional(),
  has_pets: z.boolean(),
  has_kids: z.boolean(),
  cleaning_type: z.enum(["basic", "deep", "moveout"]),
  special_notes: z.string().optional(),
});

v2Router.post("/ai/checklist", validateBody(checklistSchema), async (req: AuthedRequest, res: Response) => {
  try {
    const checklist = await generateChecklist(req.body);
    res.json({ checklist });
  } catch (error) {
    res.status(500).json({ error: { code: "GENERATE_CHECKLIST_FAILED", message: (error as Error).message } });
  }
});

/**
 * POST /v2/ai/dispute-suggestion
 * Generate AI dispute resolution suggestion (admin only)
 */
v2Router.post("/ai/dispute-suggestion", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only" } });
    }

    const suggestion = await generateDisputeSuggestion(req.body);
    res.json({ suggestion });
  } catch (error) {
    res.status(500).json({ error: { code: "GENERATE_SUGGESTION_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Cleaner Goals & Route Optimization
// ============================================

/**
 * GET /v2/cleaner/goals
 * Get cleaner's goals
 */
v2Router.get("/cleaner/goals", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    let goals = await getCleanerGoals(req.user.id);
    
    // Auto-create default goals if none exist
    if (goals.length === 0) {
      goals = await createDefaultMonthlyGoals(req.user.id);
    }

    res.json({ goals });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_GOALS_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/cleaner/route-suggestions
 * Get route optimization suggestions
 */
v2Router.get("/cleaner/route-suggestions", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    const suggestions = await getRouteSuggestions(req.user.id, date);
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_ROUTE_SUGGESTIONS_FAILED", message: (error as Error).message } });
  }
});

/**
 * GET /v2/cleaner/reliability-breakdown
 * Get detailed reliability breakdown
 */
v2Router.get("/cleaner/reliability-breakdown", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const breakdown = await getReliabilityBreakdown(req.user.id);
    res.json({ breakdown });
  } catch (error) {
    res.status(500).json({ error: { code: "GET_BREAKDOWN_FAILED", message: (error as Error).message } });
  }
});

export default v2Router;

