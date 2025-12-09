"use strict";
// src/workers/nightlyScoreRecompute.ts
// Nightly cron worker for recomputing all scores
//
// This worker runs all scoring systems:
// - Client risk scores
// - Cleaner reliability scores
// - Cleaner flexibility evaluations
// - Client flexibility profiles
// - Inconvenience pattern detection
Object.defineProperty(exports, "__esModule", { value: true });
exports.runNightlyScoreRecompute = runNightlyScoreRecompute;
const logger_1 = require("../lib/logger");
const clientRiskService_1 = require("../core/clientRiskService");
const reliabilityScoreV2Service_1 = require("../core/reliabilityScoreV2Service");
const flexibilityService_1 = require("../core/flexibilityService");
const inconvenienceService_1 = require("../core/inconvenienceService");
async function runNightlyScoreRecompute() {
    const startTime = Date.now();
    logger_1.logger.info("nightly_score_recompute_started");
    const result = {
        clientRisk: { processed: 0, failed: 0 },
        cleanerReliability: { processed: 0, failed: 0 },
        cleanerFlexibility: { evaluated: 0, badgesAssigned: 0, badgesRemoved: 0 },
        clientFlexibility: { evaluated: 0 },
        inconveniencePatterns: { clientEventsCreated: 0, cleanerEventsCreated: 0 },
        totalDurationMs: 0,
    };
    try {
        // 1. Run inconvenience pattern detection FIRST
        // (This creates events that feed into risk/reliability)
        logger_1.logger.info("running_inconvenience_pattern_detection");
        result.inconveniencePatterns = await inconvenienceService_1.InconvenienceService.runPatternDetection();
        // 2. Recompute client risk scores
        logger_1.logger.info("running_client_risk_recompute");
        result.clientRisk = await clientRiskService_1.ClientRiskService.recomputeAllClients();
        // 3. Recompute cleaner reliability scores
        logger_1.logger.info("running_cleaner_reliability_recompute");
        result.cleanerReliability = await reliabilityScoreV2Service_1.ReliabilityScoreV2Service.recomputeAllCleaners();
        // 4. Evaluate cleaner flexibility (Low Flex badge)
        logger_1.logger.info("running_cleaner_flexibility_evaluation");
        result.cleanerFlexibility = await flexibilityService_1.FlexibilityService.evaluateCleanerFlexibility();
        // 5. Recompute client flexibility profiles
        logger_1.logger.info("running_client_flexibility_recompute");
        result.clientFlexibility = await flexibilityService_1.FlexibilityService.recomputeClientFlexProfiles();
    }
    catch (err) {
        logger_1.logger.error("nightly_score_recompute_error", {
            error: err.message,
            stack: err.stack,
        });
        throw err;
    }
    result.totalDurationMs = Date.now() - startTime;
    logger_1.logger.info("nightly_score_recompute_completed", {
        ...result,
        durationSeconds: Math.round(result.totalDurationMs / 1000),
    });
    return result;
}
// Standalone execution
if (require.main === module) {
    runNightlyScoreRecompute()
        .then((result) => {
        console.log("Nightly score recompute completed:", JSON.stringify(result, null, 2));
        process.exit(0);
    })
        .catch((err) => {
        console.error("Nightly score recompute failed:", err);
        process.exit(1);
    });
}
