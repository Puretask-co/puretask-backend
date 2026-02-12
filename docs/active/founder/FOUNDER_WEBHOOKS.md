# Founder Reference: Webhook System

**Candidate:** Webhook system (System #5)  
**Where it lives:** Stripe webhook route (`src/routes/stripe.ts`), n8n webhook routes (`src/routes/events.ts`), `webhookRetryService`, signature verification (`src/lib/auth.ts`, Stripe SDK), `webhook_failures` table, `webhookRetry` worker  
**Why document:** How we receive Stripe/n8n webhooks, verify signatures, handle retries, and avoid duplicate processing.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The webhook system is the set of mechanisms that receive and process inbound webhooks from Stripe and n8n. It consists of: (1) **Stripe webhook**—POST /stripe/webhook, raw body for signature verification (stripe.webhooks.constructEvent with STRIPE_WEBHOOK_SECRET), then handleStripeEvent (paymentService); on processing failure we queue the event for retry and still return 200 so Stripe doesn’t retry; (2) **n8n webhooks**—POST /n8n/events and POST /events, verifyN8nSignature (HMAC-SHA256 over body with N8N_WEBHOOK_SECRET, header x-n8n-signature), then publishEvent; (3) **Webhook retry**—webhookRetryService (queueWebhookForRetry, processWebhookRetries) and webhook_failures table (source, event_id, event_type, payload, status, retry_count, next_retry_at); exponential backoff (1m, 5m, 15m, 1h, 4h); webhookRetry worker runs on schedule (e.g. every 15 min), processes pending retries (stripe → handleStripeEvent, n8n → publishEvent), marks succeeded or dead after max_retries; (4) **Idempotency**—Stripe event id is checked in paymentService (stripe_events_processed); webhook_failures uses event_id + source to avoid duplicate queue entries. Raw body for Stripe is ensured in index.ts (express.raw for /stripe/webhook path).

**Simple (like for a 10-year-old):** The webhook system is how we receive “notifications” from Stripe (payments) and n8n (workflows). When Stripe says “payment succeeded” we check that the message really came from Stripe (signature), then we process it; if processing fails we put it in a “retry list” and still say “OK” so Stripe doesn’t bombard us. When n8n sends us an event we check a secret signature, then we publish the event inside our app. We have a background worker that retries failed webhooks with longer and longer waits; if they keep failing we mark them “dead” so someone can look. We avoid doing the same webhook twice by remembering event ids.

### 2. Where it is used

**Technical:** Stripe webhook is in `src/routes/stripe.ts` (POST /webhook), uses getStripeWebhookSecret() from `src/integrations/stripe.ts` (env.STRIPE_WEBHOOK_SECRET). n8n webhooks are in `src/routes/events.ts` (POST /n8n/events, POST /events) with verifyN8nSignature from `src/lib/auth.ts`. Raw body handling for Stripe is in `src/index.ts` (express.raw for req.path === "/stripe/webhook"). Webhook retry is in `src/services/webhookRetryService.ts` (queueWebhookForRetry, getPendingWebhooks, processWebhookRetries, cleanupOldWebhooks, getWebhookStats, retryWebhook, markAsResolved) and `src/workers/v1-core/webhookRetry.ts` (runWebhookRetryWorker: processWebhookRetries(50), cleanupOldWebhooks(30)). Table: webhook_failures (DB/migrations/010_webhook_retry_queue.sql). Rate limiting: endpointRateLimiter in security.ts (Stripe webhook 200/min, n8n 50/min). Payment processing and idempotency for Stripe are in paymentService (handleStripeEvent, stripe_events_processed); see FOUNDER_PAYMENT_FLOW.md and FOUNDER_IDEMPOTENCY.md.

**Simple (like for a 10-year-old):** The Stripe webhook lives in the stripe routes; it uses a secret from config to check the signature. The n8n webhooks live in the events routes and use the auth lib to check the n8n signature. The main app is set up so that for the Stripe webhook URL we don’t parse the body as JSON—we keep it raw so we can verify the signature. The “retry failed webhooks” code is in webhookRetryService and a worker that runs on a schedule. We store failed webhooks in the webhook_failures table. We limit how many webhook requests we accept per minute (Stripe 200, n8n 50). How we process payments and avoid duplicates is in the payment and idempotency docs.

### 3. When we use it

**Technical:** We use the webhook system when: (1) Stripe sends a webhook (payment_intent.succeeded, charge.refunded, etc.)—Stripe calls POST /stripe/webhook; we verify signature, call handleStripeEvent; if that throws we queueWebhookForRetry and return 200; (2) n8n sends an event—n8n calls POST /n8n/events or POST /events; we verify signature, parse body, publishEvent; (3) the webhookRetry worker runs (e.g. every 15 min via scheduler)—getPendingWebhooks(50), for each processWebhookRetry (stripe → handleStripeEvent, n8n → publishEvent), then cleanupOldWebhooks(30). There is no fixed “business” trigger for receiving webhooks—Stripe and n8n push when events occur; retry is on a schedule.

**Simple (like for a 10-year-old):** We use it when Stripe sends us “payment succeeded” or “refund done” and when n8n sends us an event—they call our URLs and we check the signature and process. We also use it when our “retry failed webhooks” worker runs on a schedule (e.g. every 15 minutes); it picks up failed webhooks and tries again. We don’t “call” webhooks ourselves—Stripe and n8n push to us when something happens.

### 4. How it is used

**Technical:** **Stripe:** Request has header stripe-signature and raw body. We call stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET); on success we have a Stripe.Event. We call handleStripeEvent(event); on success we res.json({ received: true }). On handleStripeEvent throw we call queueWebhookForRetry({ source: 'stripe', eventId: event.id, eventType: event.type, payload: event, errorMessage }), log stripe_webhook_queued_for_retry, and res.status(200).json({ received: true, queued_for_retry: true }) so Stripe does not retry. **n8n:** Request has header x-n8n-signature and JSON body. verifyN8nSignature: compute HMAC-SHA256(N8N_WEBHOOK_SECRET, JSON.stringify(req.body)), timing-safe compare with header; if invalid 401. Handler: eventSchema.parse(req.body), publishEvent({ jobId, actorType, actorId, eventName: eventType, payload }), res.status(204). **Retry:** queueWebhookForRetry checks event_id+source for existing row (idempotency); INSERT webhook_failures (source, event_id, event_type, payload, error_message, max_retries, next_retry_at, status='pending'). getPendingWebhooks: WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= NOW()) AND retry_count < max_retries ORDER BY created_at LIMIT. processWebhookRetry: markAsProcessing; for stripe call handleStripeEvent(payload); for n8n call publishEvent(...); markAsSucceeded or markAsFailed (next_retry_at with backoff, or status=dead if retry_count >= max_retries).

