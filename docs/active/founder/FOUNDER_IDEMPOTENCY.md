# Founder Reference: Idempotency

**Candidate:** Idempotency (System #3)  
**Where it lives:** `src/lib/idempotency.ts`, payment flows, webhook handlers, queue jobs, `idempotency_keys` table  
**Why document:** Prevents double charges and duplicate side effects; explain keys, storage, and where we use them (payments, Stripe webhooks, queue).

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Idempotency in PureTask is the set of mechanisms that ensure mutating operations can be safely retried or replayed without duplicating side effects. It consists of: (1) **API idempotency**—`src/lib/idempotency.ts` middleware that reads the `Idempotency-Key` header, looks up the key in `idempotency_keys` (idempotency_key, endpoint, method, status_code, response_body, created_at), and if found returns the stored response without running the handler; if not found it runs the handler and stores the response (status + body) for that key; (2) **Stripe webhook idempotency**—`stripe_events_processed` (stripe_event_id) and `payment_intents.processed_success` so we don’t process the same Stripe event or payment intent twice; (3) **Notification idempotency**—dedupe keys and `notification_log` (payload->>'dedupeKey', status) so we don’t send the same notification twice; (4) **Credit ledger idempotency**—`addLedgerEntry` for reasons purchase, job_escrow, job_release, refund checks (user_id, job_id, reason) and returns existing row if present; (5) **Payout idempotency**—Stripe transfer idempotency key (payout_${cleanerId}_${date}_${payoutIds}) so we don’t double-send. Keys are client-provided (API) or derived (webhooks, ledger, payouts).

**Simple (like for a 10-year-old):** Idempotency means “doing the same thing twice doesn’t change the result twice.” We use it so that if someone double-clicks “pay” or if Stripe sends us “payment succeeded” twice, we don’t charge twice or add credits twice. We do that by: (1) remembering “we already handled this key” for API requests (payments, create job, tracking) and returning the same answer; (2) remembering “we already processed this Stripe event” and “we already processed this payment”; (3) remembering “we already sent this notification”; (4) not adding the same “purchase” or “escrow” twice for the same user and job; (5) not sending the same payout transfer twice. So idempotency is “remember this key and don’t do the action again.”

### 2. Where it is used

**Technical:** API idempotency is implemented in `src/lib/idempotency.ts` (requireIdempotency, optionalIdempotency, getIdempotencyResult, storeIdempotencyResult) and the `idempotency_keys` table (DB/migrations/039_idempotency_keys.sql). It is applied on: POST /payments/credits (requireIdempotency), job creation (POST jobs with requireIdempotency), and tracking (POST with requireIdempotency). Stripe idempotency is in paymentService (stripe_events_processed, payment_intents.processed_success, stripe_object_processed). Notification idempotency is in notificationService (alreadySent(dedupeKey) against notification_log). Credit idempotency is in creditsService.addLedgerEntry (check existing user_id, job_id, reason for purchase, job_escrow, job_release, refund). Payout idempotency is in payoutsService (Stripe transfers.create idempotencyKey). No dedicated “idempotency service”; each flow has its own storage and key shape.

**Simple (like for a 10-year-old):** The “remember this key” code lives in one file (idempotency.ts) and one table (idempotency_keys). We use it on “buy credits,” “create job,” and some tracking endpoints so the client can send a key and we return the same answer if they send the same key again. Stripe “already processed” is in the payment service and its tables. “Already sent this notification” is in the notification service and the notification log. “Already added this purchase/escrow” is in the credits service. “Already sent this payout” is in the payout service with Stripe’s idempotency key. So idempotency is used in several places, each with its own way of remembering.

### 3. When we use it

**Technical:** We use API idempotency when the client sends an `Idempotency-Key` header on POST /payments/credits, POST (create job), or POST tracking; the middleware runs before the handler and either returns a cached response or lets the request through and then caches the response. We use Stripe idempotency when we receive a webhook (payment_intent.succeeded, etc.); we insert into stripe_events_processed and skip if the event was already processed. We use notification idempotency when sendNotification is called with a dedupeKey; we check notification_log and skip if already sent. We use credit idempotency when addLedgerEntry is called with reason purchase, job_escrow, job_release, or refund and a jobId; we check for an existing row and return it if present. We use payout idempotency when processPendingPayouts calls stripe.transfers.create with an idempotencyKey. There is no fixed schedule; each use is triggered by the same request or event that would perform the action.

**Simple (like for a 10-year-old):** We use it whenever the client sends a “key” with a payment or job or tracking request—we check “did we already handle this key?” and if yes we return the old answer. We use it when Stripe sends us an event—we check “did we already process this event?” and if yes we skip. We use it when we’re about to send a notification—we check “did we already send this dedupe key?” and if yes we skip. We use it when we’re about to add a purchase or escrow to the ledger—we check “do we already have this user, job, reason?” and if yes we don’t add again. We use it when we send a payout transfer—we tell Stripe an idempotency key so they don’t send twice. So we use it at the moment we’re about to do something that must not happen twice.

### 4. How it is used

**Technical:** **API:** Client sends header `Idempotency-Key: <key>` (alphanumeric, dashes, underscores, max 255 chars). requireIdempotency middleware: if no key, next(); if invalid format, 400; getIdempotencyResult(key)—if existing, res.status(existing.status_code).json(existing.response_body) and return; else patch res.json so that when the handler calls res.json(body), we first storeIdempotencyResult(key, req.path, req.method, res.statusCode, body) then send; next(). storeIdempotencyResult INSERT idempotency_keys ON CONFLICT DO NOTHING (so first response wins; we don’t overwrite). **Stripe:** INSERT stripe_events_processed (stripe_event_id, ...) ON CONFLICT DO NOTHING RETURNING id; no row → already processed, return; else process and mark. **Notifications:** alreadySent(dedupeKey) SELECT from notification_log WHERE payload->>'dedupeKey' = key AND status = 'sent'; if row, skip send. **Credits:** addLedgerEntry for idempotent reasons: SELECT existing (user_id, job_id, reason); if row, return it; else INSERT. **Payouts:** stripe.transfers.create(..., { idempotencyKey }) so Stripe dedupes.

**Simple (like for a 10-year-old):** For API: the client sends a key in the header. We look up “did we already have this key?” If yes we return the same status and body we saved before. If no we run the handler and when it sends the response we save that status and body under the key (we don’t overwrite if the key already exists—first response wins). For Stripe we save the event id and only process if we’re the first to save it. For notifications we check “did we already send this dedupe key?” and skip if yes. For credits we check “do we already have this user, job, reason?” and return the existing row if yes. For payouts we give Stripe a key so they don’t send the same transfer twice.

### 5. How we use it (practical)

**Technical:** In day-to-day: frontend generates a unique idempotency key per “logical” action (e.g. one per “buy credits” click or one per “create job” submit) and sends it in the Idempotency-Key header for POST /payments/credits, POST jobs, and POST tracking. Keys are typically UUIDs or `${action}-${userId}-${timestamp}`. We don’t require the key on those routes (requireIdempotency allows missing key and proceeds); if the client doesn’t send a key, we don’t dedupe. Stripe and notification and credit idempotency are automatic (we don’t expose keys to clients). idempotency_keys table can grow; we have cleanup_old_idempotency_keys() (delete where created_at < now() - 24 hours)—comment says keys valid 24 hours. We don’t run the cleanup on a visible schedule in the codebase; it’s a SQL function. To debug: query idempotency_keys by key or endpoint; check stripe_events_processed, notification_log, credit_ledger for duplicates.

**Simple (like for a 10-year-old):** In practice the app makes up a unique key for each “pay” or “create job” or “track” action and sends it in the header. If they send the same key again (e.g. double-click) we return the same answer and don’t do the action again. We don’t force the client to send a key—if they don’t, we don’t dedupe. Stripe, notifications, and credits are deduped automatically with our own keys. We can delete old API idempotency keys after 24 hours so the table doesn’t grow forever. To see what happened we look at the idempotency_keys table and the other “already processed” tables.

### 6. Why we use it vs other methods

**Technical:** Idempotency prevents double charges (payment, job creation), duplicate notifications, duplicate ledger entries, and duplicate Stripe transfers. Without it, retries (client or network) or webhook replays would cause duplicate side effects. We use a mix of: (1) client-provided keys for API (so the client controls “same logical request”); (2) event/object IDs for Stripe (so we dedupe by Stripe’s id); (3) dedupe keys for notifications (type, channel, user, job, timestamp bucket); (4) (user_id, job_id, reason) for ledger (so we dedupe by business meaning); (5) derived keys for payouts (cleaner, date, payout ids). Alternatives—no idempotency—would require “never retry” or “exactly-once delivery” which we don’t have; or “manual fix duplicates” which doesn’t scale.

**Simple (like for a 10-year-old):** We use it so that if someone clicks “pay” twice or if Stripe sends us “succeeded” twice, we don’t charge twice or add credits twice. Without it, every retry or duplicate message could double-charge or double-send. We use different “keys” in different places: the client sends a key for payments and jobs; we use Stripe’s event id for Stripe; we use a “dedupe key” for notifications; we use “user, job, reason” for the ledger; we use a derived key for payouts. If we didn’t have idempotency we’d have to never retry or fix duplicates by hand—neither is good.

### 7. Best practices

**Technical:** We use a single middleware (requireIdempotency) for API idempotency so behavior is consistent. We validate key format (alphanumeric, dashes, underscores, max 255) to avoid injection and huge keys. We store full response (status + body) so replay returns the same shape. We use ON CONFLICT DO NOTHING when storing so the first response wins (we don’t overwrite on concurrent requests with same key—second request would run the handler again and try to store but get no row; we don’t currently prevent the second handler from running, we only skip when we find an existing result before the handler). Actually re-reading the code: we only run the handler if getIdempotencyResult returns null; so the first request runs and stores; the second request finds existing and returns it without running the handler. So we’re good. We fail open on getIdempotencyResult or storeIdempotencyResult errors (log and proceed) so a DB blip doesn’t block requests. Gaps: we don’t expire keys in the middleware (we rely on cleanup job); we don’t have a max key lifetime check when looking up; concurrent requests with same key could both get “null” and both run the handler (race)—we don’t have “insert key then run” to lock.

**Simple (like for a 10-year-old):** We have one way to do API idempotency (the middleware) so behavior is the same everywhere. We only allow safe key characters and length. We save the full response so when we replay we return the same thing. If the DB fails when we check or save we don’t block the request—we log and continue (fail open). What we could do better: we don’t check “key too old” when looking up; if two requests with the same key arrive at the same time both might run the handler (race)—we could “reserve” the key first then run to avoid that.

### 8. Other relevant info

**Technical:** Idempotency is critical for payments and jobs—double charge or double job would harm users and trust. Other idempotency mechanisms (Stripe, notification, credit, payout) are documented in their respective founder docs (FOUNDER_PAYMENT_FLOW, FOUNDER_NOTIFICATIONS, creditsService, FOUNDER_PAYOUT_FLOW). The idempotency_keys table has a 24-hour comment and cleanup_old_idempotency_keys(); we don’t enforce 24-hour validity on read (we return any cached result). So a key from 30 days ago would still return the cached response if not cleaned. Document key shape and lifetime in DECISIONS.md if we change them.

**Simple (like for a 10-year-old):** Idempotency really matters for payments and jobs—we must not charge or create a job twice. The other “don’t do twice” mechanisms (Stripe, notifications, credits, payouts) are described in their own docs. We say API keys are “valid 24 hours” and we have a cleanup that deletes old keys, but we don’t refuse to use an old key if it’s still in the table—so in theory an old key could still return a cached response until cleanup runs. We should write down any change to key format or lifetime.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Idempotency is supposed to ensure that mutating operations (create payment intent, create job, record tracking, process Stripe event, send notification, add credit entry, send payout) can be safely retried or replayed without duplicating side effects. Success means: for a given idempotency key (or event id or dedupe key or (user, job, reason)), we execute the operation at most once and return or store the same result on replay.

**Simple (like for a 10-year-old):** It’s supposed to make sure that “do this once” really means once—if we get the same request or event again we don’t do it again, we just say “we already did it” or return the same answer. Success means we never charge twice, create two jobs, send two notifications, add credits twice, or send two payout transfers for the same logical thing.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for API idempotency: first request with key K runs handler and we store (K, endpoint, method, status_code, response_body); second request with K finds existing and returns that response without running the handler. Done for Stripe: first delivery of event E inserts into stripe_events_processed and we process; second delivery finds conflict and skips. Done for notification: first send with dedupeKey D logs to notification_log with status sent; second send with D finds alreadySent and skips. Done for credit: first addLedgerEntry(user, job, reason) inserts row; second returns existing row. Done for payout: first transfer with idempotencyKey creates transfer; Stripe rejects duplicate key with same response. Observable: no duplicate rows or side effects for the same key.

**Simple (like for a 10-year-old):** Success for API: first time we see key K we run the handler and save the response; second time we see K we don’t run the handler and we return the saved response. Success for Stripe: we process each event id once. Success for notifications: we send each dedupe key once. Success for credits: we add each (user, job, reason) once. Success for payouts: we send each transfer key once. You can see success by “no duplicate charges, jobs, notifications, ledger rows, or transfers for the same key.”

### 11. What would happen if we didn't have it?

**Technical:** Without idempotency, any retry (client, load balancer, or Stripe webhook retry) or duplicate delivery could cause: double payment intents or double charges, double job creation, duplicate notifications, duplicate credit ledger entries (e.g. double credit for one payment), or duplicate payout transfers. We’d have to avoid retries entirely or accept duplicates and fix them manually. Revenue and trust would suffer; support load would increase.

**Simple (like for a 10-year-old):** Without it, every double-click or “Stripe sent the webhook again” could charge twice, create two jobs, send two emails, add credits twice, or send two payout transfers. We’d have to never retry or fix duplicates by hand. That would be bad for customers and for us.

### 12. What is it not responsible for?

**Technical:** Idempotency is not responsible for: validating the request body (that’s the handler); ensuring exactly-once delivery of the request (we only dedupe when we see the same key); preventing different keys from doing the same logical thing (client could send key1 and key2 for the same payment—we’d do both); or securing the key (we don’t sign or encrypt the key). It’s also not responsible for Stripe/notification/credit/payout business logic—only for “have we already done this key/event/dedupe/reason?”

**Simple (like for a 10-year-old):** It doesn’t check if the request is valid—that’s the handler’s job. It doesn’t guarantee the request only arrives once—we only dedupe when we see the same key. It doesn’t stop someone from sending two different keys for the same “logical” action—we’d do both. It doesn’t hide or sign the key. And it doesn’t do the actual payment or notification or credit logic—it only answers “have we already done this key (or event or dedupe or reason)?”

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For API idempotency: Idempotency-Key header (string, 1–255 chars, alphanumeric + dash + underscore), request path, method, and (after handler runs) status code and response body. For storage: idempotency_keys table (idempotency_key PK, endpoint, method, status_code, response_body, created_at). For Stripe: stripe_event_id, stripe_object_id, event_type, raw_payload. For notifications: dedupeKey (e.g. type:channel:userId:jobId:timestampBucket). For credits: user_id, job_id, reason (for idempotent reasons). For payouts: idempotencyKey string passed to Stripe. Env: none for idempotency.ts (uses existing DB client).

**Simple (like for a 10-year-old):** For API we need the key from the header (short, letters numbers dashes underscores), the path and method, and after the handler runs the status and body. We store that in the idempotency_keys table. For Stripe we need the event id and payload. For notifications we need the dedupe key (e.g. type, channel, user, job, time bucket). For credits we need user, job, and reason. For payouts we need the key we give to Stripe. We don’t need any special env for the API idempotency—just the database.

### 14. What does it produce or change?

**Technical:** API idempotency produces: rows in idempotency_keys (key, endpoint, method, status_code, response_body, created_at) when we store a new result; and returns a cached response (no handler run) when key exists. It does not change business data itself—the handler does; we only gate “run handler or return cached.” Stripe idempotency produces rows in stripe_events_processed and prevents duplicate processing. Notification idempotency prevents duplicate sends (no extra row beyond notification_log from the send). Credit idempotency returns existing ledger row (no duplicate row). Payout idempotency prevents duplicate transfer (Stripe side). So idempotency “produces” cached responses and “prevents” duplicate side effects; it doesn’t create business entities itself.

**Simple (like for a 10-year-old):** For API we add a row to idempotency_keys when we save a new response, and we return that saved response when the key is seen again—we don’t change business data ourselves, we only decide “run the handler or return cached.” For Stripe we add a row to “processed events” and skip if already there. For notifications we skip sending if we already sent that key. For credits we don’t add a second row. For payouts we don’t send a second transfer. So idempotency “produces” cached answers and “stops” duplicate actions; it doesn’t create the payment or job itself.

### 15. Who or what consumes its output?

**Technical:** The consumer of API idempotency is the client that sent the request—they get either the handler’s response (first time) or the cached response (replay). No other system reads idempotency_keys for business logic; admins or support might query it for debugging. Stripe idempotency output is “skip processing”—consumers are the payment/refund/dispute handlers that don’t run twice. Notification idempotency output is “skip send”—consumer is the notification path. Credit idempotency output is the existing row—consumer is the caller (e.g. handlePaymentIntentSucceeded). Payout idempotency output is “Stripe dedupes”—consumer is Stripe and our processPendingPayouts.

**Simple (like for a 10-year-old):** The main consumer of API idempotency is the client—they get the same response on replay. Nobody else uses the idempotency_keys table for business logic; we might look at it for debugging. The “output” of Stripe/notification/credit/payout idempotency is “we didn’t do it again”—the consumers are the payment, notification, credit, and payout code that only runs once per key.

### 16. What are the main steps or flow it performs?

**Technical:** **API (requireIdempotency):** (1) Read Idempotency-Key header; if missing, next(). (2) Validate format; if invalid, 400 and return. (3) getIdempotencyResult(key). (4) If existing, res.status(existing.status_code).json(existing.response_body); return. (5) Patch res.json so that when handler calls res.json(body), we call storeIdempotencyResult(key, req.path, req.method, res.statusCode, body) then originalJson(body). (6) next(). **Store:** INSERT idempotency_keys ON CONFLICT DO NOTHING. **Stripe:** INSERT stripe_events_processed ON CONFLICT DO NOTHING RETURNING id; if no row, return (skip); else process. **Notification:** alreadySent(dedupeKey) SELECT from notification_log; if row, skip. **Credit:** SELECT existing (user_id, job_id, reason); if row, return it; else INSERT. **Payout:** stripe.transfers.create(..., { idempotencyKey }).

**Simple (like for a 10-year-old):** For API: we read the key; if it’s missing we continue. If it’s invalid we return 400. We look up the key; if we have a saved response we return it and stop. Otherwise we wrap “send response” so that when the handler sends we save the response under the key, then send. Then we run the handler. When we store we insert the row and ignore if the key already exists. For Stripe we try to insert the event id; if we can’t (already there) we skip. For notifications we check “already sent this key” and skip. For credits we check “already have this user, job, reason” and return it or insert. For payouts we tell Stripe the key so they dedupe.

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) Idempotency-Key format: alphanumeric, dashes, underscores, 1–255 chars; (2) key is global (not per-user)—anyone who knows the key gets the cached response (we don’t bind key to user); (3) first response wins for storage (ON CONFLICT DO NOTHING); (4) we don’t overwrite existing keys. We don’t enforce: key lifetime (we don’t reject old keys on read); key scope (same key on different endpoints would be different rows—key is PK so one row per key across all endpoints); or that the client use a single key per logical action (client responsibility). Stripe/notification/credit/payout enforce their own key/scope rules.

