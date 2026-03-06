// src/lib/__tests__/workerMetrics.test.ts
// Unit tests for src/lib/workerMetrics.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================================
// Mocks
// =====================================================================

const { mockQuery, mockLogger, mockGetQueueStats } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockGetQueueStats: vi.fn(),
}));

vi.mock("../../db/client", () => ({ query: (...args: unknown[]) => mockQuery(...args) }));
vi.mock("../logger", () => ({ logger: mockLogger }));
vi.mock("../queue", () => ({
  queueService: { getQueueStats: (...args: unknown[]) => mockGetQueueStats(...args) },
}));
vi.mock("../../config/env", () => ({
  env: {
    DATABASE_URL: "postgres://test",
    JWT_SECRET: "test-secret",
    STRIPE_SECRET_KEY: "sk_test_x",
    STRIPE_WEBHOOK_SECRET: "whsec_x",
    N8N_WEBHOOK_SECRET: "n8n_x",
    NODE_ENV: "test",
    JWT_EXPIRES_IN: "30d",
    BCRYPT_SALT_ROUNDS: 10,
  },
}));

import {
  collectWorkerMetrics,
  checkWorkerAlerts,
  getWorkerHealth,
} from "../workerMetrics";

const DEFAULT_QUEUE_STATS = { pending: 0, processing: 0, completed: 100, failed: 0, dead: 0 };

function setupDefaultMocks() {
  mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
  // worker_runs query
  mockQuery.mockResolvedValueOnce({
    rows: [{ running: "1", success: "10", failed: "0" }],
  });
  // stuck jobs query
  mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
  // dead-letter query
  mockQuery.mockResolvedValueOnce({ rows: [{ count: "0" }] });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// =====================================================================
// collectWorkerMetrics
// =====================================================================

describe("collectWorkerMetrics", () => {
  it("returns a metrics object with a timestamp", async () => {
    setupDefaultMocks();
    const metrics = await collectWorkerMetrics();
    expect(metrics.timestamp).toBeDefined();
    expect(typeof metrics.timestamp).toBe("string");
  });

  it("includes jobQueue stats from queueService", async () => {
    mockGetQueueStats.mockResolvedValue({ pending: 5, processing: 2, completed: 100, failed: 1, dead: 3 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "1", success: "10", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.jobQueue.pending).toBe(5);
    expect(metrics.jobQueue.processing).toBe(2);
    expect(metrics.jobQueue.failed).toBe(1);
    expect(metrics.jobQueue.dead).toBe(3);
  });

  it("parses workerRuns counts as numbers", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "3", success: "42", failed: "2" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.workerRuns.running).toBe(3);
    expect(metrics.workerRuns.success).toBe(42);
    expect(metrics.workerRuns.failed).toBe(2);
  });

  it("defaults workerRuns to 0 when rows are empty", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.workerRuns.running).toBe(0);
    expect(metrics.workerRuns.success).toBe(0);
    expect(metrics.workerRuns.failed).toBe(0);
  });

  it("returns stuckJobs count", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "7" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.stuckJobs).toBe(7);
  });

  it("returns deadLetterJobs count", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "15" }] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.deadLetterJobs).toBe(15);
  });

  it("defaults stuckJobs and deadLetterJobs to 0 on empty rows", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const metrics = await collectWorkerMetrics();
    expect(metrics.stuckJobs).toBe(0);
    expect(metrics.deadLetterJobs).toBe(0);
  });

  it("sets expired to 0", async () => {
    setupDefaultMocks();
    const metrics = await collectWorkerMetrics();
    expect(metrics.workerRuns.expired).toBe(0);
  });
});

// =====================================================================
// checkWorkerAlerts
// =====================================================================

