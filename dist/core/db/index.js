"use strict";
// src/core/db/index.ts
// Database layer exports for all core systems
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreDb = void 0;
// Reliability Engine DB (Tasks 1.1-1.5)
__exportStar(require("./reliabilityDb"), exports);
// Client Risk Engine DB (Tasks 2.1-2.5)
__exportStar(require("./clientRiskDb"), exports);
// Reschedule System DB (Tasks 3.1-3.9)
__exportStar(require("./rescheduleDb"), exports);
// Cancellation System DB (Tasks 4.1-4.4)
__exportStar(require("./cancellationDb"), exports);
// Matching System DB (Tasks 5.1-5.2)
__exportStar(require("./matchingDb"), exports);
// Re-export as namespaced objects for backward compatibility
const reliabilityDb = __importStar(require("./reliabilityDb"));
const clientRiskDb = __importStar(require("./clientRiskDb"));
const rescheduleDb = __importStar(require("./rescheduleDb"));
const cancellationDb = __importStar(require("./cancellationDb"));
const matchingDb = __importStar(require("./matchingDb"));
/**
 * Unified database layer for core systems.
 *
 * This object provides a unified interface to all database operations
 * needed by the core scoring and operational engines.
 */
exports.coreDb = {
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
        logCleanerEvents: async (events) => {
            for (const event of events) {
                await reliabilityDb.insertCleanerEvent(event);
            }
        },
    },
};