**Simple (like for a 10-year-old):** We enforce: the key must be the right shape (letters, numbers, dashes, underscores, not too long). The key is global—whoever sends the key gets the cached response (we don’t tie the key to a user). We never overwrite a saved response—first one wins. We don’t refuse old keys; we don’t tie the key to an endpoint (the key is unique in the whole table). We don’t force the client to use one key per “logical” action—that’s their job. The other idempotency mechanisms (Stripe, notifications, credits, payouts) have their own rules.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** API idempotency is triggered by any request that has the requireIdempotency (or optionalIdempotency) middleware and that includes an Idempotency-Key header—i.e. the same requests that would create a payment intent, job, or tracking event. Stripe idempotency is triggered when we receive a webhook (Stripe sends the event). Notification idempotency is triggered when sendNotification is called with a dedupeKey. Credit idempotency is triggered when addLedgerEntry is called with an idempotent reason and jobId. Payout idempotency is triggered when processPendingPayouts calls stripe.transfers.create. There is no separate “idempotency job”—each mechanism runs inline with the operation.

**Simple (like for a 10-year-old):** API idempotency runs when the client sends a request with the Idempotency-Key header on pay, create job, or tracking. Stripe idempotency runs when Stripe sends us a webhook. Notification idempotency runs when we’re about to send a notification and we have a dedupe key. Credit idempotency runs when we’re about to add a purchase or escrow and we have user, job, reason. Payout idempotency runs when we send a Stripe transfer with a key. There’s no separate “idempotency” job—it’s part of each flow.

