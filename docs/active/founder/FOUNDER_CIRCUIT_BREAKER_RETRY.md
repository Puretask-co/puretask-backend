# Founder Reference: Circuit Breaker + Retry

**Candidate:** Circuit breaker + retry (System #8)  
**Where it lives:** `src/lib/circuitBreaker.ts`, `src/lib/retry.ts`, `src/lib/stripeWrapper.ts`; circuitBreakers (stripe, sendgrid, twilio, n8n), retryConfigs, executeStripeOperation  
**Why document:** When we stop calling a failing partner (e.g. Stripe) and when we retry; how this protects the app.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The circuit breaker and retry in PureTask are two patterns that protect the app when calling external APIs (Stripe, SendGrid, Twilio, n8n). **Circuit breaker:** After a number of failures in a time window, the circuit "opens"—calls fail immediately without hitting the partner, so we don't pile more load on a failing service or waste time. After a reset timeout it goes "half-open" and allows one test request; if that succeeds the circuit "closes" (normal); if it fails it opens again. Implemented in `CircuitBreaker` (states: closed, open, half-open) with config: failureThreshold, resetTimeout, timeoutWindow, name. Pre-configured breakers: stripe, sendgrid, twilio, n8n (e.g. 5 failures in 1 minute → open, 1 min reset for stripe/sendgrid/twilio, 30 s for n8n). **Retry:** Before giving up, we retry the call a few times with exponential backoff (and optional jitter) so transient network or 5xx errors can succeed. Implemented in `retryWithBackoff` with config: maxAttempts, initialDelay, maxDelay, multiplier, jitter, isRetryable. Presets: stripe (3 attempts, 1–10s), sendgrid/twilio (3 attempts, 2–15s), n8n (2 attempts, 1–5s). **Stripe wrapper:** `executeStripeOperation` runs the operation inside the Stripe circuit breaker and then inside retry (maxAttempts 2); other services can use circuitBreakers.*.execute() and retryWithBackoff with their presets.

**Simple (like for a 10-year-old):** When we call Stripe or the email/SMS service, sometimes they're slow or broken. The **circuit breaker** says: "If we've failed too many times in a short while, stop calling them for a bit and fail fast—don't keep hammering them." After a short wait we try one call; if it works we go back to normal; if it fails we wait again. The **retry** says: "If a call fails once, wait a little and try again (and again, with longer waits) in case it was a blip." For Stripe we wrap every call in both: first retry a couple of times, and the whole thing is protected by the circuit breaker so if Stripe is down we don't keep retrying forever.

### 2. Where it is used

**Technical:** `src/lib/circuitBreaker.ts`: CircuitBreaker class, CircuitBreakerOpenError, circuitBreakers (stripe, sendgrid, twilio, n8n). `src/lib/retry.ts`: retryWithBackoff, retryConfigs (stripe, sendgrid, twilio, n8n). `src/lib/stripeWrapper.ts`: executeStripeOperation (circuitBreakers.stripe.execute → retryWithBackoff with retryConfigs.stripe, maxAttempts 2), stripeOperations (createPaymentIntent, createTransfer, createAccount, createAccountLink, retrievePaymentIntent). Stripe integration code that uses stripeOperations or executeStripeOperation gets circuit breaker + retry; direct `stripe.*` calls do not unless the caller wraps them. SendGrid/Twilio/n8n circuit breakers and retry presets exist but may not be wired in every code path—check notification and n8n client usage. Tests: `src/lib/__tests__/errorRecovery.test.ts`, `src/tests/unit/security.test.ts` (retryWithBackoff).

**Simple (like for a 10-year-old):** The circuit breaker and retry code live in the circuitBreaker and retry files; the Stripe wrapper uses both for every Stripe call it exposes (create payment intent, transfer, account, etc.). So whenever we use the Stripe wrapper we get "retry a couple of times" and "if Stripe is down, stop calling for a minute." The email and SMS and n8n breakers and retry settings exist in code; whether every email/SMS/n8n call goes through them depends on where we call them.

### 3. When we use it

**Technical:** We use the circuit breaker whenever code calls circuitBreakers.*.execute(fn)—e.g. executeStripeOperation does circuitBreakers.stripe.execute(...). We use retry whenever code calls retryWithBackoff(fn, config)—e.g. inside executeStripeOperation. So for Stripe: every stripeOperations.* or executeStripeOperation call is protected (payment intents, transfers, accounts, account links). Triggers: any request or background job that triggers a Stripe call (payment, payout, Connect) or a SendGrid/Twilio/n8n call that goes through the breaker and retry. The circuit opens when failures >= failureThreshold within timeoutWindow; it goes half-open after resetTimeout; retries happen on each failed call up to maxAttempts.

**Simple (like for a 10-year-old):** We use it every time we call Stripe through the wrapper (payments, payouts, Connect). We use it when we call email or SMS or n8n if that code uses the breaker and retry. When Stripe (or the other service) fails a few times in a row we open the circuit and stop calling for a bit; when we do call we retry a couple of times with waits in between.

### 4. How it is used

**Technical:** **Circuit breaker:** execute(fn) checks state: if open, throw CircuitBreakerOpenError unless resetTimeout has passed (then transition to half-open). If closed, optionally reset failure count if outside timeoutWindow. Run fn(); on success call onSuccess (in half-open → close, reset failures); on failure call onFailure (increment failures; if half-open → open again, if closed and failures >= threshold → open). **Retry:** Loop attempt 0..maxAttempts-1; try fn(); on success return; on failure, if !isRetryable(error) throw; if last attempt throw; else calculateDelay(attempt) with exponential backoff ± jitter, wait, continue. isRetryable: custom or default (timeout, network, ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED). **Stripe:** executeStripeOperation(operation, operationName) = circuitBreakers.stripe.execute(() => retryWithBackoff(operation, { ...retryConfigs.stripe, maxAttempts: 2 })); on error rethrow with "Stripe {operationName} failed: {message}."

**Simple (like for a 10-year-old):** For the circuit breaker we run the call; if we've had too many failures we throw "circuit open" and don't call at all. If the call succeeds we clear failures (and in half-open we close the circuit). If it fails we count it and maybe open the circuit. For retry we try the call; if it fails and it's a "retryable" error (like network or timeout) we wait a bit and try again, up to a few times. For Stripe we do retry inside the circuit breaker so we get both: a few retries, and then if Stripe is still down we open the circuit and stop for a minute.

### 5. How we use it (practical)

**Technical:** In day-to-day: use stripeOperations or executeStripeOperation for Stripe calls instead of raw stripe.* so payments and payouts get protection. Env: no dedicated env vars for circuit breaker or retry; thresholds are in code (failureThreshold 5, resetTimeout 60s or 30s, timeoutWindow 60s). To add protection for SendGrid/Twilio/n8n: wrap their calls in circuitBreakers.sendgrid.execute(() => retryWithBackoff(fn, retryConfigs.sendgrid)) (and similarly for twilio, n8n). Logs: circuit_breaker_opened, circuit_breaker_closed, circuit_breaker_half_open, circuit_breaker_reset; retry_attempt, retry_aborted_non_retryable, retry_exhausted. To debug: check getStats() on the breaker; check logs for open/half-open/closed and retry attempts.

**Simple (like for a 10-year-old):** In practice we use the Stripe wrapper for all Stripe calls so they're protected. We don't have config in the environment for "how many failures" or "how long to wait"—that's in code. If we want the same protection for email or SMS we wrap those calls the same way. We log when the circuit opens, closes, or goes half-open and when we retry or give up; we can look at those logs to see what's happening.

### 6. Why we use it vs other methods

**Technical:** Retry alone: transient failures can succeed on retry but if the partner is down we keep retrying and waste time and load. Circuit breaker alone: we fail fast when the partner is down but we don't give transient errors a second chance. Together: we retry a few times (handle blips), then if we still fail repeatedly we open the circuit and stop calling (handle sustained outages). Alternatives: no retry (more user-visible failures); no circuit breaker (hammer a down service, slow timeouts); infinite retry (never give up, bad for availability). We chose: exponential backoff with jitter (avoid thundering herd), small maxAttempts for Stripe (SDK also retries), and circuit breaker with short reset so we probe recovery without waiting too long.

**Simple (like for a 10-year-old):** We use both because sometimes a failure is just a blip (retry helps) and sometimes the other service is really down (circuit breaker stops us from hammering it). If we only retried we'd keep calling a broken service; if we only had a circuit breaker we wouldn't give a flaky call a second chance. So we retry a few times and then if we're still failing we "open the circuit" and stop for a bit, then try again once to see if they're back.

### 7. Best practices

**Technical:** Init Sentry first so errors from circuit breaker and retry are captured. Use executeStripeOperation (or stripeOperations) for all Stripe calls that should be protected. Don't call Sentry.init() again. Log circuit_breaker_opened with name, threshold, resetTimeout so ops can see why. Retry only retryable errors (network, timeout, 5xx); don't retry 4xx or validation errors (isRetryable in retryConfigs). Jitter in retry avoids thundering herd. Reset timeout not too long (1 min) so we probe recovery; not too short or we reopen too often. For testing, circuitBreaker.reset() clears state. Gaps: SendGrid/Twilio/n8n may not be wrapped in every path; stripe.* used directly somewhere bypasses wrapper; no metrics (e.g. circuit_open_count) yet.

**Simple (like for a 10-year-old):** We turn on Sentry first so if something breaks we see it. We use the Stripe wrapper for every Stripe call we want protected. We only retry "maybe temporary" errors (network, timeout), not "bad request" errors. We add a little randomness to the wait so everyone doesn't retry at the same second. We keep the "stop calling" period short (e.g. 1 minute) so we can try again soon. For tests we can reset the circuit. What we could do better: make sure every email/SMS/n8n call goes through the breaker and retry, and add numbers like "how often did the circuit open."

### 8. Other relevant info

**Technical:** Stripe SDK has its own maxNetworkRetries; we add circuit breaker and our retry on top for extra resilience. CircuitBreakerOpenError is thrown when open (and not yet half-open); callers can catch it and return a user-friendly "payment service temporarily unavailable." If Redis or DB is down, circuit breaker and retry don't help those—they're for outbound HTTP/API. Document any change to failureThreshold, resetTimeout, or retry maxAttempts in DECISIONS.md. See FOUNDER_STRIPE_WRAPPER if we add a dedicated doc; see FOUNDER_WEBHOOKS for Stripe webhook handling (incoming, not outbound calls).

**Simple (like for a 10-year-old):** Stripe's own library already retries a bit; we add our retry and the circuit breaker so we're extra safe. When the circuit is open we throw a special error so the app can show "payment service temporarily unavailable" instead of a generic error. This only protects calls we make to Stripe/email/SMS/n8n; it doesn't fix Redis or the database being down. If we change "how many failures" or "how long to wait" we should write it down.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Circuit breaker: avoid cascading failures and wasted load when an external service is down; fail fast and give it time to recover; probe with half-open. Retry: improve success rate for transient failures (network, timeout, 5xx) without infinite loops. Together: fewer user-visible failures from blips, and no hammering a down service. Success means: transient errors often succeed after retry; sustained outages result in circuit open and fast failure with clear error; after recovery circuit closes and traffic resumes.

**Simple (like for a 10-year-old):** The circuit breaker is supposed to stop us from calling a broken service over and over and to give it a chance to recover. Retry is supposed to fix "one-off" failures by trying again. Together we want: blips to succeed after a retry, and when something is really down we stop calling and fail fast so the app doesn't hang and we can show a clear "temporarily unavailable" message.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a call: either success (possibly after one or more retries) or failure (non-retryable or retries exhausted or circuit open). Observable: logs circuit_breaker_opened, circuit_breaker_closed, circuit_breaker_half_open; retry_attempt, retry_exhausted, retry_aborted_non_retryable. getStats() on breaker shows state, failures, successes. Success: operation succeeded (with or without retry); or circuit was open and we failed fast with CircuitBreakerOpenError; or we correctly did not retry a non-retryable error.

**Simple (like for a 10-year-old):** Success is either the call worked (maybe after a retry) or we failed in the right way: fast when the circuit is open, or after giving up retrying when the error isn't retryable. We can see success in the logs (circuit opened/closed, retry attempt/exhausted) and by checking the breaker's state.

### 11. What would happen if we didn't have it?

**Technical:** Without retry: every transient network or 5xx would surface as a failure to the user even when one retry would succeed. Without circuit breaker: when Stripe (or email/SMS) is down we'd keep retrying (or at least keep trying) and either waste time and timeouts or pile load on a failing service; request latency would suffer. Without both: more user-visible failures and worse behavior during outages.

**Simple (like for a 10-year-old):** Without retry we'd give up on the first failure even when a second try would work. Without the circuit breaker we'd keep calling a broken service and either wait forever or make things worse. So we'd see more errors and the app would feel worse when Stripe or email is down.

### 12. What is it not responsible for?

**Technical:** Circuit breaker and retry are not responsible for: idempotency of the operation (caller must ensure Stripe call is idempotent or use idempotency keys); handling incoming webhooks (that's FOUNDER_WEBHOOKS); DB or Redis resilience; auth or rate limiting. They only wrap outbound calls to external APIs. They don't decide business logic (e.g. when to create a payment intent); they only protect the execution of the call. Stripe wrapper doesn't replace Stripe SDK—it wraps SDK calls.

**Simple (like for a 10-year-old):** They don't make the operation safe to run twice (that's idempotency). They don't handle Stripe sending us webhooks—only our calls to Stripe. They don't fix the database or Redis being down. They don't do login or rate limiting. They only protect our outbound calls to Stripe/email/SMS/n8n. The Stripe wrapper doesn't replace Stripe; it just wraps their calls.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Circuit breaker: config (failureThreshold, resetTimeout, timeoutWindow, name); the async function to execute. Retry: the async function to execute; optional config (maxAttempts, initialDelay, maxDelay, multiplier, jitter, isRetryable). Stripe wrapper: operation (e.g. () => stripe.paymentIntents.create(params)), operationName (string). No env vars required for behavior; SENTRY_DSN for error reporting. Dependencies: logger; Stripe SDK and stripe instance for Stripe wrapper.

**Simple (like for a 10-year-old):** We need the "how many failures," "how long to wait," and "name" for the circuit breaker, and the function to run. For retry we need the function and optionally how many tries and how long to wait. For the Stripe wrapper we need the Stripe call and a name for it. We don't need special env vars for this; we do need Sentry if we want errors reported.

### 14. What does it produce or change?

**Technical:** Circuit breaker: state transitions (closed → open → half-open → closed), failure/success counts, lastFailureTime/lastSuccessTime/openedAt; throws CircuitBreakerOpenError when open. Retry: either the result of fn() or rethrows the last error; logs retry_attempt, retry_aborted_non_retryable, retry_exhausted. Stripe wrapper: same as underlying operation (e.g. PaymentIntent) or throws Error with "Stripe {operationName} failed: {message}." No DB or external state change beyond the wrapped operation (e.g. Stripe creates the intent).

**Simple (like for a 10-year-old):** The circuit breaker updates its internal state (open/closed/half-open) and counts; when open it throws "circuit open." Retry either returns the result of the call or throws the last error and logs retries. The Stripe wrapper returns whatever Stripe returns or throws an error with a clear message. Nothing else is stored (no database); only the actual Stripe/email/SMS call does something in the world.

### 15. Who or what consumes its output?

**Technical:** Consumers: the caller of executeStripeOperation or circuitBreakers.*.execute or retryWithBackoff—e.g. payment service, payout service, Connect service. They get either the result (e.g. PaymentIntent) or an error (CircuitBreakerOpenError or operation error). Downstream: user sees success or "payment service temporarily unavailable" (or similar); ledger and jobs may or may not be updated depending on caller handling. Logs are consumed by ops and Sentry.

**Simple (like for a 10-year-old):** The code that calls the Stripe wrapper (or the breaker/retry) gets either the result or an error. That code then either completes the payment flow or shows an error to the user. Ops and Sentry read the logs.

### 16. What are the main steps or flow it performs?

**Technical:** **Execute (Stripe wrapper):** circuitBreakers.stripe.execute(() => retryWithBackoff(operation, { ...retryConfigs.stripe, maxAttempts: 2 })). **Circuit breaker execute:** if open and time since openedAt < resetTimeout → throw CircuitBreakerOpenError; if open and time >= resetTimeout → transitionToHalfOpen. If closed and lastFailureTime outside timeoutWindow → reset failures. Run fn(); on success onSuccess (half-open → close, reset failures); on failure onFailure (increment failures; half-open → open, closed and failures >= threshold → open). **Retry:** for attempt 0..maxAttempts-1: try fn(); success → return; failure → if !isRetryable throw; if last attempt throw; delay with backoff+jitter; continue. **Stripe wrapper catch:** rethrow with "Stripe {operationName} failed: {message}."

**Simple (like for a 10-year-old):** For Stripe we run the call inside the circuit breaker and inside retry. The breaker checks: if we're "open" and it's not time yet, throw "circuit open"; if it's time, go half-open and try once. If we're closed we maybe reset the failure count. Then we run the call; if it succeeds we clear failures (and close if half-open); if it fails we count it and maybe open. Retry tries the call up to a few times with waits; if the error isn't retryable we don't retry. At the end we either return the result or throw with a clear message.

### 17. What rules or policies does it enforce?

**Technical:** Circuit breaker: open when failures >= failureThreshold within timeoutWindow; half-open after resetTimeout; close on first success in half-open. Retry: only retry when isRetryable(error) (default: timeout, network, ECONNRESET, ETIMEDOUT, ENOTFOUND, ECONNREFUSED; custom in retryConfigs); maxAttempts cap; delay bounded by maxDelay. No business policy (e.g. "refund if Stripe fails")—caller decides. Stripe wrapper: all operations go through same circuit and retry; operationName for error message only.

**Simple (like for a 10-year-old):** The circuit opens when we've had too many failures in the time window and closes when we get a success in half-open. Retry only retries "retryable" errors (network, timeout, etc.) and only up to a few times. We don't decide things like "refund the user"—the caller does. The Stripe wrapper treats all Stripe calls the same (same circuit, same retry).

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Triggered by any code path that calls executeStripeOperation, stripeOperations.*, circuitBreakers.*.execute(), or retryWithBackoff(). So: payment flow (create/retrieve payment intent), payout flow (create transfer), Connect (create account, account link), and any future path that wraps SendGrid/Twilio/n8n with breaker and retry. No cron; purely request or job-driven.

**Simple (like for a 10-year-old):** It runs whenever we make a Stripe call through the wrapper (or whenever we use the breaker and retry for email/SMS/n8n). So payments, payouts, and Connect setup trigger it. Nothing runs on a schedule—only when the app needs to call Stripe or the other services.

### 19. What could go wrong while doing its job?

**Technical:** Circuit breaker: wrong threshold or timeout (too sensitive → open too often; too loose → keep calling a down service). Multiple instances: in-memory state is per process; with multiple servers each has its own circuit state (could open on one and not another)—acceptable for "per-node" protection; for global circuit would need shared state (e.g. Redis). Retry: non-idempotent operation retried could double-side-effect (caller must use idempotency keys for Stripe). Stripe wrapper: if operation throws non-Error, rethrow may lose context. Logging: too verbose at high volume. CircuitBreakerOpenError not caught → user sees generic error unless caller maps it.

**Simple (like for a 10-year-old):** If we set "open after 2 failures" we might open too easily; if we set "open after 100" we might keep calling when Stripe is down. If we have many servers each has its own "circuit" so one server might stop calling while another still tries. If the Stripe call isn't safe to do twice we could double-charge—the caller has to make sure we use idempotency. If we don't catch "circuit open" in the app the user might see a technical error instead of "temporarily unavailable."

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** Logs: circuit_breaker_opened, circuit_breaker_closed, circuit_breaker_half_open, retry_attempt, retry_exhausted, retry_aborted_non_retryable. getStats() on CircuitBreaker returns state, failures, successes, lastFailureTime, openedAt. Observability: when Stripe is down we should see circuit_breaker_opened and then fast failures with CircuitBreakerOpenError; when it recovers we should see half_open then circuit_breaker_closed. No built-in metrics (e.g. circuit_open_duration); could add.

**Simple (like for a 10-year-old):** We look at the logs: circuit opened/closed/half-open and retry attempt/exhausted. We can also call getStats() on the breaker to see its state and counts. When Stripe is down we should see "circuit opened" and then requests failing fast; when Stripe comes back we should see "half-open" and then "closed."

### 21. What does it depend on to do its job?

**Technical:** Logger (circuitBreaker, retry). Stripe SDK and stripe instance (stripeWrapper). No DB or Redis for circuit state (in-memory). Sentry (optional) for error reporting—init in instrument.ts before other imports. Callers must pass an async function that returns a Promise; Stripe operations must be compatible with Stripe SDK.

**Simple (like for a 10-year-old):** It needs the logger and the Stripe library. It doesn't need the database or Redis for its own state. It can use Sentry if we've set it up. The code that uses it has to give it an async function that calls Stripe (or the other service).

### 22. What are the main config or env vars that control its behavior?

**Technical:** No env vars for circuit breaker or retry thresholds; all in code. failureThreshold: 5; resetTimeout: 60000 (stripe, sendgrid, twilio), 30000 (n8n); timeoutWindow: 60000. Retry: maxAttempts 2 (Stripe in wrapper), 3 (stripe/sendgrid/twilio presets), 2 (n8n); initialDelay 1000–2000; maxDelay 5000–15000; multiplier 2; jitter true. SENTRY_DSN only affects whether errors are sent to Sentry, not circuit/retry behavior.

**Simple (like for a 10-year-old):** We don't use env vars for "how many failures" or "how long to wait"—that's all in code (e.g. 5 failures, 1 minute wait). Retry tries 2 or 3 times with 1–2 second first wait and up to 5–15 second max wait. Sentry is only for sending errors to Sentry, not for changing how the circuit or retry works.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests: `src/lib/__tests__/errorRecovery.test.ts` (retryWithBackoff success, failure, non-retryable, exhaustion); `src/tests/unit/security.test.ts` (retryWithBackoff). Circuit breaker: can be tested by mocking fn() to fail N times then succeed, assert state transitions and getStats(). Integration: call Stripe through wrapper in test env; or mock Stripe to fail and assert circuit opens and CircuitBreakerOpenError thrown. No E2E mentioned; could add.

**Simple (like for a 10-year-old):** We have tests that call retryWithBackoff with a function that fails or succeeds and check we get the right result or error. We can test the circuit breaker by making the call fail a bunch of times and checking that it opens and throws. We could also test with a fake Stripe that fails and see that we get "circuit open" after a few failures.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If circuit is stuck open (e.g. false positive): wait for resetTimeout and half-open probe, or restart process (resets in-memory state), or call circuitBreaker.reset() (e.g. from admin or script). If retry exhausts and we shouldn't have: fix isRetryable or increase maxAttempts; for that request the caller should handle the error (e.g. show "try again" or queue for later). If Stripe is down: circuit opens and we fail fast; no recovery needed until Stripe recovers; then half-open will close. No automatic "circuit reset" from config; manual reset or process restart.

**Simple (like for a 10-year-old):** If the circuit gets stuck open we can wait for the "try again" period or restart the server (which resets the circuit) or call reset() if we have a way to do that. If we're giving up retries too soon we can change what counts as retryable or how many times we retry. If Stripe is down we don't "recover" until Stripe is back; then the next probe will close the circuit.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders?

**Technical:** Users: see fewer payment/email/SMS failures when transient; see clear "temporarily unavailable" when partner is down. Ops: care that we don't hammer a down service and that we log circuit open/close. Product: care that payment and notification success rate is higher. Engineering: care that Stripe (and other) calls are wrapped and that we don't double-charge (idempotency).

**Simple (like for a 10-year-old):** Users get fewer random failures and a clearer message when Stripe is down. Ops can see in the logs when we stopped calling a service. Product cares that payments and emails work more often. Engineering cares that we use the wrapper and that we don't charge twice when we retry.

### 26. What are the security or privacy considerations?

**Technical:** Circuit breaker and retry don't handle auth or PII; they only wrap the call. Error messages: "Stripe createPaymentIntent failed: ..." might include Stripe error text—ensure we don't leak secrets to the client; log full error server-side only. CircuitBreakerOpenError message is safe ("circuit breaker X is OPEN"). Retry doesn't change request data; idempotency is caller's responsibility so retrying doesn't create duplicate charges.

**Simple (like for a 10-year-old):** The circuit and retry don't see passwords or personal data—they just run the call. We should make sure the error we show to the user doesn't include secret info. The "circuit open" message is fine. Retrying doesn't change what we send; the caller has to make sure retrying doesn't charge twice.

### 27. What are the limits or scaling considerations?

**Technical:** In-memory circuit state: one per process. With multiple app instances each has its own stripe/sendgrid/twilio/n8n circuit; under load one instance might open while others don't—acceptable. Retry adds latency (delay between attempts); maxAttempts 2–3 keeps it bounded. High request volume: many concurrent calls to Stripe all share the same circuit (per process); when open all fail fast (good). No Redis or shared state for circuit; if we wanted "global" circuit we'd need shared state and more complexity.

**Simple (like for a 10-year-old):** Each server has its own circuit, so with many servers one might stop calling while others still try. Retry adds a few seconds of wait when we retry. When the circuit is open every Stripe call on that server fails fast, which is what we want. We don't have a shared "circuit" across servers—that would need more plumbing.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** Wire SendGrid/Twilio/n8n calls through their circuit breakers and retry consistently. Add metrics (circuit_open_count, retry_count, success_after_retry) to Sentry or metrics lib. Optional shared circuit state (Redis) for multi-instance "open once, fail fast everywhere." Configurable thresholds via env (e.g. CIRCUIT_FAILURE_THRESHOLD) for tuning without deploy. Catch CircuitBreakerOpenError in payment/notification code and return consistent "service temporarily unavailable" response. Document which Stripe (or other) code paths use the wrapper and which don't.

**Simple (like for a 10-year-old):** We'd make sure every email and SMS and n8n call goes through the breaker and retry. We'd add numbers like "how often did the circuit open" and "how often did retry succeed." We might want one circuit for the whole system so when one server opens, all servers stop calling. We'd maybe make the thresholds configurable so we can tune without changing code. We'd make sure the app always shows "temporarily unavailable" when the circuit is open. We'd write down which Stripe calls use the wrapper and which don't.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Circuit breaker: created at module load (circuitBreakers.stripe, etc.); state starts closed. Lifecycle: closed → (failures >= threshold) → open → (after resetTimeout) → half-open → (success) → closed or (failure) → open. No "destroy"; process lifetime. Retry: no state; each call to retryWithBackoff runs the loop and returns or throws. Stripe wrapper: stateless; each executeStripeOperation runs circuit execute + retry once.

**Simple (like for a 10-year-old):** The circuit starts "closed" (normal). When we have too many failures it goes "open"; after a wait it goes "half-open" and we try once; if that works we close, if not we open again. Retry doesn't remember anything between calls—each time we just try up to a few times. The Stripe wrapper doesn't keep state; it just runs the call with protection each time.

### 30. What state does it keep or track?

**Technical:** Circuit breaker (per instance): state (closed|open|half-open), failures, successes, lastFailureTime, lastSuccessTime, openedAt. In-memory only; no DB. Retry: no persistent state; only loop variables during execution. Stripe wrapper: no state. So only the CircuitBreaker class holds state, and only in process memory.

**Simple (like for a 10-year-old):** The circuit breaker remembers: am I open, closed, or half-open? How many failures and successes? When did I last fail or open? That's all in memory. Retry and the Stripe wrapper don't remember anything between requests.

### 31. What assumptions does it make to do its job?

**Technical:** Assumes fn() passed to execute or retryWithBackoff is async and returns a Promise; throws on failure. Assumes failures are "transient" or "sustained" in a way that fits the threshold and window. Assumes single process for circuit state (or per-process behavior is acceptable). Assumes caller uses idempotency for Stripe when retrying. Assumes logger is available. Assumes Stripe SDK is configured (for stripeWrapper). Assumes resetTimeout and timeoutWindow are sensible (e.g. 60s) so we don't open forever or flip too often.

**Simple (like for a 10-year-old):** We assume the function we're calling is async and throws when it fails. We assume "a few failures" means "maybe down" and "one success" in half-open means "back." We assume we're only protecting one server's view (or we're okay with each server having its own circuit). We assume the caller made the Stripe call safe to retry (idempotency). We assume the logger and Stripe are set up. We assume the timeouts we picked (e.g. 1 minute) make sense.

