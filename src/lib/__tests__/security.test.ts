// src/lib/__tests__/security.test.ts
// Unit tests for security utilities (rate limiting, etc.)

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiter, generalRateLimiter } from '../security';

describe('security utilities', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'GET',
      headers: {},
    };
    res = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('createRateLimiter', () => {
    it('allows requests under limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 10,
      });

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        limiter(req as Request, res as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('blocks requests over limit', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
      });

      // Make 6 requests
      for (let i = 0; i < 6; i++) {
        limiter(req as Request, res as Response, next);
      }

      expect(next).toHaveBeenCalledTimes(5);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'RATE_LIMITED',
          }),
        })
      );
    });

    it('resets limit after window expires', async () => {
      const limiter = createRateLimiter({
        windowMs: 100, // 100ms window
        max: 2,
      });

      // Make 2 requests (should pass)
      limiter(req as Request, res as Response, next);
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(2);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next request should pass (window reset)
      limiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalledTimes(3);
    });

    it('sets rate limit headers', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 10,
      });

      limiter(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 10);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 9);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('uses custom key generator', () => {
      const customKey = 'custom-key';
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: () => customKey,
      });

      limiter(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('generalRateLimiter', () => {
    it('is a configured rate limiter', () => {
      expect(typeof generalRateLimiter).toBe('function');
      
      // Should allow requests under limit
      generalRateLimiter(req as Request, res as Response, next);
      expect(next).toHaveBeenCalled();
    });
  });
});