### 19. What could go wrong while doing its job?

**Technical:** (1) **Race:** Two requests with same key arrive concurrently; both get null from getIdempotencyResult, both run the handler—we could double-create (e.g. two payment intents). We don’t have “insert key then run” locking. (2) **Store fails:** storeIdempotencyResult catches and logs; we don’t throw so the client gets the response but we might not have stored it—replay could run the handler again. (3) **Get fails:** we fail open (next()); request runs without idempotency—replay could run again. (4) **Key collision:** client reuses key for a different logical action (e.g. same key for two different jobs)—we’d return the first response for the second action (wrong). (5) **Stale response:** we return a cached 200 with old body; if the “resource” was later deleted or changed, the client sees stale data. (6) **No key:** if client doesn’t send key we don’t dedupe—double submit can double-create. (7) **Table growth:** idempotency_keys grows; we have cleanup_old_idempotency_keys() but we don’t run it on a schedule in code—ops must run it or add a job.

**Simple (like for a 10-year-old):** Things that can go wrong: if two requests with the same key arrive at exactly the same time both might run the handler and we could do the action twice (race). If saving the response fails we log and don’t crash—but then we might not have the key stored and a replay could run again. If looking up the key fails we let the request through so we don’t block—but then we’re not deduping. If the client reuses the same key for a different action we’d return the wrong cached response. If we return a cached response and the world changed since (e.g. job deleted) the client might see stale data. If the client doesn’t send a key we don’t dedupe. The idempotency_keys table can get big; we have a cleanup function but we might not run it automatically.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) logs—idempotency_key_reused when we return cached response; idempotency_store_failed, idempotency_get_failed when we fail; (2) idempotency_keys table—count of keys, age distribution; (3) absence of duplicate charges/jobs/notifications/ledger rows for the same key in payment, job, and notification flows. We don’t have a dedicated “idempotency hit rate” or “duplicate prevented” metric in this module. Stripe/notification/credit/payout have their own logs (stripe_event_already_processed, notification_skipped_duplicate, credit_ledger_entry_duplicate_prevented). Tests: paymentIdempotency.test, stripeWebhook idempotency tests.

