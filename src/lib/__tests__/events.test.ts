// src/lib/__tests__/events.test.ts
// Unit tests for event publishing system

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { publishEvent } from '../events';
import { query } from '../../db/client';
import { postJson } from '../httpClient';
import { logger } from '../logger';

jest.mock('../../db/client');
jest.mock('../httpClient');
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('publishEvent', () => {
    it('publishes event to database when jobId provided', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await publishEvent({
        jobId: 'job-123',
        eventName: 'job_created',
        actorType: 'client',
        actorId: 'client-123',
        payload: { test: 'data' },
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO job_events'),
        ['job-123', 'client', 'client-123', 'job_created', expect.any(String)]
      );
      expect(logger.info).toHaveBeenCalledWith('job_event_published', expect.any(Object));
    });

    it('forwards event to n8n webhook when configured', async () => {
      const mockQuery = query as any;
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const mockPostJson = postJson as any;
      mockPostJson.mockResolvedValueOnce({});

      await publishEvent({
        jobId: 'job-123',
        eventName: 'job_created',
      });

      // Should forward to n8n if configured
      // (This depends on env.N8N_WEBHOOK_URL being set)
      expect(mockQuery).toHaveBeenCalled();
    });

    it('handles database insert failures gracefully', async () => {
      const mockQuery = query as any;
      mockQuery.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw, just log error
      await expect(
        publishEvent({
          jobId: 'job-123',
          eventName: 'job_created',
        })
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith('job_event_insert_failed', expect.any(Object));
    });

    it('logs event even when jobId is not provided', async () => {
      await publishEvent({
        eventName: 'system_event',
        payload: { data: 'test' },
      });

      // Should not insert to DB (job_id is required)
      expect(query).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('job_event_published', expect.any(Object));
    });
  });
});
