# Error Recovery & Circuit Breakers

**Date:** 2026-01-29  
**Status:** ✅ Complete

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

## Overview

**What it is:** The high-level summary of our error recovery and circuit breaker setup for external APIs.  
**What it does:** Describes retries, circuit breakers, and where they're used so we don't cascade when a partner is down.  
**How we use it:** Read this first; then use Implementation and Configuration when debugging or adding a new integration.

Implemented comprehensive error recovery and circuit breaker patterns for all external API integrations (Stripe, SendGrid, Twilio, N8N). This prevents cascading failures and improves system resilience.

**What this doc is for:** Reference for how error recovery and circuit breakers work in this codebase. It explains (1) the circuit breaker pattern (closed/open/half-open) and where it's used, (2) retry logic with exponential backoff, and (3) how each integration (Stripe, SendGrid, Twilio, N8N) is wrapped. Use it when debugging external API failures or when adding a new integration.

**Why it matters:** When Stripe or SendGrid is down, the app retries with backoff and then "opens" the circuit so it stops hammering the service. Without this, one outage can cascade and slow or crash the app.

**In plain English:** *Retry with backoff* = if a call fails, we wait a bit and try again (e.g. 1s, then 2s, then 4s) instead of failing immediately. *Circuit breaker* = after too many failures, we stop calling that service for a short time (e.g. 1 minute), then try one request again; if it works, we resume. That way one broken partner (e.g. Stripe down) doesn't make our whole app hang or crash.

---

## Implementation

**What it is:** The concrete pieces we use: circuit breaker, retry logic, and per-integration wiring.  
**What it does:** Wraps Stripe, SendGrid, Twilio, N8N with retries and circuit breakers so failures don't cascade.  
**How we use it:** Reference when debugging external API failures or when adding a new integration; config lives in the listed files.

### 1. Circuit Breaker Pattern

**What it is:** A state machine (closed/open/half-open) that stops calling a service after too many failures.  
**What it does:** Fails fast when a partner is down and tests recovery after a timeout so we don't hammer a broken service.  
**How we use it:** Each external service (Stripe, SendGrid, etc.) has its own circuit in `src/lib/circuitBreaker.ts`; we don't call the service directly, we call through the breaker.

**File**: `src/lib/circuitBreaker.ts`

**Features**:
- Three states: `closed` (normal), `open` (failing), `half-open` (testing recovery)
- Configurable failure threshold (default: 5 failures)
- Automatic recovery after timeout (default: 60 seconds)
- Per-service circuit breakers (Stripe, SendGrid, Twilio, N8N)

**How It Works**:
1. **CLOSED**: Normal operation, requests pass through
2. **OPEN**: After `failureThreshold` failures, circuit opens and requests fail immediately
3. **HALF-OPEN**: After `resetTimeout`, circuit allows one test request
4. If test succeeds → back to CLOSED
5. If test fails → back to OPEN

**Configuration**:
```typescript
{
  name: "stripe",
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 60000,     // Wait 1 minute before testing
  timeoutWindow: 60000,     // Track failures in 1-minute window
}
```

### 2. Retry Logic with Exponential Backoff

**What it is:** Logic that retries failed calls with increasing delays (1s, 2s, 4s) and jitter.  
**What it does:** Handles transient failures (timeouts, 5xx) without failing immediately; non-retryable errors fail fast.  
**How we use it:** Wraps external API calls in `src/lib/retry.ts`; config per service (max attempts, delays) in the same file.

**File**: `src/lib/retry.ts`

**Features**:
- Exponential backoff with jitter (prevents thundering herd)
- Configurable max attempts, delays, multipliers
- Retryable error detection (network errors, timeouts, 5xx)
- Service-specific configurations

**Default Configuration**:
```typescript
{
  maxAttempts: 3,
  initialDelay: 1000,       // 1 second
  maxDelay: 30000,          // 30 seconds max
  multiplier: 2,            // Double delay each retry
  jitter: true,             // Add random variation
}
```

**Retry Delays**:
- Attempt 1: ~1 second
- Attempt 2: ~2 seconds
- Attempt 3: ~4 seconds
- (With jitter: ±25% variation)

### 3. Integration Points

