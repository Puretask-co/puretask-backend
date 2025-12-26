"use strict";
// src/services/userManagementService.ts
// Admin user management service - CRUD operations for users
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeUserForAdmin = sanitizeUserForAdmin;
exports.listUsers = listUsers;
exports.getUserById = getUserById;
exports.getUserByEmail = getUserByEmail;
exports.createUser = createUser;
exports.updateUser = updateUser;
exports.deleteUser = deleteUser;
exports.resetUserPassword = resetUserPassword;
exports.adjustUserCredits = adjustUserCredits;
exports.getUserStats = getUserStats;
const client_1 = require("../db/client");
const logger_1 = require("../lib/logger");
const auth_1 = require("../lib/auth");
// ============================================
// User Sanitization
// ============================================
/**
 * Sanitize user for admin response (excludes password_hash)
 * Admins can see more fields than regular users, but never password hashes
 */
function sanitizeUserForAdmin(user) {
    const { password_hash, ...sanitized } = user;
    return sanitized;
}
// ============================================
// List Users
// ============================================
/**
 * List all users with optional filters
 */
async function listUsers(filters = {}) {
    const { role, search, limit = 50, offset = 0 } = filters;
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    if (role) {
        conditions.push(`u.role = $${paramIndex++}`);
        params.push(role);
    }
    if (search) {
        conditions.push(`u.email ILIKE $${paramIndex++}`);
        params.push(`%${search}%`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    // Get total count
    const countResult = await (0, client_1.query)(`SELECT COUNT(*) as count FROM users u ${whereClause}`, params);
    const total = Number(countResult.rows[0]?.count || 0);
    // Get users with profiles and balance
    const usersResult = await (0, client_1.query)(`
      SELECT 
        u.*,
        COALESCE(cp.default_address, '') as default_address,
        clp.tier,
        clp.reliability_score,
        clp.hourly_rate_credits,
        COALESCE(SUM(cl.delta_credits), 0)::text as balance
      FROM users u
      LEFT JOIN client_profiles cp ON cp.user_id = u.id AND u.role = 'client'
      LEFT JOIN cleaner_profiles clp ON clp.user_id = u.id AND u.role = 'cleaner'
      LEFT JOIN credit_ledger cl ON cl.user_id = u.id
      ${whereClause}
      GROUP BY u.id, cp.id, clp.id
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, limit, offset]);
    const users = usersResult.rows.map((row) => ({
        ...row,
        credit_balance: Number(row.balance || 0),
    }));
    return { users, total };
}
// ============================================
// Get Single User
// ============================================
/**
 * Get user by ID with full profile
 */
async function getUserById(userId) {
    const result = await (0, client_1.query)(`
      SELECT 
        u.*,
        cp.default_address,
        cp.stripe_customer_id,
        clp.tier,
        clp.reliability_score,
        clp.hourly_rate_credits,
        clp.stripe_account_id,
        COALESCE(SUM(cl.delta_credits), 0)::text as balance
      FROM users u
      LEFT JOIN client_profiles cp ON cp.user_id = u.id
      LEFT JOIN cleaner_profiles clp ON clp.user_id = u.id
      LEFT JOIN credit_ledger cl ON cl.user_id = u.id
      WHERE u.id = $1
      GROUP BY u.id, cp.id, clp.id
    `, [userId]);
    if (result.rows.length === 0) {
        return null;
    }
    const row = result.rows[0];
    return {
        ...row,
        credit_balance: Number(row.balance || 0),
    };
}
/**
 * Get user by email
 */
async function getUserByEmail(email) {
    const result = await (0, client_1.query)(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] ?? null;
}
// ============================================
// Create User
// ============================================
/**
 * Create a new user (admin action)
 */
async function createUser(input) {
    const { email, password, role, phone, defaultAddress, hourlyRateCredits } = input;
    // Check if email already exists
    const existing = await getUserByEmail(email);
    if (existing) {
        throw Object.assign(new Error("Email already in use"), { statusCode: 400 });
    }
    // Hash password
    const passwordHash = await (0, auth_1.hashPassword)(password);
    // Create user
    const userResult = await (0, client_1.query)(`
      INSERT INTO users (email, password_hash, role, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [email, passwordHash, role, phone ?? null]);
    const user = userResult.rows[0];
    // Create profile based on role
    if (role === "client") {
        await (0, client_1.query)(`
        INSERT INTO client_profiles (user_id, default_address)
        VALUES ($1, $2)
      `, [user.id, defaultAddress ?? null]);
    }
    else if (role === "cleaner") {
        await (0, client_1.query)(`
        INSERT INTO cleaner_profiles (user_id, hourly_rate_credits)
        VALUES ($1, $2)
      `, [user.id, hourlyRateCredits ?? 0]);
    }
    logger_1.logger.info("admin_user_created", {
        userId: user.id,
        email,
        role,
    });
    return getUserById(user.id);
}
// ============================================
// Update User
// ============================================
/**
 * Update user details (admin action)
 */
async function updateUser(userId, input) {
    const user = await getUserById(userId);
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    // Update user table
    const userFields = [];
    const userParams = [];
    let paramIndex = 1;
    if (input.email !== undefined) {
        // Check if email is already taken by another user
        const existing = await getUserByEmail(input.email);
        if (existing && existing.id !== userId) {
            throw Object.assign(new Error("Email already in use"), { statusCode: 400 });
        }
        userFields.push(`email = $${paramIndex++}`);
        userParams.push(input.email);
    }
    if (input.phone !== undefined) {
        userFields.push(`phone = $${paramIndex++}`);
        userParams.push(input.phone);
    }
    if (input.role !== undefined && input.role !== user.role) {
        userFields.push(`role = $${paramIndex++}`);
        userParams.push(input.role);
        // Handle role change - create new profile if needed
        if (input.role === "client") {
            await (0, client_1.query)(`INSERT INTO client_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
        }
        else if (input.role === "cleaner") {
            await (0, client_1.query)(`INSERT INTO cleaner_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
        }
    }
    if (userFields.length > 0) {
        userFields.push(`updated_at = NOW()`);
        userParams.push(userId);
        await (0, client_1.query)(`UPDATE users SET ${userFields.join(", ")} WHERE id = $${paramIndex}`, userParams);
    }
    // Update client profile
    if (input.defaultAddress !== undefined && (user.role === "client" || input.role === "client")) {
        await (0, client_1.query)(`UPDATE client_profiles SET default_address = $2, updated_at = NOW() WHERE user_id = $1`, [userId, input.defaultAddress]);
    }
    // Update cleaner profile
    const cleanerRole = input.role ?? user.role;
    if (cleanerRole === "cleaner") {
        const cleanerFields = [];
        const cleanerParams = [userId];
        let cleanerParamIndex = 2;
        if (input.hourlyRateCredits !== undefined) {
            cleanerFields.push(`hourly_rate_credits = $${cleanerParamIndex++}`);
            cleanerParams.push(input.hourlyRateCredits);
        }
        if (input.tier !== undefined) {
            cleanerFields.push(`tier = $${cleanerParamIndex++}`);
            cleanerParams.push(input.tier);
        }
        if (cleanerFields.length > 0) {
            cleanerFields.push(`updated_at = NOW()`);
            await (0, client_1.query)(`UPDATE cleaner_profiles SET ${cleanerFields.join(", ")} WHERE user_id = $1`, cleanerParams);
        }
    }
    logger_1.logger.info("admin_user_updated", {
        userId,
        changes: input,
    });
    return getUserById(userId);
}
// ============================================
// Delete User
// ============================================
/**
 * Delete user (soft delete by disabling, or hard delete)
 * Note: Hard delete will fail if user has jobs/payments due to FK constraints
 */
async function deleteUser(userId, hard = false) {
    const user = await getUserById(userId);
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    if (hard) {
        // Hard delete - will fail if FK constraints exist
        try {
            await (0, client_1.query)(`DELETE FROM users WHERE id = $1`, [userId]);
            logger_1.logger.info("admin_user_hard_deleted", { userId, email: user.email });
        }
        catch (err) {
            throw Object.assign(new Error("Cannot delete user with existing jobs or payments"), { statusCode: 400 });
        }
    }
    else {
        // Soft delete - disable the account by changing email
        await (0, client_1.query)(`
        UPDATE users 
        SET email = CONCAT('deleted_', id, '_', email),
            updated_at = NOW()
        WHERE id = $1
      `, [userId]);
        logger_1.logger.info("admin_user_soft_deleted", { userId, email: user.email });
    }
}
// ============================================
// Password Management
// ============================================
/**
 * Reset user password (admin action)
 */
async function resetUserPassword(userId, newPassword) {
    const user = await getUserById(userId);
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    const passwordHash = await (0, auth_1.hashPassword)(newPassword);
    await (0, client_1.query)(`UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`, [userId, passwordHash]);
    logger_1.logger.info("admin_password_reset", { userId, email: user.email });
}
// ============================================
// Credit Management
// ============================================
/**
 * Adjust user credits (admin action)
 */
async function adjustUserCredits(userId, amount, reason) {
    const user = await getUserById(userId);
    if (!user) {
        throw Object.assign(new Error("User not found"), { statusCode: 404 });
    }
    await (0, client_1.query)(`
      INSERT INTO credit_ledger (user_id, delta_credits, reason)
      VALUES ($1, $2, 'adjustment')
    `, [userId, amount]);
    // Get new balance
    const balanceResult = await (0, client_1.query)(`SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`, [userId]);
    const newBalance = Number(balanceResult.rows[0]?.balance || 0);
    logger_1.logger.info("admin_credits_adjusted", {
        userId,
        email: user.email,
        amount,
        reason,
        newBalance,
    });
    return { newBalance };
}
// ============================================
// User Statistics
// ============================================
/**
 * Get user statistics (for admin dashboard)
 */
async function getUserStats() {
    const result = await (0, client_1.query)(`
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role = 'client') as total_clients,
        COUNT(*) FILTER (WHERE role = 'cleaner') as total_cleaners,
        COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as new_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_month
      FROM users
    `);
    const row = result.rows[0];
    return {
        totalUsers: Number(row?.total_users || 0),
        totalClients: Number(row?.total_clients || 0),
        totalCleaners: Number(row?.total_cleaners || 0),
        totalAdmins: Number(row?.total_admins || 0),
        newUsersToday: Number(row?.new_today || 0),
        newUsersThisWeek: Number(row?.new_week || 0),
        newUsersThisMonth: Number(row?.new_month || 0),
    };
}
