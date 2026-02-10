// src/tests/fixtures/users.ts
// Test user fixtures for testing

import { query } from '../../db/client';

export interface TestUser {
  id: string;
  email: string;
  password_hash: string;
  role: 'client' | 'cleaner' | 'admin';
  created_at: Date;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides?: Partial<TestUser>): Promise<TestUser> {
  const user: TestUser = {
    id: `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    email: `test-${Date.now()}@example.com`,
    password_hash: '$2b$10$test', // Hashed password
    role: 'client',
    created_at: new Date(),
    ...overrides,
  };

  await query(
    `INSERT INTO users (id, email, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, user.email, user.password_hash, user.role, user.created_at]
  );

  return user;
}

/**
 * Create a test client user
 */
export async function createTestClient(): Promise<TestUser> {
  return createTestUser({ role: 'client' });
}

/**
 * Create a test cleaner user
 */
export async function createTestCleaner(): Promise<TestUser> {
  const user = await createTestUser({ role: 'cleaner' });
  
  // Also create cleaner profile
  await query(
    `INSERT INTO cleaner_profiles (user_id, first_name, last_name, tier)
     VALUES ($1, $2, $3, $4)`,
    [user.id, 'Test', 'Cleaner', 'bronze']
  );

  return user;
}

/**
 * Create a test admin user
 */
export async function createTestAdmin(): Promise<TestUser> {
  return createTestUser({ role: 'admin' });
}

/**
 * Clean up test user
 */
export async function deleteTestUser(userId: string): Promise<void> {
  await query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/**
 * Clean up all test users
 */
export async function cleanupTestUsers(): Promise<void> {
  await query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);
}
