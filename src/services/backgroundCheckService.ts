// src/services/backgroundCheckService.ts
// Background check integration with Checkr (or other providers)

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import { createAuditLog } from "./creditEconomyService";

// ============================================
// Configuration
// ============================================

// Checkr API configuration (placeholder - replace with actual API)
const CHECKR_CONFIG = {
  API_KEY: process.env.CHECKR_API_KEY || "",
  API_URL: process.env.CHECKR_API_URL || "https://api.checkr.com/v1",
  WEBHOOK_SECRET: process.env.CHECKR_WEBHOOK_SECRET || "",
};

// ============================================
// Types
// ============================================

export type BackgroundCheckStatus =
  | "not_started"
  | "pending"
  | "processing"
  | "clear"
  | "consider"
  | "suspended";

export interface BackgroundCheck {
  id: string;
  cleaner_id: string;
  provider: string;
  provider_id: string | null;
  status: BackgroundCheckStatus;
  report_url: string | null;
  completed_at: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CheckrCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  dob: string;
  ssn: string;
  driver_license_number?: string;
  driver_license_state?: string;
}

export interface CheckrReport {
  id: string;
  status: string;
  completed_at: string | null;
  package: string;
  result: string | null;
}

// ============================================
// Background Check Initiation
// ============================================

/**
 * Initiate a background check for a cleaner
 */
