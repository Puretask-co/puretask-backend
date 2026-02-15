// src/core/config.ts
// Configuration constants for all core systems

import { CancellationWindow } from "./types";
import { RiskBand } from "./scoring";

// ============================================
// Cancellation System Configuration
// ============================================

export const CANCELLATION_CONFIG = {
  grace: {
    total: 2, // Total grace cancellations per client (lifetime)
  },
  riskWeights: {
    clientLateCancel24_48: 3,
    clientLateCancelLt24: 5,
    clientLateCancel24_48WithGrace: 1,
    clientLateCancelLt24WithGrace: 2,
    clientExtraAfterDeclined: 1,
    clientNoShow: 20, // Heavy penalty for no-shows
  },
  reliabilityWeights: {
    cleanerCancelGt48: 0, // No penalty for >48h notice
    cleanerCancel24_48: -8, // 24-48h cancellation
    cleanerCancelLt24: -12, // <24h cancellation
    cleanerNoShow: -25, // No-show is severe
    cleanerEmergencyCancelAdjustment: -5, // Softer penalty for emergencies
  },
  feeSplits: {
    // How cancellation fees are split between cleaner and platform
    byWindow(window: CancellationWindow): { cleanerCompPct: number; platformCompPct: number } {
      switch (window) {
        case "50%":
          return { cleanerCompPct: 0.7, platformCompPct: 0.3 };
        case "100%":
          return { cleanerCompPct: 0.8, platformCompPct: 0.2 };
        case "free":
        default:
          return { cleanerCompPct: 0, platformCompPct: 0 };
      }
    },
    clientNoShowCleanerCompPct: 0.9, // Cleaner gets 90% for client no-shows
    clientNoShowPlatformCompPct: 0.1,
  },
  bonusCredits: {
    cleanerNoShowToClient: 50, // Apology credits when cleaner no-shows
    systemErrorToClient: 25, // Platform error compensation
  },
};

// ============================================
// Client Risk Score Configuration
// ============================================

export const CLIENT_RISK_CONFIG = {
  bands: {
    getBand(score: number): RiskBand {
      if (score <= 9) return "normal";
      if (score <= 19) return "mild";
      if (score <= 39) return "elevated";
      if (score <= 59) return "high";
      return "critical";
    },
  },
  windows: {
    shortDays: 14, // Short-term pattern detection
    longDays: 60, // Long-term event tracking
  },
  weights: {
    lateRescheduleLt24: 1,
    clientCancel24_48: 3,
    clientCancel24_48WithGrace: 1,
    clientCancelLt24: 5,
    clientCancelLt24WithGrace: 2,
    clientCancelAfterRescheduleDeclined: 1, // Extra weight
    clientNoShow: 20,
    disputeClientAtFault: 10,
    cardDecline: 1,
    chargeback: 20,
    abuse: 20,
    fraudBlock: 100,
  },
  caps: {
    disputeClientAtFaultMax: 20, // Max sum from disputes in 60d
    cardDeclineTotalMax: 3, // Max risk from card declines
  },
  patterns: {
    // 3+ late reschedules <24h in last 14 days triggers bonus
    lateReschedulePatternThreshold: 3,
    lateReschedulePatternBonus: 10,
    // Inconvenience patterns
    highInconvenienceThreshold: 3,
    highInconvenienceBonus: 5,
    veryHighInconvenienceThreshold: 5,
    veryHighInconvenienceBonus: 5, // Additional
  },
  decay: {
    // -2 points per full week since last negative event
    pointsPerWeek: 2,
  },
};

// ============================================
// Reliability Score 2.0 Configuration
// ============================================

