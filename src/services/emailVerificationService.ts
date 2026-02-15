// src/services/emailVerificationService.ts
// Email verification service for user email confirmation

import crypto from "crypto";
import { query } from "../db/client";
import { User } from "../types/db";
import { logger } from "../lib/logger";
import { sendEmail } from "../services/notifications/providers/emailProvider";

const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;

/**
 * Generate email verification token and send verification email
 */
export async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  // Generate secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Store token in database
  await query(
    `UPDATE users 
     SET email_verification_token = $1,
         email_verification_token_expires_at = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [token, expiresAt.toISOString(), userId]
  );

  // Send verification email
  const verificationUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Verify your PureTask email address",
      template: process.env.SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION || "",
      templateData: {
        verificationUrl,
        expiryHours: VERIFICATION_TOKEN_EXPIRY_HOURS,
      },
    });

    logger.info("email_verification_sent", { userId, email });
  } catch (error) {
    logger.error("email_verification_send_failed", {
      userId,
      email,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Verify email using token
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; user?: User }> {
  // Find user with this token
  const result = await query<User>(
    `SELECT * FROM users 
     WHERE email_verification_token = $1
     AND email_verification_token_expires_at > NOW()`,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    logger.warn("email_verification_invalid_token", { token: token.substring(0, 10) });
    return { success: false };
  }

  // Mark email as verified
  const updateResult = await query<User>(
    `UPDATE users 
     SET email_verified = TRUE,
         email_verified_at = NOW(),
         email_verification_token = NULL,
         email_verification_token_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [user.id]
  );

  const updatedUser = updateResult.rows[0];

  // Log security event
  await query(`SELECT log_security_event($1, $2, $3, NULL, NULL, '{}'::JSONB)`, [
    user.id,
    "email_verified",
    "success",
  ]);

  logger.info("email_verified", { userId: user.id, email: user.email });

  return { success: true, user: updatedUser };
}

/**
 * Check if email is verified
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  const result = await query<{ email_verified: boolean }>(
    `SELECT email_verified FROM users WHERE id = $1`,
    [userId]
  );

  return result.rows[0]?.email_verified ?? false;
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(userId: string): Promise<void> {
  const result = await query<User>(`SELECT * FROM users WHERE id = $1`, [userId]);

  const user = result.rows[0];

  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  if (user.email_verified) {
    throw Object.assign(new Error("Email already verified"), {
      statusCode: 400,
      code: "EMAIL_ALREADY_VERIFIED",
    });
  }

  // Check if token was sent recently (prevent spam)
  if (user.email_verification_token_expires_at) {
    const tokenExpiry = new Date(user.email_verification_token_expires_at);
    const hoursRemaining = (tokenExpiry.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursRemaining > 23) {
      throw Object.assign(
        new Error("Verification email was sent recently. Please check your inbox."),
        { statusCode: 429, code: "TOO_MANY_REQUESTS" }
      );
    }
  }

  await sendVerificationEmail(userId, user.email);
}

/**
 * Request email change (sends verification to new email)
 */
export async function requestEmailChange(userId: string, newEmail: string): Promise<void> {
  // Check if new email already exists
  const existing = await query<User>(`SELECT id FROM users WHERE email = $1 AND id != $2`, [
    newEmail,
    userId,
  ]);

  if (existing.rows.length > 0) {
    throw Object.assign(new Error("Email already in use"), {
      statusCode: 400,
      code: "EMAIL_EXISTS",
    });
  }

  // Get current user
  const userResult = await query<User>(`SELECT * FROM users WHERE id = $1`, [userId]);

  const user = userResult.rows[0];
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Generate verification token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Store email change request
  await query(
    `INSERT INTO email_change_requests (
      user_id, old_email, new_email, verification_token, token_expires_at
    ) VALUES ($1, $2, $3, $4, $5)`,
    [userId, user.email, newEmail, token, expiresAt.toISOString()]
  );

  // Send verification email to NEW email address
  const verificationUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email-change?token=${token}`;

  await sendEmail({
    to: newEmail,
    subject: "Confirm your new email address",
    template: process.env.SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION || "",
    templateData: {
      verificationUrl,
      oldEmail: user.email,
      newEmail,
    },
  });

  logger.info("email_change_requested", { userId, oldEmail: user.email, newEmail });
}

/**
 * Verify email change
 */
export async function verifyEmailChange(token: string): Promise<{ success: boolean }> {
  // Find pending email change
  const result = await query<any>(
    `SELECT * FROM email_change_requests 
     WHERE verification_token = $1
     AND token_expires_at > NOW()
     AND NOT verified`,
    [token]
  );

  const request = result.rows[0];
  if (!request) {
    return { success: false };
  }

  // Update user email
  await query(
    `UPDATE users 
     SET email = $1, 
         email_verified = TRUE,
         updated_at = NOW()
     WHERE id = $2`,
    [request.new_email, request.user_id]
  );

  // Mark request as verified
  await query(
    `UPDATE email_change_requests 
     SET verified = TRUE, verified_at = NOW()
     WHERE id = $1`,
    [request.id]
  );

  // Log security event
  await query(`SELECT log_security_event($1, $2, $3, NULL, NULL, $4::JSONB)`, [
    request.user_id,
    "email_changed",
    "success",
    JSON.stringify({ old_email: request.old_email, new_email: request.new_email }),
  ]);

  logger.info("email_changed", {
    userId: request.user_id,
    oldEmail: request.old_email,
    newEmail: request.new_email,
  });

  return { success: true };
}
