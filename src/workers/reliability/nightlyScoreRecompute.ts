// src/workers/nightlyScoreRecompute.ts
// Nightly cron worker for recomputing all scores
//
// This worker runs all scoring systems:
// - Client risk scores
// - Cleaner reliability scores
// - Cleaner flexibility evaluations
// - Client flexibility profiles
// - Inconvenience pattern detection

import { logger } from "../lib/logger";
import { ClientRiskService } from "../core/clientRiskService";
import { ReliabilityScoreV2Service } from "../core/reliabilityScoreV2Service";
import { FlexibilityService } from "../core/flexibilityService";
import { InconvenienceService } from "../core/inconvenienceService";

interface NightlyRecomputeResult {
  clientRisk: { processed: number; failed: number };
  cleanerReliability: { processed: number; failed: number };
  cleanerFlexibility: { evaluated: number; badgesAssigned: number; badgesRemoved: number };
  clientFlexibility: { evaluated: number };
  inconveniencePatterns: { clientEventsCreated: number; cleanerEventsCreated: number };
  totalDurationMs: number;
}

export async function runNightlyScoreRecompute(): Promise<NightlyRecomputeResult> {
  const startTime = Date.now();
  
  logger.info("nightly_score_recompute_started");

  const result: NightlyRecomputeResult = {
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
    logger.info("running_inconvenience_pattern_detection");
    result.inconveniencePatterns = await InconvenienceService.runPatternDetection();

    // 2. Recompute client risk scores
    logger.info("running_client_risk_recompute");
    result.clientRisk = await ClientRiskService.recomputeAllClients();

    // 3. Recompute cleaner reliability scores
    logger.info("running_cleaner_reliability_recompute");
    result.cleanerReliability = await ReliabilityScoreV2Service.recomputeAllCleaners();

    // 4. Evaluate cleaner flexibility (Low Flex badge)
    logger.info("running_cleaner_flexibility_evaluation");
    result.cleanerFlexibility = await FlexibilityService.evaluateCleanerFlexibility();

    // 5. Recompute client flexibility profiles
    logger.info("running_client_flexibility_recompute");
    result.clientFlexibility = await FlexibilityService.recomputeClientFlexProfiles();

  } catch (err) {
    logger.error("nightly_score_recompute_error", {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    throw err;
  }

  result.totalDurationMs = Date.now() - startTime;

  logger.info("nightly_score_recompute_completed", {
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

