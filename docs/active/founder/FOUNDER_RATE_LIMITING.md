# Founder Reference: Rate Limiting

**Candidate:** Rate limiting (System #7)  
**Where it lives:** `src/lib/security.ts` (createRateLimiter, generalRateLimiter, authRateLimiter, endpointRateLimiter, endpointRateLimits), `src/lib/rateLimitRedis.ts` (createRedisRateLimiter, productionGeneralRateLimiter, productionAuthRateLimiter), `src/middleware/productionRateLimit.ts`, `src/middleware/rateLimit.ts`; auth routes use productionAuthRateLimiter  
**Why document:** How we throttle requests, when we use Redis vs in-memory, and how to tune limits.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Rate limiting in PureTask caps how many requests a client (or user) can make in a time window so we avoid abuse, brute force, and overload. **In-memory:** `createRateLimiter` in security.ts uses a Map of buckets (key → { count, firstRequestAt }); each request increments count in the window; if count > max we return 429 with Retry-After and X-RateLimit-* headers. Window is fixed (e.g. 15 minutes); buckets are cleaned up periodically (e.g. every 5 minutes, delete keys older than 1 hour). **Redis:** `createRedisRateLimiter` in rateLimitRedis.ts uses a sorted set (key = rate_limit:{identifier}, score = timestamp); we remove entries outside the window, count with zCard, and if count >= max return 429; else zAdd current request and set key TTL. Sliding window per request. **Pre-configured limiters:** general (300/15 min per IP), auth (200/15 min per IP), stripeWebhook (100/min), passwordReset (5/hour), endpoint-specific (login, register, payments, jobs, admin, webhooks, etc.) in endpointRateLimits. **Production:** index.ts uses productionGeneralRateLimiter or generalRateLimiter (Redis if USE_REDIS_RATE_LIMITING and Redis available, else in-memory); auth routes use productionAuthRateLimiter. Endpoint-specific limits can be applied via endpointRateLimiter(limits).

**Simple (like for a 10-year-old):** Rate limiting is like "you can only knock on the door this many times per 15 minutes." We count requests per person (or per IP) and if they go over the limit we say "too many requests, try again later" (429). We can count in memory (per server) or in Redis (shared across servers). We have different limits for different things: general API (300 per 15 min), login (200 per 15 min), password reset (5 per hour), and per-endpoint (e.g. payments 10 per minute, job creation 20 per minute).

### 2. Where it is used

**Technical:** `src/lib/security.ts`: createRateLimiter, getClientIp, generalRateLimiter, authRateLimiter, stripeWebhookRateLimiter, passwordResetRateLimiter, endpointRateLimits, endpointRateLimiter. `src/lib/rateLimitRedis.ts`: createRedisRateLimiter, createRedisUserRateLimiter, productionGeneralRateLimiter, productionAuthRateLimiter, createProductionEndpointRateLimiter. `src/middleware/productionRateLimit.ts`: productionRateLimit (Redis or in-memory). `src/middleware/rateLimit.ts`: rateLimit, authRateLimit, apiRateLimit, readRateLimit, expensiveRateLimit. `src/index.ts`: if Redis and USE_REDIS_RATE_LIMITING then productionGeneralRateLimiter else generalRateLimiter; authRouter uses productionAuthRateLimiter (from rateLimitRedis). Routes: auth (login, register) get auth limiter; rest of app gets general or endpoint limits depending on mount. Endpoint limits in security.ts: login 200/15min, register 50/hour, payments 10/min, job creation 20/min, transitions 30/min, admin 100/min, Stripe webhook 200/min, n8n 50/min, read endpoints 30–60/min.

**Simple (like for a 10-year-old):** The code lives in security.ts (in-memory limiters and endpoint config), rateLimitRedis.ts (Redis limiters and production limiters), and the rateLimit and productionRateLimit middleware. The main app uses the "general" limiter for most routes and the "auth" limiter for login/register. We also have per-endpoint limits (login, register, payments, jobs, admin, webhooks) so we can be stricter on sensitive or expensive endpoints.

### 3. When we use it

**Technical:** We use it on every HTTP request that passes through the middleware stack: general limiter runs first (or production general), then route-specific (e.g. auth limiter on /auth/*). Endpoint-specific limits run when endpointRateLimiter is applied and the request path/method matches a pattern. Trigger: incoming request; we look up the bucket (by IP or user id), increment (or add to Redis set), check against max, and either next() or 429. No cron for rate limit logic; only cleanup (in-memory bucket purge every 5 min; Redis TTL on keys).

**Simple (like for a 10-year-old):** We use it on every request: we count the request, check if they're over the limit, and either let them through or return "too many requests." The "when" is always "when a request comes in." We don't run rate limiting on a schedule—we just check each request.

### 4. How it is used

**Technical:** **In-memory (security.ts):** key = keyGenerator(req) (default getClientIp); bucket = buckets.get(key) or create { count: 1, firstRequestAt: now }; if elapsed > windowMs reset bucket; else bucket.count++; set X-RateLimit-Limit, Remaining, Reset; if bucket.count > max then 429 + Retry-After and return; else next(). **Redis (rateLimitRedis.ts):** key = rate_limit:{keyGenerator(req)}; zRemRangeByScore(key, 0, windowStart); count = zCard(key); if count >= max then 429; else zAdd(key, now, requestId), expire(key, windowMs/1000+60); if skipSuccessfulRequests then on res.finish (status < 400) zRem(key, requestId). **Production (index.ts):** app.use(productionGeneralRateLimiter or generalRateLimiter); authRouter may use productionAuthRateLimiter. **Endpoint (security.ts):** endpointRateLimiter() finds matching config by path/method, uses per-pattern buckets (patternKey:clientKey), same increment/check/429 logic. **Headers:** X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset; 429 body { error: { code: "RATE_LIMIT_EXCEEDED" or "RATE_LIMITED", message, retryAfter } }.

**Simple (like for a 10-year-old):** For each request we figure out who they are (IP or user id), look up their count in the window, add one, and check if they're over the limit. If yes we return 429 and "try again in X seconds" and set headers that say what the limit is and when it resets. If no we let them through. With Redis we store the timestamps of each request in a set and count how many are in the window; with in-memory we keep a count and the start of the window. We can also "don't count successful requests" for some limiters (so only failures count).

### 5. How we use it (practical)

**Technical:** In production: set USE_REDIS_RATE_LIMITING if you want Redis-backed limiting (requires Redis); otherwise in-memory is used. General: 300 req/15 min per IP (or user if keyGenerator uses req.user). Auth: 200/15 min on auth routes. Password reset: 5/hour (security.ts passwordResetRateLimiter). Endpoint limits: apply endpointRateLimiter(limits) with endpointRateLimits or custom list. Logs: rate_limited, endpoint_rate_limited, rate_limit_exceeded_redis, rate_limit_using_memory, rate_limit_redis_error (fallback to in-memory). To tune: change windowMs and max in createRateLimiter or productionGeneralRateLimiter options; or edit endpointRateLimits. Redis fallback: if Redis fails we fall back to in-memory (rateLimitRedis) or allow request (productionRateLimit: "fail open").

**Simple (like for a 10-year-old):** In practice we turn on Redis rate limiting with an env var if we have Redis; otherwise we use in-memory. We set limits in code (300 per 15 min general, 200 for auth, 5 per hour for password reset, and per-endpoint). We log when someone is rate limited. To change limits we edit the numbers in code (or config). If Redis breaks we either use in-memory or let the request through depending on which limiter we use.

### 6. Why we use it vs other methods

**Technical:** Without rate limiting: one client or bot can send huge volume (DoS), brute-force login, or exhaust expensive endpoints (payments, job creation). With per-IP limits we cap abuse per client; with Redis we cap across all servers (shared state). In-memory is simple and has no dependency but doesn't work across multiple app instances (each instance has its own count). Redis gives global limits and sliding window; cost is Redis dependency and latency. Endpoint-specific limits let us be stricter on auth and payments and looser on reads. Alternatives: no limiting (risky); only cloud/edge rate limit (we still want app-level for consistency); token bucket (we use fixed/sliding window). We chose: window-based, IP or user key, Redis when available, endpoint-specific config for sensitive routes.

**Simple (like for a 10-year-old):** We use it so one person or a bot can't send thousands of requests and break the app or try to guess passwords. With Redis we count across all servers so the limit is global; with in-memory we only count per server. We use different limits for different pages: strict for login and password reset and payments, looser for just reading. Doing it only at the edge (e.g. cloud) would be one option but we do it in the app too so we control the limits and messages.

### 7. Best practices

**Technical:** Use getClientIp (or x-forwarded-for) so behind-proxy IPs are correct. Set X-RateLimit-* and Retry-After so clients can back off. Log rate_limited with key, path, method, count, max for debugging. Auth and password-reset limits should be strict (e.g. 5/hour for reset). Redis: set TTL on keys to avoid unbounded growth; use sliding window (zRemRangeByScore + zCard) for fairness. Fail open vs fail closed: rateLimitRedis falls back to in-memory on Redis error; productionRateLimit allows request on error (fail open)—tune for your risk. Endpoint limits: order matters (first match wins); put specific patterns before generic. Gaps: multiple app instances with in-memory each get separate buckets (user could get 300*N requests); no per-user limit on general route unless we use user id in keyGenerator.

**Simple (like for a 10-year-old):** We use the real client IP (especially when behind a proxy). We send headers so the client knows the limit and when to retry. We log when we rate limit someone. We keep login and password reset strict. With Redis we set expiry on keys so they don't grow forever. When Redis fails we either use in-memory or let the request through—we chose "allow" so the site doesn't go down. What we could do better: with many servers and in-memory, each server has its own count so one person could get 300 requests per server; and we don't limit by "logged-in user" on the general API unless we add that.

### 8. Other relevant info

**Technical:** productionAuthRateLimiter is used in auth routes (from rateLimitRedis); auth router imports it. passwordResetRateLimiter (security.ts) may be applied to password-reset endpoint separately. Stripe webhook has high limit (100–200/min) because Stripe can burst. Admin limit is relaxed (100/min) for trusted users. rateLimit.ts middleware (authRateLimit, apiRateLimit, etc.) may be used in some route stacks; check which routes use which limiter. Document limit changes in DECISIONS.md. See FOUNDER_AUTH for auth flow; rate limiting is a separate layer before or after auth.

**Simple (like for a 10-year-old):** The auth routes use the auth-specific limiter. Password reset might have its own very strict limiter. Stripe webhooks get a high limit because Stripe sends many at once. Admin gets a higher limit because we trust them. We might have several different limiters in different parts of the app—check which route uses which. If we change limits we should write it down. Rate limiting is separate from login (auth)—we limit first, then check login.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Prevent abuse: cap requests per client (IP or user) so one bad actor or buggy client can't DoS or overload the app. Prevent brute force: strict limits on login and password reset reduce guessing attempts. Protect expensive endpoints: lower limits on payments and job creation so we don't exhaust resources. Give clients a clear response: 429 with Retry-After and X-RateLimit-* so they can back off and retry. Success means: abusive or mistaken high volume gets 429; normal users stay under limits; clients can respect Retry-After and limits.

**Simple (like for a 10-year-old):** It's supposed to stop anyone from sending too many requests (abuse or accidents) and to make it hard to guess passwords by trying a lot. It's also supposed to protect the heavy stuff (payments, creating jobs) by allowing fewer requests per minute. Success is: bad or crazy traffic gets "too many requests," normal people don't hit the limit, and the app tells them when they can try again.

### 10. What does "done" or "success" look like for it?

**Technical:** Done per request: either next() (under limit) or 429 with headers and body. Observable: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on response; 429 body { error: { code, message, retryAfter } }; logs rate_limited, rate_limit_exceeded_redis. Success: request was allowed or correctly rejected with 429 and useful headers; bucket or Redis key was updated; no crash or wrong count.

**Simple (like for a 10-year-old):** Success is either we let them through or we said "too many requests" with a clear message and "try again in X seconds." We can see success in the response headers (limit, remaining, reset) and in the logs when we rate limit someone.

### 11. What would happen if we didn't have it?

**Technical:** One client or bot could send unlimited requests—could exhaust DB connections, CPU, or external APIs (Stripe, SendGrid); could brute-force login or password reset; could create huge volume of jobs or payments by mistake or malice. Multi-tenant or public API would be especially at risk. We'd need to rely only on edge/cloud rate limiting or manual blocking.

**Simple (like for a 10-year-old):** Without it one person or a script could send as many requests as they want and slow down or break the app for everyone, or try to guess passwords forever, or create tons of jobs or payments by mistake. We'd have to depend on something else (like the cloud provider) to block them.

### 12. What is it not responsible for?

**Technical:** Rate limiting is not authentication (who you are) or authorization (what you're allowed to do)—it only caps how many requests. It doesn't validate request body or prevent invalid payloads; that's validation middleware. It doesn't block IPs or countries (that would be firewall or WAF). It doesn't throttle internal or background jobs (only HTTP request middleware). It doesn't decide business rules (e.g. "max 5 jobs per user per day")—that's application logic. Redis rate limiter doesn't manage Redis connection pool; it uses getRedisClient from redis.ts.

**Simple (like for a 10-year-old):** It doesn't check who you are or what you're allowed to do—only how many requests you've sent. It doesn't check if the request is valid (that's something else). It doesn't block whole countries or IPs (that's firewall stuff). It only applies to HTTP requests, not to our own background jobs. It doesn't enforce things like "max 5 jobs per user per day"—that's business logic elsewhere.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Per request: req (path, method, headers for IP, optional req.user for user-based key). Config: windowMs, max, keyGenerator (default getClientIp), message, skipSuccessfulRequests (Redis), skip (optional). For Redis: getRedisClient(), isRedisAvailable(); env USE_REDIS_RATE_LIMITING. Endpoint limits: list of { pattern, method?, windowMs, max, message }. No DB; only in-memory Map or Redis.

**Simple (like for a 10-year-old):** We need the request (so we know path, method, and who they are—IP or user). We need the limit settings: window (e.g. 15 min), max (e.g. 300), and the message to show. For Redis we need Redis to be up and the env var set. We don't need the database for rate limit state—only memory or Redis.

### 14. What does it produce or change?

**Technical:** Response: either next() or res.status(429).json({ error: { code, message, retryAfter } }) and res.setHeader(X-RateLimit-Limit, Remaining, Reset; Retry-After). State: in-memory bucket count and firstRequestAt updated, or Redis sorted set updated (zAdd, zRemRangeByScore, expire). Logs: rate_limited, endpoint_rate_limited, rate_limit_exceeded_redis when limit exceeded. No DB rows; no side effect on business data.

**Simple (like for a 10-year-old):** We either let the request through or we return 429 with a message and headers. We update the count (in memory or in Redis). We log when we rate limit. We don't change any business data (no database writes for rate limit itself).

### 15. Who or what consumes its output?

**Technical:** Consumer: the client (browser, app, script) gets 200 + next() or 429 + body and headers. Downstream middleware and route handlers only run if next() was called. Ops and support consume logs (rate_limited, path, IP) for debugging abuse or tuning. Client code can read X-RateLimit-Remaining and Retry-After to throttle or show "try again in X seconds."

**Simple (like for a 10-year-old):** The person or app making the request gets either "OK" or "too many requests" and the headers that say the limit and when to retry. The rest of our app (the route that does the real work) only runs if we didn't rate limit. Ops can look at the logs to see who was limited. The client app can read the headers and show "try again in 60 seconds."

### 16. What are the main steps or flow it performs?

**Technical:** 1) key = keyGenerator(req). 2) Get or create bucket (in-memory) or Redis key. 3) If in-memory: if elapsed > windowMs reset bucket; else increment count. If Redis: zRemRangeByScore old entries; count = zCard; if count >= max return 429; else zAdd current request, expire key. 4) Set X-RateLimit-* (and Retry-After if 429). 5) If count > max (in-memory) or count >= max (Redis): log, 429, return. 6) Else next(). Optional: on res.finish if status < 400 and skipSuccessfulRequests, remove from Redis (zRem).

**Simple (like for a 10-year-old):** We figure out who they are (key). We get their count in the window (from memory or Redis). We add this request. If they're over the limit we set headers, log, and return 429. If not we set headers and call next(). For some limiters we only count failed requests (so successful ones don't eat the limit).

### 17. What rules or policies does it enforce?

**Technical:** Hard cap: count <= max in window (or 429). Window: fixed (in-memory) or sliding (Redis). Key: per IP (default) or per user (createRedisUserRateLimiter). Endpoint-specific: first matching pattern in endpointRateLimits wins; method optional. No soft limit or "warning" header only—we either allow or 429. Message and retryAfter are configurable per limiter.

**Simple (like for a 10-year-old):** The only rule is "you get at most X requests in this window." We count by IP (or by user when we use user id). For endpoint limits we match the path and maybe the method and apply that limit. We don't do "warning: you're getting close"—we either allow or say "too many requests."

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Every HTTP request that hits the middleware stack where the rate limiter is mounted. No cron or event—purely request-driven. Order: typically general limiter first, then auth or route-specific limiters where applied.

**Simple (like for a 10-year-old):** It runs on every request that goes through the part of the app where we put the limiter. Nothing triggers it on a schedule—only when someone sends a request.

### 19. What could go wrong while doing its job?

**Technical:** Redis down: we fall back to in-memory (rateLimitRedis) or fail open (productionRateLimit)—so either we lose global consistency or we stop limiting. In-memory: multiple instances each have their own buckets so one client could get N * max requests (N = number of servers). Key collision: if keyGenerator is weak (e.g. only IP) many users behind NAT could share one bucket and get limited unfairly. Clock skew: Redis TTL and window use server time; if skewed, window might be wrong. Memory: in-memory buckets grow with unique keys; cleanup runs every 5 min but high cardinality could use a lot of memory. Logging: logging every 429 with full key might be noisy or leak IPs in logs.

**Simple (like for a 10-year-old):** If Redis is down we might use in-memory (so each server has its own count) or we might let everyone through. With many servers and in-memory, one person could get 300 requests per server. If we only use IP, a whole office might share one limit. If our clock is wrong the "window" might be wrong. If we have tons of different IPs we might use a lot of memory. We might log too much when we rate limit.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** Logs: rate_limited, endpoint_rate_limited, rate_limit_exceeded_redis with key, path, count, max. Response headers: X-RateLimit-Limit, Remaining, Reset on every response when limiter runs. 429 responses with retryAfter. Manual test: send more than max requests in window, expect 429. No built-in metrics (e.g. rate_limit_hits_per_minute); could add.

**Simple (like for a 10-year-old):** We look at the logs when someone is rate limited and at the response headers (limit, remaining, reset). We can test by sending a bunch of requests and checking we get 429 after the limit. We don't have a dashboard of "how many rate limits this hour" yet.

### 21. What does it depend on to do its job?

**Technical:** Express req/res/next. Logger. For Redis path: getRedisClient, isRedisAvailable from redis.ts; Redis server. getClientIp uses req.ip, req.socket.remoteAddress, x-forwarded-for. No DB. Optional: req.user for user-based key (auth must run before limiter if we use user id).

**Simple (like for a 10-year-old):** It needs the request and response and the logger. For Redis it needs Redis to be running and the client from our redis module. It gets the IP from the request (or from the proxy header). It doesn't need the database. If we limit by user we need to know who's logged in (so auth middleware before the limiter).

### 22. What are the main config or env vars that control its behavior?

**Technical:** USE_REDIS_RATE_LIMITING: if set and Redis available, use Redis for productionGeneralRateLimiter and productionAuthRateLimiter. Limits themselves are in code: general 300/15min, auth 200/15min, passwordReset 5/hour, stripeWebhook 100–200/min, endpointRateLimits array. No env for window or max per limiter unless we add them.

**Simple (like for a 10-year-old):** We have one env var: use Redis for rate limiting or not. The actual numbers (300, 200, 5, etc.) are in code. We could add env vars for those later.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests: src/tests/unit/security.test.ts (rate limit middleware); src/middleware/__tests__/rateLimit.test.ts. Integration: send N requests in window, assert 429 on N+1; assert headers. Redis: with Redis up, use production limiter and assert shared limit across requests. Manual: curl or script to exceed limit, check 429 and Retry-After.

**Simple (like for a 10-year-old):** We have tests that send requests and check we get 429 when over the limit and that headers are set. We can also test by hand: send 301 requests in 15 minutes and see the 301st get "too many requests."

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If Redis fails: we already fall back to in-memory or fail open; no extra recovery. If limits are too strict (legitimate users hit 429): increase max or window in code and deploy; or add whitelist (skip(req) for certain IPs/users). If limits are too loose (abuse): decrease max or add endpoint-specific limits. If bucket memory grows: ensure cleanup interval runs; or use Redis so state is external. No automatic recovery; tune and redeploy.

**Simple (like for a 10-year-old):** If Redis is down we're already doing something (fallback or allow). If real users are getting "too many requests" we raise the limit and deploy. If bad guys are getting through we lower the limit or add stricter limits on certain endpoints. We don't have an automatic "fix"—we change the config and deploy.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders?

**Technical:** Users: want to not be blocked when using the app normally; want clear message when limited. Ops: want to prevent abuse and tune limits without breaking legitimate traffic. Product: want login and payment endpoints protected. Security: want brute-force and DoS mitigation.

**Simple (like for a 10-year-old):** Users want to use the app without hitting "too many requests." Ops want to stop abuse and set limits that don't hurt real users. Product and security want login and payments to be hard to abuse.

### 26. What are the security or privacy considerations?

**Technical:** Rate limiting helps security (brute force, DoS). Key (IP or user id) is PII-adjacent; don't log full key in public logs if policy forbids; log path and count is usually enough. 429 response shouldn't leak internal info (message is generic). Retry-After is safe. X-Forwarded-For can be spoofed; use it only when behind a trusted proxy and consider rate limit by user id for sensitive endpoints after auth.

**Simple (like for a 10-year-old):** Rate limiting is part of security (stops guessing passwords and overload). We might not want to log every IP we limit (privacy). The message we show should be generic. If we're behind a proxy we trust the IP they send; otherwise someone could fake it, so for really sensitive stuff we might limit by user id after they're logged in.

### 27. What are the limits or scaling considerations?

**Technical:** In-memory: memory grows with unique keys (IPs or users); cleanup limits growth but high cardinality = more memory. Redis: throughput (each request does zRemRangeByScore, zCard, zAdd, expire); use connection pool; sliding window is a bit more work than fixed window. Multiple instances: in-memory = per-instance limit (N * max); Redis = global limit. Very high RPS: rate limiter runs on every request so latency adds up; consider moving to edge or dedicated rate-limit service for huge scale.

**Simple (like for a 10-year-old):** With in-memory, more unique IPs means more memory; we clean up old ones. With Redis, every request does a few Redis ops so Redis has to keep up. With many servers, in-memory means each server has its own limit; Redis means one limit for everyone. If we get millions of requests per second we might need to rate limit at the edge instead of in the app.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** Make window and max configurable per limiter (env or config service). Add per-user rate limit on general API after auth (keyGenerator = user id when logged in). Add metrics (rate_limit_hits_total, rate_limit_remaining_avg) to Sentry or metrics backend. Add whitelist (skip for certain IPs or user ids). Use Redis consistently in production and document fail-open vs fail-closed. Add endpointRateLimiter to app so all routes get per-endpoint limits. Document which routes use which limiter in one place.

**Simple (like for a 10-year-old):** We'd make the limits configurable without changing code. We'd limit by user (not just IP) on the main API when they're logged in. We'd add numbers like "how many 429s this hour." We'd allow a list of IPs or users to skip limits. We'd use Redis everywhere in production and write down what we do when Redis fails. We'd apply the per-endpoint limits to the whole app and write down which route has which limit.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** No long-lived lifecycle—runs per request. Middleware is registered at app startup (app.use(limiter)). In-memory buckets are created on first request per key and cleaned up periodically. Redis keys are created on first request per key and expire after window + buffer. Each request: start → get key → get/update count → allow or 429 → done.

**Simple (like for a 10-year-old):** It doesn't "start" or "finish" as a service—it runs on every request. We register the limiter when the app starts. The "buckets" (counts per IP) are created when we see that IP and cleaned up when they're old. Each request is "check limit, allow or 429, done."

### 30. What state does it keep or track?

**Technical:** In-memory: Map<string, { count, firstRequestAt }>; cleaned every 5 min (delete keys older than 1 hour). Redis: keys rate_limit:{identifier}, value sorted set (timestamp → requestId); TTL per key (window + 60s). No DB tables. State is only "how many requests in the window per key."

**Simple (like for a 10-year-old):** We keep a count per "key" (IP or user): how many requests and when the window started (or in Redis, the list of request timestamps). We don't store this in the database—only in memory or Redis. We delete old entries so we don't grow forever.

### 31. What assumptions does it make to do its job?

**Technical:** Assumes keyGenerator(req) is stable for the same client (same IP or same user). Assumes window and max are sensible (e.g. 15 min, 300). Assumes we're behind a trusted proxy if we use x-forwarded-for for IP. For Redis: assumes Redis is available and getRedisClient() returns a client; assumes clock is roughly correct for TTL. Assumes middleware order (limiter before routes that do work). Assumes no massive clock skew between app and Redis.

**Simple (like for a 10-year-old):** We assume the same person gets the same "key" (IP or user id) so we count them correctly. We assume the limits we picked make sense. We assume the IP we get is real if we're behind a trusted proxy. For Redis we assume it's up and the clock is okay. We assume the rate limiter runs before the code that does the real work.

### 32. When should we not use it (or use something else)?

**Technical:** Don't rate limit health check or readiness (or use very high limit) so load balancers don't mark us down. Don't rate limit internal service-to-service calls if they're trusted (or use separate limit). For Stripe webhook we use high limit (100–200/min) because Stripe may burst; don't use general 300/15min for webhooks. Use endpoint-specific limits for auth and payments rather than only general. If you need "max 5 jobs per user per day" that's business logic in the app, not rate limit middleware.

**Simple (like for a 10-year-old):** We shouldn't rate limit the "are you alive?" check too hard or the load balancer might think we're down. We might not rate limit our own internal calls. For Stripe webhooks we use a high limit because Stripe sends many at once. We use special limits for login and payments. Things like "max 5 jobs per user per day" are done in the app, not in the rate limiter.

### 33. How does it interact with other systems or features?

**Technical:** Runs as Express middleware; order with auth: if we limit by user we need auth before limiter (so req.user set). Redis: rateLimitRedis uses redis.ts client. Logger: all rate limit logs. No interaction with DB, queue, or Stripe except that rate limiting protects the routes that call them. Auth routes import productionAuthRateLimiter from rateLimitRedis and use it on login/register.

**Simple (like for a 10-year-old):** It's a middleware in the request pipeline. If we limit by user we need to know who's logged in first (auth before limiter). It uses Redis when we want shared limits. It logs. It doesn't talk to the database or the queue—it just blocks or allows the request before it gets to the code that does.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** "Failure" for the limiter could mean: (1) we incorrectly allowed over limit (bug)—no explicit signal; (2) we incorrectly blocked under limit (bug)—client gets 429 when they shouldn't; (3) Redis down and we fall back or fail open—we log rate_limit_redis_error or rate_limit_using_memory. We signal "rate limited" to client with 429 + body and headers. We don't throw; we call res.status(429).json() and return (don't call next()).

**Simple (like for a 10-year-old):** Failure could mean we let someone through when they should have been limited (bug) or we limited someone who shouldn't have been (bug). When Redis is down we log and either use in-memory or allow. We tell the client they're rate limited by returning 429 and a message and headers; we don't throw an exception.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correct: count in window matches our logic (in-memory: count and firstRequestAt; Redis: zCard after zRemRangeByScore). We can verify by sending exactly max requests and checking the next one is 429; and by waiting for window to pass and checking we're allowed again. Headers: Remaining should be max - count (or 0 when limited). Tests assert 429 and headers. No formal proof; manual and automated tests.

**Simple (like for a 10-year-old):** We check that after exactly 300 requests (for example) the next one gets 429, and that after the window resets we're allowed again. We check the "remaining" header matches what we expect. Tests do this automatically.

### 36. Who owns or maintains it?

**Technical:** Code: security.ts, rateLimitRedis.ts, productionRateLimit.ts, rateLimit.ts. No explicit OWNER; typically platform or security owns rate limiting. Tuning limits and adding endpoint config is ongoing; document changes in DECISIONS.md.

**Simple (like for a 10-year-old):** The team that owns "platform" or "security" usually owns this. The code is in the security and rate limit files. When we change limits or add new endpoint limits we should write it down.

### 37. How might it need to change as the product or business grows?

**Technical:** Add per-user limits on more routes (keyGenerator = user id after auth). Move to Redis-only in production and document fail behavior. Add metrics and dashboards (429 rate, top limited IPs). Make limits configurable (env or config service). Add whitelist/allowlist for partners or internal IPs. Consider edge rate limiting (CDN/cloud) for very high RPS and DDoS. Add rate limit for GraphQL or WebSocket if we add them. Document all limiters and endpoints in one doc.

**Simple (like for a 10-year-old):** We might limit by user on more pages. We might use only Redis in production and write down what happens when Redis fails. We might add dashboards for "how many 429s" and "who's getting limited." We might make limits configurable. We might allow certain IPs or partners to skip limits. For huge traffic we might rate limit at the edge (cloud). If we add new kinds of APIs (GraphQL, WebSockets) we'd add limiters for them. We'd write down every limit and where it applies.

---

*End of Founder Reference: Rate Limiting*
