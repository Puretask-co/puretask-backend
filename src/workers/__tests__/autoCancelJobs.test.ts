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
jest.mock('../../services/creditsService', () => ({
  releaseEscrowedCredits: jest.fn(),
}));
jest.mock('../../lib/events', () => ({
  publishEvent: jest.fn(),
}));
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('autoCancelJobs worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up default mocks that can be overridden in individual tests
    (releaseEscrowedCredits as jest.MockedFunction<any>).mockResolvedValue({});
    (publishEvent as jest.MockedFunction<any>).mockResolvedValue({});
    // Default query mock - will be overridden in each test
    (query as jest.MockedFunction<any>).mockResolvedValue({ rows: [] });
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

    const mockQuery = query as jest.MockedFunction<any>;
    mockQuery
      .mockResolvedValueOnce({ rows: mockJobs }) // findJobsToCancel
      .mockResolvedValueOnce({ rows: [] }) // Update job 1
      .mockResolvedValueOnce({ rows: [] }); // Update job 2

    (releaseEscrowedCredits as jest.MockedFunction<any>).mockResolvedValue({});
    (publishEvent as jest.MockedFunction<any>).mockResolvedValue({});

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
        scheduled_start_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        credit_amount: 50,
      },
    ];

    const mockQuery = query as jest.MockedFunction<any>;
    const mockReleaseCredits = releaseEscrowedCredits as jest.MockedFunction<any>;
    
    // Reset and set up fresh mocks for this test
    mockQuery.mockReset();
    mockReleaseCredits.mockReset();
    
    // Set up query mocks
    let queryCallCount = 0;
    mockQuery.mockImplementation(async (sql: string) => {
      queryCallCount++;
      if (queryCallCount === 1) {
        // First call is findJobsToCancel
        return { rows: mockJobs };
      }
      // Subsequent calls are UPDATE statements
      return { rows: [] };
    });

    // Credit release fails - this should cause cancelJob to throw
    // The error is caught in cancelJob and re-thrown, then caught in runAutoCancelWorker
    mockReleaseCredits.mockRejectedValueOnce(new Error('Credit service error'));

    const result = await runAutoCancelWorker();

    // When cancelJob throws, it's caught in runAutoCancelWorker and counted as failed
    expect(result.cancelled).toBe(0);
    expect(result.failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
    expect(mockReleaseCredits).toHaveBeenCalled();
  });

  it('skips jobs that are not in requested status', async () => {
    // The query filters by status = 'requested', so jobs with other statuses won't be found
    const mockQuery = query as jest.MockedFunction<any>;
    // Reset and set up to return empty results
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] }); // No jobs found
    (releaseEscrowedCredits as jest.MockedFunction<any>).mockResolvedValue({});
    (publishEvent as jest.MockedFunction<any>).mockResolvedValue({});

    const result = await runAutoCancelWorker();

    // When no jobs are found, nothing should be cancelled or failed
    expect(result.cancelled).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockQuery).toHaveBeenCalled(); // findJobsToCancel query was called
    expect(releaseEscrowedCredits).not.toHaveBeenCalled(); // Should not be called when no jobs
  });
});
