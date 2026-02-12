# Founder Reference: Payment Flow (Intent → Capture → Credits)

**Candidate:** Payment flow (intent → capture → credits) (Function #32)  
**Where it lives:** `paymentService`, Stripe intents, capture, `creditsService`, `payment_succeeded` event, `src/routes/payments.ts`, Stripe webhook  
**Why document:** How a client pays (Stripe), how we capture and grant credits, and what events we emit.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The payment flow is the end-to-end path from client payment to credits in the system. It consists of: (1) **Intent creation**—`createWalletTopupIntent` (buy credits separately) or `createJobPaymentIntent` (pay for a specific job at booking) in `paymentService.ts`; both create a Stripe PaymentIntent with metadata (purpose, clientId, jobId, credits) and store a row in `payment_intents`; (2) **Capture**—Stripe captures the payment on the client (frontend confirms with client_secret); (3) **Webhook**—Stripe sends `payment_intent.succeeded`; we process it in `handleStripeEvent` with idempotency via `stripe_events_processed` and `payment_intents.processed_success`; (4) **Credits**—`handlePaymentIntentSucceeded` calls `addLedgerEntry` (creditsService): for wallet_topup it adds credits (reason: purchase); for job_charge it adds credits (purchase) then immediately escrows them (job_escrow); (5) **Event**—we publish `payment_succeeded` so notifications and n8n can react. Job charge mode applies a surcharge (NON_CREDIT_SURCHARGE_PERCENT) so direct card payers pay more than wallet users; credits minted equal job.credit_amount.

**Simple (like for a 10-year-old):** The payment flow is how a customer pays us and how they get credits. They either “top up” their wallet (buy credits to use later) or “pay for this job” at booking. We ask Stripe to charge their card; when Stripe says “paid,” we add credits to their wallet and, for job pay, we also lock those credits for that job. We then tell the rest of the app “payment succeeded” so we can send emails and update screens. If they pay by card for a job we charge a bit extra (surcharge); the credits they get are still the job amount.

### 2. Where it is used

**Technical:** The flow is implemented in `src/services/paymentService.ts` (createWalletTopupIntent, createJobPaymentIntent, handleStripeEvent, handlePaymentIntentSucceeded, handlePaymentIntentFailed, isObjectAlreadyProcessed, markObjectProcessed), `src/services/creditsService.ts` (addLedgerEntry, escrowJobCredits, getUserBalance), and `src/routes/payments.ts` (POST /payments/credits, POST /payments/job-intent, etc., with requireAuth and optional requireIdempotency). Stripe webhook route (e.g. POST /stripe/webhook) calls handleStripeEvent. Tables: `payment_intents`, `stripe_events_processed`, `stripe_events`, `stripe_object_processed`, `credit_ledger`. JobsService or booking flow calls createJobPaymentIntent when client chooses paymentMode='card'; client or credits route calls createWalletTopupIntent for top-up.

**Simple (like for a 10-year-old):** The “payment and credits” code lives in the payment service, the credits service, and the payment routes. When a customer tops up or pays for a job we create the charge in Stripe and save a row in payment_intents. When Stripe tells us “paid” we add credits (and for job pay we escrow them) and write that in the credit ledger. The job booking flow and the “buy credits” screen call this.

### 3. When we use it

**Technical:** We use it when: (1) a client calls POST /payments/credits to buy credits (wallet top-up)—we create a PaymentIntent and return client_secret; (2) a client creates a job with paymentMode='card'—we create a job and a PaymentIntent for that job and return client_secret; (3) Stripe sends payment_intent.succeeded—we run handlePaymentIntentSucceeded (add credits, escrow if job_charge, publish payment_succeeded); (4) Stripe sends payment_intent.payment_failed—we update payment_intents status and publish payment_failed. There is no fixed schedule; every step is triggered by client action or Stripe webhook.

**Simple (like for a 10-year-old):** We use it when a customer wants to buy credits or pay for a job by card—we create the charge. We use it again when Stripe tells us the payment succeeded—we add credits (and lock them for the job if it was job pay) and tell the app “payment succeeded.” We also use it when Stripe says the payment failed—we record that and tell the app “payment failed.”

### 4. How it is used

**Technical:** **Intent:** Client calls createWalletTopupIntent(clientId, clientStripeCustomerId?, credits) or createJobPaymentIntent({ job, clientId, clientStripeCustomerId? }). We compute amountCents (credits * CENTS_PER_CREDIT for top-up; for job_charge we add surcharge: baseAmountCents * (1 + NON_CREDIT_SURCHARGE_PERCENT/100)). We call stripe.paymentIntents.create with metadata (purpose, credits, clientId, jobId) and INSERT into payment_intents (job_id, client_id, stripe_payment_intent_id, status, amount_cents, currency, purpose, credits_amount) ON CONFLICT DO UPDATE. We return clientSecret and stripePaymentIntentId. **Webhook:** Stripe POSTs the event; we verify signature, then handleStripeEvent(event). We INSERT INTO stripe_events_processed (stripe_event_id, ...) ON CONFLICT DO NOTHING RETURNING id; if no row returned we skip (idempotent). For payment_intent.succeeded we call handlePaymentIntentSucceeded: check payment_intents.processed_success; if already true we return; else we UPDATE payment_intents status, then addLedgerEntry (purchase and optionally job_escrow), then UPDATE payment_intents SET processed_success = true, then publishEvent(payment_succeeded), then markObjectProcessed(pi.id, 'payment_intent').

**Simple (like for a 10-year-old):** To start: we create a “payment intent” in Stripe with the amount and who’s paying and what it’s for (top-up or job), and we save that in our database. We give the frontend a secret so the customer can confirm the charge on Stripe. When Stripe tells us “succeeded” we check we haven’t already handled this payment (so we don’t add credits twice). Then we add credits to the customer’s wallet and, for job pay, we lock those credits for that job. We mark the payment as processed and we tell the rest of the app “payment succeeded.”

### 5. How we use it (practical)

**Technical:** In day-to-day: frontend calls POST /payments/credits (body: credits, optional stripeCustomerId) or the job-creation flow calls createJobPaymentIntent after creating the job. Routes use requireAuth; wallet top-up can use requireIdempotency (Idempotency-Key header) to prevent duplicate intents. Frontend uses client_secret with Stripe.js to confirm the payment; Stripe then sends the webhook. Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CENTS_PER_CREDIT, NON_CREDIT_SURCHARGE_PERCENT, CREDITS_ENABLED. We don’t capture manually—Stripe captures when the client confirms. To debug: query payment_intents and credit_ledger for a client; check stripe_events_processed for duplicate events.

**Simple (like for a 10-year-old):** In practice the app calls “create payment for this many credits” or “create payment for this job.” We can send an “idempotency key” so if the user double-clicks we don’t create two charges. The customer confirms on Stripe’s form; Stripe then calls our webhook. We set the price per credit and the surcharge percent in our config. To see what happened we look at the payment_intents and credit_ledger tables.

### 6. Why we use it vs other methods

**Technical:** Stripe PaymentIntents give a clear lifecycle (created → succeeded/failed) and idempotent webhooks; we avoid charging twice by using stripe_events_processed and payment_intents.processed_success. Two modes (wallet_topup vs job_charge) let clients either pre-buy credits or pay per job; job_charge with surcharge incentivizes wallet use and gives us revenue on card payments. Credits in credit_ledger with reasons (purchase, job_escrow, job_release, refund) give a full audit trail. Publishing payment_succeeded keeps notifications and n8n in sync. Alternatives—one-off charges without intents, or no credits (direct charge per job only)—would be simpler but less flexible and harder to reconcile.

**Simple (like for a 10-year-old):** We use Stripe so we don’t handle card numbers ourselves and so we get a clear “succeeded” or “failed.” We support two ways to pay (top up wallet or pay for this job) so customers can choose. We charge a bit more for paying by card for a job so people are encouraged to use the wallet. We write every credit change in a ledger so we can see exactly what happened. We tell the rest of the app when payment succeeded so emails and screens stay correct.

### 7. Best practices

**Technical:** We use Stripe PaymentIntents (not legacy Charges) and store intent metadata (purpose, clientId, jobId, credits). We enforce idempotency at two levels: stripe_events_processed (event-level) and payment_intents.processed_success (object-level) so replaying the webhook doesn’t double-add credits. We use addLedgerEntry with idempotent reasons (purchase, job_escrow) and jobId so creditsService can dedupe. We validate metadata (clientId, credits) before adding credits. We publish payment_succeeded after we’ve updated DB so consumers see consistent state. Gaps: we don’t use the Stripe wrapper (circuit breaker) for every Stripe call in paymentService; we could add more metrics (e.g. payment success rate by purpose).

**Simple (like for a 10-year-old):** We use Stripe’s modern “payment intent” flow and we save what the payment was for. We make sure we never add credits twice even if Stripe sends the same “succeeded” twice—we check “already processed” at both the event and the payment. We validate that we have a client and a credit amount before adding. We tell the app “payment succeeded” only after we’ve updated the ledger. What we could do better: use our “safe Stripe” wrapper everywhere and add more numbers (e.g. success rate).

### 8. Other relevant info

**Technical:** The payment flow is critical for revenue and trust: double-crediting or missing credits would break the product. CREDITS_ENABLED and REFUNDS_ENABLED (in creditsService) can disable non-refund credit operations. Invoice payment (purpose=invoice_payment) is handled by invoiceService.handleInvoicePaymentSuccess. There is also creditsPurchaseService (Checkout session flow) for a different purchase path; paymentService is the PaymentIntent path. Changing CENTS_PER_CREDIT or surcharge affects new intents only. Document changes in DECISIONS.md.

**Simple (like for a 10-year-old):** This flow really matters—if we add credits twice or forget to add them, customers and the business are hurt. We can turn off “new credits” with a config flag (refunds can still work). There’s another way to buy credits (Checkout session) in a different service; this doc is about the “payment intent” path. If we change the price per credit or the surcharge, only new payments use the new values. We should write down big changes in our decisions doc.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The payment flow is supposed to: (1) let clients pay by card for credits (wallet top-up) or for a specific job (job_charge); (2) ensure we charge the correct amount (CENTS_PER_CREDIT; job_charge includes surcharge); (3) on success, add the correct credits to the client and, for job_charge, escrow them for the job; (4) avoid double-crediting via idempotency; (5) emit payment_succeeded so notifications and other systems can react. Success means: client is charged once, credits appear in the ledger (and are escrowed for the job when applicable), and the app is notified.

**Simple (like for a 10-year-old):** It’s supposed to let customers pay by card for credits or for a job, charge the right amount (with a small extra for card-on-job), add the right credits when Stripe says “paid,” never add credits twice, and tell the rest of the app “payment succeeded.” Success means the customer paid once, their wallet shows the right credits (and for a job those credits are reserved for that job), and the app knows.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a single payment means: payment_intents has a row with stripe_payment_intent_id and status updated to succeeded; payment_intents.processed_success is true; credit_ledger has one or two new rows (purchase and, for job_charge, job_escrow) with the correct user_id, job_id, reason, amount; payment_succeeded event was published; stripe_events_processed has the event id. Observable: client balance increased (or job is “paid” via escrow); job_events or notifications show payment_succeeded. Failure path: payment_intent.payment_failed updates payment_intents status to failed and we publish payment_failed; no credits added.

**Simple (like for a 10-year-old):** Success for one payment means: we have a row for that payment marked “succeeded” and “processed,” the credit ledger has new lines (purchase and maybe “locked for job”), we sent “payment succeeded” to the app, and we won’t process this Stripe event again. You can see success by the client’s balance or by the job being paid. If the payment failed we mark it failed and tell the app “payment failed”; we don’t add credits.

### 11. What would happen if we didn't have it?

**Technical:** Without this flow clients couldn’t pay by card for credits or for a job; we’d have no Stripe integration for PaymentIntents, no credit ledger updates on payment, and no payment_succeeded event. We’d need another way to fund wallets or pay per job (e.g. manual adjustment, or a different payment path). Revenue from card payments would stop; product would be limited to “credits only” from some other source.

**Simple (like for a 10-year-old):** Without it customers couldn’t pay by card to buy credits or to pay for a job. We wouldn’t get money from Stripe into credits, and we wouldn’t tell the app “payment succeeded.” We’d need something else to put credits in the wallet or to pay for jobs. We wouldn’t get that revenue from card payments.

### 12. What is it not responsible for?

**Technical:** The payment flow is not responsible for: creating the job (jobsService); releasing escrowed credits to the cleaner (that’s on job completion/approval via creditsService.releaseJobCreditsToCleaner); refunds (disputesService, refundProcessor, creditsService.refundJobCreditsToClient); displaying balance (routes/credits, getUserBalance); Stripe Connect or payouts to cleaners (payoutsService); invoice payment fulfillment (invoiceService). It only creates intents, processes payment_intent.succeeded/failed, adds credits (and escrow for job_charge), and publishes events.

**Simple (like for a 10-year-old):** It doesn’t create the job—someone else does. It doesn’t “pay” the cleaner (release credits to them)—that happens when the job is completed. It doesn’t do refunds—that’s disputes and refund logic. It doesn’t show the balance on the screen—that’s the credits route. It doesn’t send money to cleaners—that’s payouts. It only creates the charge, handles “paid” or “failed,” adds credits (and locks them for the job when needed), and tells the app.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For intent creation: clientId, credits (top-up) or job (with credit_amount) and clientId (job_charge), optional clientStripeCustomerId. For webhook: Stripe event (event.id, event.type, event.data.object) with signature; payment_intent has metadata (purpose, clientId, jobId, credits). Env: STRIPE_SECRET_KEY, CENTS_PER_CREDIT, NON_CREDIT_SURCHARGE_PERCENT (job_charge), CREDITS_ENABLED. credit_ledger expects user_id, job_id (optional), amount, direction, reason (purchase, job_escrow, etc.).

**Simple (like for a 10-year-old):** To create a payment we need who’s paying (client ID), how many credits (or the job so we know the amount), and optionally their Stripe customer ID. When Stripe sends “succeeded” we need the event and the payment intent with “what it was for” and “how many credits.” We need our Stripe secret, the price per credit, and the surcharge percent in config. The ledger needs user, job (if any), amount, and reason.

### 14. What does it produce or change?

**Technical:** It produces: (1) rows in payment_intents (stripe_payment_intent_id, client_id, job_id, status, amount_cents, purpose, credits_amount, processed_success); (2) rows in stripe_events_processed and stripe_events; (3) rows in credit_ledger (user_id, job_id, amount, direction, reason: purchase, job_escrow); (4) Stripe PaymentIntent (via Stripe API); (5) payment_succeeded or payment_failed event. It updates payment_intents.status and payment_intents.processed_success. It does not change job status directly; the job is “paid” implicitly when credits are escrowed.

**Simple (like for a 10-year-old):** It creates a row for the payment intent, rows for “we processed this Stripe event,” and rows in the credit ledger (purchase and maybe “locked for job”). It creates the charge in Stripe. It sends “payment succeeded” or “payment failed” to the app. It updates the payment row to “succeeded” and “processed.” It doesn’t change the job’s status itself—the job is paid because the credits are locked for it.

### 15. Who or what consumes its output?

**Technical:** Consumers of payment_intents: admin, support, and routes that show payment history. Consumers of credit_ledger: balance checks (getUserBalance), escrow/release/refund flows (creditsService, jobsService, disputesService). Consumers of payment_succeeded: event system (which forwards to n8n), notifications (e.g. “credits purchased”), and any subscriber to job_events. Consumers of payment_failed: notifications or retry logic. Stripe holds the actual funds; we only record intent and credits.

**Simple (like for a 10-year-old):** Our “payment” and “credit” rows are read by admins, by the app when showing balance and history, and by the code that escrows, releases, or refunds credits. The “payment succeeded” message is read by the event system (and n8n) and by the notification system so we can send “you bought credits” or “your job is paid.” The “payment failed” message can be used to notify the user or retry. The real money sits in Stripe; we only record “they paid” and “they have this many credits.”

### 16. What are the main steps or flow it performs?

**Technical:** **Intent path:** (1) Validate credits or job.credit_amount; (2) Compute amountCents (and surcharge for job_charge); (3) stripe.paymentIntents.create(amount, currency, metadata: purpose, credits, clientId, jobId); (4) INSERT payment_intents ON CONFLICT DO UPDATE; (5) Return clientSecret, stripePaymentIntentId, amountCents, credits [, jobId]. **Webhook path:** (1) Verify Stripe signature; (2) INSERT stripe_events_processed ON CONFLICT DO NOTHING; if no row returned, return; (3) For payment_intent.succeeded: (3a) Check payment_intents.processed_success; if true return; (3b) UPDATE payment_intents status; (3c) addLedgerEntry(purchase); (3d) if job_charge, addLedgerEntry(job_escrow); (3e) UPDATE payment_intents SET processed_success = true; (3f) publishEvent(payment_succeeded); (3g) markObjectProcessed(pi.id, 'payment_intent'). **Failed path:** UPDATE payment_intents status = failed; publishEvent(payment_failed).

**Simple (like for a 10-year-old):** To create: we check the amount, compute the charge (with surcharge for job pay), create the PaymentIntent in Stripe, save it in our DB, and return the secret to the frontend. When Stripe says “succeeded”: we check we haven’t already processed this payment; we update our payment row; we add credits (purchase) and, for job pay, we lock them for the job (job_escrow); we mark the payment as processed; we tell the app “payment succeeded”; we mark the Stripe object as processed. If Stripe says “failed” we mark the payment failed and tell the app “payment failed.”

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) credits > 0 (and job.credit_amount > 0 for job_charge); (2) idempotency—stripe_events_processed (event id) and payment_intents.processed_success so we don’t process the same event or intent twice; (3) metadata required—clientId, credits (and jobId for job_charge) before we add credits; (4) CREDITS_ENABLED in creditsService (addLedgerEntry throws if disabled and reason !== 'refund'); (5) Ledger idempotency—addLedgerEntry for purchase, job_escrow checks existing (user_id, job_id, reason) and returns existing row if present. We don’t enforce: max credits per intent (beyond route validation 10–10000); or that the job still exists when we process job_charge (we still add and escrow).