describe("checkWorkerAlerts", () => {
  it("returns empty array when all metrics are within thresholds", async () => {
    setupDefaultMocks();
    const alerts = await checkWorkerAlerts();
    expect(alerts).toEqual([]);
  });

  it("alerts when stuckJobs exceeds threshold", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "15" }] }) // stuckJobs = 15 > 10
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const alerts = await checkWorkerAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("stuck jobs");
    expect(mockLogger.error).toHaveBeenCalledWith("worker_alert_stuck_jobs", expect.any(Object));
  });

  it("alerts when deadLetterJobs exceeds threshold", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "55" }] }); // dead = 55 > 50

    const alerts = await checkWorkerAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("dead-letter");
    expect(mockLogger.error).toHaveBeenCalledWith("worker_alert_dead_letter", expect.any(Object));
  });

  it("alerts when failed workerRuns exceeds threshold", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "8" }] }) // failed = 8 > 5
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const alerts = await checkWorkerAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("failed worker runs");
    expect(mockLogger.error).toHaveBeenCalledWith("worker_alert_failed_runs", expect.any(Object));
  });

  it("alerts when pending jobs exceed threshold", async () => {
    mockGetQueueStats.mockResolvedValue({ ...DEFAULT_QUEUE_STATS, pending: 1200 }); // 1200 > 1000
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const alerts = await checkWorkerAlerts();
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("pending jobs");
    expect(mockLogger.error).toHaveBeenCalledWith("worker_alert_pending_backlog", expect.any(Object));
  });

  it("returns multiple alerts when multiple thresholds are breached", async () => {
    mockGetQueueStats.mockResolvedValue({ ...DEFAULT_QUEUE_STATS, pending: 2000 });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "10" }] })
      .mockResolvedValueOnce({ rows: [{ count: "20" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const alerts = await checkWorkerAlerts();
    expect(alerts.length).toBe(3); // stuck + failed runs + pending
  });

  it("respects custom thresholds", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "3" }] }) // stuckJobs = 3
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    // With custom threshold of 2, 3 stuck jobs should alert
    const alerts = await checkWorkerAlerts({
      maxStuckJobs: 2,
      maxDeadLetterJobs: 50,
      maxFailedWorkerRuns: 5,
      maxPendingJobs: 1000,
    });
    expect(alerts.length).toBe(1);
    expect(alerts[0]).toContain("3 stuck jobs");
  });

  it("alert message includes the actual count and threshold", async () => {
    mockGetQueueStats.mockResolvedValue(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "12" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const alerts = await checkWorkerAlerts();
    expect(alerts[0]).toContain("12");
    expect(alerts[0]).toContain("10"); // default threshold
  });
});

// =====================================================================
// getWorkerHealth
// =====================================================================

describe("getWorkerHealth", () => {
  it("returns healthy=true when no alerts", async () => {
    // collectWorkerMetrics (called twice — once by itself, once by checkWorkerAlerts)
    for (let i = 0; i < 2; i++) {
      mockGetQueueStats.mockResolvedValueOnce(DEFAULT_QUEUE_STATS);
      mockQuery
        .mockResolvedValueOnce({ rows: [{ running: "0", success: "5", failed: "0" }] })
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValueOnce({ rows: [{ count: "0" }] });
    }

    const health = await getWorkerHealth();
    expect(health.healthy).toBe(true);
    expect(health.alerts).toEqual([]);
  });

  it("returns healthy=false when there are alerts", async () => {
    // First call: collectWorkerMetrics
    mockGetQueueStats.mockResolvedValueOnce(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "20" }] }) // stuck > 10
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    // Second call: checkWorkerAlerts -> collectWorkerMetrics again
    mockGetQueueStats.mockResolvedValueOnce(DEFAULT_QUEUE_STATS);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ running: "0", success: "0", failed: "0" }] })
      .mockResolvedValueOnce({ rows: [{ count: "20" }] })
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });

    const health = await getWorkerHealth();
    expect(health.healthy).toBe(false);
    expect(health.alerts.length).toBeGreaterThan(0);
  });

  it("includes metrics in the response", async () => {
    for (let i = 0; i < 2; i++) {
      mockGetQueueStats.mockResolvedValueOnce({ ...DEFAULT_QUEUE_STATS, pending: 5 });
      mockQuery
        .mockResolvedValueOnce({ rows: [{ running: "1", success: "8", failed: "0" }] })
        .mockResolvedValueOnce({ rows: [{ count: "0" }] })
        .mockResolvedValueOnce({ rows: [{ count: "0" }] });
    }

    const health = await getWorkerHealth();
    expect(health.metrics).toBeDefined();
    expect(health.metrics.jobQueue.pending).toBe(5);
    expect(health.metrics.workerRuns.running).toBe(1);
  });
});
