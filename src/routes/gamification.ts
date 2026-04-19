/**
 * Gamification & Onboarding API
 *
 * Handles: onboarding progress, achievements, certifications, template library
 */

import { Router, Response } from "express";
import { z } from "zod";
import { query } from "../db/client";
import { requireAuth, requireRole, AuthedRequest, authedHandler } from "../middleware/authCanonical";
import { getLevelProgress, recordCleanerLogin } from "../services/cleanerLevelService";
import {
  recordEvent,
  recordSessionStart,
  EventContractValidationError,
} from "../services/eventIngestionService";
import { getCleanerProgression } from "../services/gamificationProgressionService";
import {
  selectChoiceReward,
  getActiveRewards,
  getOpenChoiceEligibilities,
} from "../services/gamificationRewardService";
import {
  getCleanerGoalsWithProgress,
  getCleanerProgressSummary,
} from "../services/cleanerGamificationProgressService";
import { RewardEffectsService } from "../services/rewardEffectsService";
import { BadgeService } from "../services/badgeService";
import { SeasonService } from "../services/seasonService";
import { NextBestActionService } from "../services/nextBestActionService";
import {
  isGamificationEnabled,
  isGamificationBadgesEnabled,
  isNextBestActionEnabled,
} from "../lib/gamificationFeatureFlags";

const router = Router();

/** Helper: gate gamification endpoints when feature flag is disabled */
async function gateGamification(
  req: AuthedRequest,
  res: Response,
  regionId: string | null,
  emptyPayload: Record<string, unknown> = {}
): Promise<boolean> {
  const enabled = await isGamificationEnabled({ region_id: regionId });
  if (!enabled) {
    res.json({ ok: true, gamification_enabled: false, ...emptyPayload });
    return false;
  }
  return true;
}
router.use(requireAuth);

// ============================================
// CLEANER LEVEL SYSTEM (Gamification)
// ============================================

/**
 * @swagger
 * /cleaner/level/progress:
 *   get:
 *     summary: Get level progress
 *     description: Get cleaner level, goals, completion status, and level-up eligibility.
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Level progress with goals and progress
 */
router.get(
  "/level/progress",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { level: 1, goals: [], progress: [] })))
      return;
    try {
      const cleanerId = req.user!.id;
      const progress = await getLevelProgress(cleanerId);
      res.json(progress);
    } catch (error: unknown) {
      console.error("Error fetching level progress:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch level progress" },
      });
    }
  })
);

/**
 * GET /cleaner/level/progression — Engine-based progression (Step 5/6)
 * Returns level evaluation, goal progress, next best actions from JSON config.
 */
router.get(
  "/level/progression",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const currentLevel = Number(req.query.current_level) || 1;

      const levelRow = await query<{ current_level: number }>(
        `SELECT current_level FROM cleaner_level_progress WHERE cleaner_id = $1`,
        [cleanerId]
      );
      const level = levelRow.rows[0]?.current_level ?? currentLevel;

      const progression = await getCleanerProgression(cleanerId, level);
      res.json({ ok: true, ...progression });
    } catch (error: unknown) {
      console.error("Error fetching progression:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch progression" },
      });
    }
  })
);

/**
 * GET /cleaner/goals — Frontend spec: goals with progress (current, target, window)
 */
router.get(
  "/goals",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { goals: [] }))) return;
    try {
      const cleanerId = req.user!.id;
      const goals = await getCleanerGoalsWithProgress(cleanerId);
      res.json({ goals });
    } catch (error: unknown) {
      console.error("Error fetching cleaner goals:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch goals" },
      });
    }
  })
);

/**
 * GET /cleaner/progress — Frontend spec: progress hub summary (level, core %, stretch, maintenance, active_rewards)
 */
router.get(
  "/progress",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { current_level: 1, active_rewards: [] }))) return;
    try {
      const cleanerId = req.user!.id;
      const summary = await getCleanerProgressSummary(cleanerId);
      if (!summary) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Progress not found" } });
      }
      res.json(summary);
    } catch (error: unknown) {
      console.error("Error fetching cleaner progress:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress" },
      });
    }
  })
);

/**
 * GET /cleaner/rewards/choices — List open choice eligibilities (Step 8)
 */
router.get(
  "/rewards/choices",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { choices: [] }))) return;
    try {
      const cleanerId = req.user!.id;
      const choices = await getOpenChoiceEligibilities(cleanerId);
      res.json({ ok: true, choices });
    } catch (error: unknown) {
      console.error("Error fetching choice eligibilities:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch choices" },
      });
    }
  })
);

