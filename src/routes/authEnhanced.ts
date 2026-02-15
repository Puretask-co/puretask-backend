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
 * @swagger
 * /auth/send-verification:
 *   post:
 *     summary: Send verification email
 *     description: Send or resend email verification link (authenticated).
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 */
router.post("/send-verification", auth(), async (req, res: Response) => {
  try {
    const userId = req.user!.id;
    const userEmail = req.user!.email || "";

    await resendVerificationEmail(userId);

    res.json({
      success: true,
      message: "Verification email sent",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SEND_VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: Verify email
 *     description: Verify email using token from verification link.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 *       400:
 *         description: Invalid or expired token
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
      message: "Email verified successfully",
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
 * @swagger
 * /auth/request-email-change:
 *   post:
 *     summary: Request email change
 *     description: Request to change email; verification sent to new address.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newEmail]
 *             properties:
 *               newEmail: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Verification email sent to new address
 */
router.post("/request-email-change", auth(), async (req, res: Response) => {
  try {
    const parsed = changeEmailSchema.parse(req.body);
    await requestEmailChange(req.user!.id, parsed.newEmail);

    res.json({
      success: true,
      message: "Verification email sent to new address",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "EMAIL_CHANGE_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/verify-email-change:
 *   post:
 *     summary: Verify email change
 *     description: Confirm new email using token from link.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Email changed successfully
 *       400:
 *         description: Invalid or expired token
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
      message: "Email changed successfully",
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
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Forgot password
 *     description: Request password reset; email sent if account exists (no enumeration).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: If email exists, reset link sent
 */
router.post("/forgot-password", async (req, res: Response) => {
  try {
    const parsed = emailSchema.parse(req.body);
    const ipAddress = req.ip || req.connection.remoteAddress;

    await requestPasswordReset(parsed.email, ipAddress);

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: "If that email exists, a password reset link has been sent",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "RESET_REQUEST_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/verify-reset-token:
 *   post:
 *     summary: Verify reset token
 *     description: Check if password reset token is valid.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Token validity result
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
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password
 *     description: Set new password using valid reset token.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid or expired token
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
      message: "Password reset successfully",
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
 * @swagger
 * /auth/2fa/enable-totp:
 *   post:
 *     summary: Enable TOTP 2FA
 *     description: Start TOTP (authenticator app) setup; returns secret and QR code.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: secret, qrCode, backupCodes
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
 * @swagger
 * /auth/2fa/verify-totp:
 *   post:
 *     summary: Verify TOTP and enable 2FA
 *     description: Confirm TOTP code to complete 2FA setup.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 8 }
 *     responses:
 *       200:
 *         description: 2FA enabled
 *       400:
 *         description: Invalid code
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
      message: "Two-factor authentication enabled successfully",
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_ENABLE_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/enable-sms:
 *   post:
 *     summary: Enable SMS 2FA
 *     description: Start SMS 2FA; sends verification code to phone.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phoneNumber]
 *             properties:
 *               phoneNumber: { type: string, minLength: 10 }
 *     responses:
 *       200:
 *         description: Verification code sent
 */
router.post("/2fa/enable-sms", auth(), async (req, res: Response) => {
  try {
    const parsed = z
      .object({
        phoneNumber: z.string().min(10),
      })
      .parse(req.body);

    await enableSMS2FA(req.user!.id, parsed.phoneNumber);

    res.json({
      success: true,
      message: "Verification code sent to your phone",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "2FA_SETUP_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/send-sms-code:
 *   post:
 *     summary: Send SMS 2FA code
 *     description: Resend SMS verification code for 2FA setup.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Code sent
 */
router.post("/2fa/send-sms-code", auth(), async (req, res: Response) => {
  try {
    await sendSMS2FACode(req.user!.id);

    res.json({
      success: true,
      message: "Verification code sent",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SMS_SEND_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/verify-sms:
 *   post:
 *     summary: Verify SMS and enable 2FA
 *     description: Confirm SMS code to complete 2FA setup.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, minLength: 6, maxLength: 8 }
 *     responses:
 *       200:
 *         description: 2FA enabled
 *       400:
 *         description: Invalid code
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
      message: "Two-factor authentication enabled successfully",
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_ENABLE_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/verify:
 *   post:
 *     summary: Verify 2FA at login
 *     description: Verify 2FA code after initial login (no auth header).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, code]
 *             properties:
 *               userId: { type: string, format: uuid }
 *               code: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: 2FA verified, method returned
 *       400:
 *         description: Invalid code
 */
router.post("/2fa/verify", async (req, res: Response) => {
  try {
    const parsed = z
      .object({
        userId: z.string().uuid(),
        code: z.string().min(6),
      })
      .parse(req.body);

    const result = await verify2FACode(parsed.userId, parsed.code);

    if (!result.success) {
      return res.status(400).json({
        error: { code: "INVALID_CODE", message: "Invalid verification code" },
      });
    }

    res.json({
      success: true,
      method: result.method,
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "2FA_VERIFICATION_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/disable:
 *   post:
 *     summary: Disable 2FA
 *     description: Disable 2FA; requires password confirmation.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: 2FA disabled
 */
router.post("/2fa/disable", auth(), async (req, res: Response) => {
  try {
    const parsed = disable2FASchema.parse(req.body);
    await disable2FA(req.user!.id, parsed.password);

    res.json({
      success: true,
      message: "Two-factor authentication disabled",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "2FA_DISABLE_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     description: Get current 2FA enrollment status.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status object
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
 * @swagger
 * /auth/2fa/regenerate-backup-codes:
 *   post:
 *     summary: Regenerate backup codes
 *     description: Generate new 2FA backup codes (invalidates previous).
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New backupCodes array
 */
router.post("/2fa/regenerate-backup-codes", auth(), async (req, res: Response) => {
  try {
    const backupCodes = await regenerateBackupCodes(req.user!.id);

    res.json({
      success: true,
      backupCodes,
      message: "New backup codes generated. Store them safely!",
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
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Get active sessions
 *     description: List all active sessions for the current user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: sessions array
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
 * @swagger
 * /auth/sessions/stats:
 *   get:
 *     summary: Get session stats
 *     description: Session statistics for current user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session stats
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
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revoke session
 *     description: Revoke a specific session by ID.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Session revoked
 */
router.delete("/sessions/:sessionId", auth(), async (req, res: Response) => {
  try {
    await revokeSession(req.params.sessionId);

    res.json({
      success: true,
      message: "Session revoked",
    });
  } catch (err) {
    const error = err as Error;
    res.status(500).json({
      error: { code: "REVOKE_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/logout-all:
 *   post:
 *     summary: Logout all devices
 *     description: Revoke all sessions for the current user.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out from N device(s)
 */
router.post("/logout-all", auth(), async (req, res: Response) => {
  try {
    const count = await revokeAllUserSessions(req.user!.id);

    res.json({
      success: true,
      message: `Logged out from ${count} device(s)`,
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
 * @swagger
 * /auth/oauth/google/start:
 *   get:
 *     summary: Start Google OAuth
 *     description: Redirect to Google OAuth consent screen.
 *     tags: [Auth]
 *     responses:
 *       302:
 *         description: Redirect to Google
 *       500:
 *         description: OAuth not configured
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

    const state = jwt.sign({ role, redirect }, env.JWT_SECRET, {
      expiresIn: "10m",
      audience: "oauth",
      issuer: "puretask",
    });

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
 * @swagger
 * /auth/oauth/google/callback:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles redirect from Google; exchanges code for token, redirects to app with JWT.
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: code
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect to app with token or error
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
 * @swagger
 * /auth/oauth/accounts:
 *   get:
 *     summary: Get linked OAuth accounts
 *     description: List OAuth providers linked to current user (no tokens exposed).
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: accounts array (provider, providerEmail, linkedAt)
 */
router.get("/oauth/accounts", auth(), async (req, res: Response) => {
  try {
    const accounts = await getUserOAuthAccounts(req.user!.id);

    // Don't expose tokens
    const safeAccounts = accounts.map((acc) => ({
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
 * @swagger
 * /auth/oauth/{provider}:
 *   delete:
 *     summary: Unlink OAuth account
 *     description: Unlink a provider (google, facebook, apple, github) from the account.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema: { type: string, enum: [google, facebook, apple, github] }
 *     responses:
 *       200:
 *         description: Account unlinked
 *       400:
 *         description: Invalid provider or cannot unlink last auth method
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
      message: "OAuth account unlinked",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "UNLINK_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/oauth/set-password:
 *   post:
 *     summary: Set password (OAuth users)
 *     description: Set a password for OAuth-only users so they can also sign in with email/password.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password set
 *       400:
 *         description: User already has password or invalid input
 */
router.post("/oauth/set-password", auth(), async (req, res: Response) => {
  try {
    const parsed = setPasswordSchema.parse(req.body);

    await setPasswordForOAuthUser(req.user!.id, parsed.password);

    res.json({
      success: true,
      message: "Password set successfully",
    });
  } catch (err) {
    const error = err as Error & { statusCode?: number; code?: string };
    res.status(error.statusCode ?? 500).json({
      error: { code: error.code ?? "SET_PASSWORD_FAILED", message: error.message },
    });
  }
});

/**
 * @swagger
 * /auth/oauth/can-set-password:
 *   get:
 *     summary: Can set password
 *     description: Check if current user (OAuth-only) can set a password.
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: { canSetPassword: boolean }
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