export const RELIABILITY_CONFIG = {
  tiers: {
    developing: { min: 0, max: 59, name: "Developing" as const },
    semiPro: { min: 60, max: 74, name: "Semi Pro" as const },
    pro: { min: 75, max: 89, name: "Pro" as const },
    elite: { min: 90, max: 100, name: "Elite" as const },
  },
  windows: {
    maxJobs: 30, // Last 30 completed/attempted jobs
    windowDays: 60, // Or last 60 days
    minJobsForFullScore: 5, // Minimum jobs for full score calculation
  },
  baseScoreWeights: {
    attendance: 25, // 0-25 points
    punctuality: 20, // 0-20 points
    photoCompliance: 15, // 0-15 points
    communication: 10, // 0-10 points
    completion: 10, // 0-10 points
    ratings: 10, // 0-10 points
    // Total base: 90 points max
  },
  streakBonus: {
    pointsPerPerfectBlock: 2, // +2 per perfect 7-job block
    maxBonus: 10, // Cap at +10 points
  },
  eventPenalties: {
    lateRescheduleLt24: -3, // Per late reschedule by cleaner
    lateRescheduleCap: -9, // Max penalty from late reschedules
    cancel24_48: -8,
    cancelLt24: -12,
    noShow: -25,
    disputeCleanerAtFault: -10,
    disputeCap: -20, // Max from disputes
    inconveniencePattern: -5,
    inconveniencePatternHigh: -5, // Additional for 5+ events
  },
  newCleanerBlend: {
    provisionalScore: 70, // Starting score for new cleaners
    blendJobThreshold: 5, // Blend until 5 completed jobs
  },
  punctuality: {
    onTimeWindowMinutes: 15, // Within 15 minutes = on time
  },
  photoCompliance: {
    minPhotosRequired: 3, // Minimum photos for compliance
  },
};

// ============================================
// Rescheduling System Configuration
// ============================================

export const RESCHEDULE_CONFIG = {
  reasonCodes: {
    client: [
      "schedule_conflict",
      "work_change",
      "family_emergency",
      "running_late",
      "need_different_cleaning_time",
      "other",
    ],
    cleaner: [
      "schedule_conflict",
      "previous_job_overrun",
      "transport_issue",
      "family_emergency",
      "health_issue",
      "other",
    ],
  },
  reasonable: {
    maxDaysFromOriginal: 7, // Within 7 days of original
    maxPreviousReschedules: 1, // First reschedule only
  },
  reliability: {
    cleanerLateReschedulePenalty: -3, // Cleaner requests <24h, even if accepted
  },
  risk: {
    clientLateRescheduleWeight: 1, // Client requests <24h
  },
};

// ============================================
// Flexibility & Inconvenience Configuration
// ============================================

export const FLEXIBILITY_CONFIG = {
  cleaner: {
    windowDays: 30, // Evaluation window
    minReasonableRequests: 3, // Minimum requests to evaluate
    lowFlexDeclineRate: 0.6, // >60% decline rate = low flexibility
  },
  client: {
    windowDays: 60,
    weights: {
      lateCancelPenalty: 0.05, // Per late cancel
      noShowPenalty: 0.15, // Per no-show
      inconveniencePenalty: 0.05, // Per high inconvenience
      gracePenaltyRatio: 0.2, // Grace usage ratio impact
      paymentIssuePenalty: 0.1, // Per payment issue
    },
    maxPenalties: {
      lateCancel: 0.4,
      noShow: 0.4,
      inconvenience: 0.2,
      payment: 0.3,
    },
  },
  inconvenience: {
    highThreshold: 3, // Score >= 3 is "high"
    patternWindowDays: 14, // Client pattern detection
    cleanerPatternWindowDays: 30, // Cleaner pattern detection
    patternThreshold: 3, // 3+ events triggers pattern
    severePatternThreshold: 5, // 5+ events is severe
  },
};

// ============================================
// Availability System Configuration
// ============================================

export const AVAILABILITY_CONFIG = {
  noShowThreshold: {
    cleanerWaitMinutes: 30, // Cleaner must wait 30 minutes before no-show
    clientWaitMinutes: 15, // Client has 15 minutes grace period
  },
  gpsCheckin: {
    radiusMeters: 250, // Per policy: 250 meters
  },
};

// ============================================
// Matching System Configuration
// ============================================

export const MATCHING_CONFIG = {
  weights: {
    reliabilityMultiplier: 2, // Reliability score weight
    distancePenaltyPerKm: 2, // Points lost per km
    repeatClientBonus: 20, // Bonus for repeat clients
    flexibilityAlignmentBonus: 10, // Low-flex cleaner + inflexible client
    riskPenaltyElite: 50, // High-risk client vs Elite cleaner
  },
  thresholds: {
    clientFlexibilityLow: 0.4, // Below this = inflexible client
  },
};
