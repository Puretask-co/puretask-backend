# Performance Testing Guide

## Overview
This guide covers performance testing setup and procedures for PureTask Backend.

## Tools

### k6 (Load Testing)
**Status**: ✅ Installed

**Installation**:
```bash
npm install --save-dev k6
```

**Usage**:
```bash
# Run basic API load test
npm run test:load

# Run job lifecycle load test
npm run test:load:jobs

# Custom base URL
K6_BASE_URL=https://api.puretask.com npm run test:load

# With authentication
TEST_EMAIL=user@example.com TEST_PASSWORD=password npm run test:load
```

## Test Scenarios

### 1. Basic API Load Test (`tests/load/api-load-test.js`)
**Purpose**: Test general API performance under load

**Configuration**:
- Stages: 50 → 100 → 200 users
- Duration: ~5 minutes total
- Thresholds:
  - 95% of requests < 500ms
  - 99% of requests < 1s
  - Error rate < 1%

**Endpoints Tested**:
- `/health` - Health check
- `/health/ready` - Readiness check
- `/status` - Operational status (if authenticated)
- `/api-docs` - API documentation

**Run**:
```bash
npm run test:load
```

### 2. Job Lifecycle Load Test (`tests/load/job-lifecycle-test.js`)
**Purpose**: Test job-related endpoints under load

**Configuration**:
- Stages: 20 → 50 users
- Duration: ~3 minutes total
- Thresholds:
  - 95% of requests < 1s
  - 99% of requests < 2s
  - Error rate < 5%

**Endpoints Tested**:
- `GET /jobs` - List jobs
- `GET /jobs/:id` - Get job details
- `/health` - Health check

**Run**:
```bash
npm run test:load:jobs
```

## Performance Benchmarks

### Benchmark Utilities (`tests/performance/benchmarks.ts`)
**Purpose**: Measure individual endpoint/query performance

**Usage**:
```typescript
import { benchmarkAPI, runBenchmarks } from './tests/performance/benchmarks';

// Single benchmark
await benchmarkAPI('GET /health', async () => {
  await fetch('http://localhost:4000/health');
}, 200); // Threshold: 200ms

// Multiple benchmarks
await runBenchmarks([
  {
    name: 'GET /health',
    fn: async () => await fetch('http://localhost:4000/health'),
    threshold: 200,
  },
  {
    name: 'GET /jobs',
    fn: async () => await fetch('http://localhost:4000/jobs'),
    threshold: 500,
  },
]);
```

**Run**:
```bash
npm run test:performance
```

## Performance Targets

### Response Time Targets
- **Health endpoints**: < 200ms (p95)
- **Read endpoints**: < 500ms (p95)
- **Write endpoints**: < 1s (p95)
- **Complex operations**: < 2s (p95)

### Throughput Targets
- **Concurrent users**: 200+ without degradation
- **Requests per second**: 100+ sustained
- **Error rate**: < 1% under normal load

### Resource Targets
- **CPU usage**: < 80% under load
- **Memory usage**: < 80% under load
- **Database connections**: < 80% of pool max

## Running Tests

### Local Testing
```bash
# Start backend server
npm run dev

# In another terminal, run load test
npm run test:load
```

### Staging Testing
```bash
K6_BASE_URL=https://staging-api.puretask.com npm run test:load
```

### Production Testing
⚠️ **Warning**: Only run with very low load on production!

```bash
# Very light load only
k6 run --vus 5 --duration 30s tests/load/api-load-test.js
```

## Monitoring During Tests

### Key Metrics to Watch

1. **Response Times**
   - p50 (median)
   - p95 (95th percentile)
   - p99 (99th percentile)

2. **Error Rates**
   - HTTP errors (4xx, 5xx)
   - Timeout errors
   - Connection errors

3. **System Resources**
   - CPU usage
   - Memory usage
   - Database connection pool
   - Network I/O

4. **Application Metrics**
   - Request rate
   - Database query times
   - Cache hit rates
   - Worker queue depth

### Tools for Monitoring

- **k6 Cloud**: Real-time metrics dashboard
- **Sentry**: Error tracking and performance
- **Database**: Slow query logs
- **System**: `htop`, `iostat`, `netstat`

## Interpreting Results

### Good Results ✅
- All thresholds met
- Error rate < 1%
- Response times stable
- No memory leaks
- Database queries optimized

### Warning Signs ⚠️
- Response times increasing over time
- Error rate > 1%
- Memory usage growing
- Database connection pool exhausted
- CPU usage > 80%

### Critical Issues ❌
- System crashes under load
- Error rate > 5%
- Response times > 5s
- Memory leaks detected
- Database timeouts

## Optimization Tips

### If Response Times Are High

1. **Database Optimization**
   - Add indexes to frequently queried columns
   - Optimize slow queries
   - Use connection pooling effectively
   - Consider read replicas

2. **Caching**
   - Cache frequently accessed data
   - Use Redis for session data
   - Implement HTTP caching headers

3. **Code Optimization**
   - Reduce database queries (N+1 problems)
   - Use async/await properly
   - Optimize loops and iterations
   - Profile code to find bottlenecks

### If Error Rate Is High

1. **Check Error Logs**
   - Review Sentry errors
   - Check application logs
   - Review database logs

2. **Resource Limits**
   - Increase connection pool size
   - Add more memory/CPU
   - Scale horizontally

3. **Rate Limiting**
   - Verify rate limits aren't too aggressive
   - Check for rate limit false positives

## Continuous Performance Testing

### CI/CD Integration

Add to `.github/workflows/ci.yml`:
```yaml
performance-test:
  name: Performance Test
  runs-on: ubuntu-latest
  needs: [build]
  
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npm run build
    - name: Start server
      run: npm start &
    - name: Wait for server
      run: sleep 10
    - name: Run load test
      run: npm run test:load
```

### Scheduled Tests

Run performance tests weekly:
- Monitor trends over time
- Detect performance regressions
- Track improvements

## Next Steps

1. **Create More Test Scenarios**
   - Payment flow load test
   - Authentication load test
   - Worker performance test

2. **Set Up Monitoring**
   - Real-time performance dashboards
   - Automated alerts for performance degradation
   - Historical performance tracking

3. **Optimize Based on Results**
   - Identify bottlenecks
   - Optimize slow endpoints
   - Scale infrastructure as needed