**Simple (like for a 10-year-old):** For Stripe we take the raw body and the signature header and ask the Stripe library to check it; if it’s valid we process the event. If processing fails we add it to the retry list and still say “OK” to Stripe so they don’t keep resending. For n8n we compute what the signature should be from the body and the secret and compare it safely to the header; if it’s wrong we return 401. If it’s right we parse the body and publish the event, then return 204. For retry we first check we don’t already have this event in the list; we add it with “retry in 1 minute.” The worker finds pending items that are due, runs the same processing (Stripe event or n8n publishEvent), and marks them succeeded or schedules the next retry (or marks dead after 5 retries).

### 5. How we use it (practical)

**Technical:** In day-to-day: Stripe is configured in the Stripe Dashboard to send events to our POST /stripe/webhook URL; we set STRIPE_WEBHOOK_SECRET to the signing secret Stripe gives us. n8n workflows that need to push events to us call POST /n8n/events or POST /events with N8N_WEBHOOK_SECRET and set x-n8n-signature. We run the webhookRetry worker on a schedule (e.g. every 15 min via workers/scheduler). Env: STRIPE_WEBHOOK_SECRET, N8N_WEBHOOK_SECRET (required in production for n8n). To debug: check webhook_failures (status, event_type, error_message); getWebhookStats(); getRecentFailures(20); retryWebhook(id) or markAsResolved(id) for dead items. Status/operationalMetricsService and admin repair service surface failed webhook counts. Raw body: index.ts must apply express.raw only for /stripe/webhook so signature verification works; if the route is mounted with a prefix, path may be /api/stripe/webhook—verify path in middleware.

**Simple (like for a 10-year-old):** In practice we tell Stripe our webhook URL and put their secret in our config. We tell n8n our URL and the shared secret so they can sign requests. We run the “retry failed webhooks” worker every 15 minutes (or whatever the scheduler is set to). To see what’s failing we look at the webhook_failures table or call getWebhookStats; we can manually retry or mark a dead one as resolved. Our status and admin pages show how many webhooks failed. We have to make sure the Stripe webhook gets the “raw” body so the signature check works—that’s set up in the main app.

### 6. Why we use it vs other methods

**Technical:** Signature verification ensures we only process webhooks that really came from Stripe or n8n (prevents forgery and replay with correct secret). Returning 200 on processing failure (and queuing for retry) stops Stripe from retrying the same event repeatedly while we fix the bug or dependency; we handle retries ourselves with backoff. webhook_failures gives us a durable retry queue and visibility (pending, dead). Idempotency (event_id + source, and stripe_events_processed in paymentService) prevents duplicate processing when we retry or Stripe redelivers. Alternatives—no signature check would be insecure; returning 5xx on processing failure would cause Stripe to retry with no backoff and could hide bugs; no retry queue would lose events when processing temporarily fails.

**Simple (like for a 10-year-old):** We check signatures so only Stripe and n8n can make us do things—nobody else can fake a “payment succeeded.” We say “OK” to Stripe even when our processing failed and put the event in our own retry list so we can try again later with longer waits, instead of Stripe hammering us. We store failed webhooks so we can see what failed and retry. We remember event ids so we don’t process the same event twice. If we didn’t check signatures someone could fake payments; if we didn’t queue for retry we’d lose events when something is temporarily broken.

### 7. Best practices

**Technical:** We verify signatures before processing (Stripe SDK constructEvent, n8n HMAC with timing-safe compare). We use raw body for Stripe so signature verification is correct (express.raw for /stripe/webhook in index.ts). We return 200 when we queue for retry so Stripe doesn’t retry (we own retry policy). We use exponential backoff (1m, 5m, 15m, 1h, 4h) and max_retries (5) so we don’t hammer failing dependencies. We dedupe queue entries by event_id + source. We fail closed for n8n in production (N8N_WEBHOOK_SECRET required). We rate limit webhook endpoints (Stripe 200/min, n8n 50/min). Gaps: we don’t verify Stripe webhook endpoint secret per-endpoint if we have multiple (we use one env var); we don’t have alerting on dead count or retry rate; cleanupOldWebhooks(30) runs in worker but no guarantee it runs if worker is down.

**Simple (like for a 10-year-old):** We always check the signature before doing anything. We keep the Stripe body “raw” so the check is correct. We tell Stripe “OK” when we’ve queued for retry so they don’t retry. We wait longer between each retry (1 min, then 5, 15, 1 hour, 4 hours) and stop after 5 tries. We don’t add the same event twice to the retry list. In production we require the n8n secret. We limit how many webhook requests we accept per minute. What we could do better: we don’t alert when the “dead” pile grows; we rely on the worker to run cleanup.

### 8. Other relevant info