**Simple (like for a 10-year-old):** We enforce: amount must be positive; we never process the same Stripe “succeeded” twice (we check event and payment); we need “who” and “how many credits” (and for job pay “which job”) before we add credits; we respect the “credits enabled” flag so we can turn off new credits in an emergency. We also make sure we don’t add the same “purchase” or “escrow” twice for the same user/job. We don’t check that the job still exists when we process job pay—we still add and lock credits.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Intent creation is triggered by: POST /payments/credits (client or frontend) or by job-creation flow calling createJobPaymentIntent when paymentMode='card'. Webhook handling is triggered by Stripe POST to the webhook URL (payment_intent.succeeded, payment_intent.payment_failed). There is no cron or timer; every step is request-driven or webhook-driven.

**Simple (like for a 10-year-old):** It’s triggered when a customer (or the app) asks to “buy credits” or “pay for this job,” and when Stripe sends us “payment succeeded” or “payment failed.” Nothing runs on a timer—only when someone pays or when Stripe tells us the result.

### 19. What could go wrong while doing its job?

**Technical:** (1) Stripe API down—intent creation fails; caller sees error. (2) Webhook delivered twice—we skip second time via stripe_events_processed. (3) Webhook delivered after long delay—we might process after job cancelled; we still add/escrow credits (no automatic refund here). (4) Metadata missing or wrong (no clientId, credits NaN)—we log and don’t add credits; we still set processed_success so we don’t retry. (5) addLedgerEntry fails (DB, CREDITS_ENABLED off)—we throw; stripe_events_processed is already inserted so Stripe may retry but we’ll hit idempotency on event; payment_intents.processed_success might still be false so we could retry and double-add if we fix the bug—actually we set processed_success at the end so if we throw before that we could retry; addLedgerEntry itself is idempotent for purchase/job_escrow so double call would return existing row. (6) Race: two webhook deliveries—first wins on stripe_events_processed; second skips. (7) Refund/chargeback—handled by refundProcessor/chargebackProcessor, not by this flow.

