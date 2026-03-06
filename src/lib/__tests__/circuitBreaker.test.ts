// src/lib/__tests__/circuitBreaker.test.ts
// Unit tests for src/lib/circuitBreaker.ts

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitBreakerOpenError, circuitBreakers } from "../circuitBreaker";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// =====================================================================
// Helpers
// =====================================================================

function makeBreaker(overrides: Partial<ConstructorParameters<typeof CircuitBreaker>[0]> = {}) {
  return new CircuitBreaker({
    name: "test",
    failureThreshold: 3,
    resetTimeout: 5000,
    timeoutWindow: 10000,
    ...overrides,
  });
}

const success = () => Promise.resolve("ok");
const fail = () => Promise.reject(new Error("boom"));

// =====================================================================
// Initial state
// =====================================================================

describe("CircuitBreaker — initial state", () => {
  it("starts in closed state", () => {
    const cb = makeBreaker();
    expect(cb.getStats().state).toBe("closed");
  });

  it("starts with zero failures and successes", () => {
    const cb = makeBreaker();
    const stats = cb.getStats();
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
  });

  it("starts with null timestamps", () => {
    const cb = makeBreaker();
    const stats = cb.getStats();
    expect(stats.lastFailureTime).toBeNull();
    expect(stats.lastSuccessTime).toBeNull();
    expect(stats.openedAt).toBeNull();
  });
});

// =====================================================================
// Closed state — normal operation
// =====================================================================

describe("CircuitBreaker — closed state", () => {
  it("passes through successful calls and returns result", async () => {
    const cb = makeBreaker();
    const result = await cb.execute(success);
    expect(result).toBe("ok");
  });

  it("increments successes on success", async () => {
    const cb = makeBreaker();
    await cb.execute(success);
    await cb.execute(success);
    expect(cb.getStats().successes).toBe(2);
  });

  it("rethrows errors from the wrapped function", async () => {
    const cb = makeBreaker();
    await expect(cb.execute(fail)).rejects.toThrow("boom");
  });

  it("increments failures on error", async () => {
    const cb = makeBreaker();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().failures).toBe(1);
  });

  it("stays closed below the failure threshold", async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().state).toBe("closed");
    expect(cb.getStats().failures).toBe(2);
  });

  it("records lastFailureTime on failure", async () => {
    const cb = makeBreaker();
    const before = Date.now();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().lastFailureTime).toBeGreaterThanOrEqual(before);
  });

  it("records lastSuccessTime on success", async () => {
    const cb = makeBreaker();
    const before = Date.now();
    await cb.execute(success);
    expect(cb.getStats().lastSuccessTime).toBeGreaterThanOrEqual(before);
  });
});

// =====================================================================
// Transition: closed → open
// =====================================================================

describe("CircuitBreaker — opening", () => {
  it("opens after hitting the failure threshold", async () => {
    const cb = makeBreaker({ failureThreshold: 3 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().state).toBe("open");
  });

  it("records openedAt when circuit opens", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    const before = Date.now();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().openedAt).toBeGreaterThanOrEqual(before);
  });

  it("throws CircuitBreakerOpenError when open", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(success)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });

  it("CircuitBreakerOpenError message includes circuit name", async () => {
    const cb = makeBreaker({ name: "my-service", failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(success)).rejects.toThrow("my-service");
  });

  it("does not call fn when circuit is open", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    const fn = vi.fn().mockResolvedValue("x");
    await expect(cb.execute(fn)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(fn).not.toHaveBeenCalled();
  });
});

// =====================================================================
// Transition: open → half-open
// =====================================================================

describe("CircuitBreaker — half-open transition", () => {
  it("transitions to half-open after resetTimeout has elapsed", async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeout: 100 });
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().state).toBe("open");

    // Simulate time passing by backdating openedAt
    (cb as any).openedAt = Date.now() - 200;

    await cb.execute(success);
    // After a success in half-open, it closes
    expect(cb.getStats().state).toBe("closed");
  });

  it("stays open if resetTimeout has not elapsed", async () => {
    const cb = makeBreaker({ failureThreshold: 1, resetTimeout: 60000 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(success)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
    expect(cb.getStats().state).toBe("open");
  });
});

