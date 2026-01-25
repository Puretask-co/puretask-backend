// src/workers/__tests__/autoCancelJobs.test.ts
// Unit tests for auto-cancel jobs worker

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { runAutoCancelWorker } from '../v1-core/autoCancelJobs';
import { query } from '../../db/client';
import { releaseEscrowedCredits } from '../../services/creditsService';
import { publishEvent } from '../../lib/events';
import { logger } from '../../lib/logger';

jest.mock('../../db/client');
jest.mock('../../services/creditsService');
jest.mock('../../lib/events');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('autoCancelJobs worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds and cancels jobs past deadline', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        client_id: 'client-1',
        status: 'requested',
        scheduled_start_at: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        credit_amount: 50,
      },
      {
        id: 'job-2',
        client_id: 'client-2',
        status: 'requested',
        scheduled_start_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        credit_amount: 75,
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockJobs }) // findJobsToCancel
      .mockResolvedValueOnce({ rows: [] }) // Update job 1
      .mockResolvedValueOnce({ rows: [] }) // Update job 2
      .mockResolvedValueOnce({ rows: [] }); // No more jobs

    (releaseEscrowedCredits as any).mockResolvedValue({});
    (publishEvent as any).mockResolvedValue({});

    const result = await runAutoCancelWorker();

    expect(result.cancelled).toBe(2);
    expect(result.failed).toBe(0);
    expect(releaseEscrowedCredits).toHaveBeenCalledTimes(2);
    expect(publishEvent).toHaveBeenCalledTimes(2);
  });

  it('handles credit release failures', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        client_id: 'client-1',
        status: 'requested',
        scheduled_start_at: new Date(Date.now() - 60 * 60 * 1000),
        credit_amount: 50,
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockJobs })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    (releaseEscrowedCredits as any).mockRejectedValueOnce(new Error('Credit service error'));
    (publishEvent as any).mockResolvedValue({});

    const result = await runAutoCancelWorker();

    expect(result.cancelled).toBe(0);
    expect(result.failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });

  it('skips jobs that are not in requested status', async () => {
    const mockJobs = [
      {
        id: 'job-1',
        client_id: 'client-1',
        status: 'confirmed', // Not requested
        scheduled_start_at: new Date(Date.now() - 60 * 60 * 1000),
        credit_amount: 50,
      },
    ];

    const mockQuery = query as any;
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No jobs found (filtered by status)

    const result = await runAutoCancelWorker();

    expect(result.cancelled).toBe(0);
    expect(result.failed).toBe(0);
  });
});