**Simple (like for a 10-year-old):** Things that can go wrong: Stripe could be down so we can’t create the charge. Stripe might send “succeeded” twice—we only process once. The webhook might arrive late (e.g. after the job was cancelled)—we still add credits; refunds are handled elsewhere. If the payment intent is missing “who” or “how many credits” we don’t add credits but we mark it processed so we don’t retry. If the database or “credits enabled” fails when adding credits we throw; Stripe might retry but we’re designed so we don’t add twice. Refunds and chargebacks are handled by other code.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) payment_intents rows with status and processed_success; (2) credit_ledger rows for the client (purchase, job_escrow); (3) stripe_events_processed for event id; (4) logs—wallet_topup_intent_created, job_charge_intent_created, wallet_topup_credits_added, job_charge_credits_purchased_and_escrowed, stripe_event_already_processed, pi_already_processed_success; (5) metrics.paymentProcessed(amountCents, true) in handlePaymentIntentSucceeded. We don’t have a dedicated “payment success rate” dashboard in this module; we’d query payment_intents and credit_ledger. Tests: paymentIdempotency.test, stripeWebhook.test, integration credits and stripe tests.

**Simple (like for a 10-year-old):** We know it’s working when we see the payment row marked “succeeded” and “processed,” new lines in the credit ledger for that client, and the “payment succeeded” event. We know we skipped a duplicate when we see “already processed” in the logs. We have tests that check idempotency and webhook handling. We don’t have a single “payment health” dashboard yet—we’d look at the DB and logs.

