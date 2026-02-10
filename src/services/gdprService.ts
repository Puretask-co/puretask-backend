// src/services/gdprService.ts
// GDPR compliance service: data export, deletion, consent management

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { User } from "../types/db";

export interface UserDataExport {
  profile: {
    id: string;
    email: string;
    role: string;
    phone: string | null;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  clientProfile?: {
    defaultAddress: string | null;
    createdAt: string;
    updatedAt: string;
  };
  cleanerProfile?: {
    hourlyRateCredits: number;
    tier: string | null;
    createdAt: string;
    updatedAt: string;
  };
  jobs: Array<{
    id: string;
    status: string;
    scheduledStartAt: string;
    address: string;
    creditAmount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    amountCredits: number;
    status: string;
    createdAt: string;
  }>;
  creditTransactions: Array<{
    id: string;
    amount: number;
    reason: string;
    jobId: string | null;
    createdAt: string;
  }>;
  messages: Array<{
    id: string;
    jobId: string;
    content: string;
    createdAt: string;
  }>;
  consentHistory: Array<{
    type: string;
    accepted: boolean;
    acceptedAt: string;
    version: string | null;
  }>;
}

/**
 * Export all user data for GDPR compliance
 */
export async function exportUserData(userId: string): Promise<UserDataExport> {
  logger.info("gdpr_data_export_started", { userId });

  // Get user profile
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Get client profile if exists
  const clientProfileResult = await query<{
    default_address: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT default_address, created_at, updated_at FROM client_profiles WHERE user_id = $1`,
    [userId]
  );

  // Get cleaner profile if exists
  const cleanerProfileResult = await query<{
    hourly_rate_credits: number;
    tier: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `SELECT hourly_rate_credits, tier, created_at, updated_at FROM cleaner_profiles WHERE user_id = $1`,
    [userId]
  );

  // Get jobs
  const jobsResult = await query<{
    id: string;
    status: string;
    scheduled_start_at: string;
    address: string;
    credit_amount: number;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT id, status, scheduled_start_at, address, credit_amount, created_at, updated_at
      FROM jobs
      WHERE client_id = $1 OR cleaner_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  // Get payments
  const paymentsResult = await query<{
    id: string;
    amount_cents: number;
    amount_credits: number;
    status: string;
    created_at: string;
  }>(
    `
      SELECT id, amount_cents, amount_credits, status, created_at
      FROM payments
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  // Get credit transactions
  const creditsResult = await query<{
    id: string;
    amount: number;
    reason: string;
    job_id: string | null;
    created_at: string;
  }>(
    `
      SELECT id, amount, reason, job_id, created_at
      FROM credit_ledger
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  // Get messages
  const messagesResult = await query<{
    id: string;
    job_id: string;
    content: string;
    created_at: string;
  }>(
    `
      SELECT id, job_id, content, created_at
      FROM messages
      WHERE sender_id = $1 OR recipient_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  // Get consent history
  const consentResult = await query<{
    type: string;
    accepted: boolean;
    accepted_at: string;
    version: string | null;
  }>(
    `
      SELECT type, accepted, accepted_at, version
      FROM user_consents
      WHERE user_id = $1
      ORDER BY accepted_at DESC
    `,
    [userId]
  );

  const exportData: UserDataExport = {
    profile: {
      id: user.id,
      email: user.email,
      role: user.role,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      emailVerified: user.email_verified,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    jobs: jobsResult.rows.map((job) => ({
      id: job.id,
      status: job.status,
      scheduledStartAt: job.scheduled_start_at,
      address: job.address,
      creditAmount: job.credit_amount,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })),
    payments: paymentsResult.rows.map((payment) => ({
      id: payment.id,
      amountCents: payment.amount_cents,
      amountCredits: payment.amount_credits,
      status: payment.status,
      createdAt: payment.created_at,
    })),
    creditTransactions: creditsResult.rows.map((credit) => ({
      id: credit.id,
      amount: credit.amount,
      reason: credit.reason,
      jobId: credit.job_id,
      createdAt: credit.created_at,
    })),
    messages: messagesResult.rows.map((message) => ({
      id: message.id,
      jobId: message.job_id,
      content: message.content,
      createdAt: message.created_at,
    })),
    consentHistory: consentResult.rows.map((consent) => ({
      type: consent.type,
      accepted: consent.accepted,
      acceptedAt: consent.accepted_at,
      version: consent.version,
    })),
  };

  if (clientProfileResult.rows.length > 0) {
    const profile = clientProfileResult.rows[0];
    exportData.clientProfile = {
      defaultAddress: profile.default_address,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  if (cleanerProfileResult.rows.length > 0) {
    const profile = cleanerProfileResult.rows[0];
    exportData.cleanerProfile = {
      hourlyRateCredits: profile.hourly_rate_credits,
      tier: profile.tier,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  logger.info("gdpr_data_export_completed", { userId, dataPoints: Object.keys(exportData).length });

  return exportData;
}

/**
 * Anonymize user data for GDPR right to be forgotten
 * Preserves data integrity by anonymizing rather than deleting
 */
export async function anonymizeUserData(userId: string): Promise<void> {
  logger.info("gdpr_data_anonymization_started", { userId });

  // Get user email for logging
  const userResult = await query<User>(`SELECT email FROM users WHERE id = $1`, [userId]);
  const user = userResult.rows[0];

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Anonymize user email (keep format for uniqueness)
  const anonymizedEmail = `deleted_${userId}_${Date.now()}@deleted.puretask.com`;

  await query(
    `
      UPDATE users
      SET email = $1,
          password_hash = '',
          phone = NULL,
          first_name = NULL,
          last_name = NULL,
          email_verified = false,
          email_verification_token = NULL,
          email_verification_token_expires_at = NULL,
          updated_at = NOW()
      WHERE id = $2
    `,
    [anonymizedEmail, userId]
  );

  // Anonymize client profile
  await query(
    `
      UPDATE client_profiles
      SET default_address = NULL,
          updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  );

  // Anonymize cleaner profile (keep tier for business logic)
  await query(
    `
      UPDATE cleaner_profiles
      SET hourly_rate_credits = 0,
          updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId]
  );

  // Anonymize messages (remove content)
  await query(
    `
      UPDATE messages
      SET content = '[Message deleted]',
          updated_at = NOW()
      WHERE sender_id = $1 OR recipient_id = $1
    `,
    [userId]
  );

  // Note: Jobs, payments, and credit transactions are kept for business/legal records
  // but user is anonymized so they can't be traced back

  logger.info("gdpr_data_anonymization_completed", {
    userId,
    originalEmail: user.email,
    anonymizedEmail,
  });
}

/**
 * Record user consent (privacy policy, terms of service, etc.)
 */
export async function recordConsent(
  userId: string,
  type: "privacy_policy" | "terms_of_service" | "marketing",
  accepted: boolean,
  version?: string
): Promise<void> {
  // Check if consent table exists, create if not
  await query(
    `
      CREATE TABLE IF NOT EXISTS user_consents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        accepted BOOLEAN NOT NULL,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, type, version)
      )
    `,
    []
  );

  await query(
    `
      INSERT INTO user_consents (user_id, type, accepted, version)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, type, version) 
      DO UPDATE SET accepted = $3, accepted_at = NOW()
    `,
    [userId, type, accepted, version || null]
  );

  logger.info("gdpr_consent_recorded", { userId, type, accepted, version });
}

/**
 * Get user consent status
 */
export async function getUserConsent(
  userId: string,
  type: "privacy_policy" | "terms_of_service" | "marketing"
): Promise<{ accepted: boolean; acceptedAt: string; version: string | null } | null> {
  const result = await query<{
    accepted: boolean;
    accepted_at: string;
    version: string | null;
  }>(
    `
      SELECT accepted, accepted_at, version
      FROM user_consents
      WHERE user_id = $1 AND type = $2
      ORDER BY accepted_at DESC
      LIMIT 1
    `,
    [userId, type]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    accepted: result.rows[0].accepted,
    acceptedAt: result.rows[0].accepted_at,
    version: result.rows[0].version,
  };
}
