// src/services/__tests__/onboardingReminderService.test.ts
// Unit tests for onboarding reminder service

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import {
  getAbandonedOnboardingCleaners,
  sendOnboardingReminder,
  sendOnboardingReminders,
} from '../onboardingReminderService';
import { query } from '../../db/client';
import sgMail from '@sendgrid/mail';
import { env } from '../../config/env';

jest.mock('../../db/client');
jest.mock('@sendgrid/mail');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('onboardingReminderService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAbandonedOnboardingCleaners', () => {
    it('finds cleaners who abandoned onboarding', async () => {
      const mockCleaners = [
        {
          id: 'cleaner-1',
          user_id: 'user-1',
          first_name: 'John',
          onboarding_current_step: 'phone-verification',
          onboarding_started_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          email: 'john@example.com',
        },
      ];

      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: mockCleaners });

      const result = await getAbandonedOnboardingCleaners(24);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cleaner-1');
      expect(mockQuery).toHaveBeenCalled();
    });

    it('respects hours threshold', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await getAbandonedOnboardingCleaners(48);

      const queryCall = mockQuery.mock.calls[0][0];
      expect(queryCall).toContain('$1');
    });
  });

  describe('sendOnboardingReminder', () => {
    it('sends email via SendGrid', async () => {
      const mockCleaner = {
        id: 'cleaner-1',
        user_id: 'user-1',
        first_name: 'John',
        email: 'john@example.com',
        onboarding_current_step: 'phone-verification',
      };

      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] }); // Update reminder sent

      (sgMail.send as any).mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(true);
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: 'Complete Your PureTask Onboarding',
        })
      );
    });

    it('handles SendGrid errors', async () => {
      const mockCleaner = {
        id: 'cleaner-1',
        user_id: 'user-1',
        first_name: 'John',
        email: 'john@example.com',
        onboarding_current_step: 'phone-verification',
      };

      (sgMail.send as any).mockRejectedValueOnce({
        response: {
          body: {
            errors: [{ message: 'Invalid email' }],
          },
        },
      });

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('skips when SendGrid not configured', async () => {
      const originalKey = env.SENDGRID_API_KEY;
      delete (env as any).SENDGRID_API_KEY;

      const mockCleaner = {
        id: 'cleaner-1',
        user_id: 'user-1',
        first_name: 'John',
        email: 'john@example.com',
        onboarding_current_step: 'phone-verification',
      };

      const result = await sendOnboardingReminder(mockCleaner);

      expect(result.success).toBe(false);
      expect(result.error).toContain('SendGrid not configured');

      env.SENDGRID_API_KEY = originalKey;
    });
  });

  describe('sendOnboardingReminders', () => {
    it('sends reminders to all abandoned cleaners', async () => {
      const mockCleaners = [
        {
          id: 'cleaner-1',
          user_id: 'user-1',
          first_name: 'John',
          email: 'john@example.com',
          onboarding_current_step: 'phone-verification',
          onboarding_started_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
        {
          id: 'cleaner-2',
          user_id: 'user-2',
          first_name: 'Jane',
          email: 'jane@example.com',
          onboarding_current_step: 'basic-info',
          onboarding_started_at: new Date(Date.now() - 30 * 60 * 60 * 1000),
        },
      ];

      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({ rows: mockCleaners }) // Get abandoned
        .mockResolvedValueOnce({ rows: [] }) // Update cleaner 1
        .mockResolvedValueOnce({ rows: [] }); // Update cleaner 2

      (sgMail.send as any)
        .mockResolvedValueOnce([{ statusCode: 202 }])
        .mockResolvedValueOnce([{ statusCode: 202 }]);

      const result = await sendOnboardingReminders(24);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('handles partial failures', async () => {
      const mockCleaners = [
        {
          id: 'cleaner-1',
          user_id: 'user-1',
          first_name: 'John',
          email: 'john@example.com',
          onboarding_current_step: 'phone-verification',
          onboarding_started_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
        {
          id: 'cleaner-2',
          user_id: 'user-2',
          first_name: 'Jane',
          email: 'invalid-email',
          onboarding_current_step: 'basic-info',
          onboarding_started_at: new Date(Date.now() - 30 * 60 * 60 * 1000),
        },
      ];

      const mockQuery = query as any;
      mockQuery
        .mockResolvedValueOnce({ rows: mockCleaners })
        .mockResolvedValueOnce({ rows: [] });

      (sgMail.send as any)
        .mockResolvedValueOnce([{ statusCode: 202 }])
        .mockRejectedValueOnce({ message: 'Invalid email' });

      const result = await sendOnboardingReminders(24);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });
});