### 21. What does it depend on to do its job?

**Technical:** It depends on: (1) Stripe API (paymentIntents.create, webhook delivery); (2) DB: payment_intents, stripe_events_processed, stripe_events, stripe_object_processed, credit_ledger; (3) creditsService.addLedgerEntry (and env CREDITS_ENABLED, REFUNDS_ENABLED); (4) event system (publishEvent); (5) env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CENTS_PER_CREDIT, NON_CREDIT_SURCHARGE_PERCENT; (6) logger, metrics. It does not depend on the queue for the main path; webhook handler is synchronous.

**Simple (like for a 10-year-old):** It needs Stripe (to create charges and to receive “succeeded”/“failed”), the database (payment_intents, processed events, credit_ledger), the credits service (to add and escrow credits), the event system (to say “payment succeeded”), and config (Stripe keys, price per credit, surcharge). It doesn’t need the job queue for the main path—the webhook runs when Stripe calls us.

### 22. What are the main config or env vars that control its behavior?

**Technical:** STRIPE_SECRET_KEY—required for Stripe API. STRIPE_WEBHOOK_SECRET—required to verify webhook signature. CENTS_PER_CREDIT—price per credit in cents (e.g. 10 = $0.10 per credit). NON_CREDIT_SURCHARGE_PERCENT—extra % for job_charge (e.g. 3 = 3% surcharge). CREDITS_ENABLED (in creditsService)—if false, addLedgerEntry throws for non-refund reasons. REFUNDS_ENABLED—if false, refund ledger entries throw. PAYOUT_CURRENCY (e.g. usd) for PaymentIntent currency.