### 32. When should we not use it (or use something else)?

**Technical:** Don't wrap non-idempotent operations without idempotency keys (e.g. Stripe create without idempotency key). Don't use circuit breaker for operations that must always be attempted (e.g. critical audit log)—or use a different pattern. Don't use retry for 4xx client errors (isRetryable should return false). Don't call Sentry.init() inside circuit or retry code. Use raw stripe.* only when we explicitly don't want protection (e.g. tests with mocked Stripe). For incoming webhooks (Stripe → us) use signature verification and idempotency, not circuit breaker (we're not "calling" Stripe).

**Simple (like for a 10-year-old):** Don't wrap something that's not safe to do twice (like charging without an idempotency key). Don't use the circuit breaker for something we must always try (e.g. writing an audit log). Don't retry "bad request" errors—only things like network or server errors. Don't init Sentry inside this code. Use the wrapper for real Stripe calls; in tests we might call Stripe directly with mocks. For when Stripe calls us (webhooks) we use different protection, not the circuit breaker.

### 33. How does it interact with other systems or features?

**Technical:** Stripe: stripeWrapper uses circuitBreakers.stripe and retryConfigs.stripe; payment and payout and Connect flows that use stripeOperations or executeStripeOperation get protection. Sentry: errors (including CircuitBreakerOpenError and exhausted retry) are captured if Sentry is init'd first. Logger: all circuit and retry logs go through logger. Notifications: SendGrid/Twilio circuit breakers and retry presets exist; integration depends on notification code using them. n8n: same. No interaction with DB, queue, or auth beyond what the wrapped operation does.

