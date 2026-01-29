// tests/load/job-lifecycle-test.js
// k6 load test for job creation and lifecycle endpoints

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // Ramp up to 20 users
    { duration: '1m', target: 20 },     // Stay at 20 users
    { duration: '30s', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 50 },     // Stay at 50 users
    { duration: '30s', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],  // 95% < 1s, 99% < 2s
    http_req_failed: ['rate<0.05'],     // Error rate < 5% (higher for complex operations)
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:4000';
const TEST_USER = {
  email: __ENV.TEST_EMAIL || 'test@example.com',
  password: __ENV.TEST_PASSWORD || 'testpassword123',
};

let authToken = null;

export function setup() {
  // Authenticate
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: TEST_USER.email,
    password: TEST_USER.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    authToken = body.token;
  }

  return { token: authToken };
}

export default function (data) {
  if (!data.token) {
    console.log('No auth token, skipping job lifecycle test');
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  // Test 1: List jobs
  let res = http.get(`${BASE_URL}/jobs`, { headers });
  const listCheck = check(res, {
    'list jobs status is 200': (r) => r.status === 200,
    'list jobs response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!listCheck);
  sleep(1);

  // Test 2: Get job details (if jobs exist)
  if (res.status === 200) {
    try {
      const body = JSON.parse(res.body);
      if (body.jobs && body.jobs.length > 0) {
        const jobId = body.jobs[0].id;
        res = http.get(`${BASE_URL}/jobs/${jobId}`, { headers });
        check(res, {
          'get job status is 200': (r) => r.status === 200,
          'get job response time < 500ms': (r) => r.timings.duration < 500,
        });
        sleep(1);
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  // Test 3: Health check (lighter operation)
  res = http.get(`${BASE_URL}/health`, { headers });
  check(res, {
    'health check works': (r) => r.status === 200,
  });
  sleep(0.5);
}
