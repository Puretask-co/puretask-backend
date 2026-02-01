// src/lib/retry.ts
// Retry logic with exponential backoff for external API calls

import { logger } from "./logger";

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in ms */
  initialDelay: number;
  /** Maximum delay in ms */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
  /** Whether to use jitter (random variation) */
  jitter: boolean;
  /** Function to determine if error is retryable */
  isRetryable?: (error: Error) => boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  multiplier: 2,
  jitter: true,
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.initialDelay * Math.pow(config.multiplier, attempt),
    config.maxDelay
  );

  if (config.jitter) {
    // Add random jitter (±25%) to prevent thundering herd
    const jitterAmount = exponentialDelay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterAmount;
    return Math.max(0, exponentialDelay + jitter);
  }

  return exponentialDelay;
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, config: RetryConfig): boolean {
  // If custom function provided, use it
  if (config.isRetryable) {
    return config.isRetryable(error);
  }

  // Default: retry on network errors, timeouts, and 5xx errors
  const retryableMessages = [
    "timeout",
    "network",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
  ];

  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some((msg) => errorMessage.includes(msg));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(lastError, finalConfig)) {
        logger.warn("retry_aborted_non_retryable", {
          attempt: attempt + 1,
          maxAttempts: finalConfig.maxAttempts,
          error: lastError.message,
        });
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === finalConfig.maxAttempts - 1) {
        logger.error("retry_exhausted", {
          attempts: finalConfig.maxAttempts,
          error: lastError.message,
        });
        throw lastError;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, finalConfig);
      logger.warn("retry_attempt", {
        attempt: attempt + 1,
        maxAttempts: finalConfig.maxAttempts,
        delay,
        error: lastError.message,
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError || new Error("Retry failed");
}

/**
 * Retry configuration presets for different services
 */
export const retryConfigs = {
  stripe: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    jitter: true,
    isRetryable: (error: Error) => {
      // Stripe SDK handles retries, but we can add custom logic
      return error.message.includes("timeout") || error.message.includes("network");
    },
  },

  sendgrid: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 15000,
    multiplier: 2,
    jitter: true,
    isRetryable: (error: Error) => {
      // Retry on 5xx errors or network issues
      return (
        error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503")
      );
    },
  },

  twilio: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    multiplier: 2,
    jitter: true,
    isRetryable: (error: Error) => {
      // Retry on network errors or 5xx
      return (
        error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("500") ||
        error.message.includes("502") ||
        error.message.includes("503")
      );
    },
  },

  n8n: {
    maxAttempts: 2, // Fewer retries for n8n (less critical)
    initialDelay: 1000,
    maxDelay: 5000,
    multiplier: 2,
    jitter: true,
    isRetryable: (error: Error) => {
      // Retry on network errors
      return (
        error.message.includes("timeout") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED")
      );
    },
  },
};