**Simple (like for a 10-year-old):** We know it’s working when we see “idempotency key reused” in the logs (we returned cached) and when we don’t see duplicate charges or jobs for the same key. We don’t have a single “idempotency health” number. The other mechanisms (Stripe, notifications, credits) log “already processed” or “duplicate prevented.” We have tests that check idempotency for payments and Stripe.

### 21. What does it depend on to do its job?

**Technical:** API idempotency depends on: DB (idempotency_keys table), query from db/client, logger, sendError from errors. It does not depend on env vars in idempotency.ts. Stripe idempotency depends on stripe_events_processed, payment_intents, stripe_object_processed tables and paymentService. Notification idempotency depends on notification_log and notificationService. Credit idempotency depends on credit_ledger and creditsService. Payout idempotency depends on Stripe API and payoutsService.

**Simple (like for a 10-year-old):** API idempotency needs the database (idempotency_keys table) and the usual DB client and logger. It doesn’t need any env vars. The other idempotency mechanisms need their own tables and services (Stripe, notification log, credit ledger, Stripe API).

### 22. What are the main config or env vars that control its behavior?

**Technical:** There are no env vars in src/lib/idempotency.ts. Behavior is controlled by: (1) whether the route uses requireIdempotency or optionalIdempotency; (2) whether the client sends Idempotency-Key; (3) DB schema (idempotency_keys). The 24-hour lifetime is documented in the table comment and cleanup_old_idempotency_keys(); we don’t read a config for that. Stripe/notification/credit/payout idempotency use their own config (e.g. Stripe webhook secret, notification types with ever-sent vs time-windowed).