**Simple (like for a 10-year-old):** The main settings are: Stripe secret key and webhook secret, the price per credit in cents, the surcharge percent for “pay by card for job,” and the “credits enabled” and “refunds enabled” flags. We also set the currency (e.g. USD) for the charge.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: paymentIdempotency.test (idempotency key, duplicate intent), stripeWebhook.test (payment_intent.succeeded records event, updates payment_intents, idempotency), v1Hardening.test (stripe_events_processed), credits.test (balance, ledger). We mock Stripe or use test mode; we mock query for some tests. We don’t run a full E2E “real card charge and webhook” in CI; that would require Stripe test webhook and test card.

**Simple (like for a 10-year-old):** We have tests that check: we don’t create two intents with the same idempotency key, we process “payment_intent.succeeded” once and update the DB and don’t process again, and credits and balance behave correctly. We mock Stripe or use test mode. We don’t run a full “real charge and real webhook” in CI—that would need Stripe test setup.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If intent creation fails (Stripe down, invalid params)—caller retries; we can use idempotency key on POST /payments/credits to avoid duplicate intents. If webhook processing throws (e.g. addLedgerEntry fails)—we don’t catch in handlePaymentIntentSucceeded so the error propagates; Stripe will retry the webhook. On retry we insert stripe_events_processed again and get no row (conflict); we return early so we don’t double-process. But if we threw *after* addLedgerEntry and *before* setting processed_success, the retry would run again—addLedgerEntry is idempotent for purchase/job_escrow so we’d return existing row; we’d then set processed_success and publish. So we’re safe. If payment_intents row is missing (e.g. intent created elsewhere)—we’d fail on UPDATE or we wouldn’t have processed_success; we could add credits without a row if we only relied on metadata; we do have a piRow check so we need the row. Manual recovery: inspect payment_intents and credit_ledger; if intent succeeded in Stripe but we didn’t add credits, we could call addLedgerEntry manually and set processed_success (runbook).

**Simple (like for a 10-year-old):** If creating the charge fails the app can retry; we can use an idempotency key so we don’t create two charges. If handling “succeeded” fails (e.g. DB error) Stripe will send the webhook again. When they do we’ll see “already processed” and skip, or we’ll run again and the “add credits” step is safe to run twice (we don’t add twice). If something is stuck we can look at the DB and manually add credits and mark the payment processed (with a runbook).

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: clients (they pay and expect credits); product and finance (revenue and correct balances); support (debugging “I paid but no credits”); engineering (reliability and idempotency); compliance (we handle payment data via Stripe). Cleaners benefit indirectly when job_charge escrows credits (job is “paid” and they can get released later).

**Simple (like for a 10-year-old):** People who care: the customer who paid and wants to see credits, the team that cares about revenue and correct numbers, support when someone says “I paid but didn’t get credits,” and engineers who want it to be reliable and never double-add. Cleaners care because when a job is paid (escrow) they can eventually get paid.

### 26. What are the security or privacy considerations for what it does?

**Technical:** We never see card numbers—Stripe handles PCI; we only store stripe_payment_intent_id and metadata. Webhook must be verified with STRIPE_WEBHOOK_SECRET so attackers can’t forge “succeeded.” payment_intents and credit_ledger contain client_id and amounts—access should be restricted (e.g. own client or admin). We publish payment_succeeded with jobId, clientId, amount—subscribers (n8n, notifications) may log or store that; treat as sensitive. Idempotency prevents “replay” of webhook to double-add credits. Use HTTPS and restrict webhook route to Stripe IPs if possible.

**Simple (like for a 10-year-old):** We don’t see or store card numbers—Stripe does that. We check the webhook secret so only Stripe can tell us “payment succeeded.” The payment and ledger tables have who paid and how much—only the right people (the customer or admins) should see that. The “payment succeeded” message goes to n8n and notifications—that’s sensitive too. We make sure we can’t add credits twice by replaying a fake “succeeded.” We use HTTPS and we can restrict who can call the webhook.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** Stripe has rate limits on API calls; high volume of intent creation could hit them. Webhook is synchronous—we process in the request; if addLedgerEntry or publishEvent is slow we might timeout and Stripe will retry. We don’t queue webhook handling. payment_intents and credit_ledger grow unbounded; we can index by client_id and created_at for queries. No per-client rate limit in this module for “create intent”; we could add one to prevent abuse. CENTS_PER_CREDIT and surcharge are global; no per-region pricing in this flow.

**Simple (like for a 10-year-old):** Stripe limits how many API calls we can make; if we create tons of charges we might hit that. The webhook runs in the same request—if our DB or “publish event” is slow, the request might time out and Stripe will try again. We don’t put webhooks in a queue. The payment and ledger tables get bigger over time; we can index them for speed. We don’t limit “how many intents per customer” here—we could add that to stop abuse. Price per credit and surcharge are the same for everyone.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d use the Stripe wrapper (executeStripeOperation) for all Stripe calls so circuit breaker and retry apply. We’d add metrics (success rate by purpose, latency, idempotency skip rate). We’d consider queueing webhook handling (accept 200 quickly, process async) to avoid Stripe timeout. We’d add a runbook for “Stripe says succeeded but we didn’t add credits” (manual addLedgerEntry + set processed_success). We’d document the exact order of operations and failure semantics. We might add idempotency key to job-intent creation if not already. We’d consider idempotent “cancel intent” or “release escrow if job cancelled after payment” to avoid manual refunds.