**Simple (like for a 10-year-old):** It works with Stripe (through the wrapper), with Sentry (so errors get reported), and with the logger (so we see when the circuit opens and when we retry). Email and SMS and n8n have their own breakers and retry settings in code; whether they're used depends on how we call those services. It doesn't touch the database or the queue or login—only the actual Stripe/email/SMS call does.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure: the wrapped operation throws; or circuit is open and we throw CircuitBreakerOpenError. We rethrow the operation error (Stripe wrapper adds "Stripe {operationName} failed: {message}"); we don't swallow. retry_exhausted and retry_aborted_non_retryable log and throw. Circuit breaker doesn't catch or transform the inner error; it only throws CircuitBreakerOpenError when open. Caller sees: success, or CircuitBreakerOpenError, or operation error (e.g. Stripe API error).

**Simple (like for a 10-year-old):** Failure means the call threw an error or the circuit was open so we threw "circuit open." We don't hide errors—we pass them up. We log "retry exhausted" or "retry aborted" and then throw. The caller gets either the result or one of those errors.

### 35. How do we know its outputs are correct or complete?

**Technical:** Success: we return the result of the operation (e.g. PaymentIntent). Correctness of that result is the operation's contract (Stripe SDK). Circuit breaker: we know state is correct if transitions follow the rules (closed → open on threshold, open → half-open on timeout, half-open → closed on success, half-open → open on failure). Retry: we know we retried correctly if we only retried when isRetryable and we capped at maxAttempts. Tests assert retry count and circuit behavior; integration with Stripe in staging can verify end-to-end.

