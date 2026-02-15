// src/workers/__tests__/payoutWeekly.test.ts
// Unit tests for weekly payout worker

import { beforeEach, vi } from "vitest";
import { processPendingPayouts } from "../../services/payoutsService";
import { query } from "../../db/client";
import { logger } from "../../lib/logger";

vi.mock("../../db/client");
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock("../../config/env", () => ({
  env: {
    PAYOUTS_ENABLED: true,
    STRIPE_SECRET_KEY: "sk_test_mock",
    PAYOUT_CURRENCY: "usd",
    CENTS_PER_CREDIT: 10,
  },
}));

// Hoist transfer mock so stripe mock factory can reference it
const mockTransferCreate = vi.hoisted(() => vi.fn());

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    transfers: { create: mockTransferCreate },
  })),
}));

vi.mock("../../lib/events", () => ({
  publishEvent: vi.fn(),
}));
vi.mock("../../lib/metrics", () => ({
  metrics: {
    payoutProcessed: vi.fn(),
    payoutRunCompleted: vi.fn(),
  },
}));

describe("payoutWeekly worker", () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
    mockTransferCreate.mockReset();
    // Use mockImplementation so it persists; mockResolvedValue can be cleared
    mockTransferCreate.mockImplementation(() => Promise.resolve({ id: "tr_test_123" }));
  });

  it("processes eligible payouts", async () => {
    const mockPayouts = [
      {
        id: "payout-1",
        cleaner_id: "cleaner-1",
        amount_cents: 1000,
        amount_credits: 100,
        stripe_account_id: "acct_test_1",
      },
      {
        id: "payout-2",
        cleaner_id: "cleaner-2",
        amount_cents: 500,
        amount_credits: 50,
        stripe_account_id: "acct_test_2",
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockPayouts }) // Get pending payouts
      .mockResolvedValueOnce({ rows: [] }) // Update cleaner-1 payouts to 'paid'
      .mockResolvedValueOnce({ rows: [] }); // Update cleaner-2 payouts to 'paid'

    const result = await processPendingPayouts();

    // Check stripe mock was used first - if 0 calls, Stripe mock isn't applied
    expect(mockTransferCreate).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalled();
    expect(result.processed).toBe(2);
  });

  it("handles payout creation errors", async () => {
    const mockPayouts = [
      {
        id: "payout-1",
        cleaner_id: "cleaner-1",
        amount_cents: 1000,
        amount_credits: 100,
        stripe_account_id: "acct_test_1",
      },
    ];

    const mockQuery = query as any;
    mockQuery
      .mockResolvedValueOnce({ rows: mockPayouts }) // Get pending payouts
      .mockResolvedValueOnce({ rows: [] }); // Update payout status to 'failed' after error

    // Stripe transfer fails
    mockTransferCreate.mockRejectedValueOnce(new Error("Stripe API error"));

    const result = await processPendingPayouts();

    expect(result.failed).toBe(1);
    expect(result.processed).toBe(0);
    expect(logger.error).toHaveBeenCalled();
    expect(mockTransferCreate).toHaveBeenCalled();
  });
});
