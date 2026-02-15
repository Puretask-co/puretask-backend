// src/routes/v2.ts
// V2 API routes: Properties, Teams, Calendar, AI, Goals
// V2 FEATURE — DISABLED FOR NOW

import { Router, Response } from "express";
import { z } from "zod";
import { validateBody } from "../lib/validation";
import { logger } from "../lib/logger";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";

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
import { generateChecklist, generateDisputeSuggestion } from "../services/aiService";
import {
  getCleanerGoals,
  createDefaultMonthlyGoals,
  getRouteSuggestions,
  getReliabilityBreakdown,
} from "../services/cleanerGoalsService";

const v2Router = Router();

// All V2 routes require authentication
v2Router.use(requireAuth);

// ============================================
// Properties
// ============================================

/**
 * @swagger
 * /v2/properties:
 *   post:
 *     summary: Create property
 *     description: Create a new property for a client.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - label
 *               - address_line1
 *               - city
 *             properties:
 *               label: { type: 'string' }
 *               address_line1: { type: 'string' }
 *               address_line2: { type: 'string' }
 *               city: { type: 'string' }
 *               state_region: { type: 'string' }
 *               postal_code: { type: 'string' }
 *               country_code: { type: 'string', default: 'US' }
 *               latitude: { type: 'number' }
 *               longitude: { type: 'number' }
 *               notes: { type: 'string' }
 *               bedrooms: { type: 'integer' }
 *               bathrooms: { type: 'number' }
 *               square_feet: { type: 'integer' }
 *               has_pets: { type: 'boolean' }
 *               has_kids: { type: 'boolean' }
 *     responses:
 *       201:
 *         description: Property created
 *       403:
 *         description: Forbidden - clients only
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

v2Router.post(
  "/properties",
  validateBody(createPropertySchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "client") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Clients only" } });
      }

      const property = await createProperty(req.user.id, req.body);
      res.status(201).json({ property });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      logger.error("create_property_failed", { error: err.message });
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "CREATE_PROPERTY_FAILED", message: err.message } });
    }
  }
);

/**
 * @swagger
 * /v2/properties:
 *   get:
 *     summary: Get properties
 *     description: Get all properties for the current client.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of properties
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(500)
      .json({ error: { code: "GET_PROPERTIES_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/properties/{id}:
 *   get:
 *     summary: Get property by ID
 *     description: Get property by ID.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property details
 *       404:
 *         description: Property not found
 */
v2Router.get("/properties/:id", async (req: AuthedRequest, res: Response) => {
  try {
    const property = await getPropertyById(
      Number(req.params.id),
      req.user?.role === "client" ? req.user.id : undefined
    );
    if (!property) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Property not found" } });
    }
    res.json({ property });
  } catch (error) {
    logger.error("get_property_failed", { error: (error as Error).message });
    res
      .status(500)
      .json({ error: { code: "GET_PROPERTY_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/properties/{id}/suggestions:
 *   get:
 *     summary: Get property cleaning suggestions
 *     description: Get cleaning suggestions for a property.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cleaning suggestions
 */
v2Router.get("/properties/:id/suggestions", async (req: AuthedRequest, res: Response) => {
  try {
    const suggestions = await getPropertySuggestions(Number(req.params.id));
    res.json({ suggestions });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "GET_SUGGESTIONS_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/properties/{id}:
 *   patch:
 *     summary: Update property
 *     description: Update a property.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: 'string' }
 *               address_line1: { type: 'string' }
 *               address_line2: { type: 'string' }
 *               city: { type: 'string' }
 *               state_region: { type: 'string' }
 *               postal_code: { type: 'string' }
 *               notes: { type: 'string' }
 *               bedrooms: { type: 'integer' }
 *               bathrooms: { type: 'number' }
 *               square_feet: { type: 'integer' }
 *               has_pets: { type: 'boolean' }
 *               has_kids: { type: 'boolean' }
 *     responses:
 *       200:
 *         description: Property updated
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "UPDATE_PROPERTY_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/properties/{id}:
 *   delete:
 *     summary: Delete property
 *     description: Delete a property.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Property deleted
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "DELETE_PROPERTY_FAILED", message: err.message } });
  }
});

// ============================================
// One-Tap Rebook
// ============================================

/**
 * @swagger
 * /v2/jobs/{id}/rebook-data:
 *   get:
 *     summary: Get rebook data
 *     description: Get data for rebooking a completed job (one-tap rebook).
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rebook data
 *       403:
 *         description: Forbidden - clients only
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
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "GET_REBOOK_DATA_FAILED", message: err.message } });
  }
});

// ============================================
// Teams
// ============================================

/**
 * @swagger
 * /v2/teams:
 *   post:
 *     summary: Create team
 *     description: Create a cleaning team.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name: { type: 'string' }
 *               description: { type: 'string' }
 *     responses:
 *       201:
 *         description: Team created
 *       403:
 *         description: Forbidden - cleaners only
 */
const createTeamSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

v2Router.post(
  "/teams",
  validateBody(createTeamSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (req.user?.role !== "cleaner") {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
      }

      const team = await createTeam(req.user.id, req.body.name, req.body.description);
      res.status(201).json({ team });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "CREATE_TEAM_FAILED", message: err.message } });
    }
  }
);

