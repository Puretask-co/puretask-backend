// src/tests/fixtures/bookings.ts
// Test booking/job fixtures for testing

import { query } from '../../db/client';
import { createTestClient, createTestCleaner } from './users';

export interface TestJob {
  id: string;
  client_id: string;
  cleaner_id?: string;
  status: string;
  credit_amount: number;
  scheduled_start_at: Date;
  scheduled_end_at: Date;
  address: string;
}

/**
 * Create a test job/booking
 */
export async function createTestJob(overrides?: Partial<TestJob>): Promise<TestJob> {
  const client = await createTestClient();

  const job: TestJob = {
    id: `test-job-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    client_id: client.id,
    status: 'requested',
    credit_amount: 100,
    scheduled_start_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
    scheduled_end_at: new Date(Date.now() + 26 * 60 * 60 * 1000), // 26 hours from now
    address: '123 Test St, Test City, TS 12345',
    ...overrides,
  };

  await query(
    `INSERT INTO jobs (
      id, client_id, cleaner_id, status, credit_amount,
      scheduled_start_at, scheduled_end_at, address
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      job.id,
      job.client_id,
      job.cleaner_id || null,
      job.status,
      job.credit_amount,
      job.scheduled_start_at,
      job.scheduled_end_at,
      job.address,
    ]
  );

  return job;
}

/**
 * Create a test job with cleaner assigned
 */
export async function createTestJobWithCleaner(): Promise<TestJob> {
  const cleaner = await createTestCleaner();
  return createTestJob({
    cleaner_id: cleaner.id,
    status: 'accepted',
  });
}

/**
 * Clean up test job
 */
export async function deleteTestJob(jobId: string): Promise<void> {
  await query(`DELETE FROM jobs WHERE id = $1`, [jobId]);
}

/**
 * Clean up all test jobs
 */
export async function cleanupTestJobs(): Promise<void> {
  await query(`DELETE FROM jobs WHERE id LIKE 'test-job-%'`);
}