// =====================================================================
// Half-open state
// =====================================================================

describe("CircuitBreaker — half-open state", () => {
  async function openThenExpire(cb: CircuitBreaker) {
    await expect(cb.execute(fail)).rejects.toThrow();
    (cb as any).openedAt = Date.now() - 999999;
    (cb as any).state = "half-open";
  }

  it("closes on success in half-open", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await openThenExpire(cb);
    await cb.execute(success);
    expect(cb.getStats().state).toBe("closed");
  });

  it("resets failure count when closing from half-open", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await openThenExpire(cb);
    await cb.execute(success);
    expect(cb.getStats().failures).toBe(0);
  });

  it("re-opens on failure in half-open", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await openThenExpire(cb);
    await expect(cb.execute(fail)).rejects.toThrow("boom");
    expect(cb.getStats().state).toBe("open");
  });
});

// =====================================================================
// Failure window reset
// =====================================================================

describe("CircuitBreaker — failure window", () => {
  it("resets failure count when outside timeoutWindow", async () => {
    const cb = makeBreaker({ failureThreshold: 3, timeoutWindow: 1000 });
    await expect(cb.execute(fail)).rejects.toThrow();
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().failures).toBe(2);

    // Backdate last failure to simulate window expiry
    (cb as any).lastFailureTime = Date.now() - 2000;

    await expect(cb.execute(fail)).rejects.toThrow();
    // Failures were reset before this call, so count starts at 1
    expect(cb.getStats().failures).toBe(1);
    expect(cb.getStats().state).toBe("closed");
  });
});

// =====================================================================
// reset()
// =====================================================================

describe("CircuitBreaker — reset()", () => {
  it("resets state to closed", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    expect(cb.getStats().state).toBe("open");
    cb.reset();
    expect(cb.getStats().state).toBe("closed");
  });

  it("clears all counters and timestamps", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    cb.reset();
    const stats = cb.getStats();
    expect(stats.failures).toBe(0);
    expect(stats.successes).toBe(0);
    expect(stats.lastFailureTime).toBeNull();
    expect(stats.lastSuccessTime).toBeNull();
    expect(stats.openedAt).toBeNull();
  });

  it("allows execution after reset", async () => {
    const cb = makeBreaker({ failureThreshold: 1 });
    await expect(cb.execute(fail)).rejects.toThrow();
    cb.reset();
    const result = await cb.execute(success);
    expect(result).toBe("ok");
  });
});

// =====================================================================
// CircuitBreakerOpenError
// =====================================================================

describe("CircuitBreakerOpenError", () => {
  it("is an instance of Error", () => {
    const err = new CircuitBreakerOpenError("circuit open");
    expect(err).toBeInstanceOf(Error);
  });

  it("has name CircuitBreakerOpenError", () => {
    const err = new CircuitBreakerOpenError("circuit open");
    expect(err.name).toBe("CircuitBreakerOpenError");
  });

  it("stores the message", () => {
    const err = new CircuitBreakerOpenError("test message");
    expect(err.message).toBe("test message");
  });
});

// =====================================================================
// Pre-configured circuit breakers
// =====================================================================

describe("circuitBreakers presets", () => {
  beforeEach(() => {
    Object.values(circuitBreakers).forEach((cb) => cb.reset());
  });

  it("all presets start in closed state", () => {
    for (const [name, cb] of Object.entries(circuitBreakers)) {
      expect(cb.getStats().state).toBe("closed", `${name} should be closed`);
    }
  });

  it("n8n has a shorter resetTimeout than stripe", () => {
    // n8n is less critical so resets faster (30s vs 60s)
    expect((circuitBreakers.n8n as any).config.resetTimeout).toBeLessThan(
      (circuitBreakers.stripe as any).config.resetTimeout
    );
  });

  it("stripe executes successfully", async () => {
    const result = await circuitBreakers.stripe.execute(success);
    expect(result).toBe("ok");
  });

  it("sendgrid executes successfully", async () => {
    const result = await circuitBreakers.sendgrid.execute(success);
    expect(result).toBe("ok");
  });
});