/**
 * POST /cleaner/rewards/select — Select a choice reward
 * Body: { eligibility_id, reward_id }
 */
router.post(
  "/rewards/select",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { eligibility_id, reward_id } = req.body ?? {};
      if (!eligibility_id || !reward_id) {
        res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "eligibility_id and reward_id required" },
        });
        return;
      }

      const grant = await selectChoiceReward({
        cleanerId,
        eligibilityId: eligibility_id,
        rewardId: reward_id,
      });
      res.json({ ok: true, grant });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to select reward";
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: msg } });
    }
  })
);

/**
 * POST /cleaner/rewards/choice/:choiceGroupId/select — Frontend spec: select by choice group id
 * Body: { reward_id }
 */
router.post(
  "/rewards/choice/:choiceGroupId/select",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const choiceGroupId = req.params.choiceGroupId;
      const reward_id = (req.body as { reward_id?: string })?.reward_id;
      if (!reward_id) {
        return res.status(400).json({
          error: { code: "BAD_REQUEST", message: "reward_id required" },
        });
      }
      const elig = await query<{ id: string }>(
        `SELECT id FROM gamification_choice_eligibilities
         WHERE cleaner_id = $1 AND choice_group_id = $2 AND status = 'open'
           AND (expires_at IS NULL OR expires_at > now())
         ORDER BY earned_at DESC LIMIT 1`,
        [cleanerId, choiceGroupId]
      );
      const eligibilityId = elig.rows[0]?.id;
      if (!eligibilityId) {
        return res.status(422).json({
          error: { code: "UNPROCESSABLE_ENTITY", message: "No open eligibility for this choice group" },
        });
      }
      const grant = await selectChoiceReward({
        cleanerId,
        eligibilityId,
        rewardId: reward_id,
      });
      res.json({ ok: true, grant });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to select reward";
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: msg } });
    }
  })
);

/**
 * GET /cleaner/rewards/effects — Get effective reward effects (Step 9)
 * Query: region_id (optional). Returns visibility multiplier, early exposure, fee discounts, etc.
 */
router.get(
  "/rewards/effects",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId))) return;
    try {
      const cleanerId = req.user!.id;
      const service = new RewardEffectsService();
      const effects = await service.getEffectiveEffects({
        cleaner_id: cleanerId,
        region_id: regionId,
      });
      res.json({ ok: true, effects });
    } catch (error: unknown) {
      console.error("Error fetching reward effects:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch effects" },
      });
    }
  })
);

/**
 * GET /cleaner/next-best-actions — Next best actions for fastest path to reward (Step 16)
 */
router.get(
  "/next-best-actions",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) ?? null;
    if (
      !(await isGamificationEnabled({ region_id: regionId })) ||
      !(await isNextBestActionEnabled({ region_id: regionId }))
    ) {
      res.json({ ok: true, gamification_enabled: false, actions: [] });
      return;
    }
    try {
      const cleanerId = req.user!.id;
      const limit = req.query.limit ? Number(req.query.limit) : 3;
      const svc = new NextBestActionService();
      const result = await svc.getNextBestActions({
        cleaner_id: cleanerId,
        region_id: regionId,
        limit,
      });
      res.json({ ok: true, ...result });
    } catch (error: unknown) {
      console.error("Error fetching next best actions:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch next best actions" },
      });
    }
  })
);

/**
 * GET /cleaner/seasons/active — Active seasonal challenges for region
 */
router.get(
  "/seasons/active",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) ?? null;
    if (!(await gateGamification(req, res, regionId, { seasons: [] }))) return;
    try {
      const svc = new SeasonService();
      const seasons = await svc.getActiveSeasons({ region_id: regionId, at: new Date() });
      res.json({
        ok: true,
        seasons: seasons.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          starts_at: s.starts_at,
          ends_at: s.ends_at,
          ui: s.rule?.ui ?? {},
        })),
      });
    } catch (error: unknown) {
      console.error("Error fetching active seasons:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch seasons" },
      });
    }
  })
);

/**
 * GET /cleaner/badges — Badge catalog (enabled definitions)
 */
