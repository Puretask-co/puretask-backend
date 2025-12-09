"use strict";
// src/routes/scoring.ts
// REST API endpoints for Scoring Systems (Task 10.1-10.3)
// - Reliability score recompute
// - Client risk score recompute
// - Score viewing endpoints
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoringRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const logger_1 = require("../lib/logger");
const reliabilityScoreV2Service_1 = require("../core/reliabilityScoreV2Service");
const clientRiskService_1 = require("../core/clientRiskService");
const flexibilityService_1 = require("../core/flexibilityService");
const inconvenienceService_1 = require("../core/inconvenienceService");
const db_1 = require("../core/db");
const client_1 = require("../db/client");
const scoringRouter = (0, express_1.Router)();
exports.scoringRouter = scoringRouter;
// All routes require auth
scoringRouter.use(auth_1.authMiddleware);
// ============================================
// Reliability Score Endpoints
// ============================================
/**
 * GET /scoring/reliability/:cleanerId - Get cleaner's reliability score
 */
scoringRouter.get("/reliability/:cleanerId", async (req, res) => {
    const cleanerId = Number(req.params.cleanerId);
    try {
        const metrics = await db_1.coreDb.cleanerMetrics.getByCleanerId(cleanerId);
        const eventPenalty = await db_1.coreDb.cleanerEvents.sumWeightsSince(cleanerId, 60);
        const streakCount = await db_1.coreDb.cleanerWeeklyStreaks.countStreaks(cleanerId, 5);
        const totalJobs = await db_1.coreDb.jobs.countForCleaner(cleanerId);
        // Get current stored score
        const result = await (0, client_1.query)(`SELECT reliability_score, tier FROM cleaner_profiles WHERE user_id = $1`, [String(cleanerId)]);
        const currentScore = Number(result.rows[0]?.reliability_score || 70);
        const currentTier = result.rows[0]?.tier || 'developing';
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
                avgRating: metrics.ratingsCount > 0
                    ? Math.round(metrics.ratingsSum / metrics.ratingsCount * 10) / 10
                    : null,
            },
            eventPenaltySum: eventPenalty,
            weeklyStreakCount: streakCount,
            lastUpdated: metrics.updatedAt.toISOString(),
        });
    }
    catch (err) {
        logger_1.logger.error("get_reliability_score_error", {
            cleanerId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /scoring/reliability/:cleanerId/recompute - Recompute single cleaner
 */
scoringRouter.post("/reliability/:cleanerId/recompute", async (req, res) => {
    const cleanerId = Number(req.params.cleanerId);
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized - only admins can trigger recompute" });
    }
    try {
        const result = await reliabilityScoreV2Service_1.ReliabilityScoreV2Service.recomputeForCleaner(cleanerId);
        logger_1.logger.info("reliability_recomputed_manually", {
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
    }
    catch (err) {
        logger_1.logger.error("reliability_recompute_error", {
            cleanerId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /scoring/reliability/recompute-all - Daily cron: recompute all cleaners
 */
scoringRouter.post("/reliability/recompute-all", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await reliabilityScoreV2Service_1.ReliabilityScoreV2Service.recomputeAllCleaners();
        logger_1.logger.info("all_reliability_recomputed", {
            processed: result.processed,
            failed: result.failed,
        });
        return res.json({
            success: true,
            processed: result.processed,
            failed: result.failed,
        });
    }
    catch (err) {
        logger_1.logger.error("reliability_recompute_all_error", {
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// Client Risk Score Endpoints
// ============================================
/**
 * GET /scoring/risk/:clientId - Get client's risk score
 */
scoringRouter.get("/risk/:clientId", async (req, res) => {
    const clientId = Number(req.params.clientId);
    try {
        const riskScore = await db_1.coreDb.clientRiskScores.get(clientId);
        const eventSum = await db_1.coreDb.clientRiskEvents.sumWeightsSince(clientId, 60);
        const hasRecentEvents = await db_1.coreDb.clientRiskEvents.existsSince(clientId, 7);
        const lateReschedules14d = await db_1.coreDb.clientRiskEvents.countLateReschedulesLast14Days(clientId);
        return res.json({
            clientId,
            currentScore: riskScore?.riskScore || 0,
            currentBand: riskScore?.riskBand || 'normal',
            eventWeightSum60d: eventSum,
            hasEventsLast7d: hasRecentEvents,
            lateReschedulesLast14d: lateReschedules14d,
            patternTriggered: lateReschedules14d >= 3,
            lastUpdated: riskScore?.updatedAt?.toISOString() || null,
        });
    }
    catch (err) {
        logger_1.logger.error("get_risk_score_error", {
            clientId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /scoring/risk/:clientId/recompute - Recompute single client
 */
scoringRouter.post("/risk/:clientId/recompute", async (req, res) => {
    const clientId = Number(req.params.clientId);
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await clientRiskService_1.ClientRiskService.recomputeForClient(clientId);
        logger_1.logger.info("risk_recomputed_manually", {
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
    }
    catch (err) {
        logger_1.logger.error("risk_recompute_error", {
            clientId,
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /scoring/risk/recompute-all - Daily cron: recompute all clients
 */
scoringRouter.post("/risk/recompute-all", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await clientRiskService_1.ClientRiskService.recomputeAllClients();
        logger_1.logger.info("all_risk_recomputed", {
            processed: result.processed,
            failed: result.failed,
        });
        return res.json({
            success: true,
            processed: result.processed,
            failed: result.failed,
        });
    }
    catch (err) {
        logger_1.logger.error("risk_recompute_all_error", {
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// Flexibility Endpoints
// ============================================
/**
 * POST /scoring/flexibility/evaluate-cleaners - Evaluate cleaner flexibility
 */
scoringRouter.post("/flexibility/evaluate-cleaners", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await flexibilityService_1.FlexibilityService.evaluateCleanerFlexibility();
        return res.json({
            success: true,
            evaluated: result.evaluated,
            badgesAssigned: result.badgesAssigned,
            badgesRemoved: result.badgesRemoved,
        });
    }
    catch (err) {
        logger_1.logger.error("flexibility_evaluate_error", {
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
/**
 * POST /scoring/flexibility/recompute-clients - Recompute client flex profiles
 */
scoringRouter.post("/flexibility/recompute-clients", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await flexibilityService_1.FlexibilityService.recomputeClientFlexProfiles();
        return res.json({
            success: true,
            evaluated: result.evaluated,
        });
    }
    catch (err) {
        logger_1.logger.error("client_flex_recompute_error", {
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// Inconvenience Pattern Detection
// ============================================
/**
 * POST /scoring/inconvenience/detect-patterns - Run pattern detection
 */
scoringRouter.post("/inconvenience/detect-patterns", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    try {
        const result = await inconvenienceService_1.InconvenienceService.runPatternDetection();
        return res.json({
            success: true,
            clientEventsCreated: result.clientEventsCreated,
            cleanerEventsCreated: result.cleanerEventsCreated,
        });
    }
    catch (err) {
        logger_1.logger.error("inconvenience_pattern_error", {
            error: err.message,
        });
        return res.status(500).json({ error: err.message });
    }
});
// ============================================
// Combined Nightly Recompute
// ============================================
/**
 * POST /scoring/nightly-recompute - Run all nightly scoring jobs
 */
scoringRouter.post("/nightly-recompute", async (req, res) => {
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: "Unauthorized" });
    }
    const startTime = Date.now();
    const results = {};
    try {
        // 1. Inconvenience pattern detection (creates events)
        results.inconvenience = await inconvenienceService_1.InconvenienceService.runPatternDetection();
        // 2. Client risk scores
        results.clientRisk = await clientRiskService_1.ClientRiskService.recomputeAllClients();
        // 3. Cleaner reliability scores
        results.cleanerReliability = await reliabilityScoreV2Service_1.ReliabilityScoreV2Service.recomputeAllCleaners();
        // 4. Cleaner flexibility evaluation
        results.cleanerFlexibility = await flexibilityService_1.FlexibilityService.evaluateCleanerFlexibility();
        // 5. Client flexibility profiles
        results.clientFlexibility = await flexibilityService_1.FlexibilityService.recomputeClientFlexProfiles();
        const durationMs = Date.now() - startTime;
        logger_1.logger.info("nightly_recompute_completed", {
            durationMs,
            results,
        });
        return res.json({
            success: true,
            durationMs,
            results,
        });
    }
    catch (err) {
        logger_1.logger.error("nightly_recompute_error", {
            error: err.message,
            partialResults: results,
        });
        return res.status(500).json({
            error: err.message,
            partialResults: results,
        });
    }
});
