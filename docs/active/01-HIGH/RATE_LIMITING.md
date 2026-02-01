# Rate Limiting Guide

## Overview

**What it is:** The high-level summary of our rate limiting (in-memory vs Redis, where it's applied).  
**What it does:** Describes how we limit requests per client to prevent abuse and keep the app stable.  
**How we use it:** Read this first; then use Implementation and Configuration when enabling or tuning rate limits.

This guide covers rate limiting implementation for PureTask Backend, including Redis-based rate limiting for production.

**What this doc is for:** Use it when you need to (1) understand how rate limiting works (in-memory vs Redis), (2) configure limits or Redis, or (3) add rate limiting to new routes. Each section explains **what the option does**, **when to use it**, and **how to configure**.

**Why it matters:** Rate limiting prevents abuse (e.g. brute-force login, API spam). In-memory is fine for single instance; Redis is needed when you run multiple instances so limits are shared.

**In plain English:** Rate limiting = "only allow X requests per minute per user (or per IP)." That stops someone from trying thousands of passwords or hammering the API. We can store the counts in memory (one server) or in Redis (many servers share the same counts). This doc explains both and how to turn them on.

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Implementation

### In-Memory Rate Limiting (Default)
**Location**: `src/lib/security.ts`

**Features**:
- Fast and simple
- No external dependencies
- Works across single server instance
- Not shared across multiple servers

**Use Case**: Development, single-server deployments

### Redis-Based Rate Limiting (Production)
**What it is:** Rate limit state stored in Redis so all instances share the same counts.  
**What it does:** Ensures limits apply across multiple servers (e.g. horizontal scaling).  
**How we use it:** Set REDIS_URL and use Redis limiter in production when running more than one instance; location `src/lib/rateLimitRedis.ts`.

**Location**: `src/lib/rateLimitRedis.ts`

**Features**:
- Shared across multiple server instances
- Persistent rate limit state
- Better for load-balanced deployments
- Automatic fallback to in-memory if Redis unavailable

**Use Case**: Production, multi-server deployments

## Configuration

### Environment Variables

```bash
# Enable Redis-based rate limiting
USE_REDIS_RATE_LIMITING=true
REDIS_URL=redis://localhost:6379

# Or for production Redis
REDIS_URL=rediss://user:password@redis.example.com:6380
```

### Rate Limit Settings

**General API**:
- Window: 15 minutes
- Max Requests: 300 per IP

**Authentication Endpoints**:
- Window: 15 minutes
- Max Requests: 200 per IP

**Endpoint-Specific**:
- Configured per endpoint pattern
- See `src/lib/security.ts` for details

## Usage

### Automatic (Default)
Rate limiting is automatically applied to all routes via middleware in `src/index.ts`.

### Manual Application
```typescript
import { productionGeneralRateLimiter } from "./lib/rateLimitRedis";

router.use(productionGeneralRateLimiter);
```

### Custom Rate Limiter
```typescript
import { createRedisRateLimiter } from "./lib/rateLimitRedis";

const customLimiter = createRedisRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: "Too many requests",
});

router.use(customLimiter);
```

## Rate Limit Headers

All rate-limited responses include standard headers:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1706544000
Retry-After: 900
```

## Error Response

When rate limit is exceeded:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down.",
    "retryAfter": 900
  }
}
```

**Status Code**: `429 Too Many Requests`

## Redis Implementation Details

### Algorithm: Sliding Window Log
- Uses Redis sorted sets (ZSET)
- Key: `rate_limit:{identifier}`
- Score: Timestamp
- Value: Unique request ID

### Benefits
- Accurate sliding window
- Handles distributed systems
- Automatic cleanup of old entries
- TTL-based expiration

### Fallback Behavior
- If Redis unavailable → Falls back to in-memory limiter
- If Redis error → Falls back to in-memory limiter
- Logs fallback events for monitoring

## Monitoring

### Key Metrics
- Rate limit hits (429 responses)
- Fallback to in-memory limiter
- Redis connection status
- Rate limit effectiveness

### Logs
```json
{
  "level": "warn",
  "msg": "rate_limit_exceeded_redis",
  "key": "192.168.1.1",
  "path": "/auth/login",
  "count": 201,
  "max": 200
}
```

## Testing

### Test Rate Limiting
```bash
# Make requests until limit is hit
for i in {1..350}; do
  curl -X POST http://localhost:4000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
done

# Should get 429 after limit
```

### Verify Headers
```bash
curl -I http://localhost:4000/health
# Check for X-RateLimit-* headers
```

## Production Recommendations

1. **Enable Redis Rate Limiting**
   ```bash
   USE_REDIS_RATE_LIMITING=true
   REDIS_URL=your-redis-url
   ```

2. **Monitor Rate Limit Hits**
   - Set up alerts for high rate limit hit rates
   - Monitor Redis connection health
   - Track fallback events

3. **Tune Limits**
   - Adjust limits based on usage patterns
   - Consider different limits for different endpoints
   - Monitor false positives

4. **Redis Setup**
   - Use Redis Cluster for high availability
   - Set appropriate memory limits
   - Configure persistence if needed
   - Monitor Redis performance

## Troubleshooting

### Rate Limiting Not Working
- Check `USE_REDIS_RATE_LIMITING` is set correctly
- Verify Redis connection (`REDIS_URL`)
- Check logs for fallback messages
- Verify middleware is applied

### Too Many False Positives
- Increase rate limit thresholds
- Review IP detection (check proxy headers)
- Consider user-based limiting for authenticated endpoints

### Redis Connection Issues
- Check Redis server status
- Verify `REDIS_URL` format
- Check network connectivity
- Review Redis logs

## Best Practices

1. **Use Redis in Production**
   - Essential for load-balanced deployments
   - Provides consistent rate limiting
   - Better scalability

2. **Monitor Rate Limits**
   - Track rate limit hit rates
   - Identify abuse patterns
   - Adjust limits as needed

3. **Different Limits for Different Endpoints**
   - Stricter limits for auth endpoints
   - More lenient for read-only endpoints
   - Consider user-based limits for authenticated routes

4. **Graceful Degradation**
   - Always fall back to in-memory if Redis fails
   - Log fallback events
   - Monitor fallback frequency

## Next Steps

1. **Set Up Redis**
   - Configure Redis instance
   - Set `REDIS_URL` environment variable
   - Enable `USE_REDIS_RATE_LIMITING`

2. **Monitor Performance**
   - Track rate limit effectiveness
   - Monitor Redis performance
   - Adjust limits based on usage

3. **Add More Granular Limits**
   - Per-endpoint limits
   - Per-user limits
   - Per-IP limits with whitelisting
