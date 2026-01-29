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
jest.mock('../../config/env', () => ({
  env: {
    PAYOUTS_ENABLED: true,
    STRIPE_SECRET_KEY: 'sk_test_mock',
    PAYOUT_CURRENCY: 'usd',
    CENTS_PER_CREDIT: 10,
  },
}));

// Create mock function that will be used by Stripe instances
const mockTransferCreate = jest.fn();

jest.mock('stripe', () => {
  // Create the mock function inside the factory to avoid hoisting issues
  // Use the same function reference that's defined above
  const transferMock = jest.fn();
  // Store it globally so we can access it in tests
  (global as any).__stripeTransferMock = transferMock;
  return jest.fn().mockImplementation(() => ({
    transfers: {
      create: transferMock,
    },
  }));
});

// Access the mock after module loads
const stripeMocks = {
  get transferCreate() {
    return (global as any).__stripeTransferMock || mockTransferCreate;
  },
};

jest.mock('../../lib/events', () => ({
  publishEvent: jest.fn() as jest.MockedFunction<any>,
}));

describe('payoutWeekly worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    stripeMocks.transferCreate.mockResolvedValue({ id: 'tr_test_123' });
  });

  it('processes eligible payouts', async () => {
    const mockPayouts = [
      {
        id: 'payout-1',
        cleaner_id: 'cleaner-1',
        amount_cents: 1000,
        amount_credits: 100,
        stripe_account_id: 'acct_test_1',
      },
      {
        id: 'payout-2',
        cleaner_id: 'cleaner-2',
        amount_cents: 500,
        amount_credits: 50,
        stripe_account_id: 'acct_test_2',
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockPayouts }) // Get pending payouts
      .mockResolvedValueOnce({ rows: [] }) // Update cleaner-1 payouts to 'paid'
      .mockResolvedValueOnce({ rows: [] }); // Update cleaner-2 payouts to 'paid'

    const result = await processPendingPayouts();

    expect(result.processed).toBe(2);
    expect(mockQuery).toHaveBeenCalled();
    expect(stripeMocks.transferCreate).toHaveBeenCalledTimes(2); // One transfer per cleaner
  });

  it('handles payout creation errors', async () => {
    const mockPayouts = [
      {
        id: 'payout-1',
        cleaner_id: 'cleaner-1',
        amount_cents: 1000,
        amount_credits: 100,
        stripe_account_id: 'acct_test_1',
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockPayouts }) // Get pending payouts
      .mockResolvedValueOnce({ rows: [] }); // Update payout status to 'failed' after error

    // Stripe transfer fails
    stripeMocks.transferCreate.mockRejectedValueOnce(new Error('Stripe API error'));

    const result = await processPendingPayouts();

    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(logger.error).toHaveBeenCalled();
    expect(stripeMocks.transferCreate).toHaveBeenCalled();
  });
});