/**
 * @swagger
 * /v2/teams/my:
 *   get:
 *     summary: Get my team
 *     description: Get my team (as owner).
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Team details
 *       403:
 *         description: Forbidden - cleaners only
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
 * @swagger
 * /v2/teams/memberships:
 *   get:
 *     summary: Get team memberships
 *     description: Get teams I belong to.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of team memberships
 *       403:
 *         description: Forbidden - cleaners only
 */
v2Router.get("/teams/memberships", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const memberships = await getCleanerMemberships(req.user.id);
    res.json({ memberships });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GET_MEMBERSHIPS_FAILED", message: (error as Error).message } });
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

/**
 * @swagger
 * /v2/teams/{id}/invite:
 *   post:
 *     summary: Invite team member
 *     description: Invite a cleaner to join a team.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cleanerId
 *               - role
 *             properties:
 *               cleanerId:
 *                 type: string
 *                 format: uuid
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *     responses:
 *       201:
 *         description: Member invited
 *       403:
 *         description: Forbidden
 */
v2Router.post(
  "/teams/:id/members",
  validateBody(inviteMemberSchema),
  async (req: AuthedRequest, res: Response) => {
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
      res
        .status(err.statusCode || 500)
        .json({ error: { code: "INVITE_FAILED", message: err.message } });
    }
  }
);

/**
 * @swagger
 * /v2/teams/invites/{inviteId}/accept:
 *   post:
 *     summary: Accept team invitation
 *     description: Accept a team invitation.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invitation accepted
 *       403:
 *         description: Forbidden
 */
