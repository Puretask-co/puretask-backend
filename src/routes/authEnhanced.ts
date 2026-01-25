// src/routes/authEnhanced.ts
// Enhanced authentication routes: email verification, password reset, 2FA, OAuth, sessions

import { Router, Response, Request } from "express";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { auth } from "../lib/auth";
import { authRateLimiter } from "../lib/security";
import { logger } from "../lib/logger";

// Import all the new services
import {
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  requestEmailChange,
  verifyEmailChange,
} from "../services/emailVerificationService";

import {
  requestPasswordReset,
  verifyResetToken,
  resetPassword,
} from "../services/passwordResetService";

import {
  enableTOTP,
  verifyAndEnableTOTP,
  enableSMS2FA,
  sendSMS2FACode,
  verifyAndEnableSMS2FA,
  verify2FACode,
  disable2FA,
  get2FAStatus,
  regenerateBackupCodes,
} from "../services/twoFactorService";

import {
  createSession,
  revokeSession,
  revokeSessionByJti,
  revokeAllUserSessions,
  getUserActiveSessions,
  getUserSessionStats,
} from "../services/sessionManagementService";

import {
  handleOAuthLogin,
  getUserOAuthAccounts,
  unlinkOAuthAccount,
  canSetPassword,
  setPasswordForOAuthUser,
  type OAuthProfile,
} from "../services/oauthService";

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

// ============================================
// Validation Schemas
// ============================================

