// src/middleware/__tests__/jwtAuth.test.ts
// Unit tests for JWT authentication middleware

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { jwtAuthMiddleware, JWTAuthedRequest } from '../jwtAuth';
import { verifyAuthToken } from '../../lib/auth';

jest.mock('../../lib/auth');
jest.mock('../../lib/logger', () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('jwtAuthMiddleware', () => {
  let req: Partial<JWTAuthedRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('attaches user to request with valid token', () => {
    const mockUser = { id: 'user-123', role: 'client' as const };
    (verifyAuthToken as any).mockReturnValue(mockUser);
    
    req.headers = {
      authorization: 'Bearer valid-token',
    };

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(verifyAuthToken).toHaveBeenCalledWith('valid-token');
    expect(req.user).toEqual(mockUser);
    expect(next).toHaveBeenCalled();
  });

  it('rejects request without authorization header', () => {
    req.headers = {};

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'UNAUTHORIZED',
        }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with invalid token', () => {
    (verifyAuthToken as any).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    req.headers = {
      authorization: 'Bearer invalid-token',
    };

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with malformed authorization header', () => {
    req.headers = {
      authorization: 'InvalidFormat token',
    };

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows legacy headers in non-production', () => {
    process.env.NODE_ENV = 'development';
    req.headers = {
      'x-user-id': 'user-123',
      'x-user-role': 'client',
    };

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(req.user).toEqual({
      id: 'user-123',
      role: 'client',
    });
    expect(next).toHaveBeenCalled();
  });

  it('blocks legacy headers in production', () => {
    process.env.NODE_ENV = 'production';
    req.headers = {
      'x-user-id': 'user-123',
      'x-user-role': 'client',
    };

    jwtAuthMiddleware(req as JWTAuthedRequest, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
