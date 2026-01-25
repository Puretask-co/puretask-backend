// src/lib/errorRecovery.ts
// Error recovery and retry mechanisms

import { logger } from "./logger";

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ["ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "ECONNREFUSED"],
};

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, retryableErrors: string[]): boolean {
  if (!error) return false;
  
  const errorCode = error.code || error.message || "";
  const errorString = String(errorCode).toUpperCase();
  
  return retryableErrors.some((retryable) => 
    errorString.includes(retryable.toUpperCase())
  );
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    retryableErrors,
  } = { ...DEFAULT_CONFIG, ...config };

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if max retries reached
      if (attempt >= maxRetries) {
        logger.error("retry_exhausted", {
          attempts: attempt + 1,
          error: error.message,
        });
        throw error;
      }

      // Don't retry if error is not retryable
      if (!isRetryableError(error, retryableErrors)) {
        logger.warn("retry_skipped_non_retryable", {
          error: error.message,
          code: error.code,
        });
        throw error;
      }

      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
      
      logger.warn("retry_attempt", {
        attempt: attempt + 1,
        maxRetries,
        delay,
        error: error.message,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Network error detection
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  const networkErrorCodes = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "ENETUNREACH",
    "EHOSTUNREACH",
  ];
  
  const errorCode = error.code || "";
  return networkErrorCodes.includes(errorCode);
}

/**
 * Offline detection (browser)
 */
export function isOffline(): boolean {
  if (typeof navigator === "undefined") return false;
  return !navigator.onLine;
}

/**
 * Create user-friendly error message
 */
export function getUserFriendlyError(error: any): string {
  if (!error) return "An unexpected error occurred";

  // Network errors
  if (isNetworkError(error)) {
    return "Network connection failed. Please check your internet connection and try again.";
  }

  // Timeout errors
  if (error.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
    return "Request timed out. Please try again.";
  }

  // Server errors
  if (error.status >= 500) {
    return "Server error. Please try again later.";
  }

  // Client errors
  if (error.status >= 400 && error.status < 500) {
    if (error.status === 401) {
      return "Authentication required. Please log in.";
    }
    if (error.status === 403) {
      return "You don't have permission to perform this action.";
    }
    if (error.status === 404) {
      return "Resource not found.";
    }
    if (error.status === 429) {
      return "Too many requests. Please wait a moment and try again.";
    }
    return error.message || "Invalid request. Please check your input.";
  }

  // Default
  return error.message || "An unexpected error occurred. Please try again.";
}
