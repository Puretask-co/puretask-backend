// src/services/__tests__/phoneVerificationService.test.ts
// Unit tests for phone verification service

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { sendOTP, verifyOTP } from '../phoneVerificationService';
import { query } from '../../db/client';
import twilio from 'twilio';

jest.mock('../../db/client');
jest.mock('twilio');
jest.mock('../../config/env', () => ({
  env: {
    TWILIO_ACCOUNT_SID: 'test-sid',
    TWILIO_AUTH_TOKEN: 'test-token',
    TWILIO_PHONE_NUMBER: '+1234567890',
    NODE_ENV: 'test',
  },
}));
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('phoneVerificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendOTP', () => {
    it('generates and stores OTP', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Check existing
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] }); // Insert OTP

      const mockTwilioClient = {
        messages: {
          create: jest.fn().mockResolvedValue({ sid: 'test-sid' }),
        },
      };
      (twilio as any).mockReturnValue(mockTwilioClient);

      const result = await sendOTP('user-123', '+11234567890');

      expect(result.success).toBe(true);
      expect(mockQuery).toHaveBeenCalled();
      expect(mockTwilioClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+11234567890',
          body: expect.stringContaining('verification code'),
        })
      );
    });

    it('validates phone number format', async () => {
      const result = await sendOTP('user-123', 'invalid-phone');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('handles Twilio errors gracefully', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [{ id: '1' }] });

      const mockTwilioClient = {
        messages: {
          create: jest.fn().mockRejectedValue(new Error('Twilio error')),
        },
      };
      (twilio as any).mockReturnValue(mockTwilioClient);

      const result = await sendOTP('user-123', '+11234567890');

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('verifyOTP', () => {
    it('verifies correct OTP', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '1',
          otp_code: '123456',
          expires_at: new Date(Date.now() + 600000), // 10 minutes from now
          verified_at: null,
        }],
      });
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update verification
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update profile

      const result = await verifyOTP('user-123', '+11234567890', '123456');

      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('rejects incorrect OTP', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '1',
          otp_code: '123456',
          expires_at: new Date(Date.now() + 600000),
          verified_at: null,
        }],
      });

      const result = await verifyOTP('user-123', '+11234567890', 'wrong-code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('rejects expired OTP', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '1',
          otp_code: '123456',
          expires_at: new Date(Date.now() - 1000), // Expired
          verified_at: null,
        }],
      });

      const result = await verifyOTP('user-123', '+11234567890', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('expired');
    });

    it('rejects already verified OTP', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: '1',
          otp_code: '123456',
          expires_at: new Date(Date.now() + 600000),
          verified_at: new Date(), // Already verified
        }],
      });

      const result = await verifyOTP('user-123', '+11234567890', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already verified');
    });
  });
});