**Technical:** Webhooks are critical for payments (Stripe) and automation (n8n). Stripe event processing and idempotency are in paymentService (handleStripeEvent, stripe_events_processed)—see FOUNDER_PAYMENT_FLOW.md and FOUNDER_IDEMPOTENCY.md. n8n events feed into publishEvent and then event-based notifications and job_events—see FOUNDER_EVENTS.md and FOUNDER_NOTIFICATIONS.md. webhook_failures schema and views are in DB/migrations/010_webhook_retry_queue.sql. If we add more webhook sources (e.g. Checkr) we’d add routes, signature verification if they provide it, and a case in webhookRetryService processWebhookRetry.

**Simple (like for a 10-year-old):** Webhooks matter because payments and n8n workflows depend on them. How we process Stripe events and avoid duplicates is in the payment and idempotency docs. How n8n events become internal events and notifications is in the events and notifications docs. The retry table and its indexes are in a migration. If we add another sender (e.g. background-check provider) we’d add a URL, check their signature if they have one, and add “how to retry” for that source.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The webhook system is supposed to: (1) receive Stripe and n8n webhooks securely (signature verification); (2) process them (handleStripeEvent, publishEvent) or queue for retry on failure; (3) retry failed webhooks with exponential backoff and mark dead after max_retries; (4) avoid duplicate processing (event_id in queue, stripe_events_processed in payment flow). Success means: only legitimate Stripe/n8n requests are processed; temporary failures are retried and eventually succeed or land in dead for manual review; we don’t process the same event twice.

**Simple (like for a 10-year-old):** It’s supposed to receive “payment succeeded” and other messages from Stripe and events from n8n in a safe way (only real Stripe/n8n), do the work (update payments, publish events), and if something fails put it in a retry list and try again later. Success means we only listen to real Stripe and n8n, we retry when things fail, and we never do the same webhook twice.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for Stripe webhook: signature valid, handleStripeEvent completed, res 200 { received: true }; or signature valid, handleStripeEvent threw, queued for retry, res 200 { received: true, queued_for_retry: true }. Done for n8n: signature valid, body parsed, publishEvent completed, res 204. Done for retry: processWebhookRetry ran handleStripeEvent or publishEvent, row marked succeeded; or retry_count >= max_retries, row marked dead. Observable: webhook_failures pending/dead counts low; getWebhookStats; logs stripe_webhook_queued_for_retry, webhook_retry_succeeded, webhook_retry_failed.

**Simple (like for a 10-year-old):** Success for Stripe: we checked the signature, processed the event, and said “OK”; or we couldn’t process it, put it in the retry list, and still said “OK.” Success for n8n: we checked the signature, published the event, and returned 204. Success for retry: we ran the same processing again and marked it succeeded, or we gave up and marked it dead. We can see success by “not many pending or dead” in the retry table and by logs like “queued for retry,” “retry succeeded,” “retry failed.”

### 11. What would happen if we didn't have it?

**Technical:** Without signature verification anyone could POST to /stripe/webhook or /n8n/events and fake payment success or inject events—security and data integrity would be broken. Without retry queue we’d lose webhook processing on any transient failure (DB down, dependency timeout). Without returning 200 on queue-for-retry Stripe would retry with their own backoff and we’d get duplicate delivery and no control over retry timing. Without idempotency we could double-credit or double-process on retry or redelivery.

**Simple (like for a 10-year-old):** Without checking signatures someone could pretend to be Stripe and say “payment succeeded” when it didn’t—very bad. Without a retry list we’d lose events whenever something failed for a moment. If we didn’t say “OK” to Stripe when we queue for retry they’d keep sending the same event and we’d have no control. Without remembering “we already did this event” we might add credits twice or process twice.

### 12. What is it not responsible for?

**Technical:** The webhook system is not responsible for: the business logic of handling a Stripe event (that’s paymentService.handleStripeEvent—credits, refunds, etc.); the business logic of what publishEvent does (that’s events and notifications); validating request body beyond signature and schema for n8n (eventSchema); outbound webhooks (we send to n8n from events.ts publishEvent/n8n client—that’s separate). It doesn’t decide which Stripe events we subscribe to (that’s Stripe Dashboard); it only receives what Stripe sends. It doesn’t run the retry worker on a schedule—that’s the scheduler or cron.

**Simple (like for a 10-year-old):** It doesn’t do the actual “add credits” or “refund”—that’s the payment service. It doesn’t decide what “publish event” does—that’s the events and notifications code. It doesn’t validate every field in the n8n body beyond “has eventType and optional jobId etc.” It doesn’t send webhooks to other systems—that’s different code. It doesn’t choose which Stripe events we get—we set that in Stripe’s dashboard. It doesn’t start the retry worker—the scheduler does.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For Stripe webhook: HTTP request with header stripe-signature and raw body (Buffer); env STRIPE_WEBHOOK_SECRET. For n8n: HTTP request with header x-n8n-signature and JSON body (eventType, optional jobId, actorType, actorId, payload); env N8N_WEBHOOK_SECRET. For queueWebhookForRetry: source, eventId?, eventType, payload, errorMessage, maxRetries?. For processWebhookRetries: limit (default 50). Table webhook_failures (id, source, event_id, event_type, payload, error_message, retry_count, max_retries, next_retry_at, status, created_at, updated_at). DB and logger.

**Simple (like for a 10-year-old):** For Stripe we need the request with the signature header and the raw body, and the Stripe webhook secret in config. For n8n we need the request with the signature header and a JSON body with at least eventType, and the n8n secret in config. To add a failed webhook to the retry list we need source, event id (if any), event type, the full payload, and the error message. To process retries we need how many to process (default 50). We need the webhook_failures table and the database and logger.

### 14. What does it produce or change?

