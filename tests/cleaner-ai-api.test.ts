/**
 * Cleaner AI Settings API Test Suite
 * 
 * Comprehensive automated tests for all AI Assistant API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { db } from '../src/db/client';

const API_BASE = process.env.API_URL || 'http://localhost:3000';
let authToken: string;
let cleanerId: string;
let templateId: string;
let responseId: string;

describe('Cleaner AI Settings API', () => {
  // Setup: Get auth token
  beforeAll(async () => {
    // Login as a test cleaner
    const response = await request(API_BASE)
      .post('/auth/login')
      .send({
        email: process.env.TEST_CLEANER_EMAIL || 'test-cleaner@example.com',
        password: process.env.TEST_CLEANER_PASSWORD || 'TestPassword123!',
      });

    authToken = response.body.token;
    cleanerId = response.body.user.id;
    expect(authToken).toBeDefined();
  });

  // ============================================
  // SETTINGS TESTS
  // ============================================

  describe('GET /cleaner/ai/settings', () => {
    it('should fetch all settings grouped by category', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/settings')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('settings');
      expect(response.body).toHaveProperty('totalSettings');
      expect(response.body.cleanerId).toBe(cleanerId);
    });

    it('should return 401 without auth token', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/settings');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /cleaner/ai/settings/:category', () => {
    it('should fetch settings for communication category', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/settings/communication')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('category');
      expect(response.body.category).toBe('communication');
      expect(Array.isArray(response.body.settings)).toBe(true);
    });
  });

  describe('PATCH /cleaner/ai/settings/:settingKey', () => {
    it('should update a single setting', async () => {
      const response = await request(API_BASE)
        .patch('/cleaner/ai/settings/booking_confirmation.enabled')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: true,
          enabled: true,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.setting.key).toBe('booking_confirmation.enabled');
    });

    it('should return 404 for non-existent setting', async () => {
      const response = await request(API_BASE)
        .patch('/cleaner/ai/settings/nonexistent.setting')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          value: true,
        });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /cleaner/ai/settings/bulk-update', () => {
    it('should bulk update multiple settings', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/settings/bulk-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          settings: [
            { key: 'booking_confirmation.enabled', value: true },
            { key: 'pre_cleaning_reminder.enabled', value: true },
            { key: 'daily_summary.enabled', value: true },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('updated');
      expect(response.body.updated).toBeGreaterThan(0);
    });
  });

  // ============================================
  // TEMPLATES TESTS
  // ============================================

  describe('GET /cleaner/ai/templates', () => {
    it('should fetch all templates', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/templates')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.templates)).toBe(true);
      expect(response.body).toHaveProperty('count');
    });

    it('should filter templates by type', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/templates?type=booking_confirmation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const templates = response.body.templates;
      if (templates.length > 0) {
        expect(templates.every((t: any) => t.type === 'booking_confirmation')).toBe(true);
      }
    });
  });

  describe('POST /cleaner/ai/templates', () => {
    it('should create a new template', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateType: 'custom',
          templateName: 'Test Template',
          templateContent: 'Hi {client_name}, this is a test message from {cleaner_name}',
          variables: ['client_name', 'cleaner_name'],
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('template');
      expect(response.body.template.name).toBe('Test Template');
      templateId = response.body.template.id;
    });

    it('should validate required fields', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/templates')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateType: 'custom',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /cleaner/ai/templates/:templateId', () => {
    it('should update an existing template', async () => {
      const response = await request(API_BASE)
        .patch(`/cleaner/ai/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateName: 'Updated Test Template',
          isActive: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.template.name).toBe('Updated Test Template');
    });
  });

  describe('DELETE /cleaner/ai/templates/:templateId', () => {
    it('should delete a template', async () => {
      const response = await request(API_BASE)
        .delete(`/cleaner/ai/templates/${templateId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });
  });

  // ============================================
  // QUICK RESPONSES TESTS
  // ============================================

  describe('GET /cleaner/ai/quick-responses', () => {
    it('should fetch all quick responses', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/quick-responses')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.responses)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/quick-responses?category=pricing')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      const responses = response.body.responses;
      if (responses.length > 0) {
        expect(responses.every((r: any) => r.category === 'pricing')).toBe(true);
      }
    });
  });

  describe('POST /cleaner/ai/quick-responses', () => {
    it('should create a new quick response', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/quick-responses')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'test',
          triggerKeywords: ['test', 'testing'],
          responseText: 'This is a test response',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('response');
      responseId = response.body.response.id;
    });
  });

  describe('PATCH /cleaner/ai/quick-responses/:responseId', () => {
    it('should update a quick response', async () => {
      const response = await request(API_BASE)
        .patch(`/cleaner/ai/quick-responses/${responseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          responseText: 'Updated test response',
          isFavorite: true,
        });

      expect(response.status).toBe(200);
      expect(response.body.response.favorite).toBe(true);
    });
  });

  describe('DELETE /cleaner/ai/quick-responses/:responseId', () => {
    it('should delete a quick response', async () => {
      const response = await request(API_BASE)
        .delete(`/cleaner/ai/quick-responses/${responseId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  // ============================================
  // PREFERENCES TESTS
  // ============================================

  describe('GET /cleaner/ai/preferences', () => {
    it('should fetch AI preferences', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/preferences')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('preferences');
      expect(response.body.preferences).toHaveProperty('communicationTone');
    });
  });

  describe('PATCH /cleaner/ai/preferences', () => {
    it('should update AI preferences', async () => {
      const response = await request(API_BASE)
        .patch('/cleaner/ai/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          communicationTone: 'professional',
          formalityLevel: 4,
          emojiUsage: 'minimal',
        });

      expect(response.status).toBe(200);
      expect(response.body.preferences.communicationTone).toBe('professional');
    });

    it('should validate enum values', async () => {
      const response = await request(API_BASE)
        .patch('/cleaner/ai/preferences')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          communicationTone: 'invalid_tone',
        });

      expect(response.status).toBe(400);
    });
  });

  // ============================================
  // INSIGHTS TESTS
  // ============================================

  describe('GET /cleaner/ai/insights', () => {
    it('should fetch AI insights', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/insights')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('templates');
      expect(response.body).toHaveProperty('quickResponses');
      expect(response.body).toHaveProperty('settings');
    });
  });

  // ============================================
  // ADVANCED FEATURES TESTS
  // ============================================

  describe('GET /cleaner/ai/advanced/export', () => {
    it('should export all settings', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/advanced/export')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('settings');
      expect(response.body).toHaveProperty('templates');
      expect(response.body).toHaveProperty('quickResponses');
    });
  });

  describe('POST /cleaner/ai/advanced/preview-template', () => {
    it('should preview template with sample data', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/advanced/preview-template')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateContent: 'Hi {client_name}, see you at {time}!',
          sampleData: {
            client_name: 'John',
            time: '2:00 PM',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.preview).toBe('Hi John, see you at 2:00 PM!');
      expect(response.body.unreplacedVariables).toHaveLength(0);
    });

    it('should identify unreplaced variables', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/advanced/preview-template')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          templateContent: 'Hi {client_name}, see you at {time}!',
          sampleData: {
            client_name: 'John',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.unreplacedVariables).toContain('time');
    });
  });

  describe('POST /cleaner/ai/advanced/reset-to-defaults', () => {
    it('should reset settings to defaults', async () => {
      const response = await request(API_BASE)
        .post('/cleaner/ai/advanced/reset-to-defaults')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resetType: 'settings',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('reset');
    });
  });

  describe('GET /cleaner/ai/advanced/templates/search', () => {
    it('should search templates', async () => {
      const response = await request(API_BASE)
        .get('/cleaner/ai/advanced/templates/search?q=confirmation')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.templates)).toBe(true);
    });
  });

  // Cleanup
  afterAll(async () => {
    await db.end();
  });
});

