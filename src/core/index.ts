// src/core/index.ts
// Core Systems v2 - Main Export File
//
// This file exports all core system services and types for use throughout the application

// ============================================
// Types
// ============================================
export * from "./types";

// ============================================
// Utilities
// ============================================
export {
  hoursDiff,
  minutesDiff,
  daysAgo,
  getTimeBucket,
  computeHoursBeforeStart,
  computeWindow,
  baseFeePctForWindow,
  bucketToString,
} from "./timeBuckets";

export {
  clampScore,
  computeRiskBand,
  computeReliabilityTier,
  computeReliabilityBasePoints,
  getPayoutPercentForTier,
  getCreditRateRangeForTier,
  RiskBand,
  ReliabilityTier,
} from "./scoring";

// ============================================
// Configuration
// ============================================
export {
  CANCELLATION_CONFIG,
  CLIENT_RISK_CONFIG,
  RELIABILITY_CONFIG,
  RESCHEDULE_CONFIG,
  FLEXIBILITY_CONFIG,
  AVAILABILITY_CONFIG,
  MATCHING_CONFIG,
} from "./config";

// ============================================
// Services
// ============================================

// 1.1 Client Risk Score System
export { ClientRiskService } from "./clientRiskService";

// 1.2 Reliability Score 2.0
export { ReliabilityScoreV2Service } from "./reliabilityScoreV2Service";

// 1.3 Rescheduling System
export { RescheduleServiceV2 } from "./rescheduleService";

// 1.4 Cancellation System
export { CancellationServiceV2, cancelJobSimple } from "./cancellationService";

// 1.5 Matching System
export { MatchingService } from "./matchingService";

// 2.1 Reason Code System
export { ReasonCodeService, REASON_CODES } from "./reasonCodeService";

// 2.2 Inconvenience Score System
export { InconvenienceService } from "./inconvenienceService";

// 2.3 & 2.4 Flexibility Systems
export { FlexibilityService } from "./flexibilityService";

// 2.5 Cleaner Availability System
export { AvailabilityService } from "./availabilityService";

// 2.6 Rolling Window System
export { RollingWindowService } from "./rollingWindowService";

// ============================================
// Type Re-exports for Convenience
// ============================================
export type {
  TimeBucket,
  Job,
  Client,
  Cleaner,
  ClientRiskScore,
  ClientRiskEvent,
  ClientFlexProfile,
  CleanerEvent,
  CleanerMetrics,
  CleanerFlexProfile,
  RescheduleEvent,
  CancellationWindow,
  CancellationActor,
  CancellationType,
  CancellationEvent,
  InconvenienceLog,
  AvailabilityBlock,
  BlackoutPeriod,
  ReasonCode,
  MatchingInput,
  RollingWindowConfig,
} from "./types";