**Technical:** Stripe webhook: on success—handleStripeEvent side effects (credits, refunds, etc.); res 200 { received: true }. On processing failure—row in webhook_failures (source stripe, event_id, event_type, payload, status pending), res 200 { received: true, queued_for_retry: true }. n8n webhook: publishEvent side effects (job_events, n8n forward, event-based notifications); res 204. Retry: processWebhookRetry updates webhook_failures (status processing→succeeded or pending/dead, retry_count, next_retry_at, error_message); handleStripeEvent or publishEvent side effects. cleanupOldWebhooks deletes rows (status succeeded/dead/failed and created_at older than daysOld). It doesn’t produce user-facing UI; it produces side effects (DB, external APIs) via payment and event logic.

**Simple (like for a 10-year-old):** When we process a Stripe webhook we either run the payment logic (add credits, refund, etc.) and say “OK,” or we add a row to the retry table and say “OK.” When we process an n8n webhook we publish the event (which may trigger notifications and other stuff) and return 204. When we retry we update the retry row (succeeded or next retry time or dead) and run the same payment or event logic. We delete old rows from the retry table after 30 days. The webhook system doesn’t “show” anything to the user—it just runs the payment and event code.

### 15. Who or what consumes its output?

**Technical:** Consumers of “webhook processed”: Stripe (they get 200 and stop retrying); n8n (they get 204). Consumers of handleStripeEvent output: creditsService, refund logic, payment_intents table, stripe_events_processed—see FOUNDER_PAYMENT_FLOW. Consumers of publishEvent output: job_events table, n8n forward, eventBasedNotificationService—see FOUNDER_EVENTS and FOUNDER_NOTIFICATIONS. webhook_failures is read by webhookRetry worker, getWebhookStats, getRecentFailures, status/operationalMetricsService, admin repair service; no direct “business” consumer of the table except retry and monitoring.

**Simple (like for a 10-year-old):** Stripe and n8n “consume” our response (200 or 204)—they know we got it. The real “output” is what handleStripeEvent and publishEvent do—credits, refunds, events, notifications. That’s described in the payment and events docs. The retry table is read by the retry worker and by our status and admin pages to see how many failed; nobody else uses it for business logic.

### 16. What are the main steps or flow it performs?

**Technical:** **Stripe:** (1) Read stripe-signature; if missing 400. (2) rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body)). (3) event = stripe.webhooks.constructEvent(rawBody, sig, secret); on throw 400. (4) handleStripeEvent(event); on throw queueWebhookForRetry({ source:'stripe', eventId: event.id, eventType, payload: event, errorMessage }), res 200 { received: true, queued_for_retry: true }; on success res 200 { received: true }. **n8n:** (1) verifyN8nSignature (secret, x-n8n-signature, body); if invalid 401. (2) eventSchema.parse(req.body). (3) publishEvent(...). (4) res 204. **queueWebhookForRetry:** (1) If eventId, SELECT webhook_failures WHERE event_id AND source; if row return it. (2) INSERT webhook_failures (source, event_id, event_type, payload, error_message, max_retries, next_retry_at, status='pending'). **processWebhookRetries:** (1) getPendingWebhooks(limit). (2) For each: markAsProcessing; if stripe handleStripeEvent(payload); if n8n publishEvent(...); markAsSucceeded or markAsFailed (backoff or dead).

**Simple (like for a 10-year-old):** For Stripe we get the signature and body, check the signature with the Stripe library, then run the payment handler; if that fails we add the event to the retry list and still say OK. For n8n we check the signature, parse the body, publish the event, and return 204. To add to retry we check we don’t already have this event, then insert a row. To process retries we get pending rows that are due, run the same Stripe or n8n logic for each, and mark them succeeded or schedule next retry or dead.

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) Stripe webhook must have stripe-signature and valid constructEvent (raw body + secret); (2) n8n must have x-n8n-signature and HMAC-SHA256(secret, body) timing-safe match; (3) n8n body must match eventSchema (eventType required, jobId/actorType/actorId/payload optional); (4) in production N8N_WEBHOOK_SECRET must be set (fail closed); (5) rate limits (Stripe 200/min, n8n 50/min). We don’t enforce: which Stripe event types we handle (handleStripeEvent may ignore unknown types); or that retry worker runs (scheduler responsibility).

**Simple (like for a 10-year-old):** We enforce: Stripe requests must have a valid signature; n8n requests must have the right signature and a body with at least eventType. In production we require the n8n secret. We limit how many webhook requests we accept per minute. We don’t enforce “we must handle every Stripe event type” (we might ignore some) or “the retry worker must run” (that’s the scheduler’s job).

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Stripe webhook is triggered by Stripe’s servers when events occur (payment_intent.succeeded, charge.refunded, etc.)—we don’t poll. n8n webhooks are triggered when n8n workflows call our URL (e.g. after a step in a workflow). Webhook retry is triggered by the webhookRetry worker run (e.g. every 15 min via scheduler or cron). There is no HTTP endpoint that “triggers” retry—only the worker. Raw body middleware in index.ts runs for every request and branches on req.path === "/stripe/webhook".

**Simple (like for a 10-year-old):** Stripe triggers us when something happens (payment succeeded, refund, etc.)—they push to our URL. n8n triggers us when a workflow step calls our URL. The retry worker is triggered by the scheduler (e.g. every 15 minutes). Nothing on the website “triggers” webhooks—Stripe and n8n do. The “use raw body for Stripe” check runs for every request and only applies raw parsing when the path is the Stripe webhook path.

### 19. What could go wrong while doing its job?

