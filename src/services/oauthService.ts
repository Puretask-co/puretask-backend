// src/services/oauthService.ts
// OAuth authentication service (Google, Facebook, etc.)

import { query, withTransaction } from "../db/client";
import { User, OAuthAccount, ClientProfile, CleanerProfile } from "../types/db";
import { signAuthToken, hashPassword } from "../lib/auth";
import { logger } from "../lib/logger";
import type { PoolClient } from "pg";

export type OAuthProvider = "google" | "facebook" | "apple" | "github";

export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

/**
 * Handle OAuth login/signup
 * Creates account if doesn't exist, or links to existing account
 */
export async function handleOAuthLogin(
  profile: OAuthProfile,
  role: "client" | "cleaner" = "client"
): Promise<{ user: User; token: string; isNewUser: boolean }> {
  return withTransaction(async (client: PoolClient) => {
    // Check if OAuth account already exists
    const oauthResult = await client.query<OAuthAccount>(
      `SELECT * FROM oauth_accounts 
       WHERE provider = $1 AND provider_account_id = $2`,
      [profile.provider, profile.providerId]
    );

    let user: User;
    let isNewUser = false;

    if (oauthResult.rows.length > 0) {
      // OAuth account exists - get the user
      const oauthAccount = oauthResult.rows[0];

      // Update OAuth tokens
      await client.query(
        `UPDATE oauth_accounts 
         SET access_token = $1,
             refresh_token = $2,
             token_expires_at = $3,
             profile_data = $4,
             updated_at = NOW()
         WHERE id = $5`,
        [
          profile.accessToken,
          profile.refreshToken || null,
          profile.expiresAt?.toISOString() || null,
          JSON.stringify(profile),
          oauthAccount.id,
        ]
      );

      // Get user
      const userResult = await client.query<User>(`SELECT * FROM users WHERE id = $1`, [
        oauthAccount.user_id,
      ]);

      user = userResult.rows[0];
    } else {
      // Check if user exists with this email
      const existingUserResult = await client.query<User>(`SELECT * FROM users WHERE email = $1`, [
        profile.email,
      ]);

      if (existingUserResult.rows.length > 0) {
        // Link OAuth to existing user
        user = existingUserResult.rows[0];

        await client.query(
          `INSERT INTO oauth_accounts (
            user_id, provider, provider_account_id, provider_email,
            access_token, refresh_token, token_expires_at, profile_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.id,
            profile.provider,
            profile.providerId,
            profile.email,
            profile.accessToken,
            profile.refreshToken || null,
            profile.expiresAt?.toISOString() || null,
            JSON.stringify(profile),
          ]
        );

        logger.info("oauth_linked_existing_user", {
          userId: user.id,
          provider: profile.provider,
          email: profile.email,
        });
      } else {
        // Create new user
        isNewUser = true;

        // Create user (no password needed for OAuth users)
        const newUserResult = await client.query<User>(
          `INSERT INTO users (
            email, password_hash, role, first_name, last_name, email_verified
          ) VALUES ($1, $2, $3, $4, $5, TRUE)
          RETURNING *`,
          [
            profile.email,
            "", // No password for OAuth users
            role,
            profile.firstName || null,
            profile.lastName || null,
          ]
        );

        user = newUserResult.rows[0];

        // Create profile
        if (role === "client") {
          await client.query(
            `INSERT INTO client_profiles (user_id, first_name, last_name) 
             VALUES ($1, $2, $3)`,
            [user.id, profile.firstName || null, profile.lastName || null]
          );
        } else if (role === "cleaner") {
          await client.query(
            `INSERT INTO cleaner_profiles (user_id, first_name, last_name, tier, reliability_score, hourly_rate_credits) 
             VALUES ($1, $2, $3, 'bronze', 100.0, 0)`,
            [user.id, profile.firstName || null, profile.lastName || null]
          );
        }

        // Create OAuth account
        await client.query(
          `INSERT INTO oauth_accounts (
            user_id, provider, provider_account_id, provider_email,
            access_token, refresh_token, token_expires_at, profile_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.id,
            profile.provider,
            profile.providerId,
            profile.email,
            profile.accessToken,
            profile.refreshToken || null,
            profile.expiresAt?.toISOString() || null,
            JSON.stringify(profile),
          ]
        );

        logger.info("oauth_user_created", {
          userId: user.id,
          provider: profile.provider,
          email: profile.email,
          role,
        });
      }
    }

    // Update last login
    await client.query(
      `UPDATE users 
       SET last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Log security event
    await client.query(`SELECT log_security_event($1, $2, $3, NULL, NULL, $4::JSONB)`, [
      user.id,
      "oauth_login",
      "success",
      JSON.stringify({ provider: profile.provider, new_user: isNewUser }),
    ]);

    // Generate JWT token
    const token = signAuthToken({
      id: user.id,
      role: user.role as any,
    });

    return { user, token, isNewUser };
  });
}

/**
 * Get OAuth accounts for a user
 */
export async function getUserOAuthAccounts(userId: string): Promise<OAuthAccount[]> {
  const result = await query<OAuthAccount>(
    `SELECT * FROM oauth_accounts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Unlink OAuth account
 */
export async function unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<void> {
  // Check if user has a password set (can't unlink if no password and only one OAuth)
  const userResult = await query<User>(`SELECT password_hash FROM users WHERE id = $1`, [userId]);

  const user = userResult.rows[0];

  if (!user.password_hash || user.password_hash === "") {
    // Check if this is the only OAuth account
    const oauthCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM oauth_accounts WHERE user_id = $1`,
      [userId]
    );

    const count = parseInt(oauthCount.rows[0]?.count ?? "0", 10);

    if (count <= 1) {
      throw Object.assign(
        new Error("Cannot unlink last authentication method. Please set a password first."),
        { statusCode: 400, code: "LAST_AUTH_METHOD" }
      );
    }
  }

  // Unlink account
  await query(
    `DELETE FROM oauth_accounts 
     WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );

  // Log security event
  await query(`SELECT log_security_event($1, $2, $3, NULL, NULL, $4::JSONB)`, [
    userId,
    "oauth_unlinked",
    "success",
    JSON.stringify({ provider }),
  ]);

  logger.info("oauth_unlinked", { userId, provider });
}

/**
 * Check if user has OAuth account for provider
 */
export async function hasOAuthAccount(userId: string, provider: OAuthProvider): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM oauth_accounts 
      WHERE user_id = $1 AND provider = $2
    ) as exists`,
    [userId, provider]
  );

  return result.rows[0]?.exists ?? false;
}

/**
 * Get OAuth account by provider
 */
export async function getOAuthAccount(
  userId: string,
  provider: OAuthProvider
): Promise<OAuthAccount | null> {
  const result = await query<OAuthAccount>(
    `SELECT * FROM oauth_accounts 
     WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );

  return result.rows[0] ?? null;
}

/**
 * Refresh OAuth token (for providers that support it)
 */
export async function refreshOAuthToken(
  accountId: string,
  newAccessToken: string,
  newRefreshToken?: string,
  expiresAt?: Date
): Promise<void> {
  await query(
    `UPDATE oauth_accounts 
     SET access_token = $1,
         refresh_token = COALESCE($2, refresh_token),
         token_expires_at = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [newAccessToken, newRefreshToken || null, expiresAt?.toISOString() || null, accountId]
  );

  logger.info("oauth_token_refreshed", { accountId });
}

/**
 * Check if user can set password (OAuth-only users)
 */
export async function canSetPassword(userId: string): Promise<boolean> {
  const userResult = await query<User>(`SELECT password_hash FROM users WHERE id = $1`, [userId]);

  const user = userResult.rows[0];

  return !user.password_hash || user.password_hash === "";
}

/**
 * Set password for OAuth-only user
 */
export async function setPasswordForOAuthUser(userId: string, newPassword: string): Promise<void> {
  // Check if user already has password
  const canSet = await canSetPassword(userId);
  if (!canSet) {
    throw Object.assign(new Error("User already has a password set"), {
      statusCode: 400,
      code: "PASSWORD_ALREADY_SET",
    });
  }

  // Hash and set password
  const passwordHash = await hashPassword(newPassword);

  await query(
    `UPDATE users 
     SET password_hash = $1,
         password_changed_at = NOW(),
         updated_at = NOW()
     WHERE id = $2`,
    [passwordHash, userId]
  );

  // Log security event
  await query(`SELECT log_security_event($1, $2, $3, NULL, NULL, '{}'::JSONB)`, [
    userId,
    "password_set",
    "success",
  ]);

  logger.info("password_set_oauth_user", { userId });
}
