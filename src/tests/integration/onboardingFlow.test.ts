// src/tests/integration/onboardingFlow.test.ts
// Integration test for complete onboarding flow

import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../index';
import { query } from '../../db/client';
import * as onboardingService from '../../services/cleanerOnboardingService';
import * as phoneService from '../../services/phoneVerificationService';

jest.mock('../../db/client');
jest.mock('../../services/cleanerOnboardingService');
jest.mock('../../services/phoneVerificationService');
jest.mock('../../lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Complete Onboarding Flow Integration', () => {
  let authToken: string;
  let cleanerId: string;

  beforeEach(() => {
    cleanerId = 'cleaner-123';
    authToken = 'mock-jwt-token';
  });

  it('completes full 10-step onboarding flow', async () => {
    const mockQuery = query as any;

    // Step 1: Save agreements
    (onboardingService.saveAgreements as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] }); // Update current step

    let res = await request(app)
      .post('/cleaner/onboarding/agreements')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        terms_of_service: true,
        independent_contractor: true,
      });
    expect(res.status).toBe(200);

    // Step 2: Save basic info
    (onboardingService.saveBasicInfo as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/basic-info')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        first_name: 'John',
        last_name: 'Doe',
        bio: 'Experienced cleaner',
        professional_headline: 'Professional Cleaner',
      });
    expect(res.status).toBe(200);

    // Step 3: Send OTP
    (phoneService.sendOTP as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/send-otp')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ phone_number: '+11234567890' });
    expect(res.status).toBe(200);

    // Step 4: Verify OTP
    (phoneService.verifyOTP as any).mockResolvedValueOnce({
      success: true,
      verified: true,
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/verify-otp')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        phone_number: '+11234567890',
        otp_code: '123456',
      });
    expect(res.status).toBe(200);

    // Step 5: Upload face photo
    (onboardingService.uploadFacePhoto as any).mockResolvedValueOnce({
      success: true,
      profile_photo_url: '/uploads/profile-photos/user-123/face.jpg',
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-123' }] })
      .mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/face-photo')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('file', Buffer.from('fake-image'), 'face.jpg');
    expect(res.status).toBe(200);

    // Step 6: Upload ID
    (onboardingService.uploadIDVerification as any).mockResolvedValueOnce({
      success: true,
      id_verification_id: 'id-verification-123',
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [{ user_id: 'user-123' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'id-verification-123' }] });

    res = await request(app)
      .post('/cleaner/onboarding/id-verification')
      .set('Authorization', `Bearer ${authToken}`)
      .field('document_type', 'drivers_license')
      .attach('file', Buffer.from('fake-pdf'), 'id.pdf');
    expect(res.status).toBe(200);

    // Step 7: Background check consent
    (onboardingService.saveBackgroundCheckConsent as any).mockResolvedValueOnce({
      success: true,
    });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/background-consent')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        fcra_consent: true,
        accuracy_consent: true,
      });
    expect(res.status).toBe(200);

    // Step 8: Service areas
    (onboardingService.saveServiceAreas as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/service-areas')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        zip_codes: ['10001', '10002'],
        travel_radius_km: 25,
      });
    expect(res.status).toBe(200);

    // Step 9: Availability
    (onboardingService.saveAvailability as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/availability')
      .set('Authorization', `Bearer ${authToken}`)
      .send([
        { day_of_week: 1, start_time: '09:00', end_time: '17:00' },
      ]);
    expect(res.status).toBe(200);

    // Step 10: Rates
    (onboardingService.saveRates as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/rates')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        hourly_rate_credits: 300,
        travel_radius_km: 20,
      });
    expect(res.status).toBe(200);

    // Complete onboarding
    (onboardingService.getOnboardingProgress as any).mockResolvedValueOnce({
      progress: {
        completed: 10,
        total: 10,
        percentage: 100,
        current_step: 'review',
        steps: {
          agreements: true,
          basic_info: true,
          phone_verified: true,
          face_photo: true,
          id_verification: true,
          background_consent: true,
          service_areas: true,
          availability: true,
          rates: true,
        },
      },
    });
    (onboardingService.completeOnboarding as any).mockResolvedValueOnce({ success: true });
    mockQuery.mockResolvedValueOnce({ rows: [] });

    res = await request(app)
      .post('/cleaner/onboarding/complete')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