**Technical:** (1) Signature verification fails—wrong secret, body modified, or raw body not preserved (e.g. Express parsed JSON so rawBody is wrong); we return 400/401. (2) handleStripeEvent throws—we queue for retry and return 200; if queueWebhookForRetry throws we log stripe_webhook_queue_failed and still return 200 (Stripe won’t retry but we might lose the event unless we add manual retry). (3) publishEvent throws—n8n gets 500; they may retry; we don’t queue n8n inbound to webhook_failures (only Stripe queue on our side). (4) Retry worker down—pending webhooks sit until worker runs. (5) handleStripeEvent idempotency (stripe_events_processed) prevents double process on retry; if event_id missing we could queue duplicate rows (we check event_id+source before insert). (6) STRIPE_WEBHOOK_SECRET or N8N_WEBHOOK_SECRET wrong—all webhooks fail verification.

**Simple (like for a 10-year-old):** Things that can go wrong: the signature is wrong (bad secret or tampered body)—we return 400 or 401. Our payment handler fails—we put the event in the retry list and say OK; if adding to the retry list fails we still say OK but we might have lost the event. If publishing the n8n event fails we return 500 and n8n might retry; we don’t put n8n requests in our retry table. If the retry worker isn’t running, pending items sit there. We avoid processing the same Stripe event twice by checking event id; if we didn’t have an event id we could add the same event to the retry list twice. If the webhook secrets are wrong, every webhook fails.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) logs—stripe_webhook_no_signature, stripe_webhook_signature_verification_failed, stripe_webhook_processing_failed, stripe_webhook_queued_for_retry, webhook_retry_succeeded, webhook_retry_failed, n8n_event_received, n8n_event_failed; (2) webhook_failures table—pending, dead counts; getWebhookStats(); (3) operationalMetricsService webhook failure rate (last 1h); status endpoint “failed webhooks in last 24h”; admin repair pending count. We don’t have a single “webhook health” metric in this module; we rely on payment and event flows succeeding. Tests: stripe webhook signature validation, idempotent processing; n8n invalid/valid signature.

**Simple (like for a 10-year-old):** We know it’s working when we see logs like “webhook queued for retry,” “retry succeeded,” “retry failed,” “n8n event received.” We look at the webhook_failures table (how many pending, how many dead) and at our status and admin pages. We don’t have one “webhook health” number—we rely on payments and events actually succeeding. We have tests that check Stripe signature and idempotency and n8n signature.

### 21. What does it depend on to do its job?

**Technical:** Stripe webhook depends on: stripe SDK (constructEvent), env STRIPE_WEBHOOK_SECRET, raw body (index.ts express.raw for path), paymentService.handleStripeEvent, webhookRetryService.queueWebhookForRetry, db/client, logger. n8n depends on: env N8N_WEBHOOK_SECRET, crypto (HMAC), auth.verifyN8nSignature, events.publishEvent, logger. webhookRetryService depends on: db/client, paymentService.handleStripeEvent, events.publishEvent (dynamic import for n8n retry), logger. webhook_failures table (010_webhook_retry_queue.sql).

**Simple (like for a 10-year-old):** The Stripe webhook needs the Stripe library, the webhook secret in config, the raw body (set up in the main app), the payment handler, the retry service, the database, and the logger. The n8n webhook needs the n8n secret, crypto for the signature, the auth check, the publishEvent function, and the logger. The retry service needs the database, the payment handler, the event publisher (for n8n retries), and the logger. We need the webhook_failures table in the database.

### 22. What are the main config or env vars that control its behavior?

**Technical:** STRIPE_WEBHOOK_SECRET—required for Stripe signature verification; getStripeWebhookSecret() returns it; if wrong all Stripe webhooks fail with 400. N8N_WEBHOOK_SECRET—required in production for n8n (verifyN8nSignature fails closed); in dev we allow missing (next()). Rate limits: in security.ts endpointRateLimiter (Stripe /stripe/webhook 200/min, n8n /n8n/events 50/min). Retry: RETRY_INTERVALS and max_retries (5) in webhookRetryService (code constants); cleanupOldWebhooks(30) in worker. No feature flags in webhook routes.

**Simple (like for a 10-year-old):** The main settings are: Stripe webhook secret (required for Stripe to work), n8n webhook secret (required in production for n8n). We limit Stripe to 200 requests per minute and n8n to 50 per minute. Retry waits (1m, 5m, 15m, 1h, 4h) and max 5 retries are set in code. We delete old retry rows after 30 days. There are no feature flags for webhooks.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: Stripe webhook—missing signature 400, invalid signature 400, valid signature + handleStripeEvent success 200, valid signature + handleStripeEvent throw → queue for retry and 200; idempotent processing (same event id skips). n8n—invalid/missing signature 401, valid signature + publishEvent success 204. webhookRetryService—queueWebhookForRetry idempotency (event_id+source), processWebhookRetry stripe/n8n path. We mock Stripe constructEvent, handleStripeEvent, publishEvent, or use test DB. Smoke tests: events.test.ts reject invalid webhook secret, accept valid signature.

**Simple (like for a 10-year-old):** We have tests that check: Stripe with no or bad signature returns 400; Stripe with good signature and successful processing returns 200; Stripe with good signature but processing failure queues for retry and still returns 200; same Stripe event id doesn’t get processed twice. n8n with bad signature returns 401; n8n with good signature returns 204. We test that adding the same event to retry doesn’t duplicate and that retry runs the right handler for Stripe vs n8n. We use mocks or a test database.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If signature verification fails: fix STRIPE_WEBHOOK_SECRET or N8N_WEBHOOK_SECRET (Stripe Dashboard / n8n config), ensure raw body for Stripe (index.ts path). If handleStripeEvent fails and we queued for retry: webhookRetry worker will retry; if worker was down run it manually or fix scheduler; if event stays dead use retryWebhook(id) or markAsResolved(id) after manual fix. If we lost an event (queueWebhookForRetry threw): we can’t recover from our side; Stripe may have redelivered (check Stripe Dashboard); or manually trigger equivalent action. If webhook_failures table is full or slow: cleanupOldWebhooks(30) (worker does this); increase frequency or reduce daysOld. If n8n 500 on publishEvent: n8n may retry; we don’t queue inbound n8n to webhook_failures—consider adding if we need retry for n8n.

