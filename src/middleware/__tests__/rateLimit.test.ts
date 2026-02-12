// src/middleware/__tests__/rateLimit.test.ts
// Unit tests for rate limiting middleware

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { productionRateLimit } from '../productionRateLimit';

describe('rateLimit middleware', () => {
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

  describe('productionRateLimit', () => {
    it('allows requests under limit', () => {
      productionRateLimit({ windowMs: 60000, max: 100 })(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('sets rate limit headers', () => {
      productionRateLimit({ windowMs: 60000, max: 100 })(req as Request, res as Response, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', expect.any(Number));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });
  });
});
