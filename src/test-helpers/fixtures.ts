// src/test-helpers/fixtures.ts
// Test data fixtures and factories

import { faker } from '@faker-js/faker';

export const createMockUser = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  role: 'client',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockCleaner = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  user_id: faker.string.uuid(),
  tier: 'bronze',
  hourly_rate_credits: 50,
  avg_rating: 4.5,
  total_jobs_completed: 10,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockJob = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  client_id: faker.string.uuid(),
  cleaner_id: faker.string.uuid(),
  status: 'pending',
  service_type: 'standard',
  scheduled_date: faker.date.future().toISOString(),
  duration_hours: 2,
  total_credits: 100,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockBooking = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  client_id: faker.string.uuid(),
  cleaner_id: faker.string.uuid(),
  status: 'confirmed',
  service_type: 'standard',
  scheduled_date: faker.date.future().toISOString(),
  duration_hours: 3,
  address: faker.location.streetAddress(),
  city: faker.location.city(),
  state: faker.location.state(),
  zip_code: faker.location.zipCode(),
  total_price: 150,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockMessage = (overrides: Partial<any> = {}) => ({
  id: faker.string.uuid(),
  sender_id: faker.string.uuid(),
  receiver_id: faker.string.uuid(),
  content: faker.lorem.sentence(),
  is_read: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const validClientData = {
  email: 'testclient@example.com',
  password: 'SecurePass123!',
  role: 'client' as const,
};

export const validCleanerData = {
  email: 'testcleaner@example.com',
  password: 'SecurePass123!',
  role: 'cleaner' as const,
};

export const validAdminData = {
  email: 'testadmin@example.com',
  password: 'SecurePass123!',
  role: 'admin' as const,
};

export const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTEyMzQ1Njc4OTAxMiIsInJvbGUiOiJjbGllbnQiLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

