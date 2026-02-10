// src/lib/circuitBreaker.ts
// Circuit breaker pattern for external API calls
// Prevents cascading failures by "opening" the circuit after repeated failures

import { logger } from "./logger";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms to wait before attempting half-open */
  resetTimeout: number;
  /** Time window in ms to track failures */
  timeoutWindow: number;
  /** Name for logging */
  name: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  openedAt: number | null;
}

/**
 * Circuit breaker implementation
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF-OPEN: Testing if service recovered, allow one request
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private openedAt: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === "open") {
      const timeSinceOpen = Date.now() - (this.openedAt || 0);
      if (timeSinceOpen >= this.config.resetTimeout) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker "${this.config.name}" is OPEN. Service unavailable.`
        );
      }
    }

    // Reset failure count if outside timeout window
    if (this.state === "closed" && this.lastFailureTime) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      if (timeSinceLastFailure > this.config.timeoutWindow) {
        this.failures = 0;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === "half-open") {
      // Service recovered, close circuit
      logger.info("circuit_breaker_closed", {
        name: this.config.name,
        failures: this.failures,
        successes: this.successes,
      });
      this.state = "closed";
      this.failures = 0;
    }
  }

  /**
   * Handle failed request
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      // Still failing, open circuit again
      this.transitionToOpen();
    } else if (
      this.state === "closed" &&
      this.failures >= this.config.failureThreshold
    ) {
      // Too many failures, open circuit
      this.transitionToOpen();
    }
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = "open";
    this.openedAt = Date.now();

    logger.warn("circuit_breaker_opened", {
      name: this.config.name,
      failures: this.failures,
      threshold: this.config.failureThreshold,
      resetTimeout: this.config.resetTimeout,
    });
  }

  /**
   * Transition to HALF-OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = "half-open";
    logger.info("circuit_breaker_half_open", {
      name: this.config.name,
      testing: true,
    });
  }

  /**
   * Get current stats
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      openedAt: this.openedAt,
    };
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  reset(): void {
    this.state = "closed";
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.openedAt = null;

    logger.info("circuit_breaker_reset", { name: this.config.name });
  }
}

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

/**
 * Pre-configured circuit breakers for external services
 */
export const circuitBreakers = {
  stripe: new CircuitBreaker({
    name: "stripe",
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    timeoutWindow: 60000, // 1 minute
  }),

  sendgrid: new CircuitBreaker({
    name: "sendgrid",
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    timeoutWindow: 60000, // 1 minute
  }),

  twilio: new CircuitBreaker({
    name: "twilio",
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    timeoutWindow: 60000, // 1 minute
  }),

  n8n: new CircuitBreaker({
    name: "n8n",
    failureThreshold: 5,
    resetTimeout: 30000, // 30 seconds (n8n is less critical)
    timeoutWindow: 60000, // 1 minute
  }),
};
