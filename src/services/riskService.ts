// src/services/riskService.ts
// Risk scoring and flagging service for V4
// NOTE: No auto-bans - all actions require manual admin review

import { query } from "../db/client";
import { logger } from "../lib/logger";

// ============================================
// Types
// ============================================

export interface RiskScore {
  userId: string;
  userRole: "client" | "cleaner";
  score: number; // 0-100 (higher = more risk)
  factors: RiskFactor[];
  calculatedAt: Date;
}

export interface RiskFactor {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  count?: number;
}

export interface RiskFlag {
  id: string;
  userId: string;
  flagType: RiskFlagType;
  severity: "low" | "medium" | "high";
  description: string;
  evidence: Record<string, any>;
  createdAt: Date;
  expiresAt?: Date;
  status: "active" | "cleared" | "expired";
}

export type RiskFlagType =
  | "HIGH_CANCELLATION_RATE"
  | "PAYMENT_FAILURES"
  | "REPEATED_DISPUTES"
  | "SUSPICIOUS_BOOKING_PATTERN";

export interface RiskProfile {
  userId: string;
  userRole: "client" | "cleaner";
  riskScore: number;
  flags: RiskFlag[];
  factors: RiskFactor[];
  calculatedAt: Date;
}

// ============================================
// Risk Score Calculation
// ============================================

/**
 * Calculate risk score for a user
 * Factors: cancellation rate, payment failures, disputes, suspicious patterns
 */