v2Router.post("/teams/:id/accept", async (req: AuthedRequest, res: Response) => {
  try {
    const member = await acceptTeamInvitation(Number(req.params.id), req.user!.id);
    res.json({ member });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "ACCEPT_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/teams/invites/{inviteId}/decline:
 *   post:
 *     summary: Decline team invitation
 *     description: Decline a team invitation.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: inviteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Invitation declined
 *       403:
 *         description: Forbidden
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
 * @swagger
 * /v2/teams/{teamId}/members/{memberId}:
 *   delete:
 *     summary: Remove team member
 *     description: Remove a member from a team.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teamId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Member removed
 *       403:
 *         description: Forbidden
 */
v2Router.delete("/teams/:id/members/:memberId", async (req: AuthedRequest, res: Response) => {
  try {
    await removeTeamMember(Number(req.params.id), req.user!.id, req.params.memberId);
    res.json({ removed: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "REMOVE_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/teams/{id}/leave:
 *   post:
 *     summary: Leave team
 *     description: Leave a team.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Left team successfully
 *       403:
 *         description: Forbidden
 */
v2Router.post("/teams/:id/leave", async (req: AuthedRequest, res: Response) => {
  try {
    await leaveTeam(Number(req.params.id), req.user!.id);
    res.json({ left: true });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "LEAVE_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/teams/{id}/stats:
 *   get:
 *     summary: Get team statistics
 *     description: Get statistics for a team.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Team statistics
 */
v2Router.get("/teams/:id/stats", async (req: AuthedRequest, res: Response) => {
  try {
    const stats = await getTeamStats(Number(req.params.id));
    res.json({ stats });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GET_STATS_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Calendar
// ============================================

/**
 * @swagger
 * /v2/calendar/google/connect:
 *   get:
 *     summary: Get Google Calendar OAuth URL
 *     description: Get Google OAuth URL for calendar connection.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OAuth URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
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
 * @swagger
 * /v2/calendar/google/callback:
 *   get:
 *     summary: Handle Google Calendar OAuth callback
 *     description: Handle Google OAuth callback and complete calendar connection.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Calendar connected successfully
 *       400:
 *         description: Invalid callback parameters
 */
v2Router.get("/calendar/google/callback", async (req: AuthedRequest, res: Response) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res
        .status(400)
        .json({ error: { code: "INVALID_CALLBACK", message: "Missing code or state" } });
    }

    const connection = await handleGoogleCallback(code as string, state as string);
    res.json({ connected: true, email: connection.email });
  } catch (error) {
    const err = error as Error & { statusCode?: number };
    res
      .status(err.statusCode || 500)
      .json({ error: { code: "CALLBACK_FAILED", message: err.message } });
  }
});

/**
 * @swagger
 * /v2/calendar/connection:
 *   get:
 *     summary: Get calendar connection status
 *     description: Get current calendar connection status.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar connection status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 connection:
 *                   type: object
 *                   nullable: true
 */
v2Router.get("/calendar/connection", async (req: AuthedRequest, res: Response) => {
  try {
    const connection = await getUserCalendarConnection(req.user!.id);
    res.json({ connection });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GET_CONNECTION_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/calendar/connection:
 *   delete:
 *     summary: Disconnect calendar
 *     description: Disconnect the user's calendar connection.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Calendar disconnected successfully
 */
v2Router.delete("/calendar/connection", async (req: AuthedRequest, res: Response) => {
  try {
    await disconnectCalendar(req.user!.id);
    res.json({ disconnected: true });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "DISCONNECT_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/calendar/ics-url:
 *   get:
 *     summary: Get ICS feed URL
 *     description: Get ICS feed URL for Apple Calendar integration.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ICS feed URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *                   format: uri
 */
v2Router.get("/calendar/ics-url", async (req: AuthedRequest, res: Response) => {
  try {
    const url = generateICSFeedUrl(req.user!.id);
    res.json({ url });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GET_ICS_URL_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// AI Features
// ============================================

/**
 * @swagger
 * /v2/ai/checklist:
 *   post:
 *     summary: Generate AI cleaning checklist
 *     description: Generate an AI-powered cleaning checklist based on property details.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - bedrooms
 *               - bathrooms
 *               - has_pets
 *               - has_kids
 *               - cleaning_type
 *             properties:
 *               bedrooms:
 *                 type: integer
 *                 minimum: 0
 *               bathrooms:
 *                 type: number
 *                 minimum: 0
 *               square_feet:
 *                 type: integer
 *               has_pets:
 *                 type: boolean
 *               has_kids:
 *                 type: boolean
 *               cleaning_type:
 *                 type: string
 *                 enum: [basic, deep, moveout]
 *               special_notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated checklist
 *       400:
 *         description: Invalid input
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

v2Router.post(
  "/ai/checklist",
  validateBody(checklistSchema),
  async (req: AuthedRequest, res: Response) => {
    try {
      const checklist = await generateChecklist(req.body);
      res.json({ checklist });
    } catch (error) {
      res
        .status(500)
        .json({ error: { code: "GENERATE_CHECKLIST_FAILED", message: (error as Error).message } });
    }
  }
);

/**
 * @swagger
 * /v2/ai/dispute-suggestion:
 *   post:
 *     summary: Generate AI dispute resolution suggestion
 *     description: Generate AI-powered dispute resolution suggestion (admin only).
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Dispute resolution suggestion
 *       403:
 *         description: Forbidden - admin only
 */
v2Router.post("/ai/dispute-suggestion", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin only" } });
    }

    const suggestion = await generateDisputeSuggestion(req.body);
    res.json({ suggestion });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GENERATE_SUGGESTION_FAILED", message: (error as Error).message } });
  }
});

// ============================================
// Cleaner Goals & Route Optimization
// ============================================

/**
 * GET /v2/cleaner/goals
 * Get cleaner's goals
 */
/**
 * @swagger
 * /v2/cleaner/goals:
 *   get:
 *     summary: Get cleaner goals
 *     description: Get cleaner's goals and progress.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleaner goals
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
    res
      .status(500)
      .json({ error: { code: "GET_GOALS_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/cleaner/route-suggestions:
 *   get:
 *     summary: Get route optimization suggestions
 *     description: Get AI-powered route optimization suggestions for cleaner's jobs.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Route optimization suggestions
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
    res
      .status(500)
      .json({ error: { code: "GET_ROUTE_SUGGESTIONS_FAILED", message: (error as Error).message } });
  }
});

/**
 * @swagger
 * /v2/cleaner/reliability-breakdown:
 *   get:
 *     summary: Get reliability breakdown
 *     description: Get detailed reliability score breakdown for cleaner.
 *     tags: [V2]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reliability breakdown
 */
v2Router.get("/cleaner/reliability-breakdown", async (req: AuthedRequest, res: Response) => {
  try {
    if (req.user?.role !== "cleaner") {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cleaners only" } });
    }

    const breakdown = await getReliabilityBreakdown(req.user.id);
    res.json({ breakdown });
  } catch (error) {
    res
      .status(500)
      .json({ error: { code: "GET_BREAKDOWN_FAILED", message: (error as Error).message } });
  }
});

export default v2Router;
