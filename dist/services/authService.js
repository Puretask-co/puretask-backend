"use strict";
// src/services/authService.ts
// Authentication service: user registration, login, profile management
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.getUserWithProfile = getUserWithProfile;
exports.updatePassword = updatePassword;
exports.resetPassword = resetPassword;
exports.updateClientProfile = updateClientProfile;
exports.updateCleanerProfile = updateCleanerProfile;
exports.sanitizeUser = sanitizeUser;
const client_1 = require("../db/client");
const auth_1 = require("../lib/auth");
const logger_1 = require("../lib/logger");
// ============================================
// Registration
// ============================================
/**
 * Register a new user with email and password
 * Creates user row + corresponding profile (client or cleaner)
 */
async function registerUser(input) {
    const { email, password, role = "client" } = input;
    // Validate role (admin cannot self-register)
    if (role === "admin") {
        throw Object.assign(new Error("Cannot register as admin"), { statusCode: 400 });
    }
    // Check if email already exists (case-insensitive via CITEXT)
    const existing = await (0, client_1.query)(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existing.rows.length > 0) {
        throw Object.assign(new Error("Email already in use"), {
            statusCode: 400,
            code: "EMAIL_EXISTS",
        });
    }
    // Hash password
    const passwordHash = await (0, auth_1.hashPassword)(password);
    // Create user and profile in a transaction to ensure foreign key constraints work
    const user = await (0, client_1.withTransaction)(async (client) => {
        // Create user
        const userResult = await client.query(`
        INSERT INTO users (email, password_hash, role)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [email, passwordHash, role]);
        const newUser = userResult.rows[0];
        if (!newUser) {
            throw Object.assign(new Error("Failed to create user"), { statusCode: 500 });
        }
        // Create corresponding profile in the same transaction
        if (role === "client") {
            await client.query(`INSERT INTO client_profiles (user_id) VALUES ($1)`, [newUser.id]);
        }
        else if (role === "cleaner") {
            // Try to insert with all columns first (if they exist)
            // If columns don't exist, fall back to just user_id
            // Use a savepoint so we can rollback the failed INSERT and try again
            await client.query("SAVEPOINT cleaner_profile_insert");
            try {
                await client.query(`INSERT INTO cleaner_profiles (user_id, tier, reliability_score, hourly_rate_credits) VALUES ($1, 'bronze', 100.0, 0)`, [newUser.id]);
                // Success - release the savepoint
                await client.query("RELEASE SAVEPOINT cleaner_profile_insert");
            }
            catch (error) {
                // If columns don't exist (error code 42703 = undefined column), rollback to savepoint and try with just user_id
                if (error?.code === '42703') {
                    await client.query("ROLLBACK TO SAVEPOINT cleaner_profile_insert");
                    await client.query(`INSERT INTO cleaner_profiles (user_id) VALUES ($1)`, [newUser.id]);
                }
                else {
                    // Re-throw other errors
                    throw error;
                }
            }
        }
        return newUser;
    });
    logger_1.logger.info("user_registered", {
        userId: user.id,
        email: user.email,
        role: user.role,
    });
    return user;
}
// ============================================
// Login
// ============================================
/**
 * Authenticate user with email and password
 * Returns user if credentials are valid
 */
async function loginUser(email, password) {
    // Find user by email
    const result = await (0, client_1.query)(`SELECT * FROM users WHERE email = $1`, [email]);
    const user = result.rows[0];
    if (!user) {
        // Use generic message to prevent email enumeration
        throw Object.assign(new Error("Invalid email or password"), {
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
    }
    // Verify password
    const isValid = await (0, auth_1.verifyPassword)(password, user.password_hash);
    if (!isValid) {
        logger_1.logger.warn("login_failed", { email, reason: "invalid_password" });
        throw Object.assign(new Error("Invalid email or password"), {
            statusCode: 401,
            code: "INVALID_CREDENTIALS",
        });
    }
    logger_1.logger.info("user_logged_in", {
        userId: user.id,
        email: user.email,
    });
    return user;
}
// ============================================
// User Retrieval
// ============================================
/**
 * Get user by ID
 */
async function getUserById(id) {
    const result = await (0, client_1.query)(`SELECT * FROM users WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
}
/**
 * Get user by email
 */
async function getUserByEmail(email) {
    const result = await (0, client_1.query)(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] ?? null;
}
/**
 * Get user with their profile
 */
async function getUserWithProfile(userId) {
    const userResult = await (0, client_1.query)(`SELECT * FROM users WHERE id = $1`, [userId]);
    const user = userResult.rows[0];
    if (!user) {
        return null;
    }
    let clientProfile;
    let cleanerProfile;
    if (user.role === "client") {
        const profileResult = await (0, client_1.query)(`SELECT * FROM client_profiles WHERE user_id = $1`, [userId]);
        clientProfile = profileResult.rows[0];
    }
    else if (user.role === "cleaner") {
        const profileResult = await (0, client_1.query)(`SELECT * FROM cleaner_profiles WHERE user_id = $1`, [userId]);
        cleanerProfile = profileResult.rows[0];
    }
    return { user, clientProfile, cleanerProfile };
}
// ============================================
// Password Management
// ============================================
/**
 * Update user password
 */
async function updatePassword(userId, currentPassword, newPassword) {
    // Get current user
    const result = await (0, client_1.query)(`SELECT * FROM users WHERE id = $1`, [userId]);
    const user = result.rows[0];
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    // Verify current password
    const isValid = await (0, auth_1.verifyPassword)(currentPassword, user.password_hash);
    if (!isValid) {
        throw Object.assign(new Error("Current password is incorrect"), {
            statusCode: 400,
            code: "INVALID_PASSWORD",
        });
    }
    // Hash and update new password
    const newHash = await (0, auth_1.hashPassword)(newPassword);
    await (0, client_1.query)(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, newHash]);
    logger_1.logger.info("password_updated", { userId });
}
/**
 * Reset password (admin or forgot password flow)
 */
async function resetPassword(userId, newPassword) {
    const newHash = await (0, auth_1.hashPassword)(newPassword);
    await (0, client_1.query)(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, newHash]);
    logger_1.logger.info("password_reset", { userId });
}
// ============================================
// Profile Updates
// ============================================
/**
 * Update client profile
 */
async function updateClientProfile(userId, updates) {
    const result = await (0, client_1.query)(`
      UPDATE client_profiles
      SET default_address = COALESCE($2, default_address),
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [userId, updates.default_address ?? null]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Profile not found"), { statusCode: 404 });
    }
    return result.rows[0];
}
/**
 * Update cleaner profile
 */
async function updateCleanerProfile(userId, updates) {
    const result = await (0, client_1.query)(`
      UPDATE cleaner_profiles
      SET tier = COALESCE($2, tier),
          hourly_rate_credits = COALESCE($3, hourly_rate_credits),
          stripe_account_id = COALESCE($4, stripe_account_id),
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `, [
        userId,
        updates.tier ?? null,
        updates.hourly_rate_credits ?? null,
        updates.stripe_account_id ?? null,
    ]);
    if (result.rows.length === 0) {
        throw Object.assign(new Error("Profile not found"), { statusCode: 404 });
    }
    return result.rows[0];
}
/**
 * Sanitize user for public response (remove password_hash)
 */
function sanitizeUser(user) {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
    };
}