**Simple (like for a 10-year-old):** If signatures fail we fix the secret in config and make sure the Stripe webhook gets the raw body. If we queued a failed Stripe event for retry the worker will try again; if the worker wasn’t running we run it or fix the schedule; if it’s still dead we can manually retry or mark resolved after fixing the cause. If we failed to add to the retry list we might have lost the event—check Stripe’s dashboard to see if they redelivered. We clean up old retry rows so the table doesn’t grow forever. If n8n gets 500 we don’t currently put those in our retry table—n8n might retry on their side.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: product and finance (payments depend on Stripe webhooks); engineering (reliability of payments and events); ops (run retry worker, monitor webhook_failures); support (when “payment didn’t show up” we check webhooks and retry). n8n operators care that n8n webhooks are accepted and events flow. Admins care about dead webhook count and repair flows.

**Simple (like for a 10-year-old):** People who care: the team that cares about payments (Stripe webhooks), engineers who keep the system working, ops who run the retry worker and watch the retry table, and support when a customer says “my payment didn’t go through.” The people who use n8n care that our URL works. Admins care about how many webhooks are dead and how to fix them.

### 26. What are the security or privacy considerations for what it does?

**Technical:** STRIPE_WEBHOOK_SECRET and N8N_WEBHOOK_SECRET must be kept secret; if leaked anyone could forge webhooks (Stripe: fake payment_intent.succeeded; n8n: inject events). We use timing-safe compare for n8n to prevent timing attacks. Raw body for Stripe must not be modified before constructEvent (Express must not parse JSON for that path). webhook_failures payload is JSONB and may contain PII (e.g. Stripe event with customer email); access to table should be restricted. We don’t log full payload in production (log redaction may cover webhook_secret). Rate limiting reduces DoS and brute-force on endpoints.

**Simple (like for a 10-year-old):** The webhook secrets must stay secret—if someone gets them they could fake “payment succeeded” or inject events. We use a safe comparison for the n8n signature so timing doesn’t leak info. We have to keep the Stripe body “raw” so the signature check is right. The retry table can have private data in the payload—only trusted people should see it. We don’t log secrets. We limit how many requests we accept so someone can’t overwhelm us.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** Rate limits: Stripe 200/min, n8n 50/min—if Stripe sends more we 429; we may need to raise or per-endpoint. Raw body for Stripe is 500kb limit (index.ts express.raw); large events could hit that. webhook_failures grows with failed events; cleanupOldWebhooks(30) deletes old succeeded/dead/failed; pending rows stay until processed. processWebhookRetries(50) per run—if pending >> 50 we need more runs or higher limit. Single worker run processes sequentially; we don’t parallelize retries in one run. Stripe and n8n call us—we don’t control their throughput; we only respond.

**Simple (like for a 10-year-old):** We accept at most 200 Stripe webhooks and 50 n8n webhooks per minute—if there are more we reject. The Stripe body can be up to 500kb. The retry table can get big; we delete old rows after 30 days. We process 50 retries per worker run; if there are many more we need to run more often or process more per run. We process retries one after another in a single run. We don’t control how often Stripe or n8n call us—we just respond.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add alerting on webhook_failures dead count or retry rate. We’d consider queuing failed n8n inbound to webhook_failures so we can retry (currently we return 500 and don’t queue). We’d document runbook for “Stripe webhook signature failing” (check secret, raw body, path). We’d ensure index.ts path for raw body matches mounted route (e.g. /api/stripe/webhook if app is mounted at /api). We’d add metrics (webhooks received, signature failures, queued for retry, retry succeeded/failed). We’d consider idempotency key for n8n if they can send duplicate events.

**Simple (like for a 10-year-old):** We’d alert when the dead pile grows or when retries are failing a lot. We might add failed n8n requests to our retry list too (right now we don’t). We’d write down what to do when Stripe signature fails (check secret and raw body). We’d make sure the “raw body” path matches where the route actually is. We’d add numbers (how many webhooks we got, how many failed verification, how many we queued, how many retries succeeded). We might track n8n event ids so we don’t process the same n8n event twice if they retry.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per Stripe event: (1) Stripe POSTs to /stripe/webhook. (2) We verify signature; if invalid we return 400 and stop. (3) We call handleStripeEvent; if success we return 200 and we’re done. (4) If handleStripeEvent throws we queueWebhookForRetry (insert webhook_failures pending, next_retry_at in 1m) and return 200. (5) Retry worker later: mark processing, handleStripeEvent again; mark succeeded or update next_retry_at (backoff) or dead. (6) cleanupOldWebhooks deletes old succeeded/dead/failed rows. n8n: request → verify → publishEvent → 204 (no retry queue for inbound n8n). No TTL on pending webhook_failures—they stay until processed or marked dead or cleaned (succeeded/dead after 30 days).

**Simple (like for a 10-year-old):** For each Stripe event: Stripe sends it, we check the signature, we process it or add it to the retry list and say OK. Later the retry worker picks it up, tries again, and marks it succeeded or schedules the next try or marks it dead. We delete old rows after 30 days. For n8n we check the signature, publish the event, return 204—we don’t put n8n requests in our retry table. Pending retries don’t expire by themselves—they sit until the worker processes them or they go dead.

### 30. What state does it keep or track?