**Simple (like for a 10-year-old):** We’d use our “safe Stripe” wrapper everywhere so we get retries and circuit breaker. We’d add dashboards (success rate, how often we skip duplicates). We might accept the webhook fast and process it in the background so we don’t timeout. We’d write a runbook for “payment succeeded in Stripe but we didn’t add credits” so we can fix it by hand. We’d make the order of operations and “what if it fails” clearer. We might support “cancel this intent” or “release escrow if the job was cancelled” so we don’t have to refund manually as often.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per payment: (1) Start—client or job flow calls create intent; we create PaymentIntent in Stripe and row in payment_intents (status = requires_payment_method or similar). (2) Client confirms on Stripe; Stripe captures and sends payment_intent.succeeded. (3) We process webhook: check idempotency, add credits, set processed_success, publish event. (4) Finish—payment_intents row is succeeded and processed_success true; credit_ledger has purchase (and job_escrow if job_charge). No “pending capture” state in our DB beyond Stripe’s; we don’t poll—we only react to webhook.

**Simple (like for a 10-year-old):** For each payment: we start when we create the intent and save a row (status “waiting for payment”). The customer pays on Stripe; Stripe sends us “succeeded.” We then add credits, mark the payment processed, and tell the app. We’re done when the payment row is “succeeded” and “processed” and the ledger has the new credits. We don’t poll Stripe—we only react when they tell us.

### 30. What state does it keep or track?

**Technical:** Persistent state: payment_intents (stripe_payment_intent_id, client_id, job_id, status, amount_cents, purpose, credits_amount, processed_success, created_at, updated_at); stripe_events_processed (stripe_event_id, stripe_object_id, event_type, raw_payload); stripe_events (legacy); stripe_object_processed (object_id, object_type); credit_ledger (user_id, job_id, amount, direction, reason). No in-memory state in this flow; all is DB and Stripe.

**Simple (like for a 10-year-old):** We keep: the payment intent row (who, which job, amount, purpose, “succeeded?” “processed?”), the “we processed this Stripe event” rows, and the credit ledger (who, job, amount, in/out, reason). We don’t keep anything in memory—everything is in the database and in Stripe.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) Stripe webhook delivery is at-least-once (we dedupe); (2) metadata (clientId, credits, jobId for job_charge) is set correctly when intent is created and not tampered (we trust our backend); (3) payment_intents row exists when we process webhook (we created it on intent creation); (4) CREDITS_ENABLED is true when we want to add credits (or we’re okay with throw and Stripe retry); (5) credit_ledger unique constraint (user_id, job_id, reason) exists for idempotent reasons; (6) Stripe API is available for intent creation. We don’t assume webhook is exactly-once; we assume idempotent handling.

**Simple (like for a 10-year-old):** We assume Stripe might send “succeeded” more than once so we dedupe. We assume the “who” and “how many credits” and “which job” in the payment intent are correct because we set them ourselves. We assume we have a payment row when we get the webhook. We assume “credits enabled” is on when we add credits (or we’re okay with failing and retrying). We assume the ledger has a unique constraint so we don’t add the same purchase/escrow twice. We assume Stripe is up when we create the intent.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use this flow for: payouts to cleaners (use payoutsService, Stripe Connect); invoice payment (we handle it in handlePaymentIntentSucceeded but fulfillment is invoiceService); refunds (refundProcessor, creditsService.refundJobCreditsToClient); or manual credit adjustments (creditsService.adjustCredits). Use the Checkout session flow (creditsPurchaseService) if you want Stripe-hosted checkout page instead of PaymentElement. Use something else when you need non-Stripe payment methods (we only do Stripe PaymentIntents here).

**Simple (like for a 10-year-old):** Don’t use this for paying cleaners—that’s payouts. Don’t use it for refunds—that’s refund and dispute code. Don’t use it for “add 10 credits by hand”—that’s adjustment. There’s another “buy credits” flow that uses Stripe Checkout (a full Stripe page). Use something else if you need a different payment provider.

### 33. How does it interact with other systems or features?

**Technical:** It receives calls from routes (payments.ts) and job-creation flow (jobsService or similar). It calls Stripe API (paymentIntents.create), creditsService (addLedgerEntry), and event system (publishEvent). It writes payment_intents, stripe_events_processed, stripe_events, stripe_object_processed, and credit_ledger. Consumers of payment_succeeded: event system → n8n, notifications. Consumers of credit_ledger: balance, escrow/release/refund. So the flow sits between: client/frontend → us → Stripe; Stripe webhook → us → credits + events.

**Simple (like for a 10-year-old):** The app and the job flow call us to create a charge. We call Stripe to create it and we call the credits service to add credits and the event system to say “payment succeeded.” We write to several tables. The “payment succeeded” message goes to the event system and then to n8n and notifications. The credit ledger is used for balance, escrow, release, and refunds. So we’re in the middle: customer and app → us → Stripe; Stripe → us → credits and “payment succeeded.”

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) Intent creation failed—Stripe or validation threw; we throw to caller; no row or partial row in payment_intents. (2) Payment failed (card declined, etc.)—Stripe sends payment_intent.payment_failed; we UPDATE payment_intents status = failed and publish payment_failed; we don’t add credits. (3) Webhook processing threw—e.g. addLedgerEntry failed; we don’t catch so we throw; Stripe gets 5xx and retries; on retry we’re idempotent. We signal failure to caller by throw (intent) or by payment_failed event (webhook). We don’t set processed_success on failure; we only set it after we’ve added credits.

