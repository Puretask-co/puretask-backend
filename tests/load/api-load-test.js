// tests/load/api-load-test.js
// k6 load testing script for PureTask Backend API

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },     // Stay at 50 users
    { duration: '30s', target: 100 },   // Ramp up to 100 users
    { duration: '1m', target: 100 },    // Stay at 100 users
    { duration: '30s', target: 200 },   // Ramp up to 200 users
    { duration: '1m', target: 200 },    // Stay at 200 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'],     // Error rate < 1%
    errors: ['rate<0.01'],              // Custom error rate < 1%
  },
};

// Base URL (can be overridden with K6_BASE_URL env var)
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';

// Test user credentials (for authenticated endpoints)
const TEST_USER = {
  email: __ENV.TEST_EMAIL || 'test@example.com',
  password: __ENV.TEST_PASSWORD || 'testpassword123',
};

let authToken = null;

// Setup: Authenticate and get token
export function setup() {
  console.log(`Testing against: ${BASE_URL}`);
  
  // Try to authenticate
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    authToken = body.token;
    console.log('Authentication successful');
  } else {
    console.log('Authentication failed, will test unauthenticated endpoints only');
  }

  return { token: authToken };
}

// Main test function
export default function (data) {
  const token = data.token;
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Test 1: Health endpoint (always available)
  let res = http.get(`${BASE_URL}/health`, { headers });
  const healthCheck = check(res, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
    'health has status field': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.status === 'ok' || body.status === 'healthy';
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!healthCheck);
  sleep(0.5);

  // Test 2: Health ready endpoint
  res = http.get(`${BASE_URL}/health/ready`, { headers });
  const readyCheck = check(res, {
    'ready status is 200': (r) => r.status === 200,
    'ready response time < 300ms': (r) => r.timings.duration < 300,
  });
  errorRate.add(!readyCheck);
  sleep(0.5);

  // Test 3: Status endpoint (if authenticated)
  if (token) {
    res = http.get(`${BASE_URL}/status`, { headers });
    const statusCheck = check(res, {
      'status endpoint works': (r) => r.status === 200 || r.status === 401,
      'status response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!statusCheck);
    sleep(0.5);
  }

  // Test 4: API docs endpoint (if available)
  res = http.get(`${BASE_URL}/api-docs`, { headers });
  check(res, {
    'api-docs accessible': (r) => r.status === 200 || r.status === 404,
  });
  sleep(1);
}

// Teardown (optional)
export function teardown(data) {
  console.log('Load test completed');
}