**Technical:** Persistent state: webhook_failures (id, source, event_id, event_type, payload, error_message, retry_count, max_retries, next_retry_at, status, created_at, updated_at). Status: pending, processing, succeeded, failed, dead. We don’t store “successfully processed webhooks” long-term—paymentService stores stripe_events_processed for idempotency; job_events stores event data. No in-memory webhook state in this module beyond the current request.

**Simple (like for a 10-year-old):** We keep the webhook_failures table: who sent it, event id, type, full payload, error message, retry count, max retries, when to retry next, status, and timestamps. Status can be pending, processing, succeeded, failed, or dead. We don’t keep a long-term list of “webhooks we processed successfully”—the payment system remembers Stripe event ids so we don’t double process, and events go to job_events. We don’t keep any webhook state in memory between requests.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) Stripe sends correct stripe-signature and we have raw body (Express didn’t parse it for /stripe/webhook); (2) STRIPE_WEBHOOK_SECRET matches Stripe Dashboard signing secret; (3) n8n sends x-n8n-signature = HMAC-SHA256(N8N_WEBHOOK_SECRET, JSON.stringify(body)) and body is JSON; (4) handleStripeEvent is idempotent for same event id (stripe_events_processed); (5) publishEvent is safe to call (events lib and downstream can handle it); (6) webhook_failures table exists and has expected schema; (7) retry worker runs on a schedule. We don’t assume: Stripe or n8n won’t retry (we return 200 when we queue; n8n may retry on 500); or that payload schema never changes.

**Simple (like for a 10-year-old):** We assume Stripe sends a valid signature and we have the raw body for Stripe. We assume our Stripe secret matches what Stripe has. We assume n8n sends the right signature and a JSON body. We assume processing the same Stripe event twice is safe (we prevent it with event id). We assume publishEvent and the payment handler can be called. We assume the retry table exists and the retry worker runs on a schedule. We don’t assume they won’t retry—we’re built for that.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use the Stripe webhook route for client-initiated requests—it’s for Stripe only; use requireAuth and payment routes for clients. Don’t use n8n webhook routes for unauthenticated public event submission without signature—use verifyN8nSignature. Don’t skip signature verification in production. Use something else when: you need to poll Stripe (e.g. sync state)—use Stripe API; or you need to send data to n8n (outbound)—use n8n client or HTTP to their webhook URL. Don’t return 5xx from Stripe webhook when you’ve queued for retry (Stripe will retry; we want to own retry).

**Simple (like for a 10-year-old):** Don’t use the Stripe webhook URL for normal user requests—it’s only for Stripe. Don’t accept n8n events without checking the signature. Don’t turn off signature checking in production. Use something else when we need to “ask” Stripe for data (use their API) or when we need to “send” something to n8n (we call their URL). Don’t return “server error” to Stripe when we’ve put the event in the retry list—we say OK so they don’t retry.

### 33. How does it interact with other systems or features?

**Technical:** Stripe webhook calls paymentService.handleStripeEvent (payment flow, credits, refunds, stripe_events_processed)—see FOUNDER_PAYMENT_FLOW. n8n webhooks call publishEvent (events lib)—see FOUNDER_EVENTS; downstream job_events, n8n forward, eventBasedNotificationService. webhookRetryService calls handleStripeEvent and publishEvent on retry. Index.ts applies raw body only for /stripe/webhook before other body middleware. Rate limiting (security.ts) applies to webhook routes. CORS allows x-n8n-signature header. Log redaction may redact webhook_secret. operationalMetricsService and status/ admin read webhook_failures for metrics and repair.

**Simple (like for a 10-year-old):** The Stripe webhook calls the payment handler (credits, refunds, etc.)—that’s the payment flow. The n8n webhook calls “publish event,” which feeds into events and notifications. The retry service calls the same payment handler and publishEvent when it retries. The main app makes sure the Stripe webhook gets the raw body. Rate limiting and CORS apply to these routes. Our status and admin pages look at the retry table for numbers and repair.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) Signature verification failed—we return 400 (Stripe) or 401 (n8n) with code WEBHOOK_SIGNATURE_VERIFICATION_FAILED / MISSING_SIGNATURE / INVALID_SIGNATURE. (2) handleStripeEvent threw—we queue for retry and return 200 { received: true, queued_for_retry: true }; we don’t signal “processing failed” to Stripe. (3) queueWebhookForRetry threw—we log stripe_webhook_queue_failed, return 200 anyway (Stripe won’t retry; we may have lost event). (4) publishEvent threw—we return 500 to n8n (n8n_event_failed); n8n may retry. (5) Retry processWebhookRetry failed—we mark row failed/dead, log webhook_retry_failed. We don’t have a user-facing “webhook failure” message; Stripe and n8n see HTTP status and body.

**Simple (like for a 10-year-old):** Failure means: the signature was wrong—we return 400 or 401 and say so. Or our payment handler failed—we put the event in the retry list and still say OK to Stripe (we don’t tell them “failed”). Or we failed to add to the retry list—we log it and still say OK (we might have lost the event). Or publishing the n8n event failed—we return 500 to n8n so they might retry. Or a retry failed—we update the row and log it. We don’t show a “webhook failed” message to users—only Stripe and n8n see our response.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust Stripe constructEvent and our HMAC for n8n; we trust handleStripeEvent and publishEvent to do the right thing (payment flow and events have their own validation). Completeness: we can check webhook_failures (pending should drain; dead should be small); getWebhookStats; operationalMetricsService webhook failure rate; payment and event flows succeeding (credits added, events stored). We don’t have an automated “every Stripe event was processed or queued” check; we rely on Stripe not retrying after 200 and our retry worker processing the queue.