const emailSchema = z.object({
  email: z.string().email(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

const changeEmailSchema = z.object({
  newEmail: z.string().email(),
});

const verify2FASchema = z.object({
  code: z.string().min(6).max(8),
});

const enable2FASchema = z.object({
  method: z.enum(["totp", "sms"]),
  phoneNumber: z.string().optional(),
});

const disable2FASchema = z.object({
  password: z.string().min(1),
});

const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

const setPasswordSchema = z.object({
  password: z.string().min(8),
});

// ============================================
// EMAIL VERIFICATION ROUTES
// ============================================

/**
 * POST /auth/send-verification
 * Send email verification link
 */
router.post("/send-verification", auth(), async (req, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email || "";

    await resendVerificationEmail(userId);

    res.json({ 
      success: true, 
      message: "Verification email sent" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SEND_VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/verify-email
 * Verify email using token from link
 */
router.post("/verify-email", async (req, res: Response) => {
  try {
    const parsed = verifyEmailSchema.parse(req.body);
    const result = await verifyEmail(parsed.token);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_TOKEN", message: "Invalid or expired verification token" },
      });
    }

    res.json({ 
      success: true, 
      message: "Email verified successfully" 
    });
  } catch (err) {
    const error = err as Error & { issues?: unknown };
    if (error.issues) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "Invalid input", details: error.issues },
      });
    }
    res.status(500).json({
      error: { code: "VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/request-email-change
 * Request to change email address
 */
router.post("/request-email-change", auth(), async (req, res: Response) => {
  try {
    const parsed = changeEmailSchema.parse(req.body);
    await requestEmailChange(req.user!.id, parsed.newEmail);

    res.json({ 
      success: true, 
      message: "Verification email sent to new address" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "EMAIL_CHANGE_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/verify-email-change
 * Verify new email address
 */
router.post("/verify-email-change", async (req, res: Response) => {
  try {
    const parsed = verifyEmailSchema.parse(req.body);
    const result = await verifyEmailChange(parsed.token);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_TOKEN", message: "Invalid or expired verification token" },
      });
    }

    res.json({ 
      success: true, 
      message: "Email changed successfully" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "VERIFICATION_FAILED", message: error.message },
    });
  }
});

// ============================================
// PASSWORD RESET ROUTES
// ============================================

/**
 * POST /auth/forgot-password
 * Request password reset
 */
router.post("/forgot-password", async (req, res: Response) => {
  try {
    const parsed = emailSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;

    await requestPasswordReset(parsed.email, ipAddress);

    // Always return success to prevent email enumeration
    res.json({ 
      success: true, 
      message: "If that email exists, a password reset link has been sent" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "RESET_REQUEST_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/verify-reset-token
 * Check if reset token is valid
 */
router.post("/verify-reset-token", async (req, res: Response) => {
  try {
    const parsed = verifyEmailSchema.parse(req.body);
    const result = await verifyResetToken(parsed.token);

    res.json(result);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset password using token
 */
router.post("/reset-password", async (req, res: Response) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;

    const result = await resetPassword(parsed.token, parsed.newPassword, ipAddress);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_TOKEN", message: "Invalid or expired reset token" },
      });
    }

    res.json({ 
      success: true, 
      message: "Password reset successfully" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "RESET_FAILED", message: error.message },
    });
  }
});

// ============================================
// TWO-FACTOR AUTHENTICATION ROUTES
// ============================================

/**
 * POST /auth/2fa/enable-totp
 * Start TOTP (authenticator app) 2FA setup
 */
router.post("/2fa/enable-totp", auth(), async (req, res: Response) => {
  try {
    const result = await enableTOTP(req.user!.id);

    res.json({
      success: true,
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      message: "Scan the QR code with your authenticator app, then verify with a code",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "2FA_SETUP_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/verify-totp
 * Verify TOTP code and enable 2FA
 */
router.post("/2fa/verify-totp", auth(), async (req, res: Response) => {
  try {
    const parsed = verify2FASchema.parse(req.body);
    const result = await verifyAndEnableTOTP(req.user!.id, parsed.code);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_CODE", message: "Invalid verification code" },
      });
    }

    res.json({ 
      success: true, 
      message: "Two-factor authentication enabled successfully" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_ENABLE_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/enable-sms
 * Start SMS 2FA setup
 */
router.post("/2fa/enable-sms", auth(), async (req, res: Response) => {
  try {
    const parsed = z.object({
      phoneNumber: z.string().min(10),
    }).parse(req.body);

    await enableSMS2FA(req.user!.id, parsed.phoneNumber);

    res.json({ 
      success: true, 
      message: "Verification code sent to your phone" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "2FA_SETUP_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/send-sms-code
 * Send SMS verification code
 */
router.post("/2fa/send-sms-code", auth(), async (req, res: Response) => {
  try {
    await sendSMS2FACode(req.user!.id);

    res.json({ 
      success: true, 
      message: "Verification code sent" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SMS_SEND_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/verify-sms
 * Verify SMS code and enable 2FA
 */
router.post("/2fa/verify-sms", auth(), async (req, res: Response) => {
  try {
    const parsed = verify2FASchema.parse(req.body);
    const result = await verifyAndEnableSMS2FA(req.user!.id, parsed.code);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_CODE", message: "Invalid verification code" },
      });
    }

    res.json({ 
      success: true, 
      message: "Two-factor authentication enabled successfully" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_ENABLE_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/verify
 * Verify 2FA code during login (called after initial login)
 */
router.post("/2fa/verify", async (req, res: Response) => {
  try {
    const parsed = z.object({
      userId: z.string().uuid(),
      code: z.string().min(6),
    }).parse(req.body);

    const result = await verify2FACode(parsed.userId, parsed.code);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_CODE", message: "Invalid verification code" },
      });
    }

    res.json({ 
      success: true, 
      method: result.method 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/disable
 * Disable 2FA (requires password confirmation)
 */
router.post("/2fa/disable", auth(), async (req, res: Response) => {
  try {
    const parsed = disable2FASchema.parse(req.body);
    await disable2FA(req.user!.id, parsed.password);

    res.json({ 
      success: true, 
      message: "Two-factor authentication disabled" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "2FA_DISABLE_FAILED", message: error.message },
    });
  }
});

/**
 * GET /auth/2fa/status
 * Get 2FA status
 */
router.get("/2fa/status", auth(), async (req, res: Response) => {
  try {
    const status = await get2FAStatus(req.user!.id);
    res.json(status);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "STATUS_FETCH_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/2fa/regenerate-backup-codes
 * Regenerate backup codes
 */
router.post("/2fa/regenerate-backup-codes", auth(), async (req, res: Response) => {
  try {
    const backupCodes = await regenerateBackupCodes(req.user!.id);

    res.json({ 
      success: true, 
      backupCodes,
      message: "New backup codes generated. Store them safely!" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "REGENERATE_FAILED", message: error.message },
    });
  }
});

// ============================================
// SESSION MANAGEMENT ROUTES
// ============================================

/**
 * GET /auth/sessions
 * Get all active sessions
 */
router.get("/sessions", auth(), async (req, res: Response) => {
  try {
    const sessions = await getUserActiveSessions(req.user!.id);
    res.json({ sessions });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "SESSIONS_FETCH_FAILED", message: error.message },
    });
  }
});

/**
 * GET /auth/sessions/stats
 * Get session statistics
 */
router.get("/sessions/stats", auth(), async (req, res: Response) => {
  try {
    const stats = await getUserSessionStats(req.user!.id);
    res.json(stats);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "STATS_FETCH_FAILED", message: error.message },
    });
  }
});

/**
 * DELETE /auth/sessions/:sessionId
 * Revoke specific session
 */
router.delete("/sessions/:sessionId", auth(), async (req, res: Response) => {
  try {
    await revokeSession(req.params.sessionId);

    res.json({ 
      success: true, 
      message: "Session revoked" 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "REVOKE_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/logout-all
 * Logout from all devices
 */
router.post("/logout-all", auth(), async (req, res: Response) => {
  try {
    const count = await revokeAllUserSessions(req.user!.id);

    res.json({ 
      success: true, 
      message: `Logged out from ${count} device(s)` 
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "LOGOUT_ALL_FAILED", message: error.message },
    });
  }
});

// ============================================
// OAUTH ROUTES
// ============================================

/**
 * GET /auth/oauth/google/start
 * Redirect user to Google OAuth consent screen
 */
router.get("/oauth/google/start", (req, res: Response) => {
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      return res.status(500).json({
        error: { code: "OAUTH_CONFIG_MISSING", message: "Google OAuth is not configured" },
      });
    }

    const roleParam = typeof req.query.role === "string" ? req.query.role : "";
    const role = roleParam === "cleaner" ? "cleaner" : "client";
    const redirect = typeof req.query.redirect === "string" ? req.query.redirect : "";

    const state = jwt.sign(
      { role, redirect },
      env.JWT_SECRET,
      { expiresIn: "10m", audience: "oauth", issuer: "puretask" }
    );

    const params = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "OAUTH_START_FAILED", message: error.message },
    });
  }
});

/**
 * GET /auth/oauth/google/callback
 * Handle Google OAuth callback
 */
router.get("/oauth/google/callback", async (req, res: Response) => {
  const appUrl = env.APP_URL || "http://localhost:3000";
  const redirectTarget = new URL("/auth/oauth-callback", appUrl);

  try {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
      redirectTarget.searchParams.set("error", "oauth_config_missing");
      return res.redirect(redirectTarget.toString());
    }

    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";

    if (!code || !state) {
      redirectTarget.searchParams.set("error", "oauth_missing_params");
      return res.redirect(redirectTarget.toString());
    }

    const statePayload = jwt.verify(state, env.JWT_SECRET, {
      audience: "oauth",
      issuer: "puretask",
    }) as { role?: "client" | "cleaner"; redirect?: string };

    const role = statePayload.role === "cleaner" ? "cleaner" : "client";

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      redirectTarget.searchParams.set("error", "oauth_token_exchange_failed");
      return res.redirect(redirectTarget.toString());
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token as string | undefined;
    const refreshToken = tokenData.refresh_token as string | undefined;
    const expiresIn = tokenData.expires_in as number | undefined;

    if (!accessToken) {
      redirectTarget.searchParams.set("error", "oauth_no_access_token");
      return res.redirect(redirectTarget.toString());
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoResponse.ok) {
      redirectTarget.searchParams.set("error", "oauth_userinfo_failed");
      return res.redirect(redirectTarget.toString());
    }

    const userInfo = await userInfoResponse.json();

    const profile: OAuthProfile = {
      provider: "google",
      providerId: userInfo.id,
      email: userInfo.email,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      profilePicture: userInfo.picture,
      accessToken,
      refreshToken,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined,
    };

    const { token } = await handleOAuthLogin(profile, role);

    redirectTarget.searchParams.set("token", token);
    if (statePayload.redirect) {
      redirectTarget.searchParams.set("redirect", statePayload.redirect);
    }

    return res.redirect(redirectTarget.toString());
  } catch (err) {
    const error = err as Error;
    logger.error("google_oauth_callback_failed", { error: error.message });
    redirectTarget.searchParams.set("error", "oauth_callback_failed");
    return res.redirect(redirectTarget.toString());
  }
});

/**
 * GET /auth/oauth/accounts
 * Get linked OAuth accounts
 */
router.get("/oauth/accounts", auth(), async (req, res: Response) => {
  try {
    const accounts = await getUserOAuthAccounts(req.user!.id);
    
    // Don't expose tokens
    const safeAccounts = accounts.map(acc => ({
      id: acc.id,
      provider: acc.provider,
      providerEmail: acc.provider_email,
      linkedAt: acc.created_at,
    }));

    res.json({ accounts: safeAccounts });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "ACCOUNTS_FETCH_FAILED", message: error.message },
    });
  }
});

/**
 * DELETE /auth/oauth/:provider
 * Unlink OAuth account
 */
router.delete("/oauth/:provider", auth(), async (req, res: Response) => {
  try {
    const provider = req.params.provider as any;
    
    if (!["google", "facebook", "apple", "github"].includes(provider)) {
      return res.status(400).json({
        error: { code: "INVALID_PROVIDER", message: "Invalid OAuth provider" },
      });
    }

    await unlinkOAuthAccount(req.user!.id, provider);

    res.json({ 
      success: true, 
      message: "OAuth account unlinked" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "UNLINK_FAILED", message: error.message },
    });
  }
});

/**
 * POST /auth/oauth/set-password
 * Set password for OAuth-only users
 */
router.post("/oauth/set-password", auth(), async (req, res: Response) => {
  try {
    const parsed = setPasswordSchema.parse(req.body);

    await setPasswordForOAuthUser(req.user!.id, parsed.password);

    res.json({ 
      success: true, 
      message: "Password set successfully" 
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SET_PASSWORD_FAILED", message: error.message },
    });
  }
});

/**
 * GET /auth/oauth/can-set-password
 * Check if user can set password
 */
router.get("/oauth/can-set-password", auth(), async (req, res: Response) => {
  try {
    const canSet = await canSetPassword(req.user!.id);
    res.json({ canSetPassword: canSet });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "CHECK_FAILED", message: error.message },
    });
  }
});

export default router;

