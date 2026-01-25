// src/lib/__tests__/errorRecovery.test.ts
// Unit tests for error recovery utilities

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import {
  retryWithBackoff,
  isNetworkError,
  isOffline,
  getUserFriendlyError,
} from '../errorRecovery';

describe('errorRecovery utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retryWithBackoff', () => {
    it('succeeds on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and succeeds', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('success');
      
      const result = await retryWithBackoff(fn, { maxRetries: 3 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('fails after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3 })
      ).rejects.toThrow('Network error');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('uses exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success');
      
      const startTime = Date.now();
      await retryWithBackoff(fn, { maxRetries: 3, initialDelay: 100 });
      const elapsed = Date.now() - startTime;
      
      // Should have waited at least 100ms + 200ms = 300ms
      expect(elapsed).toBeGreaterThanOrEqual(250); // Allow some margin
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('does not retry non-network errors', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('Validation error'));
      
      await expect(
        retryWithBackoff(fn, { maxRetries: 3, retryOnlyNetworkErrors: true })
      ).rejects.toThrow('Validation error');
      expect(fn).toHaveBeenCalledTimes(1); // Should not retry
    });
  });

  describe('isNetworkError', () => {
    it('detects network errors', () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';
      expect(isNetworkError(networkError)).toBe(true);
    });

    it('detects timeout errors', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';
      expect(isNetworkError(timeoutError)).toBe(true);
    });

    it('detects ECONNREFUSED errors', () => {
      const error: any = new Error('Connection refused');
      error.code = 'ECONNREFUSED';
      expect(isNetworkError(error)).toBe(true);
    });

    it('returns false for non-network errors', () => {
      const validationError = new Error('Invalid input');
      expect(isNetworkError(validationError)).toBe(false);
    });
  });

  describe('isOffline', () => {
    it('detects offline status', () => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      });
      expect(isOffline()).toBe(true);
    });

    it('detects online status', () => {
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true,
      });
      expect(isOffline()).toBe(false);
    });
  });

  describe('getUserFriendlyError', () => {
    it('returns user-friendly message for network errors', () => {
      const error = new Error('Network request failed');
      error.name = 'NetworkError';
      const message = getUserFriendlyError(error);
      expect(message).toContain('network');
      expect(message).not.toContain('NetworkError');
    });

    it('returns user-friendly message for timeout errors', () => {
      const error = new Error('Request timeout');
      const message = getUserFriendlyError(error);
      expect(message).toContain('timeout');
    });

    it('returns generic message for unknown errors', () => {
      const error = new Error('Unknown error');
      const message = getUserFriendlyError(error);
      expect(message).toBeTruthy();
      expect(typeof message).toBe('string');
    });
  });
});