router.get(
  "/badges",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (
      !(await isGamificationEnabled({ region_id: regionId })) ||
      !(await isGamificationBadgesEnabled({ region_id: regionId }))
    ) {
      res.json({ ok: true, gamification_enabled: false, badges: [] });
      return;
    }
    try {
      const svc = new BadgeService();
      const badges = await svc.getBadgeCatalog();
      res.json({ ok: true, badges });
    } catch (error: unknown) {
      console.error("Error fetching badge catalog:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch badges" },
      });
    }
  })
);

/**
 * GET /cleaner/badges/earned — Cleaner's earned badges
 */
router.get(
  "/badges/earned",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { earned: [] }))) return;
    try {
      const cleanerId = req.user!.id;
      const svc = new BadgeService();
      const earned = await svc.getCleanerBadges(cleanerId);
      res.json({ ok: true, earned });
    } catch (error: unknown) {
      console.error("Error fetching earned badges:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch earned badges" },
      });
    }
  })
);

/**
 * GET /cleaner/badges/feed — Achievement feed (badge, level_up, goal_complete, reward_granted)
 */
router.get(
  "/badges/feed",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const svc = new BadgeService();
      const feed = await svc.getAchievementFeed(cleanerId, limit);
      res.json({ ok: true, feed });
    } catch (error: unknown) {
      console.error("Error fetching achievement feed:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch feed" },
      });
    }
  })
);

/**
 * GET /cleaner/rewards/active — List active rewards
 */
router.get(
  "/rewards/active",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId, { rewards: [] }))) return;
    try {
      const cleanerId = req.user!.id;
      const rewards = await getActiveRewards(cleanerId);
      res.json({ ok: true, rewards });
    } catch (error: unknown) {
      console.error("Error fetching active rewards:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch rewards" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/level/record-login:
 *   post:
 *     summary: Record login for streak
 *     description: Record cleaner login for daily streak tracking. Call on app open/login.
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Login recorded
 */
router.post(
  "/level/record-login",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      await recordCleanerLogin(cleanerId);
      res.json({ message: "Login recorded" });
    } catch (error: unknown) {
      console.error("Error recording login:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to record login" },
      });
    }
  })
);

/**
 * POST /cleaner/events — Record gamification events (session start, meaningful action, etc.)
 * See docs/active/EVENT_CONTRACT.md
 */
const eventSchema = z.object({
  event_type: z.string(),
  occurred_at: z.string().datetime().optional(),
  payload: z.record(z.unknown()).optional(),
  idempotency_key: z.string().optional(),
  job_id: z.string().uuid().optional().nullable(),
  job_request_id: z.string().uuid().optional().nullable(),
  client_id: z.string().optional().nullable(),
});
router.post(
  "/events",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.body?.region_id as string) || (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId))) return;
    try {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
        return;
      }
      const {
        event_type,
        occurred_at,
        payload,
        idempotency_key,
        job_id,
        job_request_id,
        client_id,
      } = parsed.data;
      const source = (req.headers["x-event-source"] as string) || "mobile";
      const validSource = ["mobile", "web"].includes(source)
        ? (source as "mobile" | "web")
        : "mobile";

      await recordEvent({
        event_type,
        occurred_at: occurred_at ? new Date(occurred_at) : new Date(),
        source: validSource,
        cleaner_id: req.user!.id,
        client_id: client_id ?? null,
        job_id: job_id ?? null,
        job_request_id: job_request_id ?? null,
        payload: payload ?? {},
        idempotency_key: idempotency_key ?? undefined,
      });
      res.json({ ok: true });
    } catch (error: unknown) {
      if (error instanceof EventContractValidationError) {
        res.status(400).json({
          error: {
            code: "EVENT_CONTRACT_VIOLATION",
            message: error.message,
            details: error.errors,
          },
        });
        return;
      }
      console.error("Error recording event:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to record event" },
      });
    }
  })
);

/**
 * POST /cleaner/events/session-start — Record engagement session start
 */
