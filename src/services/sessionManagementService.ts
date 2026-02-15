// src/services/sessionManagementService.ts
// Session management and token revocation service

import crypto from "crypto";
import UAParser from "ua-parser-js";
import { query } from "../db/client";
import { UserSession } from "../types/db";
import { logger } from "../lib/logger";
import { Request } from "express";

/**
 * Extract device info from user agent
 */
function parseUserAgent(userAgent: string): Record<string, unknown> {
  const parser = new UAParser.UAParser(userAgent);
  const result = parser.getResult();

  return {
    browser: result.browser.name || "Unknown",
    browserVersion: result.browser.version || "",
    os: result.os.name || "Unknown",
    osVersion: result.os.version || "",
    device: result.device.type || "desktop",
    deviceVendor: result.device.vendor || "",
    deviceModel: result.device.model || "",
  };
}

/**
 * Create a new session
 */
export async function createSession(
  userId: string,
  tokenJti: string,
  expiresAt: Date,
  req: Request
): Promise<UserSession> {
  const userAgent = req.headers["user-agent"] || "Unknown";
  const ipAddress = req.ip || req.connection.remoteAddress || "Unknown";

  const deviceInfo = parseUserAgent(userAgent);

  const result = await query<UserSession>(
    `INSERT INTO user_sessions (
      user_id, token_jti, device_info, ip_address, expires_at
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [userId, tokenJti, JSON.stringify(deviceInfo), ipAddress, expiresAt.toISOString()]
  );

  const session = result.rows[0];

  logger.info("session_created", {
    userId,
    sessionId: session.id,
    device: deviceInfo.device,
    os: deviceInfo.os,
  });

  return session;
}

/**
 * Verify session is valid (not revoked and not expired)
 */
export async function verifySession(tokenJti: string): Promise<{
  valid: boolean;
  session?: UserSession;
  reason?: string;
}> {
  const result = await query<UserSession>(
    `SELECT * FROM user_sessions 
     WHERE token_jti = $1`,
    [tokenJti]
  );

  const session = result.rows[0];

  if (!session) {
    return { valid: false, reason: "session_not_found" };
  }

  if (session.revoked) {
    return { valid: false, reason: "session_revoked" };
  }

  if (new Date(session.expires_at) < new Date()) {
    return { valid: false, reason: "session_expired" };
  }

  return { valid: true, session };
}

/**
 * Update session activity timestamp
 */
export async function updateSessionActivity(tokenJti: string): Promise<void> {
  await query(
    `UPDATE user_sessions 
     SET last_activity_at = NOW()
     WHERE token_jti = $1 AND NOT revoked`,
    [tokenJti]
  );
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
  sessionId: string,
  reason: string = "user_logout"
): Promise<void> {
  const result = await query<UserSession>(
    `UPDATE user_sessions 
     SET revoked = TRUE,
         revoked_at = NOW(),
         revoked_reason = $2
     WHERE id = $1 AND NOT revoked
     RETURNING *`,
    [sessionId, reason]
  );

  const session = result.rows[0];

  if (session) {
    logger.info("session_revoked", {
      sessionId,
      userId: session.user_id,
      reason,
    });
  }
}

/**
 * Revoke session by token JTI
 */
export async function revokeSessionByJti(
  tokenJti: string,
  reason: string = "user_logout"
): Promise<void> {
  const result = await query<UserSession>(
    `UPDATE user_sessions 
     SET revoked = TRUE,
         revoked_at = NOW(),
         revoked_reason = $2
     WHERE token_jti = $1 AND NOT revoked
     RETURNING *`,
    [tokenJti, reason]
  );

  const session = result.rows[0];

  if (session) {
    logger.info("session_revoked", {
      sessionId: session.id,
      userId: session.user_id,
      reason,
    });
  }
}

/**
 * Revoke all user sessions (logout from all devices)
 */
export async function revokeAllUserSessions(
  userId: string,
  reason: string = "user_logout_all"
): Promise<number> {
  const result = await query(`SELECT revoke_all_user_sessions($1) as count`, [userId]);

  const count = result.rows[0]?.count ?? 0;

  logger.info("all_sessions_revoked", {
    userId,
    count,
    reason,
  });

  return count;
}

/**
 * Get all active sessions for a user
 */
export async function getUserActiveSessions(userId: string): Promise<UserSession[]> {
  const result = await query<UserSession>(
    `SELECT * FROM user_sessions 
     WHERE user_id = $1
     AND NOT revoked
     AND expires_at > NOW()
     ORDER BY last_activity_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Get all sessions for a user (including revoked/expired)
 */
export async function getUserAllSessions(
  userId: string,
  limit: number = 50
): Promise<UserSession[]> {
  const result = await query<UserSession>(
    `SELECT * FROM user_sessions 
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<UserSession | null> {
  const result = await query<UserSession>(`SELECT * FROM user_sessions WHERE id = $1`, [sessionId]);

  return result.rows[0] ?? null;
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await query(
    `DELETE FROM user_sessions 
     WHERE expires_at < NOW()
     AND created_at < NOW() - INTERVAL '30 days'
     RETURNING id`
  );

  const count = result.rowCount ?? 0;

  logger.info("expired_sessions_cleaned", { count });

  return count;
}

/**
 * Get session statistics for a user
 */
export async function getUserSessionStats(userId: string): Promise<{
  activeSessions: number;
  totalSessions: number;
  lastLogin: string | null;
  devices: Array<{ device: string; lastUsed: string }>;
}> {
  // Get active sessions count
  const activeResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_sessions 
     WHERE user_id = $1 AND NOT revoked AND expires_at > NOW()`,
    [userId]
  );

  // Get total sessions count
  const totalResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_sessions WHERE user_id = $1`,
    [userId]
  );

  // Get last login
  const lastLoginResult = await query<{ last_login_at: string | null }>(
    `SELECT last_login_at FROM users WHERE id = $1`,
    [userId]
  );

  // Get recent devices
  const devicesResult = await query<UserSession>(
    `SELECT DISTINCT ON (device_info->>'device', device_info->>'os') 
       device_info, last_activity_at
     FROM user_sessions 
     WHERE user_id = $1 AND NOT revoked
     ORDER BY device_info->>'device', device_info->>'os', last_activity_at DESC
     LIMIT 10`,
    [userId]
  );

  const devices = devicesResult.rows.map((session) => {
    const info = session.device_info as any;
    return {
      device:
        `${info.device || "Desktop"} - ${info.os || "Unknown"} ${info.osVersion || ""}`.trim(),
      lastUsed: session.last_activity_at,
    };
  });

  return {
    activeSessions: parseInt(activeResult.rows[0]?.count ?? "0", 10),
    totalSessions: parseInt(totalResult.rows[0]?.count ?? "0", 10),
    lastLogin: lastLoginResult.rows[0]?.last_login_at ?? null,
    devices,
  };
}

/**
 * Detect suspicious session activity
 */
export async function detectSuspiciousActivity(
  userId: string,
  req: Request
): Promise<{ suspicious: boolean; reasons: string[] }> {
  const reasons: string[] = [];
  const userAgent = req.headers["user-agent"] || "";
  const ipAddress = req.ip || req.connection.remoteAddress || "";

  // Get recent sessions
  const recentSessions = await query<UserSession>(
    `SELECT * FROM user_sessions 
     WHERE user_id = $1 
     AND created_at > NOW() - INTERVAL '7 days'
     ORDER BY created_at DESC`,
    [userId]
  );

  const sessions = recentSessions.rows;

  if (sessions.length === 0) {
    return { suspicious: false, reasons: [] };
  }

  // Check for new location
  const knownIps = new Set(sessions.map((s) => s.ip_address));
  if (!knownIps.has(ipAddress)) {
    reasons.push("new_ip_address");
  }

  // Check for new device
  const deviceInfo = parseUserAgent(userAgent);
  const knownDevices = sessions.map((s) => {
    const info = s.device_info as any;
    return `${info.device}-${info.os}`;
  });

  const currentDevice = `${deviceInfo.device}-${deviceInfo.os}`;
  if (!knownDevices.includes(currentDevice)) {
    reasons.push("new_device");
  }

  // Check for rapid location changes (impossible travel)
  const lastSession = sessions[0];
  if (lastSession && lastSession.ip_address !== ipAddress) {
    const timeDiff = Date.now() - new Date(lastSession.last_activity_at).getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // If less than 1 hour since last activity from different IP
    if (hoursDiff < 1) {
      reasons.push("impossible_travel");
    }
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

/**
 * Generate session fingerprint for device identification
 */
export function generateDeviceFingerprint(req: Request): string {
  const userAgent = req.headers["user-agent"] || "";
  const deviceInfo = parseUserAgent(userAgent);

  // Create fingerprint from device characteristics
  const fingerprintData = {
    browser: deviceInfo.browser,
    os: deviceInfo.os,
    device: deviceInfo.device,
  };

  return crypto.createHash("sha256").update(JSON.stringify(fingerprintData)).digest("hex");
}