**What it is:** The list of external services that use circuit breaker + retry (SendGrid, Twilio, N8N, Stripe).  
**What it does:** Maps each service to its breaker and retry config so we know where to look when one fails.  
**How we use it:** When an integration fails, check the file listed; ensure calls go through the wrapper, not the raw client.

#### SendGrid (Email)
**What it is:** Our email provider; wrapped with circuit breaker and retry.  
**What it does:** Sends transactional email; on failure we retry then open the circuit.  
**How we use it:** All email goes through `src/services/notifications/providers/sendgrid.ts`; no direct SendGrid calls elsewhere.
**File**: `src/services/notifications/providers/sendgrid.ts`

- Circuit breaker: `circuitBreakers.sendgrid`
- Retry config: `retryConfigs.sendgrid`
- Retries on: timeouts, network errors, 5xx responses

#### Twilio (SMS)
**What it is:** Our SMS provider; wrapped with circuit breaker and retry.  
**What it does:** Sends SMS; on failure we retry then open the circuit.  
**How we use it:** All SMS goes through `src/services/notifications/providers/twilio.ts`; no direct Twilio calls elsewhere.

**File**: `src/services/notifications/providers/twilio.ts`

- Circuit breaker: `circuitBreakers.twilio`
- Retry config: `retryConfigs.twilio`
- Retries on: timeouts, network errors, 5xx responses

#### N8N (Workflows)
**What it is:** Our workflow/automation service; wrapped with circuit breaker and retry.  
**What it does:** Sends events to n8n; on failure we retry (fewer retries) then open the circuit.  
**How we use it:** All n8n calls go through `src/lib/n8nClient.ts`; no direct HTTP calls to n8n elsewhere.

**File**: `src/lib/n8nClient.ts`

- Circuit breaker: `circuitBreakers.n8n`
- Retry config: `retryConfigs.n8n` (fewer retries, less critical)
- Retries on: timeouts, network errors, connection refused

#### Stripe (Payments)
**What it is:** Our payment provider; wrapped with circuit breaker; Stripe SDK already has its own retries.  
**What it does:** Processes payments; circuit opens on repeated failures so we don't hammer Stripe.  
**How we use it:** All Stripe calls go through `src/lib/stripeWrapper.ts`; the wrapper adds circuit protection on top of SDK retries.

**File**: `src/lib/stripeWrapper.ts`

- Circuit breaker: `circuitBreakers.stripe`
- Retry config: `retryConfigs.stripe` (fewer retries, SDK already retries)
- Note: Stripe SDK has `maxNetworkRetries: 3` built-in
- Wrapper provides additional circuit breaker protection

---

## Benefits

**What it is:** The outcomes of using circuit breakers and retries (no cascade, auto recovery, better UX, observability).  
**What it does:** Summarizes why we invested in this pattern.  
**How we use it:** Reference when justifying or explaining the setup to the team or in runbooks.

### 1. Prevents Cascading Failures
**What it is:** The idea that one failing service shouldn't take down or slow the whole app.  
**What it does:** Circuit opens so we stop calling the failing service and fail fast instead of timing out.  
**How we use it:** Rely on it; when Stripe or SendGrid is down, our app stays responsive and we return clear errors.
- When external service is down, circuit opens quickly
- Prevents overwhelming failing service with requests
- Fails fast instead of timing out

### 2. Automatic Recovery
**What it is:** The circuit testing recovery after a timeout (half-open, one request).  
**What it does:** Resumes calling the service when it's back without manual intervention.  
**How we use it:** No action needed; after `resetTimeout` the circuit tries one request and closes if it succeeds.

- Circuit automatically tests recovery after timeout
- No manual intervention needed
- Gracefully resumes when service recovers

### 3. Improved User Experience
**What it is:** Users get fast, clear errors instead of long timeouts when a partner is down.  
**What it does:** Reduces perceived latency and confusion when Stripe or email is unavailable.  
**How we use it:** Return user-friendly messages when the circuit is open; don't expose internal details.

- Faster failure detection (circuit opens quickly)
- Clear error messages (circuit breaker errors)
- System remains responsive even when external services fail

### 4. Better Observability
**What it is:** Logs and stats for circuit state (open/closed/half-open) and failure counts.  
**What it does:** Lets us see when circuits opened and when they recovered.  
**How we use it:** Call `getStats()` per breaker; log state changes; optionally add metrics to Sentry/Datadog.

