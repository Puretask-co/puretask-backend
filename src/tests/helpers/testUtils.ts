// src/tests/helpers/testUtils.ts
// Test utilities for creating test users, jobs, and common operations

import request from "supertest";
import app from "../../index";
import { query } from "../../db/client";

// ============================================
// Types
// ============================================

export interface TestUser {
  id: string;
  email: string;
  role: "client" | "cleaner" | "admin";
  token: string;
}

export interface TestJob {
  id: string;
  client_id: string;
  cleaner_id: string | null;
  status: string;
  credit_amount: number;
}

// ============================================
// Unique ID Generator
// ============================================

let uniqueCounter = 0;

function uniqueEmail(prefix: string): string {
  uniqueCounter += 1;
  return `${prefix}+${Date.now()}_${uniqueCounter}@test.puretask.com`;
}

// ============================================
// User Creation
// ============================================

/**
 * Create a test client user
 */
export async function createTestClient(): Promise<TestUser> {
  const email = uniqueEmail("client");
  const password = "testpassword123";

  const res = await request(app)
    .post("/auth/register")
    .send({
      email,
      password,
      role: "client",
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test client: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.user.id,
    email: res.body.user.email,
    role: res.body.user.role,
    token: res.body.token,
  };
}

/**
 * Create a test cleaner user
 */
export async function createTestCleaner(): Promise<TestUser> {
  const email = uniqueEmail("cleaner");
  const password = "testpassword123";

  const res = await request(app)
    .post("/auth/register")
    .send({
      email,
      password,
      role: "cleaner",
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test cleaner: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.user.id,
    email: res.body.user.email,
    role: res.body.user.role,
    token: res.body.token,
  };
}

/**
 * Create a test admin user (directly in DB since admin can't self-register)
 */
export async function createTestAdmin(): Promise<TestUser> {
  const email = uniqueEmail("admin");
  // Note: In real tests, you'd hash the password properly
  // For simplicity, we'll create via DB and then login
  
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("adminpassword123", 10);

  const result = await query<{ id: string; email: string; role: string }>(
    `
      INSERT INTO users (email, password_hash, role)
      VALUES ($1, $2, 'admin')
      RETURNING id, email, role
    `,
    [email, passwordHash]
  );

  const user = result.rows[0];

  // Login to get token
  const loginRes = await request(app)
    .post("/auth/login")
    .send({ email, password: "adminpassword123" });

  if (loginRes.status !== 200) {
    throw new Error(`Failed to login test admin: ${loginRes.status}`);
  }

  return {
    id: user.id,
    email: user.email,
    role: "admin",
    token: loginRes.body.token,
  };
}

// ============================================
// Job Creation
// ============================================

/**
 * Create a test job for a client
 */
export async function createTestJob(
  client: TestUser,
  options?: {
    creditAmount?: number;
    address?: string;
  }
): Promise<TestJob> {
  const now = new Date();
  const endTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

  const res = await request(app)
    .post("/jobs")
    .set("Authorization", `Bearer ${client.token}`)
    .send({
      scheduled_start_at: now.toISOString(),
      scheduled_end_at: endTime.toISOString(),
      address: options?.address || "123 Test Street, Test City",
      credit_amount: options?.creditAmount || 100,
    });

  if (res.status !== 201) {
    throw new Error(`Failed to create test job: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return {
    id: res.body.job.id,
    client_id: res.body.job.client_id,
    cleaner_id: res.body.job.cleaner_id,
    status: res.body.job.status,
    credit_amount: res.body.job.credit_amount,
  };
}

// ============================================
// Credit Operations
// ============================================

/**
 * Add credits to a user's account (directly in DB)
 */
export async function addCreditsToUser(userId: string, amount: number): Promise<void> {
  await query(
    `
      INSERT INTO credit_ledger (user_id, delta_credits, reason)
      VALUES ($1, $2, 'purchase')
    `,
    [userId, amount]
  );
}

/**
 * Get user's credit balance
 */
export async function getUserBalance(userId: string): Promise<number> {
  const result = await query<{ balance: string }>(
    `SELECT COALESCE(SUM(delta_credits), 0) as balance FROM credit_ledger WHERE user_id = $1`,
    [userId]
  );
  return Number(result.rows[0]?.balance || 0);
}

// ============================================
// Job State Transitions (for test setup)
// ============================================

/**
 * Transition a job through states for testing
 */
export async function transitionJobTo(
  jobId: string,
  targetStatus: string,
  cleanerId?: string
): Promise<void> {
  const updates: string[] = [`status = '${targetStatus}'`, `updated_at = NOW()`];
  
  if (cleanerId) {
    updates.push(`cleaner_id = '${cleanerId}'`);
  }

  await query(
    `UPDATE jobs SET ${updates.join(", ")} WHERE id = $1`,
    [jobId]
  );
}

// ============================================
// Cleanup
// ============================================

/**
 * Clean up test data (call in afterAll or afterEach)
 */
export async function cleanupTestData(): Promise<void> {
  // Delete in order of dependencies
  await query(`DELETE FROM notification_failures WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM credit_ledger WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM payouts WHERE cleaner_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM disputes WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM job_events WHERE job_id IN (SELECT id FROM jobs WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com'))`);
  await query(`DELETE FROM jobs WHERE client_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM cleaner_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM client_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.puretask.com')`);
  await query(`DELETE FROM users WHERE email LIKE '%@test.puretask.com'`);
}

// ============================================
// Assertion Helpers
// ============================================

/**
 * Assert job is in expected status
 */
export async function assertJobStatus(jobId: string, expectedStatus: string): Promise<void> {
  const result = await query<{ status: string }>(
    `SELECT status FROM jobs WHERE id = $1`,
    [jobId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Job ${jobId} not found`);
  }
  
  if (result.rows[0].status !== expectedStatus) {
    throw new Error(`Expected job status '${expectedStatus}', got '${result.rows[0].status}'`);
  }
}

/**
 * Assert credit ledger has expected entry
 */
export async function assertCreditLedgerEntry(
  userId: string,
  jobId: string,
  expectedReason: string,
  expectedAmount?: number
): Promise<void> {
  const result = await query<{ delta_credits: number; reason: string }>(
    `
      SELECT delta_credits, reason
      FROM credit_ledger
      WHERE user_id = $1 AND job_id = $2 AND reason = $3
    `,
    [userId, jobId, expectedReason]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Credit ledger entry not found for user ${userId}, job ${jobId}, reason ${expectedReason}`);
  }
  
  if (expectedAmount !== undefined && result.rows[0].delta_credits !== expectedAmount) {
    throw new Error(`Expected credit amount ${expectedAmount}, got ${result.rows[0].delta_credits}`);
  }
}

