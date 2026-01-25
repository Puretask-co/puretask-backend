// src/workers/__tests__/payoutWeekly.test.ts
// Unit tests for weekly payout worker

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { processPendingPayouts } from '../../services/payoutsService';
import { query } from '../../db/client';
import { logger } from '../../lib/logger';

jest.mock('../../db/client');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('payoutWeekly worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('processes eligible payouts', async () => {
    const mockEarnings = [
      { cleaner_id: 'cleaner-1', total_earnings: 1000 },
      { cleaner_id: 'cleaner-2', total_earnings: 500 },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockEarnings }) // Get eligible cleaners
      .mockResolvedValueOnce({ rows: [] }) // Create payout records
      .mockResolvedValueOnce({ rows: [] }); // Update status

    const result = await processPendingPayouts();

    expect(result.processed).toBe(2);
    expect(mockQuery).toHaveBeenCalled();
  });

  it('handles payout creation errors', async () => {
    const mockEarnings = [
      { cleaner_id: 'cleaner-1', total_earnings: 1000 },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockEarnings })
      .mockRejectedValueOnce(new Error('Database error'));

    const result = await processPendingPayouts();

    expect(result.failed).toBe(1);
    expect(logger.error).toHaveBeenCalled();
  });
});