**Simple (like for a 10-year-old):** There are no config or env vars for the API idempotency code itself. Whether we dedupe depends on whether the route uses the middleware and whether the client sends a key. We say keys are valid 24 hours in the DB comment and we have a cleanup function, but we don’t have a setting for that. The other idempotency mechanisms have their own config (e.g. Stripe, notification types).

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: paymentIdempotency.test (same Idempotency-Key returns same response, no double charge); stripeWebhook tests (same event id skips processing); notification tests (dedupe key skips send); creditsService tests (duplicate addLedgerEntry returns existing). We mock DB or use test DB. We don’t have a dedicated “idempotency middleware” test that covers race (two concurrent requests same key)—that would require concurrency.

**Simple (like for a 10-year-old):** We have tests that check: same idempotency key for payment returns the same response and doesn’t charge twice; same Stripe event skips processing; same notification dedupe key skips send; duplicate credit entry returns existing row. We don’t have a test that simulates two requests with the same key at the same time (race).

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If we double-ran (e.g. race or store failed): we might have duplicate payment intents, jobs, or tracking events. Recovery is manual: identify duplicates (e.g. same idempotency key or same Stripe event), cancel or refund or merge as appropriate, and fix data. If we failed to store and the client replays: they might get a second response (e.g. second payment intent)—we’d have two intents for one “logical” payment; we could use Stripe idempotency on the webhook to avoid double-crediting when the client pays one of them. If idempotency_keys table is full or slow: run cleanup_old_idempotency_keys(); add a scheduled job if needed. We don’t have an automatic “detect and fix duplicates” job.

