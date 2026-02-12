// src/services/passwordResetService.ts
// Password reset service for forgot password flow

import crypto from "crypto";
import { query } from "../db/client";
import { User } from "../types/db";
import { hashPassword } from "../lib/auth";
import { updatePassword } from "./authService";
import { logger } from "../lib/logger";
import { sendEmail } from "../services/notifications/providers/emailProvider";

const RESET_TOKEN_EXPIRY_HOURS = 1; // Short expiry for security

/**
 * Request password reset - sends email with reset link
 */
export async function requestPasswordReset(email: string, ipAddress?: string): Promise<void> {
  // Find user by email
  const result = await query<User>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );

  const user = result.rows[0];

  // Always return success to prevent email enumeration
  // But only send email if user exists
  if (!user) {
    logger.warn("password_reset_requested_nonexistent_email", { email });
    // Still return successfully to prevent enumeration
    return;
  }

  // Check if account is locked
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    logger.warn("password_reset_requested_locked_account", {
      userId: user.id,
      email,
    });
    throw Object.assign(
      new Error("Account is temporarily locked. Please try again later."),
      { statusCode: 429, code: "ACCOUNT_LOCKED" }
    );
  }

  // Check rate limiting (prevent spam)
  if (user.password_reset_token_expires_at) {
    const tokenExpiry = new Date(user.password_reset_token_expires_at);
    const minutesRemaining = (tokenExpiry.getTime() - Date.now()) / (1000 * 60);
    
    if (minutesRemaining > 55) {
      logger.warn("password_reset_rate_limited", { userId: user.id, email });
      throw Object.assign(
        new Error("Password reset email was sent recently. Please check your inbox."),
        { statusCode: 429, code: "TOO_MANY_REQUESTS" }
      );
    }
  }

  // Generate secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  // Store token in database
  await query(
    `UPDATE users 
     SET password_reset_token = $1,
         password_reset_token_expires_at = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [token, expiresAt.toISOString(), user.id]
  );

  // Send reset email
  const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  try {
    await sendEmail({
      to: email,
      subject: "Reset your PureTask password",
      template: process.env.SENDGRID_TEMPLATE_USER_PASSWORD_RESET || "",
      templateData: {
        resetUrl,
        expiryMinutes: RESET_TOKEN_EXPIRY_HOURS * 60,
        firstName: user.first_name || "User",
      },
    });

    // Log security event
    await query(
      `SELECT log_security_event($1, $2, $3, $4, NULL, '{}'::JSONB)`,
      [user.id, "password_reset_requested", "success", ipAddress]
    );

    logger.info("password_reset_email_sent", { userId: user.id, email });
  } catch (error) {
    logger.error("password_reset_email_failed", {
      userId: user.id,
      email,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Verify password reset token (check if valid)
 */
export async function verifyResetToken(token: string): Promise<{ valid: boolean; userId?: string }> {
  const result = await query<User>(
    `SELECT id FROM users 
     WHERE password_reset_token = $1
     AND password_reset_token_expires_at > NOW()`,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    return { valid: false };
  }

  return { valid: true, userId: user.id };
}

/**
 * Reset password using token
 */
export async function resetPassword(
  token: string,
  newPassword: string,
  ipAddress?: string
): Promise<{ success: boolean; userId?: string }> {
  // Find user with this token
  const result = await query<User>(
    `SELECT * FROM users 
     WHERE password_reset_token = $1
     AND password_reset_token_expires_at > NOW()`,
    [token]
  );

  const user = result.rows[0];

  if (!user) {
    logger.warn("password_reset_invalid_token", { token: token.substring(0, 10) });
    return { success: false };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and clear reset token
  await query(
    `UPDATE users 
     SET password_hash = $1,
         password_reset_token = NULL,
         password_reset_token_expires_at = NULL,
         password_reset_at = NOW(),
         password_changed_at = NOW(),
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  // Revoke all existing sessions (force re-login)
  await query(
    `SELECT revoke_all_user_sessions($1)`,
    [user.id]
  );

  // Log security event
  await query(
    `SELECT log_security_event($1, $2, $3, $4, NULL, '{}'::JSONB)`,
    [user.id, "password_reset", "success", ipAddress]
  );

  logger.info("password_reset_completed", { userId: user.id, email: user.email });

  // Send confirmation email
  try {
    await sendEmail({
      to: user.email,
      subject: "Your PureTask password was changed",
      template: process.env.SENDGRID_TEMPLATE_USER_PASSWORD_RESET || "",
      templateData: {
        firstName: user.first_name || "User",
        resetTime: new Date().toLocaleString(),
      },
    });
  } catch (error) {
    logger.error("password_reset_confirmation_email_failed", {
      userId: user.id,
      error: (error as Error).message,
    });
    // Don't throw - password was reset successfully
  }

  return { success: true, userId: user.id };
}

/**
 * Change password (when user is already authenticated)
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ipAddress?: string
): Promise<void> {
  // Delegate to authService; we add extra logging here
  await updatePassword(userId, currentPassword, newPassword);

  // Log security event
  await query(
    `SELECT log_security_event($1, $2, $3, $4, NULL, '{}'::JSONB)`,
    [userId, "password_changed", "success", ipAddress]
  );

  // Get user for notification
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (user) {
    // Send notification email
    try {
      await sendEmail({
        to: user.email,
        subject: "Your PureTask password was changed",
        template: process.env.SENDGRID_TEMPLATE_USER_PASSWORD_RESET || "",
        templateData: {
          firstName: user.first_name || "User",
          changeTime: new Date().toLocaleString(),
        },
      });
    } catch (error) {
      logger.error("password_change_notification_failed", {
        userId,
        error: (error as Error).message,
      });
      // Don't throw - password was changed successfully
    }
  }

  logger.info("password_changed", { userId });
}

/**
 * Check if password was recently changed
 */
export async function wasPasswordRecentlyChanged(
  userId: string,
  withinHours: number = 24
): Promise<boolean> {
  const result = await query<{ password_changed_at: string | null }>(
    `SELECT password_changed_at FROM users WHERE id = $1`,
    [userId]
  );

  const user = result.rows[0];
  if (!user || !user.password_changed_at) {
    return false;
  }

  const changedAt = new Date(user.password_changed_at);
  const hoursAgo = (Date.now() - changedAt.getTime()) / (1000 * 60 * 60);

  return hoursAgo < withinHours;
}

