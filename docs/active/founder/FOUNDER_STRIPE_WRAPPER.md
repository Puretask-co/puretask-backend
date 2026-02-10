# Founder Reference: Stripe Wrapper

**Candidate:** Stripe wrapper (Module #24)  
**Where it lives:** `src/lib/stripeWrapper.ts` (executeStripeOperation, stripeOperations); uses circuitBreakers.stripe and retryWithBackoff from circuitBreaker and retry  
**Why document:** How we call Stripe safely (retry, circuit breaker) and where we use the wrapper.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Stripe wrapper in PureTask is a thin layer that runs every Stripe API call through the circuit breaker and retry so we don't hammer Stripe when it's down and we give transient failures a second chance. `executeStripeOperation(operation, operationName)` runs the operation inside `circuitBreakers.stripe.execute()` and then inside `retryWithBackoff(..., { ...retryConfigs.stripe, maxAttempts: 2 })`. On error it rethrows with a message like "Stripe createPaymentIntent failed: {original message}." **stripeOperations** exposes wrapped versions of common calls: createPaymentIntent, createTransfer, createAccount, createAccountLink, retrievePaymentIntent. Each of these calls the raw Stripe SDK method (e.g. stripe.paymentIntents.create) via executeStripeOperation. The Stripe SDK already has maxNetworkRetries; we add circuit breaker so that after several failures we stop calling Stripe for a while (see FOUNDER_CIRCUIT_BREAKER_RETRY).

**Simple (like for a 10-year-old):** The Stripe wrapper is the way we always call Stripe so that (1) if a call fails once or twice we retry with a short wait, and (2) if Stripe is down and we've failed too many times we stop calling for a minute and fail fast. We have a small list of "wrapped" calls: create payment intent, create transfer, create account, create account link, and get a payment intent. Each one goes through "retry a couple of times" and "circuit breaker." When something fails we throw an error that says "Stripe createPaymentIntent failed: ..." so we know which call broke.

### 2. Where it is used

**Technical:** `src/lib/stripeWrapper.ts` defines executeStripeOperation and stripeOperations. **Callers:** Any code that should call Stripe with protection should use stripeOperations.* or executeStripeOperation( () => stripe.something(), "something" ). Grep shows stripeWrapper is only used inside itself (stripeOperations calls executeStripeOperation). The payment service, payout service, and Stripe Connect service may call stripe.* directly in places—to get full protection those call sites should be switched to stripeOperations or executeStripeOperation. So the wrapper exists and is the right pattern; adoption across the codebase may be partial. See FOUNDER_PAYMENT_FLOW and FOUNDER_PAYOUT_FLOW for where Stripe is used; those flows should use the wrapper where they create intents, transfers, or accounts.

**Simple (like for a 10-year-old):** The code lives in stripeWrapper.ts. Any place that wants to call Stripe safely should use stripeOperations (e.g. stripeOperations.createPaymentIntent) or executeStripeOperation with the Stripe call. Right now the wrapper is only used inside that file for the five operations we wrapped. Other code (payments, payouts, Connect) might still call Stripe directly in some places; those should be updated to use the wrapper so they get retry and circuit breaker everywhere.

### 3. When we use it

**Technical:** We use it whenever we want to call Stripe with circuit breaker and retry—i.e. for payment intents (create, retrieve), transfers (create), Connect accounts (create), and account links (create). Triggers: payment flow (create or retrieve payment intent), payout flow (create transfer), Connect onboarding (create account, create account link). If callers use stripe.* directly instead of the wrapper, those calls don't get protection. So "when we use it" is "whenever a caller uses stripeOperations.* or executeStripeOperation"; the rest of the app should be updated to use it for all Stripe calls that can fail transiently.

**Simple (like for a 10-year-old):** We use it whenever we create a payment intent, create a transfer, create a Connect account, create an account link, or retrieve a payment intent. That happens when someone pays, when we pay out a cleaner, or when a cleaner sets up Connect. If some code still calls Stripe without the wrapper, that code doesn't get the retry and circuit breaker; we should use the wrapper everywhere we call Stripe.

### 4. How it is used

**Technical:** **executeStripeOperation(operation, operationName):** try { return await circuitBreakers.stripe.execute(() => retryWithBackoff(operation, { ...retryConfigs.stripe, maxAttempts: 2 })); } catch (error) { if (error instanceof Error) throw new Error(`Stripe ${operationName} failed: ${error.message}`); throw error; }. **stripeOperations:** each method (e.g. createPaymentIntent(params)) calls executeStripeOperation(() => stripe.paymentIntents.create(params), "createPaymentIntent"). So the flow is: caller calls stripeOperations.createPaymentIntent(params) → executeStripeOperation → circuit breaker execute → retry up to 2 times → stripe.paymentIntents.create(params) → success or throw. Callers must pass the same params they would to the Stripe SDK; we don't change the API, we only wrap execution.

**Simple (like for a 10-year-old):** To use it we call stripeOperations.createPaymentIntent(params) (or the other methods) with the same parameters we'd pass to Stripe. Inside we run the real Stripe call inside the circuit breaker and retry: we try up to 2 times, and if the circuit is open we don't call Stripe at all and throw. If something fails we throw "Stripe createPaymentIntent failed: ..." so the caller knows which operation failed. We don't change the parameters or the return value—we just add protection around the call.

### 5. How we use it (practical)

**Technical:** In payment service: replace stripe.paymentIntents.create(...) with stripeOperations.createPaymentIntent(...) and stripe.paymentIntents.retrieve(id) with stripeOperations.retrievePaymentIntent(id). In payout service: replace stripe.transfers.create(...) with stripeOperations.createTransfer(...). In stripeConnectService: replace stripe.accounts.create(...) and stripe.accountLinks.create(...) with stripeOperations.createAccount(...) and stripeOperations.createAccountLink(...). For any other Stripe call (e.g. refunds, balance transactions) add a new method to stripeOperations or call executeStripeOperation directly. No env vars in the wrapper; Stripe is configured in integrations/stripe. See FOUNDER_CIRCUIT_BREAKER_RETRY for tuning retry and circuit thresholds.

**Simple (like for a 10-year-old):** In practice we use stripeOperations.createPaymentIntent, createTransfer, createAccount, createAccountLink, and retrievePaymentIntent wherever we used to call Stripe for those things. For other Stripe calls we can add a new method to stripeOperations or call executeStripeOperation with the Stripe call and a name. We don't have special env vars for the wrapper; Stripe is set up in the Stripe integration. If we want to change how many retries or when the circuit opens, that's in the circuit breaker and retry docs.

### 6. Why we use it vs other methods

**Technical:** Calling stripe.* directly gives no retry and no circuit breaker—one timeout or 5xx fails the request, and if Stripe is down we keep trying and wasting time. The wrapper adds retry (up to 2 attempts with backoff) and circuit breaker (after 5 failures in 1 minute we stop calling for 1 minute). Alternatives: rely only on Stripe SDK retries (we still want circuit breaker); add retry/circuit at every call site (duplicated logic). We chose one wrapper so all Stripe calls can get the same behavior by using stripeOperations or executeStripeOperation. See FOUNDER_CIRCUIT_BREAKER_RETRY for the full rationale.

**Simple (like for a 10-year-old):** We use it so that when Stripe is slow or down we don't just fail once—we retry a couple of times—and when Stripe is really down we stop hammering it and fail fast. If we called Stripe directly we'd have no retry and no "stop calling" behavior. We put the logic in one place (the wrapper) so every Stripe call can use it by calling stripeOperations or executeStripeOperation.

### 7. Best practices

**Technical:** Use stripeOperations.* or executeStripeOperation for every Stripe call that can fail transiently (network, 5xx). Use idempotency keys for create operations (payment intent, transfer) so retries don't double-create; the wrapper doesn't add keys—callers must. Don't call stripe.* directly for the same operations we wrapped; use the wrapper. For new Stripe operations add a stripeOperations method or call executeStripeOperation( () => stripe.X(), "X" ). Catch CircuitBreakerOpenError (from circuitBreaker) and return a user-friendly "payment service temporarily unavailable." Logs come from circuit breaker and retry (circuit_breaker_opened, retry_attempt, etc.). Gaps: not every Stripe call in the codebase may use the wrapper yet; stripeOperations doesn't cover refunds, balance, or other endpoints—add as needed.

**Simple (like for a 10-year-old):** We should use the wrapper for every Stripe call that might fail because of network or Stripe being down. For things like "create payment intent" we need to use idempotency keys so that if we retry we don't create two intents—the wrapper doesn't add those, the caller does. We shouldn't call Stripe directly for the same things we wrapped. When we add new Stripe operations we add them to stripeOperations or use executeStripeOperation. When the circuit is open we can catch that and show "payment service temporarily unavailable." We might not have switched every Stripe call to the wrapper yet, and we don't have wrapper methods for refunds or balance yet—we add those when we need them.

### 8. Other relevant info

**Technical:** The wrapper depends on circuitBreakers.stripe (from circuitBreaker.ts) and retryWithBackoff + retryConfigs.stripe (from retry.ts). It uses the stripe instance from integrations/stripe. It doesn't handle webhooks (incoming Stripe → us); that's FOUNDER_WEBHOOKS. It doesn't add idempotency keys; callers must pass them in params. Document any new stripeOperations method in this doc. See FOUNDER_PAYMENT_FLOW, FOUNDER_PAYOUT_FLOW, FOUNDER_CIRCUIT_BREAKER_RETRY.

**Simple (like for a 10-year-old):** The wrapper uses the circuit breaker and retry code and the Stripe connection we set up in the integration. It doesn't handle Stripe sending us webhooks—that's a different doc. It doesn't add idempotency keys; the code that calls it has to. If we add new wrapped operations we should write them down here. See the payment, payout, and circuit breaker docs for more.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: run all Stripe calls through circuit breaker and retry so we get higher success rate on transient failures and fail fast when Stripe is down. Success: callers use the wrapper; Stripe calls succeed or fail with clear "Stripe X failed" messages; circuit opens when Stripe is down. Without it we'd have no retry/circuit on Stripe calls. The wrapper is not responsible for: webhooks, idempotency keys, or business logic (when to create intent, how much to transfer).

**Simple (like for a 10-year-old):** It's there so every Stripe call gets retry and circuit breaker. Success is we use it everywhere we call Stripe and we see clear errors when something fails. Without it we wouldn't have that protection. It doesn't handle webhooks or idempotency keys or the "when to pay" logic—only the safe execution of the Stripe call.

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: operation (async function that returns Stripe result), operationName (string); or for stripeOperations the same params as Stripe SDK (e.g. PaymentIntentCreateParams). Outputs: same as Stripe (e.g. PaymentIntent, Transfer) or throws Error with "Stripe {operationName} failed: {message}". Flow: executeStripeOperation → circuit execute → retry up to 2 times → operation() → return or throw. Rules: caller must pass valid Stripe params; idempotency keys are caller's responsibility.

**Simple (like for a 10-year-old):** We give it the Stripe call (and a name) or we call stripeOperations with the same params we'd give Stripe. We get back what Stripe returns or an error that says "Stripe X failed." We run the call inside the circuit and retry. The caller has to pass correct params and idempotency keys when needed.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, security, limits, lifecycle, state, assumptions, when not to use, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by any code that calls stripeOperations.* or executeStripeOperation (payment, payout, Connect flows). Could go wrong: operation not idempotent and we retry → double side effect (use idempotency keys); circuit open → CircuitBreakerOpenError. Depends on circuitBreaker, retry, stripe instance. No env in wrapper. Test: mock stripe and circuit/retry, assert operation called and result/error. Recovery: circuit resets after timeout; caller handles error. Stakeholders: product (payment success rate), ops (fewer timeouts). Security: don't log full Stripe params (may contain PII). Limits: same as Stripe API. Lifecycle/state: none in wrapper. Assumptions: operation returns Promise; Stripe SDK configured. When not to use: for webhooks (incoming) we don't call Stripe. Interacts with circuit breaker, retry, Stripe. Failure: rethrow with context. Correctness: we trust circuit and retry; caller ensures idempotency. Owner: platform. Evolution: add more stripeOperations methods (refund, balance, etc.); ensure all Stripe call sites use wrapper.

**Simple (like for a 10-year-old):** It runs when payment, payout, or Connect code calls it. If we retry without idempotency we could double-charge; so we use keys. When the circuit is open we throw. We depend on the circuit breaker, retry, and Stripe. We test by mocking Stripe and checking we get the right result or error. We don't log full payment details. The platform team owns it. Later we add more operations (refunds, etc.) and make sure every Stripe call uses the wrapper.

---

*End of Founder Reference: Stripe Wrapper*