export async function initiateBackgroundCheck(
  cleanerId: string,
  candidateInfo: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string;
    ssn: string;
    driverLicenseNumber?: string;
    driverLicenseState?: string;
  }
): Promise<BackgroundCheck> {
  // Check if cleaner already has a pending or valid check
  const existingResult = await query<BackgroundCheck>(
    `
      SELECT * FROM background_checks 
      WHERE cleaner_id = $1 
        AND (status IN ('pending', 'processing') OR (status = 'clear' AND expires_at > NOW()))
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [cleanerId]
  );

  if (existingResult.rows.length > 0) {
    throw Object.assign(new Error("Background check already in progress or valid"), {
      statusCode: 400,
    });
  }

  // Create Checkr candidate and report (placeholder - implement actual API call)
  let providerId: string | null = null;

  if (CHECKR_CONFIG.API_KEY) {
    try {
      // Example Checkr API call (you'd use their actual SDK or API)
      // const response = await fetch(`${CHECKR_CONFIG.API_URL}/candidates`, {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${CHECKR_CONFIG.API_KEY}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     first_name: candidateInfo.firstName,
      //     last_name: candidateInfo.lastName,
      //     email: candidateInfo.email,
      //     dob: candidateInfo.dateOfBirth,
      //     ssn: candidateInfo.ssn,
      //     driver_license_number: candidateInfo.driverLicenseNumber,
      //     driver_license_state: candidateInfo.driverLicenseState,
      //   }),
      // });
      // const candidate = await response.json();
      // providerId = candidate.id;

      // Then create a report/invitation
      // const reportResponse = await fetch(`${CHECKR_CONFIG.API_URL}/invitations`, {
      //   method: 'POST',
      //   headers: { ... },
      //   body: JSON.stringify({
      //     candidate_id: candidate.id,
      //     package: 'tasker_standard', // Your configured package
      //   }),
      // });

      providerId = `checkr_${Date.now()}`; // Placeholder
    } catch (err) {
      logger.error("checkr_api_failed", { error: (err as Error).message });
      throw Object.assign(new Error("Failed to initiate background check with provider"), {
        statusCode: 500,
      });
    }
  } else {
    // Mock mode for development
    providerId = `mock_${Date.now()}`;
    logger.warn("background_check_mock_mode", { cleanerId });
  }

  // Calculate expiry (typically 1-2 years)
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  // Create database record
  const result = await query<BackgroundCheck>(
    `
      INSERT INTO background_checks (cleaner_id, provider, provider_id, status, expires_at, metadata)
      VALUES ($1, 'checkr', $2, 'pending', $3, $4::jsonb)
      RETURNING *
    `,
    [
      cleanerId,
      providerId,
      expiresAt.toISOString(),
      JSON.stringify({
        firstName: candidateInfo.firstName,
        lastName: candidateInfo.lastName,
        email: candidateInfo.email,
        initiatedAt: new Date().toISOString(),
      }),
    ]
  );

  // Update cleaner profile status
  await query(
    `UPDATE cleaner_profiles SET background_check_status = 'pending', updated_at = NOW() WHERE user_id = $1`,
    [cleanerId]
  );

  logger.info("background_check_initiated", {
    cleanerId,
    checkId: result.rows[0].id,
    providerId,
  });

  return result.rows[0];
}

/**
 * Get background check status for a cleaner
 */
export async function getBackgroundCheckStatus(cleanerId: string): Promise<{
  hasCheck: boolean;
  status: BackgroundCheckStatus;
  check: BackgroundCheck | null;
  isValid: boolean;
}> {
  const result = await query<BackgroundCheck>(
    `
      SELECT * FROM background_checks 
      WHERE cleaner_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `,
    [cleanerId]
  );

  if (result.rows.length === 0) {
    return {
      hasCheck: false,
      status: "not_started",
      check: null,
      isValid: false,
    };
  }

  const check = result.rows[0];
  const isValid =
    check.status === "clear" &&
    check.expires_at !== null &&
    new Date(check.expires_at) > new Date();

  return {
    hasCheck: true,
    status: check.status as BackgroundCheckStatus,
    check,
    isValid,
  };
}

// ============================================
// Webhook Handling
// ============================================

/**
 * Handle Checkr webhook events
 */
export async function handleCheckrWebhook(
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  logger.info("checkr_webhook_received", { eventType, data });

  switch (eventType) {
    case "report.completed":
      await handleReportCompleted(data);
      break;
    case "report.upgraded":
      await handleReportUpgraded(data);
      break;
    case "candidate.adverse_action":
      await handleAdverseAction(data);
      break;
    default:
      logger.debug("checkr_webhook_unhandled", { eventType });
  }
}

/**
 * Handle report completed event
 */
async function handleReportCompleted(data: Record<string, unknown>): Promise<void> {
  const reportId = data.id as string;
  const status = data.status as string;
  const result = data.result as string | null;

  // Find the check by provider_id
  const checkResult = await query<BackgroundCheck>(
    `SELECT * FROM background_checks WHERE provider_id = $1`,
    [reportId]
  );

  if (checkResult.rows.length === 0) {
    logger.warn("checkr_report_not_found", { reportId });
    return;
  }

  const check = checkResult.rows[0];

  // Map Checkr status to our status
  let newStatus: BackgroundCheckStatus = "processing";
  if (status === "complete") {
    newStatus = result === "clear" ? "clear" : "consider";
  }

  // Update check
  await query(
    `
      UPDATE background_checks 
      SET status = $2, 
          completed_at = NOW(),
          report_url = $3,
          metadata = metadata || $4::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      check.id,
      newStatus,
      (data.report_url as string) || null,
      JSON.stringify({ checkrResult: result, checkrStatus: status }),
    ]
  );

  // Update cleaner profile
  await query(
    `UPDATE cleaner_profiles SET background_check_status = $2, updated_at = NOW() WHERE user_id = $1`,
    [check.cleaner_id, newStatus]
  );

  await createAuditLog({
    actorType: "system",
    action: "background_check_completed",
    resourceType: "background_check",
    resourceId: check.id,
    newValue: { status: newStatus, result },
  });

  logger.info("background_check_completed", {
    checkId: check.id,
    cleanerId: check.cleaner_id,
    status: newStatus,
    result,
  });

  // TODO: Send notification to cleaner about result
}

/**
 * Handle report upgraded (re-run) event
 */
async function handleReportUpgraded(data: Record<string, unknown>): Promise<void> {
  const reportId = data.id as string;

  await query(
    `UPDATE background_checks SET status = 'processing', updated_at = NOW() WHERE provider_id = $1`,
    [reportId]
  );

  logger.info("background_check_upgraded", { reportId });
}

/**
 * Handle adverse action (pre-adverse or adverse action taken)
 */
