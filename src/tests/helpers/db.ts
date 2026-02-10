// src/tests/helpers/db.ts
// Database setup/teardown helpers for testing

import { query, pool } from '../../db/client';
import { logger } from '../../lib/logger';

/**
 * Setup test database
 * Creates necessary tables and test data
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Ensure test database is clean
    await cleanupTestDatabase();

    // Run migrations if needed
    // In a real scenario, you'd run your migration files here
    logger.info('test_database_setup', { message: 'Test database setup complete' });
  } catch (error: any) {
    logger.error('test_database_setup_failed', { error: error.message });
    throw error;
  }
}

/**
 * Cleanup test database
 * Removes all test data
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Delete test data in reverse order of dependencies
    await query('DELETE FROM job_events WHERE job_id LIKE $1', ['test-%']);
    await query('DELETE FROM jobs WHERE id LIKE $1', ['test-%']);
    await query('DELETE FROM cleaner_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['test-%@example.com']);
    await query('DELETE FROM users WHERE email LIKE $1', ['test-%@example.com']);
    
    logger.info('test_database_cleanup', { message: 'Test database cleanup complete' });
  } catch (error: any) {
    logger.error('test_database_cleanup_failed', { error: error.message });
    // Don't throw - cleanup failures shouldn't break tests
  }
}

/**
 * Close database connection
 */
export async function closeTestDatabase(): Promise<void> {
  try {
    await pool.end();
    logger.info('test_database_closed', { message: 'Test database connection closed' });
  } catch (error: any) {
    logger.error('test_database_close_failed', { error: error.message });
  }
}

/**
 * Reset database to clean state
 */
export async function resetTestDatabase(): Promise<void> {
  await cleanupTestDatabase();
  await setupTestDatabase();
}

/**
 * Execute SQL in a transaction that gets rolled back
 * Useful for tests that need to modify data
 */
export async function withTestTransaction<T>(
  callback: () => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback();
    await client.query('ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