**Simple (like for a 10-year-old):** If we did the action twice (e.g. race or save failed) we might have two charges or two jobs. Fixing that is manual: find the duplicates, cancel or refund or merge, and fix the data. If we didn’t store the key and the client replays they might get a second “payment intent” or job—we’d have to handle that (e.g. Stripe will only process one payment when they confirm). If the idempotency table is too big or slow we run the cleanup function and maybe add a scheduled job. We don’t have an automatic “find and fix duplicates” job.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: clients (they must not be double-charged or see duplicate jobs); product and finance (revenue and trust); support (fewer “I was charged twice” tickets); engineering (reliability of retries and webhooks). Cleaners and admins benefit indirectly (correct payments and jobs).

**Simple (like for a 10-year-old):** People who care: customers who don’t want to be charged twice or see two jobs, the team that cares about revenue and trust, support who don’t want “charged twice” tickets, and engineers who want retries and webhooks to be safe. Cleaners and admins benefit because payments and jobs are correct.

### 26. What are the security or privacy considerations for what it does?

**Technical:** Idempotency keys are not secret—anyone who knows the key gets the cached response. So keys should be unguessable (e.g. UUID) so an attacker can’t replay someone else’s response by guessing. We don’t bind key to user in the middleware—so if key is leaked, anyone with the key could get the cached response (which might contain PII or resource ids). Stored response_body in idempotency_keys may contain PII (e.g. job id, payment intent id); access to the table should be restricted. We don’t sign or encrypt the key. Stripe/notification/credit idempotency use server-side keys so not exposed to clients.

**Simple (like for a 10-year-old):** The idempotency key isn’t a secret—whoever has the key gets the cached answer. So keys should be random (e.g. UUID) so someone can’t guess another person’s key. We don’t tie the key to a user in the middleware, so if a key leaks someone could get that cached response (which might have private data). The saved responses in the table might have personal info—only trusted people should see that table. We don’t sign or encrypt the key. The other idempotency (Stripe, notifications, credits) uses keys that only the server knows.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** idempotency_keys table grows with unique keys per endpoint; we have a 24-hour comment and cleanup function but no TTL on read—so we might return very old cached responses if cleanup hasn’t run. No max keys enforced; under high traffic the table could get large. get/store are one SELECT and one INSERT per request when key is used; adds latency. Concurrent requests with same key can race (both get null, both run)—we don’t have advisory lock or “insert then run.” Stripe/notification/credit/payout idempotency have their own limits (table size, Stripe key length).

**Simple (like for a 10-year-old):** The idempotency_keys table gets bigger the more unique keys we see; we say keys are valid 24 hours and we have a cleanup, but we don’t refuse old keys when reading, so if we don’t run cleanup we could return very old cached answers. We don’t limit how many keys we store. Looking up and saving the key adds a little time to each request. If two requests with the same key hit at the same time both might run (race). The other idempotency mechanisms have their own size and length limits.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add “insert key then run” (INSERT idempotency_keys with status 'in_progress' ON CONFLICT DO NOTHING RETURNING id; if no row, another request has the key—wait or return 409; else run handler, UPDATE to status 'done' and response_body) to avoid race. We’d enforce key TTL on read (e.g. reject or ignore if created_at < now() - 24h). We’d add a scheduled job to run cleanup_old_idempotency_keys(). We’d add metrics (idempotency_hit_count, idempotency_miss_count, store_failures). We’d consider binding key to user or endpoint so the same key can’t be reused across users. We’d document key format and lifetime in API docs and DECISIONS.md.

