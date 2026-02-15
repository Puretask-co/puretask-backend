// src/routes/scoring.ts
// REST API endpoints for Scoring Systems (Task 10.1-10.3)
// - Reliability score recompute
// - Client risk score recompute
// - Score viewing endpoints

import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { ReliabilityScoreV2Service } from "../core/reliabilityScoreV2Service";
import { ClientRiskService } from "../core/clientRiskService";
import { FlexibilityService } from "../core/flexibilityService";
import { InconvenienceService } from "../core/inconvenienceService";
import { coreDb } from "../core/db";
import { query } from "../db/client";

const scoringRouter = Router();

// All routes require auth
scoringRouter.use(requireAuth);

// ============================================
// Reliability Score Endpoints
// ============================================

/**
 * @swagger
 * /scoring/reliability/{cleanerId}:
 *   get:
 *     summary: Get reliability score
 *     description: Get cleaner's reliability score with metrics breakdown.
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cleanerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reliability score and metrics
 */
scoringRouter.get("/reliability/:cleanerId", async (req: AuthedRequest, res) => {
  const cleanerId = Number(req.params.cleanerId);

  try {
    const metrics = await coreDb.cleanerMetrics.getByCleanerId(cleanerId);
    const eventPenalty = await coreDb.cleanerEvents.sumWeightsSince(cleanerId, 60);
    const streakCount = await coreDb.cleanerWeeklyStreaks.countStreaks(cleanerId, 5);
    const totalJobs = await coreDb.jobs.countForCleaner(cleanerId);

    // Get current stored score
    const result = await query<{ reliability_score: string; tier: string }>(
      `SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`,
      [String(cleanerId)]
    );

    const currentScore = Number(result.rows[0]?.reliability_score || 70);
    const currentTier = result.rows[0]?.tier || "developing";

    return res.json({
      cleanerId,
      currentScore,
      currentTier,
      totalJobsCompleted: totalJobs,
      metrics: {
        totalJobsWindow: metrics.totalJobsWindow,
        attendedJobs: metrics.attendedJobs,
        noShowJobs: metrics.noShowJobs,
        onTimeCheckins: metrics.onTimeCheckins,
        photoCompliantJobs: metrics.photoCompliantJobs,
        communicationOkJobs: metrics.communicationOkJobs,
        completionOkJobs: metrics.completionOkJobs,
        ratingsSum: metrics.ratingsSum,
        ratingsCount: metrics.ratingsCount,
        avgRating:
          metrics.ratingsCount > 0
            ? Math.round((metrics.ratingsSum / metrics.ratingsCount) * 10) / 10
            : null,
      },
      eventPenaltySum: eventPenalty,
      weeklyStreakCount: streakCount,
      lastUpdated: metrics.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error("get_reliability_score_error", {
      cleanerId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /scoring/reliability/{cleanerId}/recompute:
 *   post:
 *     summary: Recompute reliability score
 *     description: Recompute reliability score for a cleaner (admin only).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cleanerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recomputed score
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/reliability/:cleanerId/recompute", async (req: AuthedRequest, res) => {
  const cleanerId = Number(req.params.cleanerId);
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized - only admins can trigger recompute" });
  }

  try {
    const result = await ReliabilityScoreV2Service.recomputeForCleaner(cleanerId);

    logger.info("reliability_recomputed_manually", {
      cleanerId,
      newScore: result.reliabilityScore,
      newTier: result.tier,
    });

    return res.json({
      success: true,
      cleanerId,
      newScore: result.reliabilityScore,
      newTier: result.tier,
      breakdown: {
        baseBehaviorScore: Math.round(result.baseBehaviorScore * 10) / 10,
        streakBonus: result.streakBonus,
        eventPenaltySum: result.eventPenaltySum,
      },
      stats: result.stats,
    });
  } catch (err) {
    logger.error("reliability_recompute_error", {
      cleanerId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /scoring/reliability/recompute-all - Daily cron: recompute all cleaners
 */
scoringRouter.post("/reliability/recompute-all", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await ReliabilityScoreV2Service.recomputeAllCleaners();

    logger.info("all_reliability_recomputed", {
      processed: result.processed,
      failed: result.failed,
    });

    return res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (err) {
    logger.error("reliability_recompute_all_error", {
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// Client Risk Score Endpoints
// ============================================

/**
 * @swagger
 * /scoring/risk/{clientId}:
 *   get:
 *     summary: Get client risk score
 *     description: Get client's risk score with metrics breakdown.
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Risk score and metrics
 */
scoringRouter.get("/risk/:clientId", async (req: AuthedRequest, res) => {
  const clientId = Number(req.params.clientId);

  try {
    const riskScore = await coreDb.clientRiskScores.get(clientId);
    const eventSum = await coreDb.clientRiskEvents.sumWeightsSince(clientId, 60);
    const hasRecentEvents = await coreDb.clientRiskEvents.existsSince(clientId, 7);
    const lateReschedules14d =
      await coreDb.clientRiskEvents.countLateReschedulesLast14Days(clientId);

    return res.json({
      clientId,
      currentScore: riskScore?.riskScore || 0,
      currentBand: riskScore?.riskBand || "normal",
      eventWeightSum60d: eventSum,
      hasEventsLast7d: hasRecentEvents,
      lateReschedulesLast14d: lateReschedules14d,
      patternTriggered: lateReschedules14d >= 3,
      lastUpdated: riskScore?.updatedAt?.toISOString() || null,
    });
  } catch (err) {
    logger.error("get_risk_score_error", {
      clientId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /scoring/risk/{clientId}/recompute:
 *   post:
 *     summary: Recompute client risk score
 *     description: Recompute risk score for a client (admin only).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: clientId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Recomputed risk score
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/risk/:clientId/recompute", async (req: AuthedRequest, res) => {
  const clientId = Number(req.params.clientId);
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await ClientRiskService.recomputeForClient(clientId);

    logger.info("risk_recomputed_manually", {
      clientId,
      newScore: result.riskScore,
      newBand: result.riskBand,
    });

    return res.json({
      success: true,
      clientId,
      newScore: result.riskScore,
      newBand: result.riskBand,
      breakdown: {
        baseRisk: result.baseRisk,
        patternBonuses: result.patternBonuses,
        decayApplied: result.decayApplied,
      },
      stats: result.stats,
    });
  } catch (err) {
    logger.error("risk_recompute_error", {
      clientId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /scoring/risk/recompute-all:
 *   post:
 *     summary: Recompute all client risk scores
 *     description: Recompute risk scores for all clients (admin only, daily cron).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recompute results
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/risk/recompute-all", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await ClientRiskService.recomputeAllClients();

    logger.info("all_risk_recomputed", {
      processed: result.processed,
      failed: result.failed,
    });

    return res.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
    });
  } catch (err) {
    logger.error("risk_recompute_all_error", {
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// Flexibility Endpoints
// ============================================

/**
 * @swagger
 * /scoring/flexibility/evaluate-cleaners:
 *   post:
 *     summary: Evaluate cleaner flexibility
 *     description: Evaluate cleaner flexibility and assign badges (admin only).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Evaluation results
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/flexibility/evaluate-cleaners", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await FlexibilityService.evaluateCleanerFlexibility();

    return res.json({
      success: true,
      evaluated: result.evaluated,
      badgesAssigned: result.badgesAssigned,
      badgesRemoved: result.badgesRemoved,
    });
  } catch (err) {
    logger.error("flexibility_evaluate_error", {
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /scoring/flexibility/recompute-clients:
 *   post:
 *     summary: Recompute client flexibility profiles
 *     description: Recompute client flexibility profiles (admin only).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recompute results
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/flexibility/recompute-clients", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await FlexibilityService.recomputeClientFlexProfiles();

    return res.json({
      success: true,
      evaluated: result.evaluated,
    });
  } catch (err) {
    logger.error("client_flex_recompute_error", {
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// Inconvenience Pattern Detection
// ============================================

/**
 * @swagger
 * /scoring/inconvenience/detect-patterns:
 *   post:
 *     summary: Detect inconvenience patterns
 *     description: Run pattern detection for inconvenience scoring (admin only).
 *     tags: [Scoring]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pattern detection results
 *       403:
 *         description: Forbidden - admin only
 */
scoringRouter.post("/inconvenience/detect-patterns", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const result = await InconvenienceService.runPatternDetection();

    return res.json({
      success: true,
      clientEventsCreated: result.clientEventsCreated,
      cleanerEventsCreated: result.cleanerEventsCreated,
    });
  } catch (err) {
    logger.error("inconvenience_pattern_error", {
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// Combined Nightly Recompute
// ============================================

/**
 * POST /scoring/nightly-recompute - Run all nightly scoring jobs
 */
scoringRouter.post("/nightly-recompute", async (req: AuthedRequest, res) => {
  const userRole = req.user?.role;

  if (userRole !== "admin") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  try {
    // 1. Inconvenience pattern detection (creates events)
    results.inconvenience = await InconvenienceService.runPatternDetection();

    // 2. Client risk scores
    results.clientRisk = await ClientRiskService.recomputeAllClients();

    // 3. Cleaner reliability scores
    results.cleanerReliability = await ReliabilityScoreV2Service.recomputeAllCleaners();

    // 4. Cleaner flexibility evaluation
    results.cleanerFlexibility = await FlexibilityService.evaluateCleanerFlexibility();

    // 5. Client flexibility profiles
    results.clientFlexibility = await FlexibilityService.recomputeClientFlexProfiles();

    const durationMs = Date.now() - startTime;

    logger.info("nightly_recompute_completed", {
      durationMs,
      results,
    });

    return res.json({
      success: true,
      durationMs,
      results,
    });
  } catch (err) {
    logger.error("nightly_recompute_error", {
      error: (err as Error).message,
      partialResults: results,
    });
    return res.status(500).json({
      error: (err as Error).message,
      partialResults: results,
    });
  }
});

export { scoringRouter };
