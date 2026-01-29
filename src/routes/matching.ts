// src/routes/matching.ts
// REST API endpoints for Matching System (Task 5.2)

import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/authCanonical";
import { logger } from "../lib/logger";
import { MatchingService } from "../core/matchingService";
import { coreDb } from "../core/db";

const matchingRouter = Router();

// All routes require auth
matchingRouter.use(requireAuth);

/**
 * @swagger
 * /matching/jobs/{jobId}/candidates:
 *   get:
 *     summary: Get ranked cleaner candidates
 *     description: Get ranked list of cleaner candidates for a job based on matching algorithm.
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Ranked candidates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId: { type: 'string' }
 *                 clientRiskBand: { type: 'string' }
 *                 totalCandidates: { type: 'integer' }
 *                 candidates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       rank: { type: 'integer' }
 *                       cleanerId: { type: 'string' }
 *                       matchScore: { type: 'number' }
 *                       tier: { type: 'string' }
 *                       reliabilityScore: { type: 'number' }
 *                       distanceKm: { type: 'number' }
 *                       isRepeatClient: { type: 'boolean' }
 *                       breakdown: { type: 'object' }
 *       404:
 *         description: Job not found
 */
matchingRouter.get("/jobs/:jobId/candidates", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const maxResults = Number(req.query.limit || 10);

  try {
    // Get job with client profile
    const jobData = await coreDb.jobs.getWithClientProfile(jobId);
    if (!jobData) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get matching context
    const context = await MatchingService.getMatchingContext(jobId);
    if (!context) {
      return res.status(500).json({ error: "Could not build matching context" });
    }

    // Get ranked candidates
    const matchingResult = await MatchingService.findCandidates(context);
    const ranked = matchingResult.candidates;

    // Log recommendations for analytics
    for (let i = 0; i < ranked.length; i++) {
      await coreDb.matching.logRecommendation({
        jobId,
        clientId: context.client.id,
        cleanerId: ranked[i].cleaner.id,
        matchScore: ranked[i].score,
        rank: i + 1,
        breakdown: ranked[i].factors as unknown as Record<string, unknown>,
      });
    }

    logger.info("matching_candidates_retrieved", {
      jobId,
      candidateCount: ranked.length,
      topScore: ranked[0]?.score,
    });

    return res.json({
      jobId,
      clientRiskBand: context.clientRisk.riskBand,
      totalCandidates: ranked.length,
      candidates: ranked.slice(0, maxResults).map((r, index) => ({
        rank: index + 1,
        cleanerId: r.cleaner.id,
        matchScore: Math.round(r.score * 100) / 100,
        tier: r.cleaner.reliabilityTier,
        reliabilityScore: r.cleaner.reliabilityScore,
        distanceKm: Math.round(r.distanceKm * 10) / 10,
        isRepeatClient: r.isRepeatClient,
        lowFlexibilityBadge: r.cleaner.flexibilityBadgeActive,
        breakdown: {
          reliability: Math.round(r.factors.reliabilityPoints * 100) / 100,
          distance: Math.round(r.factors.distancePenalty * 100) / 100,
          repeatBonus: r.factors.repeatClientBonus,
          flexibilityScore: Math.round(r.factors.flexibilityBonus * 100) / 100,
          riskAlignment: Math.round(r.factors.riskPenalty * 100) / 100,
        },
      })),
    });

  } catch (err) {
    logger.error("matching_candidates_error", {
      jobId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * @swagger
 * /matching/jobs/{jobId}/auto-assign:
 *   post:
 *     summary: Auto-assign best cleaner
 *     description: Automatically assign the best matching cleaner to a job. Admin only.
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cleaner auto-assigned
 *       403:
 *         description: Forbidden - admin only
 *       404:
 *         description: Job not found
 */
matchingRouter.post("/jobs/:jobId/auto-assign", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const userRole = req.user?.role;

  // Only admins or system can auto-assign
  if (userRole !== 'admin') {
    return res.status(403).json({ error: "Unauthorized - only admins can auto-assign" });
  }

  try {
    // Get matching context
    const context = await MatchingService.getMatchingContext(jobId);
    if (!context) {
      return res.status(404).json({ error: "Job not found or could not build matching context" });
    }

    // Get recommended cleaner (auto-match mode)
    const matchingResult = await MatchingService.findCandidates(context);
    const candidates = matchingResult.candidates;
    
    if (candidates.length === 0) {
      logger.warn("no_candidates_for_auto_assign", { jobId });
      return res.status(404).json({
        success: false,
        error: "No available cleaners found for this job",
        suggestions: [
          "Try expanding the time window",
          "Check if the location is within service area",
          "Manually assign a cleaner",
        ],
      });
    }

    const bestMatch = candidates[0];

    // Assign the cleaner
    await coreDb.jobs.assignCleaner(jobId, bestMatch.cleaner.id, bestMatch.score);

    // Log the recommendation
    await coreDb.matching.logRecommendation({
      jobId,
      clientId: context.client.id,
      cleanerId: bestMatch.cleaner.id,
      matchScore: bestMatch.score,
      rank: 1,
      breakdown: bestMatch.factors as unknown as Record<string, unknown>,
    });

    logger.info("job_auto_assigned", {
      jobId,
      cleanerId: bestMatch.cleaner.id,
      matchScore: bestMatch.score,
    });

    return res.json({
      success: true,
      assignment: {
        jobId,
        cleanerId: bestMatch.cleaner.id,
        matchScore: Math.round(bestMatch.score * 100) / 100,
        tier: bestMatch.cleaner.reliabilityTier,
        reliabilityScore: bestMatch.cleaner.reliabilityScore,
        isRepeatClient: bestMatch.isRepeatClient,
      },
    });

  } catch (err) {
    logger.error("auto_assign_error", {
      jobId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// GET /matching/jobs/:id/history - Get match history for a job
// ============================================

matchingRouter.get("/jobs/:jobId/history", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);

  try {
    const history = await coreDb.matching.getHistoryForJob(jobId);

    return res.json({
      jobId,
      recommendations: history.map(h => ({
        cleanerId: h.cleanerId,
        matchScore: Math.round(h.matchScore * 100) / 100,
        rank: h.rank,
        generatedAt: h.generatedAt.toISOString(),
      })),
    });

  } catch (err) {
    logger.error("match_history_error", {
      jobId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================
// GET /matching/explain/:jobId/:cleanerId - Explain a match score
// ============================================

matchingRouter.get("/explain/:jobId/:cleanerId", async (req: AuthedRequest, res) => {
  const jobId = Number(req.params.jobId);
  const cleanerId = Number(req.params.cleanerId);

  try {
    // Get matching context
    const context = await MatchingService.getMatchingContext(jobId);
    if (!context) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Get all candidates to find this cleaner
    const matchingResult = await MatchingService.findCandidates(context);
    const ranked = matchingResult.candidates;
    
    const cleanerResult = ranked.find(r => r.cleaner.id === cleanerId);
    if (!cleanerResult) {
      return res.status(404).json({ 
        error: "Cleaner not found in candidate pool",
        possibleReasons: [
          "Cleaner is not available at the requested time",
          "Cleaner is outside the service area",
          "Cleaner is at max capacity for the day",
          "Cleaner does not support this job type",
        ],
      });
    }

    const explanation: string[] = [];

    // Build human-readable explanation
    if (cleanerResult.factors.reliabilityPoints > 150) {
      explanation.push(`High reliability score (${cleanerResult.cleaner.reliabilityScore}/100)`);
    }
    if (cleanerResult.isRepeatClient) {
      explanation.push("Has successfully completed jobs for you before");
    }
    if (cleanerResult.distanceKm < 5) {
      explanation.push(`Close proximity (${Math.round(cleanerResult.distanceKm)}km away)`);
    }
    if (cleanerResult.cleaner.reliabilityTier === 'Elite') {
      explanation.push("Elite tier cleaner - top performer");
    } else if (cleanerResult.cleaner.reliabilityTier === 'Pro') {
      explanation.push("Pro tier cleaner - highly rated");
    }

    return res.json({
      jobId,
      cleanerId,
      matchScore: Math.round(cleanerResult.score * 100) / 100,
      rank: ranked.findIndex(r => r.cleaner.id === cleanerId) + 1,
      explanation,
      breakdown: {
        reliability: {
          score: Math.round(cleanerResult.factors.reliabilityPoints * 100) / 100,
          description: `Based on ${cleanerResult.cleaner.reliabilityScore}/100 reliability score`,
        },
        distance: {
          score: -Math.round(cleanerResult.factors.distancePenalty * 100) / 100,
          description: `${Math.round(cleanerResult.distanceKm)}km from job location`,
        },
        repeatClient: {
          score: cleanerResult.factors.repeatClientBonus,
          description: cleanerResult.isRepeatClient 
            ? "Bonus for previous successful jobs with you"
            : "No prior history with this client",
        },
        flexibility: {
          score: Math.round(cleanerResult.factors.flexibilityBonus * 100) / 100,
          description: cleanerResult.cleaner.flexibilityBadgeActive
            ? "Low flexibility badge (prefers fixed schedules)"
            : "Flexible with schedule changes",
        },
        riskAlignment: {
          score: -Math.round(cleanerResult.factors.riskPenalty * 100) / 100,
          description: cleanerResult.factors.riskPenalty > 0
            ? "Adjustment based on client risk profile"
            : "Good risk alignment",
        },
      },
    });

  } catch (err) {
    logger.error("match_explain_error", {
      jobId,
      cleanerId,
      error: (err as Error).message,
    });
    return res.status(500).json({ error: (err as Error).message });
  }
});

export { matchingRouter };