**Simple (like for a 10-year-old):** We’d “reserve” the key first (insert a row) then run the handler so two requests with the same key can’t both run (no race). We’d refuse to use keys older than 24 hours when looking up. We’d run the cleanup job on a schedule. We’d add numbers (how many times we returned cached vs ran the handler, how many store failures). We might tie the key to the user or the endpoint so one key can’t be reused for something else. We’d write down the key format and how long keys last in our docs.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per key: (1) Start—first request with key K arrives; we look up, find null, run handler, store (K, response). (2) Replay—second request with K arrives; we look up, find row, return cached response; no handler run. (3) Finish—key remains in table until cleanup deletes it (e.g. 24 hours). No “in progress” state in current design—we don’t write the key before the handler runs. Stripe/notification/credit/payout have their own lifecycles (event processed once, dedupe key sent once, ledger row once, transfer once).

**Simple (like for a 10-year-old):** For each key: the first time we see it we run the handler and save the response. The second time we see it we return the saved response and don’t run the handler. The key stays in the table until we delete it (e.g. after 24 hours). We don’t “reserve” the key before running—we only store after we have the response. The other idempotency mechanisms have their own “once per event/key/reason” lifecycles.

### 30. What state does it keep or track?

**Technical:** Persistent state: idempotency_keys (idempotency_key, endpoint, method, status_code, response_body, created_at). No in-memory cache in idempotency.ts. Stripe: stripe_events_processed, payment_intents.processed_success, stripe_object_processed. Notifications: notification_log (payload includes dedupeKey, status). Credits: credit_ledger (user_id, job_id, reason). Payouts: Stripe’s server-side idempotency for transfers. We don’t track “pending” or “in progress” for API idempotency—only “done” (stored response).

**Simple (like for a 10-year-old):** We keep: the idempotency_keys table (key, path, method, status, body, time). We don’t keep anything in memory in the idempotency module. The other mechanisms keep their own state (Stripe processed events, notification log, credit ledger, Stripe’s transfer idempotency). We don’t track “we’re handling this key right now”—only “we already have a response for this key.”

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) the client sends the same key for the same logical action (we don’t derive key from body); (2) the handler’s response is deterministic for the same request (we don’t re-run to get a fresh response); (3) DB is available for get and store (we fail open on error); (4) idempotency_keys table exists and has the expected schema; (5) key format is enforced so we don’t store huge or malicious strings. We don’t assume: exactly-once delivery of the request (we dedupe when we see the same key); or that the client won’t reuse a key for a different action (we’d return wrong cached response).

**Simple (like for a 10-year-old):** We assume the client uses the same key when they mean “same action” (we don’t figure that out from the body). We assume the handler would give the same response if we ran it again (we don’t re-run). We assume the database is there for lookups and saves (if it fails we don’t block the request). We assume the idempotency_keys table exists and has the right columns. We assume the key is in the right format. We don’t assume the request only arrives once—we dedupe when we see the same key. We don’t assume the client won’t reuse a key for a different action—they could and we’d return the wrong cached answer.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use API idempotency for: GET or read-only endpoints (no need to dedupe reads); or when the operation is naturally idempotent (e.g. “set status to X” where repeating is fine). Use something else when: you need request-scoped dedupe but can’t send a header (e.g. webhook)—use event/object id; or you need business-scoped dedupe (e.g. “one ledger row per user, job, reason”)—use that constraint in the business layer. Don’t use the same key across different endpoints or different logical actions—each key should mean one logical request.

**Simple (like for a 10-year-old):** Don’t use API idempotency for read-only requests (no need to “do once”). Don’t use it when the action is already safe to repeat (e.g. “set status to done”). Use event id or business rules when you can’t send a header (e.g. webhooks) or when you need “one per user/job/reason.” Don’t reuse the same key for different actions—one key should mean one thing.

### 33. How does it interact with other systems or features?

**Technical:** API idempotency sits in front of payment, job, and tracking handlers—it doesn’t call other services; it only gates “run handler or return cached.” It uses the same DB client as the rest of the app. Stripe idempotency is inside paymentService (stripe_events_processed, payment_intents). Notification idempotency is inside notificationService (notification_log). Credit idempotency is inside creditsService (credit_ledger). Payout idempotency is inside payoutsService (Stripe API). So “idempotency” is a cross-cutting concern implemented in one middleware (API) and several inline checks (Stripe, notification, credit, payout); they don’t call each other.

**Simple (like for a 10-year-old):** API idempotency is a layer in front of the “pay,” “create job,” and “tracking” handlers—it doesn’t call other systems; it only decides “run the handler or return cached.” The other idempotency (Stripe, notifications, credits, payouts) lives inside those services and uses their own tables and keys. They don’t call each other—they’re separate “don’t do twice” checks in different places.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) we didn’t dedupe when we should have (e.g. get failed and we ran the handler again, or race and both ran)—we don’t signal that to the client; we might have duplicate side effects. (2) we stored the wrong response (e.g. bug in res.json patch)—replay would return wrong body; we don’t have a separate “idempotency error.” (3) store failed—we log idempotency_store_failed; we don’t throw so the client gets 200 and the handler ran; replay might run again. (4) get failed—we log idempotency_get_failed and next(); we don’t signal to the client. So we fail open: we don’t block the request; we might lose idempotency. We don’t return a specific “idempotency failure” code to the client.