**Simple (like for a 10-year-old):** Failure means: we couldn’t create the charge (we throw and the app sees an error), or the customer’s payment failed (Stripe tells us; we mark the payment failed and tell the app “payment failed”; we don’t add credits), or something broke while we were adding credits (we throw, Stripe will retry, and we’re safe to run again). We don’t mark “processed” when the payment failed—only when we’ve successfully added credits.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we validate metadata (clientId, credits) before adding credits; we use idempotent ledger reasons so we don’t double-add. Completeness: we can reconcile payment_intents (processed_success = true) vs credit_ledger (purchase and job_escrow for that client/job); we can compare Stripe balance or payouts to our ledger over time (reconciliationService or manual). We don’t have an automated “every succeeded intent has ledger entries” check in this module; we rely on tests and idempotency.

**Simple (like for a 10-year-old):** We check “who” and “how many credits” before adding. We use “same event/job only once” so we don’t add twice. To see if everything is correct we can compare our payment table (processed) to our ledger and to Stripe. We don’t have an automatic “every payment has credits” check in this code—we rely on tests and safe retries.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned in the repo; typically the backend or payments team would own the payment flow. Changes to CENTS_PER_CREDIT, surcharge, or intent metadata affect new payments only; document in DECISIONS.md. Stripe API version and webhook contract should be kept in sync with Stripe’s docs.

**Simple (like for a 10-year-old):** The team that owns the backend (or payments) is responsible. When we change price per credit or surcharge we should write it down. We should keep our Stripe integration in line with Stripe’s current API and webhooks.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) multiple currencies or regions (different CENTS_PER_CREDIT per region); (2) subscription or recurring payment path (we have invoice.paid for some of that); (3) queue-based webhook handling to avoid timeout and to rate-limit DB writes; (4) stronger reconciliation (automated job that compares Stripe to ledger); (5) “payment succeeded but job cancelled” auto-refund or escrow release; (6) idempotency key on job-intent creation; (7) Stripe wrapper on all Stripe calls. As we add payment methods (e.g. ACH, Apple Pay) we’d extend Stripe integration or add providers.

**Simple (like for a 10-year-old):** As we grow we might support different prices per region or currency, or subscriptions. We might process webhooks in a queue so we don’t timeout. We might add a job that checks “Stripe and our ledger match.” We might automatically release escrow or refund if the job was cancelled after payment. We might use our “safe Stripe” wrapper everywhere. If we add other payment methods we’d extend this or add new flows.

---

## Additional questions (A): Cost, performance, contract, resilience, metrics, access

### A1. What does it cost to run?

**Technical:** Cost is dominated by: (1) Stripe fees (per successful charge—percentage + fixed); (2) DB writes (payment_intents, stripe_events_processed, credit_ledger). We don’t pay Stripe for failed intents (no capture). No dedicated infra for this flow; it shares the app and DB. Cost scales with payment volume.

**Simple (like for a 10-year-old):** We pay Stripe a fee per successful charge and we pay for database writes. We don’t pay for failed charges. More payments mean more cost. We use the same server and DB as the rest of the app.

### A2. How fast should it be? What's acceptable latency or throughput?

**Technical:** Intent creation should be sub-second (Stripe API + one INSERT). Webhook handling should complete within Stripe’s timeout (we process synchronously); if we’re slow Stripe retries. We don’t want to block the client on intent creation; we don’t want to timeout on webhook so we avoid double-retries. Throughput is limited by Stripe rate limits and our DB. No formal SLA for “credits available within X seconds of payment.”

**Simple (like for a 10-year-old):** Creating the charge should be quick so the user isn’t waiting. When Stripe says “succeeded” we should finish before Stripe gives up (they retry if we’re slow). We don’t promise “credits in 2 seconds”—we process as fast as we can. Stripe and our DB limit how many payments we can handle per second.

### A4. How long do we keep the data it uses or produces?

**Technical:** payment_intents, stripe_events_processed, stripe_events, and credit_ledger are kept indefinitely unless we add retention. We don’t purge by age in this module. For compliance we might retain payment records for 7 years and archive. Stripe retains its own data per their policy.

**Simple (like for a 10-year-old):** We keep payment and ledger rows until we decide to delete them—we don’t auto-delete yet. For legal or tax we might keep payment data for several years. Stripe keeps their own records.

### A6. How do we change it without breaking callers?

**Technical:** Add new purpose (e.g. subscription_topup) and handle in handlePaymentIntentSucceeded rather than removing or renaming purposes. Add optional metadata fields; keep clientId, credits (and jobId for job_charge) required. Changing CENTS_PER_CREDIT or surcharge affects only new intents. When changing Stripe API version or webhook payload, support both during migration and document. Don’t remove or rename payment_succeeded payload fields without notifying consumers (n8n, notifications).

**Simple (like for a 10-year-old):** We add new “purposes” (e.g. subscription) and handle them in the webhook instead of changing old ones. We keep “who” and “how many credits” required. Changing price or surcharge only affects new payments. When we change how Stripe talks to us we support both old and new during the change and we tell anyone who listens to “payment succeeded.”

### A7. What's the "contract" (API, events, schema) and how stable is it?

**Technical:** Contract: createWalletTopupIntent(clientId, clientStripeCustomerId?, credits) → { clientSecret, stripePaymentIntentId, amountCents, credits }; createJobPaymentIntent({ job, clientId, clientStripeCustomerId? }) → { clientSecret, stripePaymentIntentId, amountCents, credits, jobId }. payment_intents table: stripe_payment_intent_id, client_id, job_id, status, amount_cents, purpose, credits_amount, processed_success. payment_succeeded event: jobId?, actorType, actorId?, eventName: "payment_succeeded", payload: { purpose, stripe_payment_intent_id, credits, amount, currency, clientId, jobId }. Stability: we treat purpose enum and payload shape as stable; new purposes are additive. Stripe webhook contract is Stripe’s.

