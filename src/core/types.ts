// src/core/types.ts
// Shared types across all core systems

export type TimeBucket = "gt48" | "24_48" | "lt24" | "no_show";

export type ReasonActorType = "client" | "cleaner" | "system" | "both";
export type ReasonCategory = "reschedule" | "cancel" | "no_show" | "issue";

// ============================================
// Job Types
// ============================================

export interface Job {
  id: number;
  clientId: number;
  cleanerId: number;
  startTime: Date;
  endTime: Date;
  heldCredits: number;
  status: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

// ============================================
// Client Types
// ============================================

export interface Client {
  id: number;
  graceCancellationsTotal: number;
  graceCancellationsUsed: number;
}

export interface ClientRiskScore {
  clientId: number;
  riskScore: number; // 0–100
  riskBand: "normal" | "mild" | "elevated" | "high" | "critical";
  lastRecomputedAt?: Date;
}

export interface ClientRiskEvent {
  id?: number;
  clientId: number;
  jobId?: number | null;
  eventType: string; // e.g. 'late_reschedule_lt24', 'no_show', 'cancel_24_48', etc.
  weight: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface ClientFlexProfile {
  clientId: number;
  flexScore: number; // 0–1 (1 = super flexible, 0 = very rigid)
  rescheduleCount: number;
  lateCancelCount: number;
  noShowCount: number;
  highInconvenienceEvents: number;
  graceUsed: number;
  graceTotal: number;
  paymentIssueCount: number;
  lastEvaluatedAt: Date;
}

// ============================================
// Cleaner Types
// ============================================

export interface Cleaner {
  id: number;
  reliabilityScore: number; // 0–100
  reliabilityTier: "Developing" | "Semi Pro" | "Pro" | "Elite";
  flexibilityStatus: "normal" | "low_flex";
  flexibilityBadgeActive: boolean;
}

export interface CleanerEvent {
  id?: number;
  cleanerId: number;
  jobId?: number | null;
  eventType: string; // e.g. 'cancel_lt24', 'no_show', 'late_reschedule'
  weight: number;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export interface CleanerMetrics {
  cleanerId: number;
  totalJobsWindow: number;
  attendedJobs: number;
  noShowJobs: number;
  onTimeCheckins: number;
  photoCompliantJobs: number;
  communicationOkJobs: number;
  completionOkJobs: number;
  ratingsSum: number;
  ratingsCount: number;
}

export interface CleanerFlexProfile {
  cleanerId: number;
  reasonableRescheduleRequests: number;
  reasonableDeclines: number;
  lowFlexibilityActive: boolean;
  lastEvaluatedAt: Date;
}

// ============================================
// Reschedule Types
// ============================================

export interface RescheduleEvent {
  id?: number;
  jobId: number;
  clientId: number;
  cleanerId: number;
  requestedBy: "client" | "cleaner";
  requestedTo: "client" | "cleaner";
  tRequest: Date;
  tStartOriginal: Date;
  tStartNew: Date;
  hoursBeforeOriginal: number;
  bucket: TimeBucket;
  reasonCode: string | null;
  status: "pending" | "accepted" | "declined" | "expired";
  isReasonable: boolean;
  declinedBy?: "client" | "cleaner" | null;
  declineReasonCode?: string | null;
}

// ============================================
// Cancellation Types
// ============================================

export type CancellationWindow = "free" | "50%" | "100%";
export type CancellationActor = "client" | "cleaner" | "system";

export type CancellationType =
  | "client_cancel_normal"
  | "client_cancel_after_reschedule_declined"
  | "cleaner_cancel_normal"
  | "cleaner_cancel_emergency"
  | "client_no_show"
  | "cleaner_no_show"
  | "system_cancel";

export interface CancellationEvent {
  id?: number;
  jobId: number;
  cancelledBy: CancellationActor;
  type?: CancellationType;
  tCancel: Date;
  hoursBeforeStart: number | null;
  bucket: TimeBucket | null;
  reasonCode: string | null;
  afterRescheduleDeclined: boolean;
  feePct: number; // 0, 50, 100
  feeCredits: number;
  refundCredits: number;
  cleanerCompCredits: number;
  platformCompCredits: number;
  graceUsed: boolean;
  bonusCreditsToClient?: number;
}

// ============================================
// Inconvenience Types
// ============================================

export interface InconvenienceLog {
  id?: number;
  jobId: number;
  clientId: number;
  cleanerId: number;
  causedBy: "client" | "cleaner" | "system";
  ratedBy: "client" | "cleaner";
  score: 1 | 2 | 3 | 4;
  relatedEventType: "reschedule" | "cancel" | "no_show" | "issue";
  relatedEventId: number | null;
  reasonCode: string | null;
  note?: string | null;
  createdAt?: Date;
}

// ============================================
// Availability Types
// ============================================

export interface AvailabilityBlock {
  id?: number;
  cleanerId: number;
  dayOfWeek: number; // 0–6
  startTime: string; // 'HH:MM'
  endTime: string; // 'HH:MM'
}

export interface BlackoutPeriod {
  id?: number;
  cleanerId: number;
  startTs: Date;
  endTs: Date;
  reason?: string | null;
}

// ============================================
// Reason Code Types
// ============================================

export interface ReasonCode {
  id: number;
  code: string;
  actorType: ReasonActorType;
  category: ReasonCategory;
  label: string;
  description: string;
  isActive: boolean;
}

// ============================================
// Matching Types
// ============================================

export interface MatchingInput {
  job: Job;
  client: Client;
  clientRisk: ClientRiskScore;
  candidateCleaner: Cleaner;
  distanceKm: number;
  isRepeatClient: boolean;
  clientFlexibilityScore: number; // 0–1 (higher = more flexible)
}

// ============================================
// Rolling Window Types
// ============================================

export type RollingWindowMode = "days" | "jobs" | "hybrid";

export interface RollingWindowConfig {
  mode: RollingWindowMode;
  days?: number; // for 'days' or 'hybrid'
  maxJobs?: number; // for 'jobs' or 'hybrid'
}