**Simple (like for a 10-year-old):** Failure means we didn’t “do once” when we should have—e.g. we ran the handler twice (because lookup failed or two requests raced). We don’t tell the client “idempotency failed”—we might just have done the action twice. If saving the response failed we log it and don’t crash—the client still gets their response but we might not have stored it, so a replay could run again. So we “fail open”: we’d rather let the request through than block it; we might lose idempotency.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust that the stored response_body matches what we sent (we patch res.json and store the same body). We don’t validate that the handler is deterministic. Completeness: we can audit idempotency_keys (count, age) and compare to request volume for endpoints that use the middleware; we can check for duplicate payment intents or jobs for the same key in logs or DB. We don’t have an automated “no duplicate charges for same key” check; we rely on tests and manual audit.

**Simple (like for a 10-year-old):** We trust that what we store is what we sent (we save the same body the handler returns). We don’t check that the handler would give the same answer every time. To see if we’re correct we can look at the idempotency table and at whether we have duplicate charges or jobs for the same key. We don’t have an automatic “no duplicates” check—we rely on tests and manual checks.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. The idempotency middleware (idempotency.ts) and idempotency_keys table are shared; Stripe/notification/credit/payout idempotency are owned by their respective services. Changes to key format, storage schema, or TTL should be documented in DECISIONS.md and communicated to API consumers.

**Simple (like for a 10-year-old):** The team that owns the backend (or payments/platform) is responsible. The API idempotency code and table are shared; the other “don’t do twice” logic lives in each service. When we change key format or how long we keep keys we should write it down and tell API users.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) “insert key then run” to avoid race; (2) key TTL enforced on read (reject or ignore if > 24h); (3) scheduled cleanup job; (4) metrics and alerts (hit rate, store failures); (5) key scoped to user or endpoint (e.g. key + user_id) so key can’t be reused across users; (6) idempotency for more endpoints (e.g. cancel job, reschedule); (7) document key format and lifetime in API spec and runbook. As we add more mutating endpoints we’d add requireIdempotency where double-execution would be harmful.

**Simple (like for a 10-year-old):** As we grow we might “reserve” the key first so two requests can’t both run, enforce “key too old” when reading, run the cleanup on a schedule, and add dashboards and alerts. We might tie the key to the user so one key can’t be used by someone else. We might use idempotency on more endpoints (e.g. cancel, reschedule) and write down the key format and lifetime for API users.

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: DB storage and writes for idempotency_keys (one row per unique key per 24h window), one SELECT per request when key present, one INSERT per first request with key. Stripe/notification/credit/payout idempotency use their existing tables and one extra SELECT or INSERT in their flow. No dedicated infra for idempotency.ts; it shares the app and DB.

**Simple (like for a 10-year-old):** We pay for database space and one lookup (and sometimes one save) per request when the client sends a key. The other idempotency mechanisms use their own tables and one extra check. We use the same server and database as the rest of the app.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** The purpose of idempotency is to make “run twice” safe: the second run returns the cached response (API) or skips (Stripe/notification/credit/payout). So by design, replay/retry with the same key is safe—we don’t duplicate the side effect. The only caveat is API race: two concurrent requests with same key might both get null and both run the handler; we don’t have lock. So “retry after first response” is safe; “concurrent duplicate requests” might not be.

**Simple (like for a 10-year-old):** Yes—that’s the point. If you send the same key again we return the cached response (API) or skip (Stripe, notifications, credits, payouts). So “retry” is safe. The only problem is if two requests with the same key arrive at exactly the same time—both might run (race). So “try again later” is safe; “two at once” might not be.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails on getIdempotencyResult: we catch, log, next()—request runs without idempotency (fail open). If DB fails on storeIdempotencyResult: we catch, log, don’t throw—response is still sent to client but we might not have stored; replay could run handler again. We don’t retry get or store. Stripe/notification/credit/payout idempotency have their own failure behavior (e.g. Stripe insert fails → we might process twice if we don’t throw).

**Simple (like for a 10-year-old):** If the database fails when we look up the key we log and let the request through—so we’re not blocking but we might not dedupe. If the database fails when we save the response we log and don’t crash—the client still gets their response but we might not have saved it, so a replay could run again. We don’t retry. The other idempotency mechanisms have their own “what if DB fails” behavior.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Any client that can call the endpoints that use requireIdempotency (POST /payments/credits, POST jobs, POST tracking) can send an Idempotency-Key header—we don’t restrict who can send a key. We don’t bind key to user, so any authenticated (or unauthenticated, if the route allows) client could in theory send a key that was used by someone else and get that cached response (if they knew the key). Configuration: no env in idempotency.ts; table schema and cleanup are changed by DB migrations and ops. Route authors decide which routes use requireIdempotency.

**Simple (like for a 10-year-old):** Anyone who can call the “pay,” “create job,” or “tracking” endpoints can send an idempotency key. We don’t tie the key to a user, so if someone knew another person’s key they could get that cached response (keys should be unguessable). There’s no config for the idempotency code itself; the table and cleanup are changed by migrations and ops. The people who add routes decide which ones use idempotency.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_PAYMENT_FLOW.md`, `FOUNDER_NOTIFICATIONS.md`, `FOUNDER_PAYOUT_FLOW.md`, paymentIdempotency.test, stripeWebhook tests.
