// src/services/userManagementService.ts
// Admin user management service - CRUD operations for users

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { hashPassword } from "../lib/auth";
import { User, UserRole, ClientProfile, CleanerProfile } from "../types/db";

// ============================================
// User Sanitization
// ============================================

/**
 * Sanitize user for admin response (excludes password_hash)
 * Admins can see more fields than regular users, but never password hashes
 */
export function sanitizeUserForAdmin(user: User | UserWithProfile): Omit<User | UserWithProfile, 'password_hash'> {
  const { password_hash, ...sanitized } = user as any;
  return sanitized;
}

// ============================================
// Types
// ============================================

export interface UserWithProfile extends User {
  profile?: ClientProfile | CleanerProfile;
  credit_balance?: number;
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  defaultAddress?: string;  // for clients
  hourlyRateCredits?: number;  // for cleaners
}

export interface UpdateUserInput {
  email?: string;
  phone?: string;
  role?: UserRole;
  defaultAddress?: string;
  hourlyRateCredits?: number;
  tier?: string;
}

export interface UserListFilters {
  role?: UserRole;
  search?: string;  // email search
  limit?: number;
  offset?: number;
}

// ============================================
// List Users
// ============================================

/**
 * List all users with optional filters
 */
export async function listUsers(filters: UserListFilters = {}): Promise<{
  users: UserWithProfile[];
  total: number;
}> {
  const { role, search, limit = 50, offset = 0 } = filters;

  const conditions: string[] = [];
  const params: unknown[] = [];
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
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users u ${whereClause}`,
    params
  );
  const total = Number(countResult.rows[0]?.count || 0);

  // Get users with profiles and balance
  const usersResult = await query<UserWithProfile & {
    default_address?: string;
    tier?: string;
    reliability_score?: number;
    hourly_rate_credits?: number;
    balance?: string;
  }>(
    `
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
    `,
    [...params, limit, offset]
  );

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
export async function getUserById(userId: string): Promise<UserWithProfile | null> {
  const result = await query<UserWithProfile & {
    default_address?: string;
    stripe_customer_id?: string;
    tier?: string;
    reliability_score?: number;
    hourly_rate_credits?: number;
    stripe_account_id?: string;
    balance?: string;
  }>(
    `
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
    `,
    [userId]
  );

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
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE email = $1`,
    [email]
  );
  return result.rows[0] ?? null;
}

// ============================================
// Create User
// ============================================

/**
 * Create a new user (admin action)
 */
export async function createUser(input: CreateUserInput): Promise<UserWithProfile> {
  const { email, password, role, phone, defaultAddress, hourlyRateCredits } = input;

  // Check if email already exists
  const existing = await getUserByEmail(email);
  if (existing) {
    throw Object.assign(new Error("Email already in use"), { statusCode: 400 });
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const userResult = await query<User>(
    `
      INSERT INTO users (email, password_hash, role, phone)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [email, passwordHash, role, phone ?? null]
  );

  const user = userResult.rows[0];

  // Create profile based on role
  if (role === "client") {
    await query(
      `
        INSERT INTO client_profiles (user_id, default_address)
        VALUES ($1, $2)
      `,
      [user.id, defaultAddress ?? null]
    );
  } else if (role === "cleaner") {
    await query(
      `
        INSERT INTO cleaner_profiles (user_id, hourly_rate_credits)
        VALUES ($1, $2)
      `,
      [user.id, hourlyRateCredits ?? 0]
    );
  }

  logger.info("admin_user_created", {
    userId: user.id,
    email,
    role,
  });

  return getUserById(user.id) as Promise<UserWithProfile>;
}

// ============================================
// Update User
// ============================================

/**
 * Update user details (admin action)
 */
export async function updateUser(
  userId: string,
  input: UpdateUserInput
): Promise<UserWithProfile> {
  const user = await getUserById(userId);
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  // Update user table
  const userFields: string[] = [];
  const userParams: unknown[] = [];
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
      await query(
        `INSERT INTO client_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [userId]
      );
    } else if (input.role === "cleaner") {
      await query(
        `INSERT INTO cleaner_profiles (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [userId]
      );
    }
  }

  if (userFields.length > 0) {
    userFields.push(`updated_at = NOW()`);
    userParams.push(userId);
    
    await query(
      `UPDATE users SET ${userFields.join(", ")} WHERE id = $${paramIndex}`,
      userParams
    );
  }

  // Update client profile
  if (input.defaultAddress !== undefined && (user.role === "client" || input.role === "client")) {
    await query(
      `UPDATE client_profiles SET default_address = $2, updated_at = NOW() WHERE user_id = $1`,
      [userId, input.defaultAddress]
    );
  }

  // Update cleaner profile
  const cleanerRole = input.role ?? user.role;
  if (cleanerRole === "cleaner") {
    const cleanerFields: string[] = [];
    const cleanerParams: unknown[] = [userId];
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
      await query(
        `UPDATE cleaner_profiles SET ${cleanerFields.join(", ")} WHERE user_id = $1`,
        cleanerParams
      );
    }
  }

  logger.info("admin_user_updated", {
    userId,
    changes: input,
  });

  return getUserById(userId) as Promise<UserWithProfile>;
}

// ============================================
// Delete User
// ============================================

/**
 * Delete user (soft delete by disabling, or hard delete)
 * Note: Hard delete will fail if user has jobs/payments due to FK constraints
 */
export async function deleteUser(userId: string, hard: boolean = false): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  if (hard) {
    // Hard delete - will fail if FK constraints exist
    try {
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
      logger.info("admin_user_hard_deleted", { userId, email: user.email });
    } catch (err) {
      throw Object.assign(
        new Error("Cannot delete user with existing jobs or payments"),
        { statusCode: 400 }
      );
    }
  } else {
    // Soft delete - disable the account by changing email
    await query(
      `
        UPDATE users 
        SET email = CONCAT('deleted_', id, '_', email),
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId]
    );
    logger.info("admin_user_soft_deleted", { userId, email: user.email });
  }
}

// ============================================
// Password Management
// ============================================

/**
 * Reset user password (admin action)
 */
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<void> {
  const user = await getUserById(userId);
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  const passwordHash = await hashPassword(newPassword);

  await query(
    `UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1`,
    [userId, passwordHash]
  );

  logger.info("admin_password_reset", { userId, email: user.email });
}

// ============================================
// Credit Management
// ============================================

/**
 * Adjust user credits (admin action)
 */
export async function adjustUserCredits(
  userId: string,
  amount: number,
  reason: string
): Promise<{ newBalance: number }> {
  const user = await getUserById(userId);
  if (!user) {
    throw Object.assign(new Error("User not found"), { statusCode: 404 });
  }

  await query(
    `
      INSERT INTO credit_ledger (user_id, delta_credits, reason)
      VALUES ($1, $2, 'adjustment')
    `,
    [userId, amount]
  );

  // Get new balance
  const balanceResult = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(delta_credits), 0)::text as balance FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );

  const newBalance = Number(balanceResult.rows[0]?.balance || 0);

  logger.info("admin_credits_adjusted", {
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
export async function getUserStats(): Promise<{
  totalUsers: number;
  totalClients: number;
  totalCleaners: number;
  totalAdmins: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
}> {
  const result = await query<{
    total_users: string;
    total_clients: string;
    total_cleaners: string;
    total_admins: string;
    new_today: string;
    new_week: string;
    new_month: string;
  }>(
    `
      SELECT
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE role = 'client') as total_clients,
        COUNT(*) FILTER (WHERE role = 'cleaner') as total_cleaners,
        COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
        COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as new_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as new_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as new_month
      FROM users
    `
  );

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