**Simple (like for a 10-year-old):** We trust the signature checks and the payment and event handlers. To see if we’re keeping up we look at the retry table (pending should go down, dead shouldn’t grow too much) and at our webhook failure rate and at whether payments and events are actually working. We don’t have an automatic “every webhook was handled” check—we rely on saying OK to Stripe and our retry worker doing its job.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. Typically the backend or platform team owns webhook routes and webhookRetryService. Payment team cares about Stripe webhook correctness; automation/ops may care about n8n. Changes to signature verification, retry policy, or webhook_failures schema should be documented and coordinated (e.g. STRIPE_WEBHOOK_SECRET rotation, adding new webhook source).

**Simple (like for a 10-year-old):** The team that owns the backend (or platform) usually owns the webhook code and the retry service. The payment team cares that Stripe webhooks work; ops might care about n8n. When we change how we verify signatures, how we retry, or the retry table we should write it down and coordinate (e.g. when we change the Stripe secret).

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) alerting on webhook_failures dead count and retry rate; (2) queue failed n8n inbound to webhook_failures for retry; (3) runbook for signature failures and secret rotation; (4) metrics (received, signature_fail, queued, retry_succeeded/failed); (5) multiple Stripe webhook endpoints (e.g. Connect) with different secrets; (6) idempotency for n8n (event_id or dedupe key) if they send duplicates; (7) ensure raw body path matches mounted route in all environments. As we add more webhook sources (Checkr, etc.) we’d add routes, verification, and retry cases.

**Simple (like for a 10-year-old):** As we grow we might add alerts when the dead pile grows or retries are failing. We might add n8n to the retry list. We’d write runbooks for “signature failed” and “rotate secret.” We’d add dashboards for webhook volume and failures. We might have more than one Stripe webhook URL with different secrets. We might track n8n event ids so we don’t process duplicates. We’d make sure the “raw body” setup works in every environment. When we add new senders (e.g. background checks) we’d add their URL, check their signature, and add retry logic for them.

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: no separate webhook infra; we use the same app and DB. Stripe and n8n call us—we pay for compute and DB for request handling and webhook_failures storage. Retry worker runs on a schedule (same pool as other workers). Under high webhook volume we pay for more requests and more rows in webhook_failures until cleanup. Signature verification is cheap (HMAC, Stripe SDK parse). handleStripeEvent and publishEvent cost depends on payment and event logic.

**Simple (like for a 10-year-old):** We use the same server and database as the rest of the app—we don’t pay for a separate webhook system. We pay for the work of handling each request and for storing failed webhooks until we clean them up. The retry worker runs with our other workers. Checking signatures is cheap; the real cost is whatever the payment and event code do.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Stripe: we return 200 after queueing for retry so Stripe typically won’t resend the same event; if they do, handleStripeEvent checks stripe_events_processed (paymentService) and skips duplicate—so replay is safe. Retry worker calls handleStripeEvent again with same payload—idempotency in payment flow prevents double credit/refund. webhook_failures: we check event_id+source before insert so we don’t queue the same event twice. n8n: we don’t queue inbound failures; if n8n retries we might publishEvent twice—publishEvent/job_events may be idempotent by event shape or we accept duplicate events; document if we need n8n dedupe.

**Simple (like for a 10-year-old):** For Stripe we say OK when we queue for retry so they usually don’t send again; if they do, we check “already processed” and don’t do it twice. When we retry we run the same handler again and the payment flow prevents double credit. We don’t add the same event to the retry list twice (we check event id + source). For n8n we don’t put failures in our retry list; if n8n sends the same event again we might publish twice—we might need to add “remember this n8n event” if that’s a problem.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during queueWebhookForRetry: we throw; stripe route catches and logs stripe_webhook_queue_failed, still returns 200—Stripe won’t retry, we may lose the event. If DB fails during processWebhookRetries: worker throws, logs webhook_retry_worker_failed; next run will retry. If handleStripeEvent fails (e.g. Stripe API or our DB): we queue for retry and return 200; retry worker will call handleStripeEvent again later. If publishEvent fails (e.g. DB or n8n client): we return 500 to n8n; we don’t queue n8n inbound. We don’t retry DB in webhook route; we rely on retry worker for Stripe.

**Simple (like for a 10-year-old):** If the database fails when we’re adding to the retry list we log it and still say OK to Stripe—so we might lose that event. If the database fails during the retry worker the worker crashes and we’ll try again next run. If the payment handler fails we put the event in the retry list and say OK; the retry worker will try again later. If publishing the n8n event fails we return 500 to n8n and we don’t put it in our retry list. We don’t retry the database in the webhook route—we depend on the retry worker for Stripe.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Stripe and n8n invoke the webhook endpoints (they need the URL and, for n8n, the secret to sign). No auth on Stripe webhook—verification is by signature only. n8n same—no user auth, only signature. Configuration: STRIPE_WEBHOOK_SECRET and N8N_WEBHOOK_SECRET are env—whoever manages deployment (ops, CI/CD) sets them. Rate limits are in code (security.ts). Retry worker is run by scheduler/cron (ops). getWebhookStats, retryWebhook, markAsResolved are backend/admin—no public route unless we add admin API.

**Simple (like for a 10-year-old):** Only Stripe and n8n “invoke” the webhooks—they need our URL and (for n8n) the secret to sign. We don’t require login for these URLs—we only check the signature. Only people who can change the server’s config can set the webhook secrets and rate limits. The retry worker is run by the scheduler (ops). Looking at retry stats and manually retrying or resolving is backend/admin only unless we add an admin page.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_PAYMENT_FLOW.md`, `FOUNDER_EVENTS.md`, `FOUNDER_NOTIFICATIONS.md`, `FOUNDER_IDEMPOTENCY.md`, `FOUNDER_AUTH.md` (verifyN8nSignature), `DB/migrations/010_webhook_retry_queue.sql`.
