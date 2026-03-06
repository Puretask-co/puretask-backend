// src/lib/__tests__/workerUtils.test.ts
// Unit tests for src/lib/workerUtils.ts

import { describe, it, expect, vi, beforeEach } from "vitest";

// =====================================================================
// Mocks
// =====================================================================

const { mockClientQuery, mockClientRelease, mockPoolConnect, mockLogger } = vi.hoisted(() => ({
  mockClientQuery: vi.fn(),
  mockClientRelease: vi.fn(),
  mockPoolConnect: vi.fn(),
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../db/client", () => ({
  pool: { connect: () => mockPoolConnect() },
}));
vi.mock("../logger", () => ({ logger: mockLogger }));
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

import { runWorkerWithLock, getWorkerLockId } from "../workerUtils";

function makeClient(lockAcquired = true, runId = "run-1") {
  const client = {
    query: mockClientQuery,
    release: mockClientRelease,
  };
  // lock attempt
  mockClientQuery.mockResolvedValueOnce({
    rows: [{ pg_try_advisory_lock: lockAcquired }],
  });
  if (lockAcquired) {
    // insert worker_run
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: runId }] });
  }
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPoolConnect.mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  });
  // Default: advisory_unlock always succeeds
  mockClientQuery.mockResolvedValue({ rows: [] });
});

// =====================================================================
// getWorkerLockId — pure function
// =====================================================================

describe("getWorkerLockId", () => {
  it("returns a number", () => {
    expect(typeof getWorkerLockId("payouts")).toBe("number");
  });

  it("returns a value in range 2000–9999", () => {
    const id = getWorkerLockId("payouts");
    expect(id).toBeGreaterThanOrEqual(2000);
    expect(id).toBeLessThanOrEqual(9999);
  });

  it("is deterministic — same name always returns same id", () => {
    expect(getWorkerLockId("auto-cancel")).toBe(getWorkerLockId("auto-cancel"));
    expect(getWorkerLockId("payouts")).toBe(getWorkerLockId("payouts"));
  });

  it("returns different ids for different worker names", () => {
    expect(getWorkerLockId("payouts")).not.toBe(getWorkerLockId("auto-cancel"));
  });

  it("returns a positive number for any input", () => {
    const names = ["payouts", "auto-cancel", "cleanup", "email-digest", "x"];
    for (const name of names) {
      expect(getWorkerLockId(name)).toBeGreaterThanOrEqual(2000);
    }
  });

  it("handles single-character names", () => {
    const id = getWorkerLockId("x");
    expect(id).toBeGreaterThanOrEqual(2000);
    expect(id).toBeLessThanOrEqual(9999);
  });
});

// =====================================================================
// runWorkerWithLock — lock not acquired
// =====================================================================

describe("runWorkerWithLock — lock not acquired", () => {
  it("returns null when lock is already held", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: false }] }) // lock attempt
      .mockResolvedValueOnce({ rows: [] }); // advisory_unlock in finally

    const workerFn = vi.fn().mockResolvedValue({ processed: 1, failed: 0 });
    const result = await runWorkerWithLock("payouts", 5000, workerFn);

    expect(result).toBeNull();
    expect(workerFn).not.toHaveBeenCalled();
  });

  it("logs a warning when lock is not acquired", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: false }] })
      .mockResolvedValueOnce({ rows: [] });

    await runWorkerWithLock("payouts", 5000, vi.fn());
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "worker_locked",
      expect.objectContaining({ workerName: "payouts" })
    );
  });

  it("always releases the client when lock is not acquired", async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: false }] })
      .mockResolvedValueOnce({ rows: [] });

    await runWorkerWithLock("payouts", 5000, vi.fn());
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// =====================================================================
// runWorkerWithLock — successful execution
// =====================================================================

describe("runWorkerWithLock — successful execution", () => {
  beforeEach(() => {
    // lock acquired
    mockClientQuery.mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: true }] });
    // insert worker_run
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "run-42" }] });
    // update worker_run success
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // advisory_unlock
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
  });

  it("returns the worker function result", async () => {
    const workerFn = vi.fn().mockResolvedValue({ processed: 10, failed: 2 });
    const result = await runWorkerWithLock("payouts", 5000, workerFn);
    expect(result).toEqual({ processed: 10, failed: 2 });
  });

  it("calls the worker function once", async () => {
    const workerFn = vi.fn().mockResolvedValue({ processed: 5, failed: 0 });
    await runWorkerWithLock("payouts", 5000, workerFn);
    expect(workerFn).toHaveBeenCalledOnce();
  });

  it("logs worker_started and worker_completed", async () => {
    const workerFn = vi.fn().mockResolvedValue({ processed: 3, failed: 0 });
    await runWorkerWithLock("my-worker", 5001, workerFn);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "worker_started",
      expect.objectContaining({ workerName: "my-worker" })
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      "worker_completed",
      expect.objectContaining({ workerName: "my-worker", processed: 3 })
    );
  });

  it("releases the client after success", async () => {
    const workerFn = vi.fn().mockResolvedValue({ processed: 1, failed: 0 });
    await runWorkerWithLock("payouts", 5000, workerFn);
    expect(mockClientRelease).toHaveBeenCalled();
  });
});

// =====================================================================
// runWorkerWithLock — worker function throws
// =====================================================================

describe("runWorkerWithLock — worker throws", () => {
  beforeEach(() => {
    // lock acquired
    mockClientQuery.mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: true }] });
    // insert worker_run
    mockClientQuery.mockResolvedValueOnce({ rows: [{ id: "run-err" }] });
    // update worker_run as failed
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
    // advisory_unlock
    mockClientQuery.mockResolvedValueOnce({ rows: [] });
  });

  it("rethrows the error from the worker function", async () => {
    const workerFn = vi.fn().mockRejectedValue(new Error("worker boom"));
    await expect(runWorkerWithLock("payouts", 5000, workerFn)).rejects.toThrow("worker boom");
  });

  it("logs worker_failed on error", async () => {
    const workerFn = vi.fn().mockRejectedValue(new Error("crash"));
    await expect(runWorkerWithLock("my-worker", 5001, workerFn)).rejects.toThrow();
    expect(mockLogger.error).toHaveBeenCalledWith(
      "worker_failed",
      expect.objectContaining({ workerName: "my-worker", error: "crash" })
    );
  });

  it("releases the client even on error", async () => {
    const workerFn = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(runWorkerWithLock("payouts", 5000, workerFn)).rejects.toThrow();
    expect(mockClientRelease).toHaveBeenCalled();
  });
});