export async function calculateRiskScore(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<RiskScore> {
  const factors: RiskFactor[] = [];
  let totalScore = 0;

  // 1. Cancellation rate (0-40 points)
  const cancellationScore = await calculateCancellationRisk(userId, userRole);
  totalScore += cancellationScore.score;
  factors.push(cancellationScore.factor);

  // 2. Payment failures (0-30 points)
  const paymentScore = await calculatePaymentFailureRisk(userId);
  totalScore += paymentScore.score;
  factors.push(paymentScore.factor);

  // 3. Disputes (0-30 points)
  const disputeScore = await calculateDisputeRisk(userId, userRole);
  totalScore += disputeScore.score;
  factors.push(disputeScore.factor);

  // Cap at 100
  const finalScore = Math.min(100, totalScore);

  return {
    userId,
    userRole,
    score: finalScore,
    factors,
    calculatedAt: new Date(),
  };
}

/**
 * Calculate cancellation risk (0-40 points)
 */
async function calculateCancellationRisk(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<{ score: number; factor: RiskFactor }> {
  const column = userRole === "client" ? "client_id" : "cleaner_id";

  const result = await query<{
    total: string;
    cancelled: string;
  }>(
    `
    SELECT 
      COUNT(*)::text as total,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled
    FROM jobs
    WHERE ${column} = $1
      AND created_at > NOW() - INTERVAL '90 days'
    `,
    [userId]
  );

  const total = Number(result.rows[0]?.total || 0);
  const cancelled = Number(result.rows[0]?.cancelled || 0);
  const cancellationRate = total > 0 ? cancelled / total : 0;

  let score = 0;
  let severity: "low" | "medium" | "high" = "low";

  if (cancellationRate > 0.5) {
    // >50% cancellation rate
    score = 40;
    severity = "high";
  } else if (cancellationRate > 0.3) {
    // 30-50% cancellation rate
    score = 25;
    severity = "medium";
  } else if (cancellationRate > 0.2) {
    // 20-30% cancellation rate
    score = 15;
    severity = "low";
  }

  return {
    score,
    factor: {
      type: "cancellation_rate",
      severity,
      description: `${(cancellationRate * 100).toFixed(0)}% cancellation rate (${cancelled}/${total} jobs)`,
      count: cancelled,
    },
  };
}

/**
 * Calculate payment failure risk (0-30 points)
 */
async function calculatePaymentFailureRisk(
  _userId: string
): Promise<{ score: number; factor: RiskFactor }> {
  // credit_reason enum has no 'payment_failed'; use payment_intents if needed later
  const failures: number = 0;

  let score = 0;
  let severity: "low" | "medium" | "high" = "low";

  if (failures > 3) {
    score = 30;
    severity = "high";
  } else if (failures > 1) {
    score = 15;
    severity = "medium";
  } else if (failures === 1) {
    score = 5;
    severity = "low";
  }

  return {
    score,
    factor: {
      type: "payment_failures",
      severity,
      description: `${failures} payment failure(s) in last 90 days`,
      count: failures,
    },
  };
}

/**
 * Calculate dispute risk (0-30 points)
 */
async function calculateDisputeRisk(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<{ score: number; factor: RiskFactor }> {
  const column = userRole === "client" ? "client_id" : "cleaner_id";

  // Get disputes where user is involved
  const result = await query<{ disputes: string }>(
    `
    SELECT COUNT(*)::text as disputes
    FROM disputes d
    JOIN jobs j ON j.id = d.job_id
    WHERE j.${column} = $1
      AND d.created_at > NOW() - INTERVAL '90 days'
    `,
    [userId]
  );

  const disputes = Number(result.rows[0]?.disputes || 0);

  let score = 0;
  let severity: "low" | "medium" | "high" = "low";

  if (disputes > 3) {
    score = 30;
    severity = "high";
  } else if (disputes > 1) {
    score = 20;
    severity = "medium";
  } else if (disputes === 1) {
    score = 10;
    severity = "low";
  }

  return {
    score,
    factor: {
      type: "disputes",
      severity,
      description: `${disputes} dispute(s) in last 90 days`,
      count: disputes,
    },
  };
}

// ============================================
// Risk Flags
// ============================================

/**
 * Calculate and generate risk flags based on risk score
 * Flags are stored in memory/cache for now (can be persisted to DB later)
 */
export async function calculateRiskFlags(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<RiskFlag[]> {
  const riskScore = await calculateRiskScore(userId, userRole);
  const flags: RiskFlag[] = [];

  // Check each factor and create flags
  for (const factor of riskScore.factors) {
    if (factor.severity === "high") {
      let flagType: RiskFlagType;

      if (factor.type === "cancellation_rate") {
        flagType = "HIGH_CANCELLATION_RATE";
      } else if (factor.type === "payment_failures") {
        flagType = "PAYMENT_FAILURES";
      } else if (factor.type === "disputes") {
        flagType = "REPEATED_DISPUTES";
      } else {
        continue;
      }

      flags.push({
        id: `${userId}-${flagType}-${Date.now()}`,
        userId,
        flagType,
        severity: factor.severity,
        description: factor.description,
        evidence: {
          factorType: factor.type,
          count: factor.count,
        },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        status: "active",
      });
    }
  }

  // Check for suspicious booking patterns
  const suspiciousPattern = await detectSuspiciousBookingPattern(userId, userRole);
  if (suspiciousPattern) {
    flags.push({
      id: `${userId}-SUSPICIOUS_BOOKING_PATTERN-${Date.now()}`,
      userId,
      flagType: "SUSPICIOUS_BOOKING_PATTERN",
      severity: suspiciousPattern.severity,
      description: suspiciousPattern.description,
      evidence: suspiciousPattern.evidence,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: "active",
    });
  }

  return flags;
}

/**
 * Detect suspicious booking patterns
 */
async function detectSuspiciousBookingPattern(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<{
  severity: "medium" | "high";
  description: string;
  evidence: Record<string, any>;
} | null> {
  if (userRole !== "client") {
    return null; // Only check clients for booking patterns
  }

  // Check for rapid job creation/cancellation pattern
  const result = await query<{
    created: string;
    cancelled: string;
    rapid_cancelled: string;
  }>(
    `
    SELECT 
      COUNT(*)::text as created,
      COUNT(*) FILTER (WHERE status = 'cancelled')::text as cancelled,
      COUNT(*) FILTER (
        WHERE status = 'cancelled' 
        AND updated_at - created_at < INTERVAL '1 hour'
      )::text as rapid_cancelled
    FROM jobs
    WHERE client_id = $1
      AND created_at > NOW() - INTERVAL '7 days'
    `,
    [userId]
  );

  const created = Number(result.rows[0]?.created || 0);
  const cancelled = Number(result.rows[0]?.cancelled || 0);
  const rapidCancelled = Number(result.rows[0]?.rapid_cancelled || 0);

  // Flag if: >5 jobs created and >50% cancelled rapidly
  if (created > 5 && rapidCancelled > created * 0.5) {
    return {
      severity: "high",
      description: `Suspicious pattern: ${rapidCancelled} jobs cancelled within 1 hour out of ${created} created`,
      evidence: {
        created,
        cancelled,
        rapidCancelled,
        pattern: "rapid_cancellation",
      },
    };
  }

  return null;
}

// ============================================
// Risk Profile
// ============================================

/**
 * Get complete risk profile for a user
 */
export async function getUserRiskProfile(
  userId: string,
  userRole: "client" | "cleaner"
): Promise<RiskProfile> {
  const riskScore = await calculateRiskScore(userId, userRole);
  const flags = await calculateRiskFlags(userId, userRole);

  return {
    userId,
    userRole,
    riskScore: riskScore.score,
    flags,
    factors: riskScore.factors,
    calculatedAt: riskScore.calculatedAt,
  };
}

// ============================================
// Risk Review Queue
// ============================================

/**
 * Get list of users with active risk flags (for admin review)
 */
export async function getRiskReviewQueue(): Promise<
  Array<{ userId: string; userRole: "client" | "cleaner"; flags: RiskFlag[]; riskScore: number }>
> {
  const result = await query<{
    id: string;
    user_id: string;
    flag_type: string;
    reason: string | null;
    severity: string;
    metadata: Record<string, unknown> | null;
    active: boolean;
    created_at: string;
    role: string;
  }>(
    `SELECT rf.id, rf.user_id, rf.flag_type, rf.reason, rf.severity, rf.metadata, rf.active, rf.created_at, u.role
     FROM risk_flags rf
     JOIN users u ON u.id = rf.user_id
     WHERE rf.active = true
     ORDER BY rf.created_at DESC`
  );

  const byUser = new Map<
    string,
    { userId: string; userRole: "client" | "cleaner"; flags: RiskFlag[]; riskScore: number }
  >();
  for (const r of result.rows) {
    const role = r.role === "cleaner" ? "cleaner" : "client";
    const flag: RiskFlag = {
      id: r.id,
      userId: r.user_id,
      flagType: r.flag_type as RiskFlagType,
      severity: r.severity as "low" | "medium" | "high",
      description: r.reason ?? "",
      evidence: (r.metadata as Record<string, any>) ?? {},
      createdAt: new Date(r.created_at),
      status: r.active ? "active" : "cleared",
    };
    let entry = byUser.get(r.user_id);
    if (!entry) {
      entry = { userId: r.user_id, userRole: role, flags: [], riskScore: 0 };
      byUser.set(r.user_id, entry);
    }
    entry.flags.push(flag);
    // Simple risk score from highest severity in queue
    const sevScore = r.severity === "high" ? 75 : r.severity === "medium" ? 50 : 25;
    if (sevScore > entry.riskScore) entry.riskScore = sevScore;
  }
  return Array.from(byUser.values());
}