**Simple (like for a 10-year-old):** The “deal” is: you ask for “top up X credits” or “pay for this job” and we give you a Stripe secret and the payment ID. We store the payment with status and “processed?” The “payment succeeded” message includes purpose, payment ID, credits, amount, client, job. We try not to change those shapes; we add new purposes when needed. The exact webhook format is Stripe’s.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Yes. Event-level: INSERT stripe_events_processed ON CONFLICT (stripe_event_id) DO NOTHING RETURNING id; no row → skip. Object-level: payment_intents.processed_success; if true we return before adding credits. Ledger-level: addLedgerEntry for purchase and job_escrow checks (user_id, job_id, reason) and returns existing row if present. So: replaying the same webhook → skip at event or object; retrying after partial failure (e.g. after addLedgerEntry but before processed_success) → addLedgerEntry returns existing, we set processed_success and publish (safe). Intent creation can use Idempotency-Key header on POST /payments/credits to avoid duplicate intents.

**Simple (like for a 10-year-old):** Yes. If Stripe sends the same “succeeded” twice we skip the second time (event and “already processed” on the payment). If we run “add credits” twice for the same payment we don’t add twice—we check “same user, same job, same reason” and return the existing row. So replay and retry are safe. When creating a charge the app can send an idempotency key so we don’t create two charges for one click.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If Stripe API fails on intent creation—we throw; caller sees error. If DB fails on INSERT payment_intents—we throw; caller retries. If DB fails during webhook (e.g. stripe_events_processed INSERT)—we might not insert; Stripe retries; on retry we might insert and process (or we throw again). If addLedgerEntry fails—we throw; Stripe retries; on retry we hit event idempotency and skip, or we process again and addLedgerEntry is idempotent. If publishEvent fails—we’ve already set processed_success and added credits; we could throw and Stripe retries; we’d skip on retry (event idempotency). So we don’t double-add credits; we might miss publishing the event until we fix event system (no retry of publishEvent in this flow). If event system is down we still add credits and set processed_success.

**Simple (like for a 10-year-old):** If Stripe is down when we create the charge we throw and the app sees an error. If the DB fails when we’re handling “succeeded” we throw and Stripe will send the webhook again; when they do we either skip (already processed) or run again and “add credits” is safe (won’t add twice). If “publish event” fails we’ve already added credits and marked processed—so we might not tell the app “payment succeeded” until we fix the event system; we don’t retry the publish here. So we never double-add credits; we might miss one “payment succeeded” message.

### A12. What's the fallback or alternate path when the primary path fails?

**Technical:** If intent creation fails the caller can retry (with idempotency key to avoid duplicate intents). If webhook processing fails Stripe retries; we’re idempotent so we don’t double-add. We don’t have a “fallback” payment provider; if Stripe is down we can’t create intents. We don’t have an automatic “payment succeeded but we didn’t add credits” repair job; that would be manual (runbook: addLedgerEntry + set processed_success). For “payment failed” we don’t retry the charge automatically; the client would try again (new intent).

**Simple (like for a 10-year-old):** If creating the charge fails the app can try again (with an idempotency key). If handling “succeeded” fails Stripe will send again and we’re safe. We don’t have another payment provider—if Stripe is down we can’t take payments. We don’t have an automatic “fix missing credits” job—we’d do that by hand with a runbook. If the payment failed the customer has to try again (new charge).

### A13. If it breaks at 3am, who gets paged and what's the blast radius?

**Technical:** Paging follows the app’s on-call. Blast radius: if payment flow is broken (e.g. Stripe down, webhook route down, DB down), new payments can’t complete—clients can’t buy credits or pay for jobs by card. Existing balances and already-processed payments are unchanged. If only webhook is broken (e.g. our handler throws), Stripe will retry; we’re idempotent so when we fix the bug the next retry will succeed. If we’re slow and Stripe times out they retry—we might process twice in theory but we dedupe. So impact is “new payments blocked or delayed” until we fix it.

**Simple (like for a 10-year-old):** Whoever is on call for the app would get paged. If payments are broken, new card payments won’t go through—customers can’t top up or pay for a job. Old balances and past payments are fine. If only the “succeeded” handler is broken Stripe will keep trying; when we fix it the next try will work and we won’t add credits twice. So the main impact is “new payments don’t work until we fix it.”

### A15. What business or product metric do we use to judge that it's "working"?

**Technical:** We don’t have a formal business metric in code. Operationally we’d use: (1) payment_intents with processed_success = true vs stripe_events_processed for payment_intent.succeeded (should align); (2) credit_ledger purchase + job_escrow volume vs payment volume; (3) Stripe dashboard (successful charges, failures). Product-level: “customers can pay and see credits” is the outcome; we’d measure via support tickets (“I paid but no credits”) or reconciliation (Stripe vs ledger).

**Simple (like for a 10-year-old):** We don’t have one number in the code that says “payments are working.” We’d look at: how many payments we marked processed vs how many “succeeded” events we got, and whether the ledger matches. We’d also look at Stripe’s dashboard. The real test is “customers pay and get credits”—we’d see that from support or from reconciling Stripe with our ledger.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Intent creation is via POST /payments/credits or job flow; both require requireAuth so only authenticated users (and the frontend with a valid token) can create intents. We don’t distinguish “client only” for payments—whoever has the token can call; the clientId in the body or job should match the authenticated user (enforced by route or job flow). Webhook is called by Stripe (verified by signature); no auth token. Configuration (STRIPE_*, CENTS_PER_CREDIT, NON_CREDIT_SURCHARGE_PERCENT) is env—whoever manages deployment can change it.

**Simple (like for a 10-year-old):** Only logged-in users (and the app with their token) can create a payment intent; we don’t let random people create charges. The webhook is only from Stripe (we check the secret). Only people who can change the server’s config can change Stripe keys, price per credit, and surcharge.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_EVENTS.md`, `FOUNDER_NOTIFICATIONS.md`, `FOUNDER_PAYOUT_FLOW.md` (next), `creditsService`, `payoutsService`.
