// src/core/db/index.ts
// Database layer exports for all core systems

// Reliability Engine DB (Tasks 1.1-1.5)
export * from './reliabilityDb';

// Client Risk Engine DB (Tasks 2.1-2.5)
export * from './clientRiskDb';

// Reschedule System DB (Tasks 3.1-3.9)
export * from './rescheduleDb';

// Cancellation System DB (Tasks 4.1-4.4)
export * from './cancellationDb';

// Matching System DB (Tasks 5.1-5.2)
export * from './matchingDb';

// Re-export as namespaced objects for backward compatibility
import * as reliabilityDb from './reliabilityDb';
import * as clientRiskDb from './clientRiskDb';
import * as rescheduleDb from './rescheduleDb';
import * as cancellationDb from './cancellationDb';
import * as matchingDb from './matchingDb';

/**
 * Unified database layer for core systems.
 * 
 * This object provides a unified interface to all database operations
 * needed by the core scoring and operational engines.
 */
export const coreDb = {
  // Reliability Engine
  cleanerMetrics: {
    getByCleanerId: reliabilityDb.getCleanerMetricsById,
  },
  cleanerEvents: {
    sumWeightsSince: reliabilityDb.sumCleanerEventWeightsSince,
    insert: reliabilityDb.insertCleanerEvent,
  },
  cleanerWeeklyStreaks: {
    countStreaks: reliabilityDb.countCleanerWeeklyStreaks,
    update: reliabilityDb.updateCleanerWeeklyStreak,
  },
  cleaners: {
    updateReliability: reliabilityDb.updateCleanerReliability,
    getActiveCleaners: reliabilityDb.getActiveCleaners,
    getCandidatesForJob: matchingDb.getCandidatesForJob,
  },
  jobs: {
    countForCleaner: reliabilityDb.countJobsForCleaner,
    updateStartTime: rescheduleDb.updateJobStartTime,
    assignCleaner: matchingDb.assignCleanerToJob,
    getWithClientProfile: matchingDb.getJobWithClientProfile,
  },

  // Client Risk Engine
  clientRiskEvents: {
    sumWeightsSince: clientRiskDb.sumClientRiskEventWeightsSince,
    existsSince: clientRiskDb.clientRiskEventsExistSince,
    getClientsWithEventsSince: clientRiskDb.getClientsWithEventsSince,
    insert: clientRiskDb.insertClientRiskEvent,
    logEvents: clientRiskDb.logClientRiskEvents,
    countLateReschedulesLast14Days: clientRiskDb.countLateReschedulesLast14Days,
  },
  clientRiskScores: {
    upsert: clientRiskDb.upsertClientRiskScore,
    get: clientRiskDb.getClientRiskScore,
  },
  clients: {
    getActiveClients: clientRiskDb.getActiveClients,
    getGraceRemaining: cancellationDb.getClientGraceRemaining,
    useGrace: cancellationDb.useGraceCancellation,
  },

  // Reschedule System
  rescheduleEvents: {
    insert: rescheduleDb.insertRescheduleEvent,
    update: rescheduleDb.updateRescheduleEvent,
    findById: rescheduleDb.findRescheduleEventById,
    countForJob: rescheduleDb.countReschedulesForJob,
    countLateClientReschedulesLt24LastNDays: rescheduleDb.countLateClientReschedulesLt24LastNDays,
    getPendingForJob: rescheduleDb.getPendingReschedulesForJob,
    getCleanerStats: rescheduleDb.getCleanerRescheduleStats,
  },
  availability: {
    isCleanerAvailableForRange: rescheduleDb.isCleanerAvailableForRange,
  },
  flexibility: {
    logCleanerDeclineReasonableRequest: rescheduleDb.logCleanerDeclineReasonableRequest,
  },

  // Cancellation System
  cancellationEvents: {
    insert: cancellationDb.insertCancellationEvent,
    getClientStats: cancellationDb.getClientCancellationStats,
    getCleanerStats: cancellationDb.getCleanerCancellationStats,
  },
  credits: {
    applyCancellation: cancellationDb.applyCancellationCredits,
  },
  noShow: {
    markClientNoShow: cancellationDb.markClientNoShow,
    markCleanerNoShow: cancellationDb.markCleanerNoShow,
  },

  // Matching System
  matching: {
    logRecommendation: matchingDb.logMatchRecommendation,
    getHistoryForJob: matchingDb.getMatchHistoryForJob,
  },

  // Scoring Events (unified interface)
  scoring: {
    logClientRiskEvents: clientRiskDb.logClientRiskEvents,
    logCleanerEvents: async (events: Array<{
      cleanerId: number;
      jobId?: number | null;
      eventType: string;
      weight: number;
      metadata?: Record<string, any>;
    }>) => {
      for (const event of events) {
        await reliabilityDb.insertCleanerEvent(event);
      }
    },
  },
};