async function handleAdverseAction(data: Record<string, unknown>): Promise<void> {
  const reportId = data.id as string;

  // Find the check
  const checkResult = await query<BackgroundCheck>(
    `SELECT * FROM background_checks WHERE provider_id = $1`,
    [reportId]
  );

  if (checkResult.rows.length === 0) return;

  const check = checkResult.rows[0];

  // Update status to suspended
  await query(
    `
      UPDATE background_checks 
      SET status = 'suspended', 
          metadata = metadata || $2::jsonb,
          updated_at = NOW()
      WHERE id = $1
    `,
    [check.id, JSON.stringify({ adverseAction: data })]
  );

  await query(
    `UPDATE cleaner_profiles SET background_check_status = 'suspended', updated_at = NOW() WHERE user_id = $1`,
    [check.cleaner_id]
  );

  logger.warn("background_check_adverse_action", {
    checkId: check.id,
    cleanerId: check.cleaner_id,
  });

  // TODO: Notify admin, disable cleaner account if needed
}

// ============================================
// Admin Functions
// ============================================

/**
 * Manually update background check status (admin override)
 */
export async function adminUpdateCheckStatus(
  checkId: string,
  newStatus: BackgroundCheckStatus,
  adminId: string,
  notes?: string
): Promise<BackgroundCheck> {
  const result = await query<BackgroundCheck>(
    `
      UPDATE background_checks 
      SET status = $2, 
          metadata = metadata || $3::jsonb,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [checkId, newStatus, JSON.stringify({ adminOverride: true, notes, adminId })]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error("Background check not found"), { statusCode: 404 });
  }

  const check = result.rows[0];

  // Update cleaner profile
  await query(
    `UPDATE cleaner_profiles SET background_check_status = $2, updated_at = NOW() WHERE user_id = $1`,
    [check.cleaner_id, newStatus]
  );

  await createAuditLog({
    actorId: adminId,
    actorType: "admin",
    action: "background_check_override",
    resourceType: "background_check",
    resourceId: checkId,
    newValue: { status: newStatus, notes },
  });

  logger.info("background_check_admin_override", {
    checkId,
    newStatus,
    adminId,
    notes,
  });

  return check;
}

/**
 * Get cleaners needing background checks
 */
export async function getCleanersNeedingChecks(): Promise<
  Array<{
    cleaner_id: string;
    email: string;
    status: string;
    last_check_date: string | null;
  }>
> {
  const result = await query<{
    cleaner_id: string;
    email: string;
    status: string;
    last_check_date: string | null;
  }>(
    `
      SELECT 
        cp.user_id as cleaner_id,
        u.email,
        cp.background_check_status as status,
        bc.created_at::text as last_check_date
      FROM cleaner_profiles cp
      JOIN users u ON u.id = cp.user_id
      LEFT JOIN (
        SELECT DISTINCT ON (cleaner_id) * 
        FROM background_checks 
        ORDER BY cleaner_id, created_at DESC
      ) bc ON bc.cleaner_id = cp.user_id
      WHERE cp.background_check_required = true
        AND (
          cp.background_check_status = 'not_started'
          OR (cp.background_check_status = 'clear' AND bc.expires_at < NOW() + INTERVAL '30 days')
        )
      ORDER BY bc.expires_at ASC NULLS FIRST
    `
  );

  return result.rows;
}

/**
 * Get background check stats
 */
export async function getBackgroundCheckStats(): Promise<{
  total: number;
  pending: number;
  clear: number;
  consider: number;
  suspended: number;
  expiringSoon: number;
}> {
  const result = await query<{
    total: string;
    pending: string;
    clear: string;
    consider: string;
    suspended: string;
    expiring_soon: string;
  }>(
    `
      SELECT
        COUNT(DISTINCT cleaner_id)::text as total,
        COUNT(*) FILTER (WHERE status = 'pending')::text as pending,
        COUNT(*) FILTER (WHERE status = 'clear' AND expires_at > NOW())::text as clear,
        COUNT(*) FILTER (WHERE status = 'consider')::text as consider,
        COUNT(*) FILTER (WHERE status = 'suspended')::text as suspended,
        COUNT(*) FILTER (WHERE status = 'clear' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days')::text as expiring_soon
      FROM (
        SELECT DISTINCT ON (cleaner_id) * 
        FROM background_checks 
        ORDER BY cleaner_id, created_at DESC
      ) latest_checks
    `
  );

  const row = result.rows[0];
  return {
    total: Number(row?.total || 0),
    pending: Number(row?.pending || 0),
    clear: Number(row?.clear || 0),
    consider: Number(row?.consider || 0),
    suspended: Number(row?.suspended || 0),
    expiringSoon: Number(row?.expiring_soon || 0),
  };
}
