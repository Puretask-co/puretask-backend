// src/services/phoneVerificationService.ts
// Phone verification service using Twilio OTP

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import twilio from "twilio";

const twilioClient =
  env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN
    ? twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN)
    : null;

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP code via SMS
 */
export async function sendOTP(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate phone number format (E.164)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return {
        success: false,
        error: "Invalid phone number format. Please use E.164 format (e.g., +1234567890)",
      };
    }

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store in database
    await query(
      `INSERT INTO phone_verifications (user_id, phone_number, otp_code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, phoneNumber, otpCode, expiresAt]
    );

    // Send via Twilio if configured
    if (twilioClient && env.TWILIO_FROM_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `Your PureTask verification code is: ${otpCode}. This code expires in 10 minutes.`,
          to: phoneNumber,
          from: env.TWILIO_FROM_NUMBER,
        });
        logger.info("otp_sent", { userId, phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*") });
      } catch (twilioError: any) {
        logger.error("twilio_send_failed", {
          userId,
          error: twilioError.message,
          code: twilioError.code,
        });
        // Still return success if stored in DB (for testing without Twilio)
        if (env.NODE_ENV === "production") {
          return { success: false, error: "Failed to send SMS. Please try again." };
        }
      }
    } else {
      // Development mode: log OTP instead of sending
      logger.info("otp_generated_dev", { userId, otpCode, phoneNumber });
      if (env.NODE_ENV === "development") {
        console.log(`\n📱 OTP for ${phoneNumber}: ${otpCode}\n`);
      }
    }

    return { success: true };
  } catch (error: any) {
    logger.error("send_otp_failed", {
      userId,
      error: error.message,
      stack: error.stack,
    });
    return { success: false, error: "Failed to send verification code. Please try again." };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  userId: string,
  phoneNumber: string,
  otpCode: string
): Promise<{ success: boolean; verified: boolean; error?: string }> {
  try {
    // Find valid, unverified OTP
    const result = await query(
      `SELECT id, otp_code, expires_at
       FROM phone_verifications
       WHERE user_id = $1
         AND phone_number = $2
         AND verified_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, phoneNumber]
    );

    if (result.rows.length === 0) {
      return { success: false, verified: false, error: "Invalid or expired verification code" };
    }

    const verification = result.rows[0];

    // Check OTP code
    if (verification.otp_code !== otpCode) {
      return { success: false, verified: false, error: "Invalid verification code" };
    }

    // Mark as verified
    await query(
      `UPDATE phone_verifications
       SET verified_at = NOW()
       WHERE id = $1`,
      [verification.id]
    );

    // Update cleaner profile
    const profileResult = await query(`SELECT id FROM cleaner_profiles WHERE user_id = $1`, [
      userId,
    ]);

    if (profileResult.rows.length > 0) {
      await query(
        `UPDATE cleaner_profiles
         SET phone_number = $1, phone_verified = true
         WHERE user_id = $2`,
        [phoneNumber, userId]
      );
    }

    // Also update users table if needed
    await query(`UPDATE users SET phone_number = $1 WHERE id = $2`, [phoneNumber, userId]);

    logger.info("otp_verified", { userId, phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, "*") });

    return { success: true, verified: true };
  } catch (error: any) {
    logger.error("verify_otp_failed", {
      userId,
      error: error.message,
      stack: error.stack,
    });
    return { success: false, verified: false, error: "Failed to verify code. Please try again." };
  }
}

/**
 * Check if phone is already verified for a user
 */
export async function isPhoneVerified(userId: string): Promise<boolean> {
  try {
    const result = await query(`SELECT phone_verified FROM cleaner_profiles WHERE user_id = $1`, [
      userId,
    ]);

    if (result.rows.length === 0) {
      return false;
    }

    return result.rows[0].phone_verified === true;
  } catch (error: any) {
    logger.error("check_phone_verified_failed", { userId, error: error.message });
    return false;
  }
}