const sessionStartSchema = z.object({
  session_id: z.string().uuid(),
  timezone: z.string().optional(),
  device_platform: z.enum(["ios", "android", "web"]).optional(),
  app_version: z.string().optional(),
});
router.post(
  "/events/session-start",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    const regionId = (req.body?.region_id as string) || (req.query.region_id as string) || null;
    if (!(await gateGamification(req, res, regionId))) return;
    try {
      const parsed = sessionStartSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: { code: "VALIDATION_ERROR", details: parsed.error.flatten() } });
        return;
      }
      const source = (req.headers["x-event-source"] as string) || "mobile";
      const validSource = ["mobile", "web"].includes(source)
        ? (source as "mobile" | "web")
        : "mobile";

      await recordSessionStart(parsed.data.session_id, req.user!.id, validSource, {
        timezone: parsed.data.timezone,
        device_platform: parsed.data.device_platform,
        app_version: parsed.data.app_version,
      });
      res.json({ ok: true });
    } catch (error: unknown) {
      console.error("Error recording session start:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to record session" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/progress:
 *   get:
 *     summary: Get onboarding progress
 *     description: Get cleaner onboarding progress (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: completionPercentage, wizardCompleted, currentStep, etc.
 */
router.get(
  "/onboarding/progress",
  requireRole("cleaner"),
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        profile_completion_percentage as "completionPercentage",
        setup_wizard_completed as "wizardCompleted",
        setup_wizard_step as "currentStep",
        profile_photo_uploaded as "photoUploaded",
        bio_completed as "bioCompleted",
        services_defined as "servicesDefined",
        availability_set as "availabilitySet",
        pricing_configured as "pricingConfigured",
        ai_personality_set as "aiPersonalitySet",
        templates_customized as "templatesCustomized",
        quick_responses_added as "quickResponsesAdded",
        first_template_used as "firstTemplateUsed",
        viewed_insights_dashboard as "viewedDashboard",
        created_custom_template as "createdCustomTemplate",
        marked_favorite_response as "markedFavorite",
        days_since_signup as "daysSinceSignup",
        total_logins as "totalLogins",
        onboarding_abandoned as "abandoned"
      FROM cleaner_onboarding_progress
      WHERE cleaner_id = $1`,
      [cleanerId]
    );

      if (result.rows.length === 0) {
        // Initialize if not exists
        await query(`INSERT INTO cleaner_onboarding_progress (cleaner_id) VALUES ($1)`, [cleanerId]);
        res.json({
          completionPercentage: 0,
          wizardCompleted: false,
          currentStep: 0,
        });
        return;
      }

      res.json(result.rows[0]);
    } catch (error: unknown) {
      console.error("Error fetching onboarding progress:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch progress" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/onboarding/update:
 *   post:
 *     summary: Update onboarding progress
 *     description: Update onboarding step/fields (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               setup_wizard_step: { type: number }
 *               setup_wizard_completed: { type: boolean }
 *               profile_photo_uploaded: { type: boolean }
 *               bio_completed: { type: boolean }
 *               services_defined: { type: boolean }
 *               availability_set: { type: boolean }
 *               pricing_configured: { type: boolean }
 *               ai_personality_set: { type: boolean }
 *               templates_customized: { type: boolean }
 *               quick_responses_added: { type: boolean }
 *               first_template_used: { type: boolean }
 *               viewed_insights_dashboard: { type: boolean }
 *               created_custom_template: { type: boolean }
 *               marked_favorite_response: { type: boolean }
 *     responses:
 *       200:
 *         description: Progress updated
 *       400:
 *         description: No valid fields to update
 */
router.post(
  "/onboarding/update",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const updates = req.body;

      const allowedFields = [
        "setup_wizard_step",
        "setup_wizard_completed",
        "profile_photo_uploaded",
        "bio_completed",
        "services_defined",
        "availability_set",
        "pricing_configured",
        "ai_personality_set",
        "templates_customized",
        "quick_responses_added",
        "first_template_used",
        "viewed_insights_dashboard",
        "created_custom_template",
        "marked_favorite_response",
      ];

      const updateFields = Object.keys(updates)
        .filter((key) => allowedFields.includes(key))
        .map((key, index) => `${key} = $${index + 2}`)
        .join(", ");

      if (!updateFields) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "No valid fields to update" },
        });
      }

      const values = [
        cleanerId,
        ...Object.keys(updates)
          .filter((key) => allowedFields.includes(key))
          .map((key) => updates[key]),
      ];

      await query(
        `UPDATE cleaner_onboarding_progress
       SET ${updateFields}, updated_at = NOW()
       WHERE cleaner_id = $1`,
        values
      );

      // Check if any achievements unlocked
      await checkAndUnlockAchievements(cleanerId);

      res.json({ message: "Progress updated successfully" });
    } catch (error: any) {
      console.error("Error updating onboarding progress:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to update progress" },
      });
    }
  })
);

// ============================================
// ACHIEVEMENTS
// ============================================

/**
 * @swagger
 * /cleaner/achievements:
 *   get:
 *     summary: Get achievements
 *     description: Get all achievements with earned status and stats (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: achievements (grouped), stats (earnedPoints, totalPoints, etc.)
 */
router.get(
  "/achievements",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      // Get all achievements with earned status
      const result = await query(
        `SELECT 
        a.id,
        a.achievement_key as "key",
        a.name,
        a.description,
        a.category,
        a.tier,
        a.icon,
        a.points,
        a.criteria,
        CASE WHEN ca.id IS NOT NULL THEN true ELSE false END as earned,
        ca.earned_at as "earnedAt",
        ca.seen,
        ca.progress_percentage as "progressPercentage"
      FROM achievements a
      LEFT JOIN cleaner_achievements ca ON a.id = ca.achievement_id AND ca.cleaner_id = $1
      WHERE a.is_active = true
      ORDER BY a.display_order, a.created_at`,
        [cleanerId]
      );

      // Group by category
      const grouped = result.rows.reduce((acc: any, achievement: any) => {
        if (!acc[achievement.category]) {
          acc[achievement.category] = [];
        }
        acc[achievement.category].push(achievement);
        return acc;
      }, {});

      // Calculate total points
      const earnedPoints = result.rows
        .filter((a: any) => a.earned)
        .reduce((sum: number, a: any) => sum + a.points, 0);

      const totalPoints = result.rows.reduce((sum: number, a: any) => sum + a.points, 0);

      res.json({
        achievements: grouped,
        stats: {
          earnedPoints,
          totalPoints,
          earnedCount: result.rows.filter((a: any) => a.earned).length,
          totalCount: result.rows.length,
        },
      });
    } catch (error: any) {
      console.error("Error fetching achievements:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch achievements" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/achievements/{achievementId}/mark-seen:
 *   post:
 *     summary: Mark achievement as seen
 *     description: Mark an achievement as seen (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: achievementId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Achievement marked as seen
 */
router.post(
  "/achievements/:achievementId/mark-seen",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { achievementId } = req.params;

      await query(
        `UPDATE cleaner_achievements
       SET seen = true
       WHERE cleaner_id = $1 AND achievement_id = $2`,
        [cleanerId, achievementId]
      );

      res.json({ message: "Achievement marked as seen" });
    } catch (error: any) {
      console.error("Error marking achievement:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to mark achievement" },
      });
    }
  })
);

// ============================================
// CERTIFICATIONS
// ============================================

/**
 * @swagger
 * /cleaner/certifications:
 *   get:
 *     summary: Get certifications
 *     description: Get certifications with earned status and progress (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of certifications with progress
 */
router.get(
  "/certifications",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      const result = await query(
        `SELECT 
        c.id,
        c.certification_key as "key",
        c.name,
        c.description,
        c.level,
        c.icon,
        c.badge_color as "badgeColor",
        c.requirements,
        c.benefits,
        CASE WHEN cc.id IS NOT NULL THEN true ELSE false END as earned,
        cc.earned_at as "earnedAt",
        cc.expires_at as "expiresAt",
        cc.certificate_url as "certificateUrl",
        cc.is_active as "isActive"
      FROM certifications c
      LEFT JOIN cleaner_certifications cc ON c.id = cc.certification_id AND cc.cleaner_id = $1
      WHERE c.is_active = true
      ORDER BY c.level`,
        [cleanerId]
      );

      // Calculate progress for each certification
      const certsWithProgress = await Promise.all(
        result.rows.map(async (cert: any) => {
          const progress = await calculateCertificationProgress(cleanerId, cert.requirements);
          return {
            ...cert,
            progress,
            canEarn: progress >= 100 && !cert.earned,
          };
        })
      );

      res.json({
        certifications: certsWithProgress,
        currentLevel: certsWithProgress.filter((c: any) => c.earned).length,
      });
    } catch (error: any) {
      console.error("Error fetching certifications:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch certifications" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/certifications/{certificationId}/claim:
 *   post:
 *     summary: Claim certification
 *     description: Claim a certification (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: certificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Certification claimed
 */
router.post("/certifications/:certificationId/claim", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { certificationId } = req.params;

    // Check if requirements met
    const cert = await query(`SELECT requirements FROM certifications WHERE id = $1`, [
      certificationId,
    ]);

    if (cert.rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "Certification not found" },
      });
    }

    const progress = await calculateCertificationProgress(cleanerId, cert.rows[0].requirements);

    if (progress < 100) {
      return res.status(400).json({
        error: { code: "REQUIREMENTS_NOT_MET", message: "Requirements not yet met" },
      });
    }

    // Award certification
    const result = await query(
      `INSERT INTO cleaner_certifications (cleaner_id, certification_id)
       VALUES ($1, $2)
       ON CONFLICT (cleaner_id, certification_id) DO UPDATE SET is_active = true
       RETURNING id, earned_at as "earnedAt"`,
      [cleanerId, certificationId]
    );

    res.json({
      message: "Certification earned!",
      certification: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error claiming certification:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to claim certification" },
    });
  }
});

// ============================================
// TEMPLATE LIBRARY
// ============================================

/**
 * @swagger
 * /cleaner/template-library:
 *   get:
 *     summary: Get template library
 *     description: List templates with optional category, type, search, sort (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [rating, popular, recent], default: rating }
 *     responses:
 *       200:
 *         description: templates array and count
 */
router.get(
  "/template-library",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const { category, type, search, sort = "rating" } = req.query;

      let sql = `
      SELECT 
        id,
        template_type as type,
        template_name as name,
        template_content as content,
        variables,
        category,
        subcategory,
        description,
        rating_average as "ratingAverage",
        rating_count as "ratingCount",
        usage_count as "usageCount",
        favorite_count as "favoriteCount",
        is_featured as "isFeatured",
        is_verified as "isVerified",
        tags,
        created_at as "createdAt"
      FROM template_library
      WHERE is_active = true
    `;

      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        sql += ` AND category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      if (type) {
        sql += ` AND template_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (search) {
        sql += ` AND (template_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex} OR $${paramIndex} = ANY(tags))`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Sorting
      if (sort === "rating") {
        sql += ` ORDER BY is_featured DESC, rating_average DESC, rating_count DESC`;
      } else if (sort === "popular") {
        sql += ` ORDER BY is_featured DESC, usage_count DESC`;
      } else if (sort === "recent") {
        sql += ` ORDER BY is_featured DESC, created_at DESC`;
      }

      sql += ` LIMIT 50`;

      const result = await query(sql, params);

      res.json({
        templates: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching template library:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/template-library/{templateId}/save:
 *   post:
 *     summary: Save template from library
 *     description: Save a library template to user's templates (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customizedContent: { type: string }
 *     responses:
 *       200:
 *         description: Template saved
 *       404:
 *         description: Template not found
 */
router.post(
  "/template-library/:templateId/save",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { templateId } = req.params;
      const { customizedContent } = req.body;

      // Get template from library
      const template = await query(`SELECT * FROM template_library WHERE id = $1`, [templateId]);

      if (template.rows.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Template not found" },
        });
      }

      // Save to user's templates
      await query(
        `INSERT INTO cleaner_saved_library_templates 
        (cleaner_id, library_template_id, customized_content)
       VALUES ($1, $2, $3)
       ON CONFLICT (cleaner_id, library_template_id) 
       DO UPDATE SET customized_content = EXCLUDED.customized_content, saved_at = NOW()`,
        [cleanerId, templateId, customizedContent || template.rows[0].template_content]
      );

      // Increment usage count
      await query(
        `UPDATE template_library 
       SET usage_count = usage_count + 1 
       WHERE id = $1`,
        [templateId]
      );

      res.json({ message: "Template saved successfully" });
    } catch (error: any) {
      console.error("Error saving template:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to save template" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/template-library/{templateId}/rate:
 *   post:
 *     summary: Rate template
 *     description: Submit rating (1-5) and optional review for a template (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: number, minimum: 1, maximum: 5 }
 *               review: { type: string }
 *     responses:
 *       200:
 *         description: Rating submitted
 *       400:
 *         description: Rating must be 1-5
 */
router.post("/template-library/:templateId/rate", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const { templateId } = req.params;
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Rating must be between 1 and 5" },
      });
    }

    await query(
      `INSERT INTO template_library_ratings (template_id, cleaner_id, rating, review)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (template_id, cleaner_id) 
       DO UPDATE SET rating = EXCLUDED.rating, review = EXCLUDED.review`,
      [templateId, cleanerId, rating, review]
    );

    res.json({ message: "Rating submitted successfully" });
  } catch (error: any) {
    console.error("Error rating template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to rate template" },
    });
  }
});

/**
 * @swagger
 * /cleaner/template-library/saved:
 *   get:
 *     summary: Get saved templates
 *     description: Get templates saved by the cleaner from the library (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: templates array and count
 */
router.get(
  "/template-library/saved",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;

      const result = await query(
        `SELECT 
        st.id,
        st.customized_content as "customizedContent",
        st.is_active as "isActive",
        st.saved_at as "savedAt",
        tl.template_type as type,
        tl.template_name as name,
        tl.template_content as "originalContent",
        tl.variables,
        tl.category
      FROM cleaner_saved_library_templates st
      JOIN template_library tl ON st.library_template_id = tl.id
      WHERE st.cleaner_id = $1 AND st.is_active = true
      ORDER BY st.saved_at DESC`,
        [cleanerId]
      );

      res.json({
        templates: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error("Error fetching saved templates:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch saved templates" },
      });
    }
  })
);

// ============================================
// TOOLTIPS
// ============================================

/**
 * @swagger
 * /cleaner/tooltips:
 *   get:
 *     summary: Get tooltips
 *     description: Get active tooltips not yet dismissed (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: tooltips array and count
 */
router.get("/tooltips", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;

    const result = await query(
      `SELECT 
        t.id,
        t.tooltip_key as "key",
        t.target_element as "targetElement",
        t.title,
        t.content,
        t.position,
        t.trigger_condition as "triggerCondition",
        t.display_order as "displayOrder",
        t.category,
        CASE WHEN ti.id IS NOT NULL THEN true ELSE false END as dismissed
      FROM app_tooltips t
      LEFT JOIN cleaner_tooltip_interactions ti ON t.id = ti.tooltip_id AND ti.cleaner_id = $1
      WHERE t.is_active = true AND ti.id IS NULL
      ORDER BY t.display_order`,
      [cleanerId]
    );

    res.json({
      tooltips: result.rows,
      count: result.rows.length,
    });
  } catch (error: any) {
    console.error("Error fetching tooltips:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to fetch tooltips" },
    });
  }
});

/**
 * @swagger
 * /cleaner/tooltips/{tooltipId}/dismiss:
 *   post:
 *     summary: Dismiss tooltip
 *     description: Mark a tooltip as dismissed (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tooltipId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               helpful: { type: boolean }
 *     responses:
 *       200:
 *         description: Tooltip dismissed
 */
router.post(
  "/tooltips/:tooltipId/dismiss",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const cleanerId = req.user!.id;
      const { tooltipId } = req.params;
      const { helpful } = req.body;

      await query(
        `INSERT INTO cleaner_tooltip_interactions (cleaner_id, tooltip_id, marked_helpful)
       VALUES ($1, $2, $3)
       ON CONFLICT (cleaner_id, tooltip_id) DO UPDATE SET marked_helpful = EXCLUDED.marked_helpful`,
        [cleanerId, tooltipId, helpful]
      );

      // Update tooltip dismissed count in onboarding
      await query(
        `UPDATE cleaner_onboarding_progress
       SET tooltip_dismissed_count = tooltip_dismissed_count + 1
       WHERE cleaner_id = $1`,
        [cleanerId]
      );

      res.json({ message: "Tooltip dismissed" });
    } catch (error: any) {
      console.error("Error dismissing tooltip:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to dismiss tooltip" },
      });
    }
  })
);

/**
 * @swagger
 * /cleaner/template-library:
 *   post:
 *     summary: Publish template to marketplace
 *     description: Create and publish a custom template to the library (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [template_name, template_content, category]
 *             properties:
 *               template_type: { type: string }
 *               template_name: { type: string }
 *               template_content: { type: string }
 *               variables: { type: array }
 *               category: { type: string }
 *               subcategory: { type: string }
 *               description: { type: string }
 *               tags: { type: array }
 *     responses:
 *       201:
 *         description: Template published
 *       400:
 *         description: Validation error
 */
router.post("/template-library", async (req: AuthedRequest, res) => {
  try {
    const cleanerId = req.user!.id;
    const {
      template_type,
      template_name,
      template_content,
      variables,
      category,
      subcategory,
      description,
      tags,
    } = req.body;

    // Validation
    if (!template_name || !template_content || !category) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Template name, content, and category are required",
        },
      });
    }

    // Insert template into library
    const result = await query(
      `INSERT INTO template_library (
        template_type,
        template_name,
        template_content,
        variables,
        category,
        subcategory,
        description,
        author_id,
        tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, template_name as name, created_at as "createdAt"`,
      [
        template_type || "custom",
        template_name,
        template_content,
        JSON.stringify(variables || []),
        category,
        subcategory || null,
        description || "",
        cleanerId,
        tags || [],
      ]
    );

    // Update onboarding progress
    await query(
      `UPDATE cleaner_onboarding_progress
       SET created_custom_template = true, templates_customized = templates_customized + 1
       WHERE cleaner_id = $1`,
      [cleanerId]
    );

    // Check achievements
    await checkAndUnlockAchievements(cleanerId);

    res.status(201).json({
      message: "Template published to marketplace successfully!",
      template: result.rows[0],
    });
  } catch (error: any) {
    console.error("Error publishing template:", error);
    res.status(500).json({
      error: { code: "INTERNAL_ERROR", message: "Failed to publish template" },
    });
  }
});

/**
 * @swagger
 * /cleaner/template-library/{templateId}:
 *   get:
 *     summary: Get single template
 *     description: Get one template from the library by id (cleaners only).
 *     tags: [Cleaner]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get(
  "/template-library/:templateId",
  authedHandler(async (req: AuthedRequest, res) => {
    try {
      const { templateId } = req.params;

      const result = await query(
        `SELECT 
        id,
        template_type as type,
        template_name as name,
        template_content as content,
        variables,
        category,
        subcategory,
        description,
        rating_average as "ratingAverage",
        rating_count as "ratingCount",
        usage_count as "usageCount",
        favorite_count as "favoriteCount",
        is_featured as "isFeatured",
        is_verified as "isVerified",
        tags,
        created_at as "createdAt"
      FROM template_library
      WHERE id = $1 AND is_active = true`,
        [templateId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "Template not found" },
        });
      }

      res.json({ template: result.rows[0] });
    } catch (error: any) {
      console.error("Error fetching template:", error);
      res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch template" },
      });
    }
  })
);

// ============================================
// HELPER FUNCTIONS
// ============================================

async function checkAndUnlockAchievements(cleanerId: string) {
  try {
    // Get user's progress
    const progress = await query(
      `SELECT * FROM cleaner_onboarding_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (progress.rows.length === 0) return;

    const userProgress = progress.rows[0];

    // Get all unearned achievements
    const achievements = await query(
      `SELECT a.* 
       FROM achievements a
       WHERE a.is_active = true 
       AND NOT EXISTS (
         SELECT 1 FROM cleaner_achievements ca 
         WHERE ca.achievement_id = a.id AND ca.cleaner_id = $1
       )`,
      [cleanerId]
    );

    // Check each achievement
    for (const achievement of achievements.rows) {
      const criteria = achievement.criteria;
      let earned = false;

      // Check criteria based on achievement type
      if (criteria.action === "login" && criteria.count === 1) {
        earned = true; // First login
      } else if (
        criteria.profile_completion &&
        userProgress.profile_completion_percentage >= criteria.profile_completion
      ) {
        earned = true;
      } else if (criteria.setup_wizard_completed && userProgress.setup_wizard_completed) {
        earned = true;
      } else if (criteria.first_template_used && userProgress.first_template_used) {
        earned = true;
      } else if (criteria.created_custom_template && userProgress.created_custom_template) {
        earned = true;
      } else if (
        criteria.templates_customized &&
        userProgress.templates_customized >= criteria.templates_customized
      ) {
        earned = true;
      } else if (
        criteria.quick_responses_added &&
        userProgress.quick_responses_added >= criteria.quick_responses_added
      ) {
        earned = true;
      } else if (
        criteria.days_since_signup &&
        userProgress.days_since_signup >= criteria.days_since_signup
      ) {
        earned = true;
      }

      if (earned) {
        await query(
          `INSERT INTO cleaner_achievements (cleaner_id, achievement_id)
           VALUES ($1, $2)
           ON CONFLICT (cleaner_id, achievement_id) DO NOTHING`,
          [cleanerId, achievement.id]
        );
      }
    }
  } catch (error) {
    console.error("Error checking achievements:", error);
  }
}

async function calculateCertificationProgress(
  cleanerId: string,
  requirements: any
): Promise<number> {
  try {
    const progress = await query(
      `SELECT * FROM cleaner_onboarding_progress WHERE cleaner_id = $1`,
      [cleanerId]
    );

    if (progress.rows.length === 0) return 0;

    const userProgress = progress.rows[0];
    const requiredFields = Object.keys(requirements);
    let metCount = 0;

    for (const field of requiredFields) {
      if (userProgress[field] >= requirements[field]) {
        metCount++;
      }
    }

    return Math.round((metCount / requiredFields.length) * 100);
  } catch (error) {
    console.error("Error calculating progress:", error);
    return 0;
  }
}

export default router;
