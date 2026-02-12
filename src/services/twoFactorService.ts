// src/services/twoFactorService.ts
// Two-Factor Authentication service (TOTP + SMS)

import crypto from "crypto";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { query } from "../db/client";
import { User, TwoFactorCode } from "../types/db";
import { logger } from "../lib/logger";
import { verifyPassword } from "../lib/auth";
import { sendSMS } from "../services/notifications/providers/smsProvider";

/**
 * Generate TOTP secret and QR code for authenticator apps
 */
export async function enableTOTP(userId: string): Promise<{
  secret: string;
  qrCode: string;
  backupCodes: string[];
}> {
  // Get user
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Check if 2FA is already enabled
  if (user.two_factor_enabled) {
    throw Object.assign(new Error("Two-factor authentication is already enabled"), {
      statusCode: 400,
      code: "2FA_ALREADY_ENABLED",
    });
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `PureTask (${user.email})`,
    issuer: "PureTask",
    length: 32,
  });

  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

  // Store secret (but don't enable yet - wait for verification)
  await query(
    `UPDATE users 
     SET two_factor_secret = $1,
         two_factor_backup_codes = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [secret.base32, backupCodes, userId]
  );

  logger.info("totp_secret_generated", { userId, email: user.email });

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify TOTP code and enable 2FA
 */
export async function verifyAndEnableTOTP(
  userId: string,
  code: string
): Promise<{ success: boolean }> {
  // Get user with secret
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user || !user.two_factor_secret) {
    return { success: false };
  }

  // Verify code
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: "base32",
    token: code,
    window: 2, // Allow 2 time steps in either direction
  });

  if (!verified) {
    logger.warn("totp_verification_failed", { userId });
    return { success: false };
  }

  // Enable 2FA
  await query(
    `UPDATE users 
     SET two_factor_enabled = TRUE,
         two_factor_method = 'totp',
         two_factor_enabled_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  // Log security event
  await query(
    `SELECT log_security_event($1, $2, $3, NULL, NULL, $4::JSONB)`,
    [userId, "2fa_enabled", "success", JSON.stringify({ method: "totp" })]
  );

  logger.info("totp_enabled", { userId });

  return { success: true };
}

/**
 * Enable SMS 2FA
 */
export async function enableSMS2FA(userId: string, phoneNumber: string): Promise<void> {
  // Get user
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Check if 2FA is already enabled
  if (user.two_factor_enabled) {
    throw Object.assign(new Error("Two-factor authentication is already enabled"), {
      statusCode: 400,
      code: "2FA_ALREADY_ENABLED",
    });
  }

  // Generate backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  // Update user with phone number
  await query(
    `UPDATE users 
     SET two_factor_phone = $1,
         two_factor_backup_codes = $2,
         updated_at = NOW()
     WHERE id = $3`,
    [phoneNumber, backupCodes, userId]
  );

  // Send verification code
  await sendSMS2FACode(userId);

  logger.info("sms_2fa_setup_initiated", { userId, phone: phoneNumber });
}

/**
 * Send SMS 2FA code
 */
