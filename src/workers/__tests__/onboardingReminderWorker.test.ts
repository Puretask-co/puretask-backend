// src/workers/__tests__/onboardingReminderWorker.test.ts
// Unit tests for onboarding reminder worker

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { runOnboardingReminderWorker } from '../onboardingReminderWorker';
import { sendOnboardingReminders } from '../../services/onboardingReminderService';
import { logger } from '../../lib/logger';

jest.mock('../../services/onboardingReminderService');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('onboardingReminderWorker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends reminders successfully', async () => {
    const mockResult = {
      success: true,
      count: 5,
      errors: [],
    };

    (sendOnboardingReminders as any).mockResolvedValueOnce(mockResult);

    const result = await runOnboardingReminderWorker();

    expect(result).toEqual(mockResult);
    expect(sendOnboardingReminders).toHaveBeenCalledWith(24);
    expect(logger.info).toHaveBeenCalledWith('onboarding_reminder_worker_started');
    expect(logger.info).toHaveBeenCalledWith(
      'onboarding_reminder_worker_completed',
      expect.objectContaining({
        success: true,
        count: 5,
        errors: 0,
      })
    );
  });

  it('handles errors gracefully', async () => {
    const mockResult = {
      success: true,
      count: 3,
      errors: [
        { cleanerId: 'cleaner-1', error: 'Email failed' },
        { cleanerId: 'cleaner-2', error: 'Invalid email' },
      ],
    };

    (sendOnboardingReminders as any).mockResolvedValueOnce(mockResult);

    const result = await runOnboardingReminderWorker();

    expect(result).toEqual(mockResult);
    expect(logger.warn).toHaveBeenCalledWith(
      'onboarding_reminder_worker_errors',
      expect.objectContaining({
        errors: mockResult.errors,
      })
    );
  });

  it('handles service failures', async () => {
    const error = new Error('Service unavailable');
    (sendOnboardingReminders as any).mockRejectedValueOnce(error);

    await expect(runOnboardingReminderWorker()).rejects.toThrow('Service unavailable');
    expect(logger.error).toHaveBeenCalledWith(
      'onboarding_reminder_worker_failed',
      expect.objectContaining({
        error: 'Service unavailable',
      })
    );
  });
});
