// src/middleware/__tests__/adminAuth.test.ts
// Unit tests for admin authentication middleware

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { requireAdmin } from '../adminAuth';
import { jwtAuthMiddleware, JWTAuthedRequest } from '../jwtAuth';

jest.mock('../jwtAuth', () => ({
  jwtAuthMiddleware: jest.fn((req: any, res: any, next: any) => {
    (req as any).user = { id: 'user-123', role: 'admin' };
    next();
  }),
}));

describe('adminAuth middleware', () => {
  let req: Partial<JWTAuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      user: { id: 'user-123', role: 'admin' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAdmin', () => {
    it('allows admin users', () => {
      req.user = { id: 'user-123', role: 'admin' };

      requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects non-admin users', () => {
      req.user = { id: 'user-123', role: 'client' };

      requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FORBIDDEN',
          }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('rejects requests without user', () => {
      req.user = undefined;

      requireAdmin(req as JWTAuthedRequest, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
