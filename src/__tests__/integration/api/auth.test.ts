// src/__tests__/integration/api/auth.test.ts
// Integration tests for authentication API endpoints

import request from 'supertest';
import express from 'express';
import authRouter from '../../../routes/auth';
import { validClientData, validCleanerData } from '../../../test-helpers/fixtures';

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRouter);

describe('Auth API Integration Tests', () => {
  describe('POST /auth/register', () => {
    it('should register a new client successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `client-${Date.now()}@test.com`,
          password: 'TestPass123!',
          role: 'client',
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('client');
      expect(response.body.token).toBeValidJWT();
    });

    it('should register a new cleaner successfully', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `cleaner-${Date.now()}@test.com`,
          password: 'TestPass123!',
          role: 'cleaner',
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.role).toBe('cleaner');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'TestPass123!',
          role: 'client',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@test.com',
          password: '123',
          role: 'client',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject duplicate email registration', async () => {
      const email = `duplicate-${Date.now()}@test.com`;
      
      // First registration
      await request(app)
        .post('/auth/register')
        .send({
          email,
          password: 'TestPass123!',
          role: 'client',
        })
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/auth/register')
        .send({
          email,
          password: 'TestPass123!',
          role: 'client',
        })
        .expect(400);

      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should reject admin role self-registration', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: `admin-${Date.now()}@test.com`,
          password: 'TestPass123!',
          role: 'admin',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    const testUser = {
      email: `logintest-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'client' as const,
    };

    beforeAll(async () => {
      // Register a test user
      await request(app)
        .post('/auth/register')
        .send(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.token).toBeValidJWT();
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'TestPass123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'invalid-email',
          password: 'TestPass123!',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject login with missing password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /auth/me', () => {
    let authToken: string;
    const testUser = {
      email: `metest-${Date.now()}@test.com`,
      password: 'TestPass123!',
      role: 'client' as const,
    };

    beforeAll(async () => {
      // Register and login to get token
      const registerResponse = await request(app)
        .post('/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.token;
    });

    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should reject request without token', async () => {
      await request(app)
        .get('/auth/me')
        .expect(401);
    });

    it('should reject request with invalid token', async () => {
      await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed authorization header', async () => {
      await request(app)
        .get('/auth/me')
        .set('Authorization', 'InvalidFormat')
        .expect(401);
    });
  });
});