- Circuit state changes are logged
- Stats available via `getStats()` method
- Can monitor circuit health in dashboards

---

## Monitoring

**What it is:** How we observe circuit breakers (stats, logs, metrics).  
**What it does:** Gives visibility into when circuits open and recover so we can debug and alert.  
**How we use it:** Use `getStats()` in code or dashboards; rely on logged state changes; optionally add metrics.

### Circuit Breaker Stats
**What it is:** Per-breaker counts (state, failures, successes, last failure/success time).  
**What it does:** Lets us see current state and history of each circuit.  
**How we use it:** Call `circuitBreakers.<service>.getStats()`; expose in admin or health endpoint if needed.

```typescript
import { circuitBreakers } from "./lib/circuitBreaker";

const stats = circuitBreakers.stripe.getStats();
console.log(stats);
// {
//   state: "closed" | "open" | "half-open",
//   failures: 0,
//   successes: 100,
//   lastFailureTime: null,
//   lastSuccessTime: 1234567890,
//   openedAt: null,
// }
```

### Logging
**What it is:** Automatic log lines when a circuit opens, goes half-open, or closes.  
**What it does:** Creates an audit trail so we know when and why circuits tripped.  
**How we use it:** Search logs for `circuit_breaker_opened`, `circuit_breaker_closed`, etc. during incidents.

Circuit breaker state changes are automatically logged:
- `circuit_breaker_opened` - Circuit opened due to failures
- `circuit_breaker_half_open` - Testing recovery
- `circuit_breaker_closed` - Circuit closed, service recovered
- `circuit_breaker_reset` - Manual reset

### Metrics
**What it is:** Optional counters for circuit state changes, failure rates, recovery times.  
**What it does:** Enables dashboards and alerts (e.g. "Stripe circuit opened").  
**How we use it:** Add to `src/lib/metrics.ts` or your metrics system; alert when a circuit opens for critical services.

Consider adding metrics for:
- Circuit breaker state transitions
- Failure rates per service
- Recovery times
- Request counts (total, failed, succeeded)

---

## Configuration

**What it is:** How to tune circuit breaker and retry behavior (thresholds, delays).  
**What it does:** Lets us match behavior to service criticality (e.g. Stripe vs N8N).  
**How we use it:** Edit config in `src/lib/circuitBreaker.ts` and `src/lib/retry.ts`; deploy and monitor.

### Adjusting Thresholds
**What it is:** Failure count and reset timeout per service.  
**What it does:** Controls when the circuit opens and when we try again.  
**How we use it:** Critical services (Stripe, SendGrid): higher threshold, longer reset; less critical (N8N): shorter reset.

**For Critical Services** (Stripe, SendGrid):
```typescript
failureThreshold: 5,      // Open after 5 failures
resetTimeout: 60000,     // 1 minute recovery test
```

**For Less Critical Services** (N8N):
```typescript
failureThreshold: 5,
resetTimeout: 30000,     // 30 seconds (faster recovery test)
```

### Adjusting Retry Logic
**What it is:** Max attempts, initial delay, max delay, multiplier per service.  
**What it does:** Controls how many retries and how long we wait between them.  
**How we use it:** High-latency services: longer delays; low-latency: fewer retries, shorter delays.

**For High-Latency Services**:
```typescript
{
  maxAttempts: 3,
  initialDelay: 2000,     // Start with 2 seconds
  maxDelay: 15000,       // Max 15 seconds
  multiplier: 2,
}
```

**For Low-Latency Services**:
```typescript
{
  maxAttempts: 2,        // Fewer retries
  initialDelay: 500,     // Start with 500ms
  maxDelay: 5000,        // Max 5 seconds
  multiplier: 2,
}
```

---

## Testing

**What it is:** How to verify circuit breakers and retries (manual and integration).  
**What it does:** Ensures we don't ship broken or misconfigured breakers.  
**How we use it:** Manually break a service and confirm circuit opens and recovers; add integration tests for state transitions.

### Manual Testing
**What it is:** Steps to test circuit open, recovery, and retry by hand.  
**What it does:** Validates behavior without writing tests.  
**How we use it:** Temporarily break an integration (wrong key, mock down), trigger failures, wait for reset, confirm recovery.

1. **Test Circuit Opening**:
   - Temporarily break external service (wrong API key, network down)
   - Make 5+ requests
   - Verify circuit opens and subsequent requests fail fast