**Simple (like for a 10-year-old):** We know we succeeded when we return the Stripe result (and Stripe's result is what Stripe says it is). We know the circuit is correct if it opens after enough failures and closes after a success in half-open. We know retry is correct if we only retry the right errors and only a few times. Tests and staging help verify.

### 36. Who owns or maintains it?

**Technical:** Code: src/lib/circuitBreaker.ts, retry.ts, stripeWrapper.ts. No explicit OWNER; typically platform or reliability owns resilience patterns. Changes to thresholds or presets should be documented (DECISIONS.md). When adding a new external service, add a circuit breaker and retry preset and wire calls through them.

**Simple (like for a 10-year-old):** The team that owns "platform" or "reliability" usually owns this. The code is in the circuit breaker, retry, and Stripe wrapper files. If we change the numbers (failures, timeouts) or add a new service we should write it down.

### 37. How might it need to change as the product or business grows?

**Technical:** Add circuit + retry for every outbound partner (SendGrid, Twilio, n8n) in all code paths. Add metrics (open count, retry success rate) to Sentry or metrics backend. Consider shared circuit state (Redis) for multi-instance "fail fast everywhere." Make thresholds configurable (env or config service). Add admin endpoint to reset circuit (e.g. for false positives). Tune Stripe retry (e.g. 3 attempts) if we see high transient failure rate. Document which operations use wrapper and which don't; add wrapper for any direct stripe.* that should be protected.

**Simple (like for a 10-year-old):** We might add the same protection for every email and SMS and n8n call. We might add dashboards for "how often did the circuit open." We might want one circuit for the whole system when we have many servers. We might make the thresholds configurable. We might add a "reset circuit" button for admins. We might change how many times we retry Stripe based on what we see. We'd write down which Stripe calls are wrapped and wrap any that aren't.

---

## Optional deeper questions (selected)

### A10. Can we run it twice safely (idempotency)?

**Technical:** The circuit breaker and retry themselves are idempotent in the sense that running execute() or retryWithBackoff() twice with the same fn() runs the operation twice—so if the operation is not idempotent (e.g. Stripe create without idempotency key), retrying can double the side effect. Caller must ensure Stripe (and other) calls use idempotency keys where needed. Circuit state: calling execute() when closed twice is "run twice"; when open twice is "throw twice"—no duplicate state change. So: the pattern is safe to invoke multiple times; the wrapped operation must be idempotent if we retry.

**Simple (like for a 10-year-old):** Running the wrapper twice is fine for the wrapper itself. But if the Stripe call isn't safe to do twice (e.g. "create payment" without an idempotency key), then retrying could create two payments. So the caller has to make sure Stripe calls use idempotency when we retry.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** When the wrapped dependency (Stripe, SendGrid, etc.) fails: we count the failure (circuit), and we retry if the error is retryable (retry). After enough failures we open the circuit and subsequent calls throw immediately (no call to dependency). When the dependency recovers: after resetTimeout we go half-open, make one call; if it succeeds we close; if it fails we open again. So we don't depend on DB or queue for our logic; we only depend on the external API. If the external API is down we eventually open and fail fast; when it's back we probe and close.

**Simple (like for a 10-year-old):** When Stripe (or email/SMS) fails we count it and maybe retry. After too many failures we stop calling and throw "circuit open." When they're back we try once (half-open); if that works we go back to normal; if not we wait again. We don't use the database or a queue for this—only the external service. So when that service is down we stop calling it and fail fast; when it's up we try again.

---

*End of Founder Reference: Circuit Breaker + Retry*