export async function sendSMS2FACode(userId: string): Promise<void> {
  // Get user
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user || !user.two_factor_phone) {
    throw Object.assign(new Error("SMS 2FA not configured"), {
      statusCode: 400,
      code: "SMS_2FA_NOT_CONFIGURED",
    });
  }

  // Generate 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store code
  await query(
    `INSERT INTO two_factor_codes (user_id, code, method, phone, expires_at)
     VALUES ($1, $2, 'sms', $3, $4)`,
    [userId, code, user.two_factor_phone, expiresAt.toISOString()]
  );

  // Send SMS
  try {
    await sendSMS({
      to: user.two_factor_phone,
      message: `Your PureTask verification code is: ${code}. Valid for 10 minutes.`,
    });

    logger.info("sms_2fa_code_sent", { userId, phone: user.two_factor_phone });
  } catch (error) {
    logger.error("sms_2fa_code_failed", {
      userId,
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Verify SMS 2FA code and enable
 */
export async function verifyAndEnableSMS2FA(
  userId: string,
  code: string
): Promise<{ success: boolean }> {
  // Find valid code
  const result = await query<TwoFactorCode>(
    `SELECT * FROM two_factor_codes 
     WHERE user_id = $1
     AND code = $2
     AND method = 'sms'
     AND NOT used
     AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, code]
  );

  const codeRecord = result.rows[0];
  if (!codeRecord) {
    logger.warn("sms_2fa_invalid_code", { userId });
    return { success: false };
  }

  // Mark code as used
  await query(
    `UPDATE two_factor_codes 
     SET used = TRUE, used_at = NOW()
     WHERE id = $1`,
    [codeRecord.id]
  );

  // Enable 2FA
  await query(
    `UPDATE users 
     SET two_factor_enabled = TRUE,
         two_factor_method = 'sms',
         two_factor_enabled_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  // Log security event
  await query(
    `SELECT log_security_event($1, $2, $3, NULL, NULL, $4::JSONB)`,
    [userId, "2fa_enabled", "success", JSON.stringify({ method: "sms" })]
  );

  logger.info("sms_2fa_enabled", { userId });

  return { success: true };
}

/**
 * Verify 2FA code during login
 */
export async function verify2FACode(
  userId: string,
  code: string
): Promise<{ success: boolean; method?: string }> {
  // Get user
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user || !user.two_factor_enabled) {
    return { success: false };
  }

  // Check if it's a backup code first
  if (user.two_factor_backup_codes && user.two_factor_backup_codes.includes(code.toUpperCase())) {
    // Remove used backup code
    const newBackupCodes = user.two_factor_backup_codes.filter(
      (bc) => bc !== code.toUpperCase()
    );

    await query(
      `UPDATE users 
       SET two_factor_backup_codes = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [newBackupCodes, userId]
    );

    logger.info("2fa_backup_code_used", { userId, remainingCodes: newBackupCodes.length });

    return { success: true, method: "backup_code" };
  }

  // Verify based on method
  if (user.two_factor_method === "totp") {
    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret!,
      encoding: "base32",
      token: code,
      window: 2,
    });

    if (verified) {
      logger.info("2fa_totp_verified", { userId });
      return { success: true, method: "totp" };
    }
  } else if (user.two_factor_method === "sms") {
    // Verify SMS code
    const result = await query<TwoFactorCode>(
      `SELECT * FROM two_factor_codes 
       WHERE user_id = $1
       AND code = $2
       AND method = 'sms'
       AND NOT used
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, code]
    );

    const codeRecord = result.rows[0];
    if (codeRecord) {
      // Mark code as used
      await query(
        `UPDATE two_factor_codes 
         SET used = TRUE, used_at = NOW()
         WHERE id = $1`,
        [codeRecord.id]
      );

      logger.info("2fa_sms_verified", { userId });
      return { success: true, method: "sms" };
    }
  }

  logger.warn("2fa_verification_failed", { userId, method: user.two_factor_method });
  return { success: false };
}

/**
 * Disable 2FA
 */
export async function disable2FA(userId: string, password: string): Promise<void> {
  // Verify password first
  const userResult = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw Object.assign(new Error("Invalid password"), {
      statusCode: 401,
      code: "INVALID_PASSWORD",
    });
  }

  // Disable 2FA
  await query(
    `UPDATE users 
     SET two_factor_enabled = FALSE,
         two_factor_method = NULL,
         two_factor_secret = NULL,
         two_factor_phone = NULL,
         two_factor_backup_codes = NULL,
         two_factor_enabled_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [userId]
  );

  // Log security event
  await query(
    `SELECT log_security_event($1, $2, $3, NULL, NULL, '{}'::JSONB)`,
    [userId, "2fa_disabled", "success"]
  );

  logger.info("2fa_disabled", { userId });
}

/**
 * Get 2FA status for user
 */
export async function get2FAStatus(userId: string): Promise<{
  enabled: boolean;
  method: string | null;
  backupCodesRemaining: number;
}> {
  const userResult = await query<User>(
    `SELECT two_factor_enabled, two_factor_method, two_factor_backup_codes 
     FROM users WHERE id = $1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  return {
    enabled: user.two_factor_enabled,
    method: user.two_factor_method,
    backupCodesRemaining: user.two_factor_backup_codes?.length ?? 0,
  };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  // Generate new backup codes
  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString("hex").toUpperCase()
  );

  await query(
    `UPDATE users 
     SET two_factor_backup_codes = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [backupCodes, userId]
  );

  logger.info("2fa_backup_codes_regenerated", { userId });

  return backupCodes;
}

