// src/tests/helpers/seed.ts
// Seed data utilities for testing

import { query } from '../../db/client';
import { createTestUser, createTestClient, createTestCleaner, createTestAdmin } from '../fixtures/users';
import { createTestJob, createTestJobWithCleaner } from '../fixtures/bookings';

/**
 * Seed test database with common test data
 */
export async function seedTestDatabase(): Promise<{
  client: any;
  cleaner: any;
  admin: any;
  jobs: any[];
}> {
  const client = await createTestClient();
  const cleaner = await createTestCleaner();
  const admin = await createTestAdmin();
  
  const jobs = [
    await createTestJob({ client_id: client.id }),
    await createTestJobWithCleaner(),
  ];

  return { client, cleaner, admin, jobs };
}

/**
 * Seed with specific scenario
 */
export async function seedBookingScenario(): Promise<{
  client: any;
  cleaner: any;
  job: any;
}> {
  const client = await createTestClient();
  const cleaner = await createTestCleaner();
  const job = await createTestJob({
    client_id: client.id,
    cleaner_id: cleaner.id,
    status: 'accepted',
  });

  return { client, cleaner, job };
}

/**
 * Seed with payment scenario
 */
export async function seedPaymentScenario(): Promise<{
  client: any;
  cleaner: any;
  job: any;
  paymentIntentId: string;
}> {
  const { client, cleaner, job } = await seedBookingScenario();
  
  // Create payment intent record
  const paymentIntentId = `pi_test_${Date.now()}`;
  await query(
    `INSERT INTO payment_intents (id, job_id, client_id, amount_cents, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [paymentIntentId, job.id, client.id, job.credit_amount * 10, 'pending']
  );

  return { client, cleaner, job, paymentIntentId };
}

/**
 * Seed with dispute scenario
 */
export async function seedDisputeScenario(): Promise<{
  client: any;
  cleaner: any;
  job: any;
  dispute: any;
}> {
  const { client, cleaner, job } = await seedBookingScenario();
  
  // Create dispute
  const disputeResult = await query(
    `INSERT INTO disputes (job_id, client_id, cleaner_id, reason, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [job.id, client.id, cleaner.id, 'Quality issue', 'pending']
  );

  return { client, cleaner, job, dispute: disputeResult.rows[0] };
}

/**
 * Clean up seeded data
 */
export async function cleanupSeededData(): Promise<void> {
  // Use the cleanup functions from fixtures
  const { cleanupTestUsers } = await import('../fixtures/users');
  const { cleanupTestJobs } = await import('../fixtures/bookings');
  
  await cleanupTestJobs();
  await cleanupTestUsers();
}