2. **Test Recovery**:
   - Wait for `resetTimeout` (60 seconds)
   - Make a request
   - Verify circuit transitions to half-open, then closed if successful

3. **Test Retry Logic**:
   - Simulate transient failures (timeout, 503)
   - Verify retries with exponential backoff
   - Verify non-retryable errors fail immediately

### Integration Tests
**What it is:** Automated tests for circuit state transitions and retry behavior.  
**What it does:** Prevents regressions when we change breaker or retry code.  
**How we use it:** Add tests in `src/tests/` that simulate failures and assert state changes and retry counts.

Consider adding tests for:
- Circuit breaker state transitions
- Retry logic with different error types
- Recovery scenarios
- Concurrent request handling

---

## Best Practices

**What it is:** Do's and don'ts for circuit breakers and retries.  
**What it does:** Keeps usage consistent and safe (external only, tuned config, monitored, user-friendly errors).  
**How we use it:** Apply when adding or changing integrations; review during code review.

### 1. Use Circuit Breakers for External APIs
**What it is:** Rule: wrap external APIs, not internal DB calls.  
**What it does:** Ensures we only protect against partner outages, not our own DB.  
**How we use it:** Every Stripe/SendGrid/Twilio/N8N call goes through a breaker; DB calls do not.
✅ **Do**: Wrap all external API calls with circuit breakers  
❌ **Don't**: Use circuit breakers for internal database calls

### 2. Configure Appropriately
**What it is:** Tune thresholds and retries per service criticality.  
**What it does:** Avoids one-size-fits-all that is too loose or too aggressive.  
**How we use it:** Stripe/SendGrid: conservative; N8N: faster recovery.

✅ **Do**: Adjust thresholds based on service criticality  
❌ **Don't**: Use same config for all services

### 3. Monitor Circuit Health
**What it is:** Log and metric circuit state so we notice when circuits open.  
**What it does:** Ensures we don't ignore outages in partners.  
**How we use it:** Rely on logs; add metrics and alerts for circuit open events.
✅ **Do**: Log state changes and track metrics  
❌ **Don't**: Ignore circuit breaker alerts

### 4. Handle Circuit Open Errors
**What it is:** When the circuit is open, return a clear message to the user, not internal details.  
**What it does:** Keeps UX acceptable and avoids leaking implementation.  
**How we use it:** In route handlers, catch circuit-open errors and return e.g. "Service temporarily unavailable; try again shortly."

✅ **Do**: Return user-friendly error messages  
❌ **Don't**: Expose internal circuit breaker details

### 5. Test Recovery Scenarios
**What it is:** Verify that circuits open and close as expected.  
**What it does:** Prevents shipping breakers that never open or never recover.  
**How we use it:** Run manual tests and integration tests before and after config changes.
✅ **Do**: Test circuit opening and recovery  
❌ **Don't**: Assume circuit breakers always work

---

## Related Files

**What it is:** The list of code files that implement circuit breakers and retries.  
**What it does:** Points to where to read or change behavior.  
**How we use it:** When debugging or adding an integration, open these files; keep the list updated when we add new wrappers.

- `src/lib/circuitBreaker.ts` - Circuit breaker implementation
- `src/lib/retry.ts` - Retry logic with exponential backoff
- `src/lib/stripeWrapper.ts` - Stripe operations wrapper
- `src/services/notifications/providers/sendgrid.ts` - SendGrid integration
- `src/services/notifications/providers/twilio.ts` - Twilio integration
- `src/lib/n8nClient.ts` - N8N integration

---

## Future Enhancements

**What it is:** Possible next steps (metrics, dashboard, dynamic config, health checks, alerting).  
**What it does:** Captures ideas so we don't forget them.  
**How we use it:** Prioritize after production is stable; add metrics and alerting first.

1. **Metrics Integration**: Add circuit breaker metrics to monitoring system
2. **Admin Dashboard**: Show circuit breaker states in admin panel
3. **Dynamic Configuration**: Allow runtime adjustment of thresholds
4. **Health Checks**: Add health check endpoints for circuit breaker status
5. **Alerting**: Alert when circuit opens (Sentry, PagerDuty, etc.)

---

**Last Updated**: 2026-01-29  
**Next Review**: After production deployment
