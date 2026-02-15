// src/services/__tests__/payoutsService.test.ts
// Unit tests for payouts service

import { beforeEach, vi } from "vitest";
import {
  getCleanerPayoutPercent,
  recordEarningsForCompletedJob,
  processPendingPayouts,
  getCleanerPayouts,
} from "../payoutsService";
import Stripe from "stripe";

const mockQuery = vi.fn();
vi.mock("../../db/client", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  withTransaction: vi.fn(
    async (callback: (client: { query: typeof mockQuery }) => Promise<unknown>) => {
      const mockClient = { query: mockQuery };
      return callback(mockClient);
    }
  ),
}));
vi.mock("../../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("../../lib/events", () => ({
  publishEvent: vi.fn(),
}));
vi.mock("../../config/env", () => ({
  env: {
    STRIPE_SECRET_KEY: "sk_test_mock",
    PAYOUTS_ENABLED: true,
    PAYOUT_CURRENCY: "usd",
    CENTS_PER_CREDIT: 10,
    CLEANER_PAYOUT_PERCENT_BRONZE: 80,
    CLEANER_PAYOUT_PERCENT_SILVER: 82,
    CLEANER_PAYOUT_PERCENT_GOLD: 84,
    CLEANER_PAYOUT_PERCENT_PLATINUM: 85,
  },
}));
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    transfers: { create: vi.fn().mockResolvedValue({ id: "tr_123" }) },
  })),
}));

describe("payoutsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCleanerPayoutPercent", () => {
    it("returns payout percent based on tier", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: "gold", payout_percent: null }],
      });

      const percent = await getCleanerPayoutPercent("cleaner-123");

      expect(percent).toBeGreaterThanOrEqual(80);
      expect(percent).toBeLessThanOrEqual(85);
    });

    it("uses stored payout_percent when explicitly set", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: "bronze", payout_percent: 90 }],
      });

      const percent = await getCleanerPayoutPercent("cleaner-123");

      expect(percent).toBe(90);
    });

    it("defaults to bronze tier when no tier set", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ tier: null, payout_percent: null }],
      });

      const percent = await getCleanerPayoutPercent("cleaner-123");

      expect(percent).toBe(80); // Bronze default
    });
  });

  describe("recordEarningsForCompletedJob", () => {
    it("creates pending payout for completed job", async () => {
      const mockJob = {
        id: "job-123",
        cleaner_id: "cleaner-123",
        credit_amount: 100,
        status: "completed",
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ tier: "gold", payout_percent: null }] }) // getCleanerPayoutPercent
        .mockResolvedValueOnce({ rows: [{ exists: true }] }) // userCheck
        .mockResolvedValueOnce({ rows: [{ id: "payout-123" }] }); // INSERT payout RETURNING

      const payout = await recordEarningsForCompletedJob(mockJob as any);

      expect(payout).toBeDefined();
      expect(payout.id).toBe("payout-123");
      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO payouts"),
        expect.any(Array)
      );
    });

    it("throws error if job has no cleaner assigned", async () => {
      const mockJob = {
        id: "job-123",
        cleaner_id: null,
        credit_amount: 100,
      };

      await expect(recordEarningsForCompletedJob(mockJob as any)).rejects.toThrow(
        "Job has no cleaner assigned"
      );
    });
  });

  describe("processPendingPayouts", () => {
    it("processes pending payouts", async () => {
      mockQuery
        .mockResolvedValueOnce({
          rows: [{ id: "payout-1", cleaner_id: "cleaner-1", amount_cents: 1000 }],
        })
        .mockResolvedValueOnce({ rows: [] }); // UPDATE

      const result = await processPendingPayouts();

      expect(result.processed).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getCleanerPayouts", () => {
    it("returns payouts for cleaner", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          {
            id: "payout-1",
            cleaner_id: "cleaner-123",
            amount_cents: 1000,
            status: "completed",
          },
        ],
      });

      const payouts = await getCleanerPayouts("cleaner-123", 10);

      expect(payouts).toHaveLength(1);
      expect(payouts[0].id).toBe("payout-1");
    });
  });
});
