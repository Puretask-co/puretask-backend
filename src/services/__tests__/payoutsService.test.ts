// src/services/__tests__/payoutsService.test.ts
// Unit tests for payouts service

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import {
  getCleanerPayoutPercent,
  recordEarningsForCompletedJob,
  processPendingPayouts,
  getCleanerPayouts,
} from '../payoutsService';
import { query } from '../../db/client';
import Stripe from 'stripe';

jest.mock('../../db/client');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));
jest.mock('../../lib/events', () => ({
  publishEvent: jest.fn(),
}));

describe('payoutsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCleanerPayoutPercent', () => {
    it('returns payout percent based on tier', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: 'gold', payout_percent: null }],
      });

      const percent = await getCleanerPayoutPercent('cleaner-123');

      expect(percent).toBeGreaterThanOrEqual(80);
      expect(percent).toBeLessThanOrEqual(85);
    });

    it('uses stored payout_percent when explicitly set', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: 'bronze', payout_percent: 90 }],
      });

      const percent = await getCleanerPayoutPercent('cleaner-123');

      expect(percent).toBe(90);
    });

    it('defaults to bronze tier when no tier set', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: null, payout_percent: null }],
      });

      const percent = await getCleanerPayoutPercent('cleaner-123');

      expect(percent).toBe(80); // Bronze default
    });
  });

  describe('recordEarningsForCompletedJob', () => {
    it('creates pending payout for completed job', async () => {
      const mockJob = {
        id: 'job-123',
        cleaner_id: 'cleaner-123',
        credit_amount: 100,
        status: 'completed',
      };

      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({ rows: [{ tier: 'gold', payout_percent: null }] }) // getCleanerPayoutPercent
        .mockResolvedValueOnce({ rows: [{ id: 'payout-123' }] }); // INSERT payout

      const payout = await recordEarningsForCompletedJob(mockJob as any);

      expect(payout).toBeDefined();
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payouts'),
        expect.any(Array)
      );
    });

    it('throws error if job has no cleaner assigned', async () => {
      const mockJob = {
        id: 'job-123',
        cleaner_id: null,
        credit_amount: 100,
      };

      await expect(
        recordEarningsForCompletedJob(mockJob as any)
      ).rejects.toThrow('Job has no cleaner assigned');
    });
  });

  describe('processPendingPayouts', () => {
    it('processes pending payouts', async () => {
      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({
          rows: [
            { id: 'payout-1', cleaner_id: 'cleaner-1', amount_cents: 1000 },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE

      const result = await processPendingPayouts();

      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getCleanerPayouts', () => {
    it('returns payouts for cleaner', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'payout-1',
            cleaner_id: 'cleaner-123',
            amount_cents: 1000,
            status: 'completed',
          },
        ],
      });

      const payouts = await getCleanerPayouts('cleaner-123', 10);

      expect(payouts).toHaveLength(1);
      expect(payouts[0].id).toBe('payout-1');
    });
  });
});
