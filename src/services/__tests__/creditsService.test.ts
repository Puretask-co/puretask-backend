// src/services/__tests__/creditsService.test.ts
// Unit tests for credits service

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { query } from '../../db/client';
import { releaseEscrowedCredits } from '../creditsService';

jest.mock('../../db/client');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('creditsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('releaseEscrowedCredits', () => {
    it('releases escrowed credits', async () => {
      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Update credit account
        .mockResolvedValueOnce({ rows: [] }); // Insert ledger entry

      await releaseEscrowedCredits({
        userId: 'user-123',
        jobId: 'job-123',
        creditAmount: 50,
      });

      expect(mockQuery).toHaveBeenCalled();
    });

    it('handles errors gracefully', async () => {
      const mockQuery = query as any;
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        releaseEscrowedCredits({
          userId: 'user-123',
          jobId: 'job-123',
          creditAmount: 50,
        })
      ).rejects.toThrow();
    });
  });
});
