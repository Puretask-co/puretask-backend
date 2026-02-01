# Founder Reference: Payout Flow (Tier → Connect → Transfer)

**Candidate:** Payout flow (tier → Connect → transfer) (Function #33)  
**Where it lives:** `payoutsService`, reliability tier, Stripe Connect, payout workers  
**Why document:** How we compute payout amount from tier, and how we send money to cleaners via Connect.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The payout flow is the end-to-end path from “job completed and approved” to money in the cleaner’s Stripe Connect account. It consists of: (1) **Record earnings**—when a job is approved/completed, `recordEarningsForCompletedJob(job)` in `payoutsService.ts` computes the cleaner’s payout from the job’s credit_amount and the cleaner’s tier (Bronze 80%, Silver 82%, Gold 84%, Platinum 85% via env CLEANER_PAYOUT_PERCENT_* or cleaner_profiles.payout_percent override), creates a row in `payouts` (cleaner_id, job_id, amount_credits, amount_cents, status 'pending'), and publishes `payout_created`; (2) **Process payouts**—`processPendingPayouts()` (run by the payoutWeekly worker) loads pending payouts grouped by cleaner, creates a Stripe Connect transfer to each cleaner’s `stripe_account_id` (cleaner_profiles), marks payouts 'paid' with stripe_transfer_id, and publishes `payout_batch_processed`; (3) **Tier**—tier comes from reliability score (cleaner_profiles.tier) or payout_percent override. PAYOUTS_ENABLED gates actual transfers; when false we still record pending payouts but processPendingPayouts returns without sending money.

**Simple (like for a 10-year-old):** The payout flow is how we pay cleaners after a job is done and approved. When a job is approved we “record” how much the cleaner should get (based on their level—Bronze 80%, Silver 82%, Gold 84%, Platinum 85% of the job value) and add a “pending payout” row. Later, a weekly job runs and sends that money to each cleaner’s Stripe account (Connect). We can turn off actually sending money with a config flag, but we still record what we would pay.

### 2. Where it is used

**Technical:** The flow is implemented in `src/services/payoutsService.ts` (recordEarningsForCompletedJob, getCleanerPayoutPercent, processPendingPayouts, processSinglePayout, updatePayoutPause, getCleanerPayouts), `src/workers/v1-core/payoutWeekly.ts` (calls processPendingPayouts), and `src/services/stripeConnectService.ts` (cleaner onboarding for stripe_account_id). It is invoked from: jobTrackingService (when client approves job), jobsService (when job is approved/completed), autoExpireAwaitingApproval worker (when job auto-approves), disputesService (when dispute resolved in cleaner’s favor and job is (re-)approved). Tables: payouts, cleaner_profiles (tier, payout_percent, stripe_account_id, payout_paused). Stripe Connect API: transfers.create(destination: stripe_account_id).

**Simple (like for a 10-year-old):** The “payout” code lives in the payouts service and a weekly worker. When a job is approved (by the client or by auto-approve or after a dispute) we call “record earnings” and add a pending payout. The weekly worker loads all pending payouts, groups them by cleaner, and sends money to each cleaner’s Stripe account. We need the cleaner’s tier and their Stripe Connect account ID (set when they onboard).

### 3. When we use it

**Technical:** We use it when: (1) a job is approved and completed—jobTrackingService (client approves), jobsService (approve flow), or autoExpireAwaitingApproval (auto-approve after window) calls recordEarningsForCompletedJob; (2) a dispute is resolved in the cleaner’s favor and the job is (re-)approved—disputesService calls recordEarningsForCompletedJob; (3) on schedule—payoutWeekly worker (e.g. Monday 3 AM) runs processPendingPayouts. There is no “immediate payout” on approval; we batch and pay weekly (or when the worker runs). Manual: processSinglePayout(payoutId) for one payout; updatePayoutPause(cleanerId, true) to pause payouts for a cleaner.

**Simple (like for a 10-year-old):** We use it when a job is approved (by the customer or by auto-approve or after a dispute)—we record “cleaner gets this much.” We use it again when the weekly job runs—we send all the pending money to cleaners. We don’t pay the cleaner the second the job is approved; we collect pending payouts and pay in a batch (e.g. weekly). We can also pay one payout by hand or pause payouts for one cleaner.

### 4. How it is used

**Technical:** **Record:** recordEarningsForCompletedJob(job) gets getCleanerPayoutPercent(cleanerId) from cleaner_profiles (tier → env CLEANER_PAYOUT_PERCENT_* or payout_percent override). grossCents = job.credit_amount * CENTS_PER_CREDIT; payoutCents = round(grossCents * payoutPercent/100); platformFeeCents = grossCents - payoutCents. In a transaction: verify user exists, INSERT payouts (cleaner_id, job_id, stripe_transfer_id null, amount_credits, amount_cents, status 'pending'). Publish payout_created. **Process:** processPendingPayouts() returns early if !PAYOUTS_ENABLED. SELECT pending payouts JOIN cleaner_profiles.stripe_account_id WHERE status='pending' and !payout_paused. Group by cleaner_id. For each cleaner: if no stripe_account_id, mark payouts failed and skip; else totalCents = sum(p.amount_cents), idempotencyKey = payout_${cleanerId}_${date}_${payoutIds}; stripe.transfers.create(amount: totalCents, currency, destination: stripe_account_id, metadata); UPDATE payouts SET status='paid', stripe_transfer_id WHERE id IN payoutIds; publish payout_batch_processed; on error mark payouts failed.

**Simple (like for a 10-year-old):** When we record: we look up the cleaner’s tier and get their payout percent (80–85%). We multiply the job’s credit value by that percent to get the payout in cents and create a “pending payout” row. When we process: we load all pending payouts, group by cleaner, and for each cleaner we send one Stripe transfer for the total amount to their Connect account, then mark those payouts “paid.” If a cleaner has no Connect account we mark their payouts failed and skip. We use an idempotency key so we don’t send the same transfer twice.

### 5. How we use it (practical)

**Technical:** In day-to-day: job approval flows call recordEarningsForCompletedJob; no direct “create payout” API for clients. The payoutWeekly worker runs on schedule (e.g. cron Monday 3 AM); it calls processPendingPayouts(). Env: PAYOUTS_ENABLED (default false), PAYOUT_CURRENCY, CENTS_PER_CREDIT, CLEANER_PAYOUT_PERCENT_BRONZE/SILVER/GOLD/PLATINUM. Cleaners need stripe_account_id (Stripe Connect onboarding) before they can receive payouts; payout_paused can block a cleaner. To debug: query payouts (status, stripe_transfer_id); getCleanerPayouts(cleanerId); check Stripe Connect dashboard for transfers.

**Simple (like for a 10-year-old):** In practice we don’t “create a payout” by hand from the app—it happens when a job is approved. The weekly job runs on a schedule and sends all pending payouts. We set “payouts enabled,” currency, price per credit, and the four tier percentages in config. Cleaners must have connected their Stripe account (onboarding) to get paid; we can also “pause” payouts for one cleaner. To see what happened we look at the payouts table and Stripe’s dashboard.

### 6. Why we use it vs other methods

**Technical:** Tier-based payout (80–85%) aligns cleaner pay with reliability and gives the platform a consistent fee (15–20%). Recording pending payouts per job gives a clear audit trail (each payout row = one job) and supports batching (one transfer per cleaner per run). Stripe Connect transfers move money to the cleaner’s connected account without us holding balances. Batch processing (weekly) reduces transfer count and simplifies reconciliation. Alternatives—pay per job immediately, or manual payouts only—would be more real-time or simpler but less efficient and harder to audit.

**Simple (like for a 10-year-old):** We use tiers so better cleaners get a bit more (80–85%) and we keep a clear fee. We record “this job = this much payout” so we have a clear history and we can add up and pay in one go per cleaner. Stripe Connect sends money to the cleaner’s own Stripe account so we don’t hold their money. Paying weekly in a batch is simpler and cheaper than paying after every single job.

### 7. Best practices

**Technical:** We use a transaction when creating the payout row so we don’t leave partial state. We check user exists before insert to avoid FK errors. We use Stripe transfer idempotency key (payout_${cleanerId}_${date}_${payoutIds}) so retrying the worker doesn’t double-send. We mark payouts failed when stripe_account_id is missing or when transfer throws, and we log. We publish payout_created and payout_batch_processed so notifications and n8n can react. Gaps: we don’t use the Stripe wrapper (circuit breaker) for stripe.transfers.create; we could add retry with backoff for transient Stripe errors; we don’t have a “payout failed” event that notifications consume.

**Simple (like for a 10-year-old):** We create the payout row in a transaction so we don’t leave half-done data. We check the cleaner exists before creating the payout. We use an idempotency key when sending the Stripe transfer so if the worker runs twice we don’t send money twice. We mark payouts failed when the cleaner has no Connect account or when Stripe fails, and we log. We tell the app “payout created” and “payout batch processed” so we can send emails. What we could do better: use our “safe Stripe” wrapper and retry on temporary Stripe errors; send a “payout failed” message for notifications.

### 8. Other relevant info

**Technical:** The payout flow is critical for cleaner trust and platform liability. Tier is derived from reliability score (see reliabilityService / FOUNDER_BACKEND_REFERENCE); cleaner_profiles.payout_percent overrides tier when set. PAYOUTS_ENABLED=false is the default so we don’t send real money until Connect and policy are ready. payouts table schema: id, cleaner_id (FK users.id), job_id, stripe_transfer_id, amount_credits, amount_cents, status, created_at, updated_at. paymentService handles payment_intent.succeeded; creditsService releases credits to cleaner on job completion; payoutsService only moves money to Connect—it doesn’t touch credit_ledger. Document tier or percent changes in DECISIONS.md.

**Simple (like for a 10-year-old):** This flow really matters—cleaners expect to get paid. Their “level” (tier) comes from their reliability score; we can also set a custom payout percent per cleaner. We keep “payouts enabled” off by default so we don’t send real money until we’re ready. The payouts table stores who, which job, how much, and whether we’ve paid. The payment flow puts money from the client into our system; the credit flow “releases” credits to the cleaner; this flow sends that money to the cleaner’s Stripe account. We should write down any change to tier percentages or policy.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The payout flow is supposed to: (1) record how much each cleaner is owed per completed/approved job (tier-based percentage of job value); (2) batch those pending payouts and send money to each cleaner’s Stripe Connect account on a schedule; (3) avoid double-paying via idempotency on the transfer; (4) emit events so notifications (e.g. “payout sent”) can run. Success means: every completed/approved job has a payout row (pending then paid), money arrives in the cleaner’s Connect account, and the app is notified.

**Simple (like for a 10-year-old):** It’s supposed to figure out how much we owe each cleaner for each finished job (based on their level), save that as “pending payout,” and then send that money to their Stripe account in a batch (e.g. weekly). It’s supposed to never send the same money twice and to tell the app “payout created” and “payout batch processed” so we can send emails. Success means every completed job has a payout and the money shows up in the cleaner’s account.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for “record” means: payouts has a new row (cleaner_id, job_id, amount_credits, amount_cents, status 'pending'); payout_created event was published. Done for “process” means: for each cleaner with pending payouts and stripe_account_id, stripe.transfers.create succeeded; payouts rows updated to status 'paid' and stripe_transfer_id set; payout_batch_processed event published. Observable: payouts.status = 'paid', stripe_transfer_id set; Stripe Connect dashboard shows transfer. Failure: payouts.status = 'failed' (no stripe_account_id or transfer threw); we log and optionally publish failure for notifications.

**Simple (like for a 10-year-old):** Success for “record” means we have a new “pending payout” row and we sent “payout created.” Success for “process” means we sent the Stripe transfer, we marked those payouts “paid” with the transfer ID, and we sent “payout batch processed.” You can see success in the payouts table (status paid, transfer ID) and in Stripe. If we can’t pay (no Connect account or Stripe failed) we mark the payouts “failed” and log.

### 11. What would happen if we didn't have it?

**Technical:** Without this flow we wouldn’t pay cleaners—no payout rows, no Stripe Connect transfers. We’d have to pay them manually (e.g. bank transfer, check) or use another system. Cleaners wouldn’t get paid on a predictable schedule; we’d have no audit trail of “job X → payout Y”; platform liability and trust would suffer.

**Simple (like for a 10-year-old):** Without it we wouldn’t send money to cleaners—no “pending payout” rows and no Stripe transfers. We’d have to pay them some other way (manual transfer, etc.). Cleaners wouldn’t get paid on a schedule and we wouldn’t have a clear record of “this job = this payout.”

### 12. What is it not responsible for?

**Technical:** The payout flow is not responsible for: computing reliability score or tier (reliabilityService, scoring); releasing credits from escrow to the cleaner (creditsService.releaseJobCreditsToCleaner); client payment (paymentService); creating the job or marking it completed (jobsService, jobTrackingService); Stripe Connect onboarding (stripeConnectService); disputes or refunds (disputesService, refundProcessor). It only records payout amount from tier and job, and sends money via Connect.

**Simple (like for a 10-year-old):** It doesn’t figure out the cleaner’s tier—that’s the reliability/scoring system. It doesn’t “release” credits to the cleaner in our ledger—that’s the credits service. It doesn’t take the client’s payment—that’s the payment flow. It doesn’t create the job or mark it done—that’s jobs and tracking. It doesn’t connect the cleaner’s Stripe account—that’s onboarding. It only figures “how much do we pay for this job?” and sends that money to their Connect account.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For recordEarningsForCompletedJob: job (with cleaner_id, credit_amount). We need cleaner_profiles (tier or payout_percent), users (cleaner exists), env CENTS_PER_CREDIT, CLEANER_PAYOUT_PERCENT_*. For processPendingPayouts: payouts (status 'pending'), cleaner_profiles (stripe_account_id, payout_paused), env PAYOUTS_ENABLED, PAYOUT_CURRENCY, STRIPE_SECRET_KEY. Stripe API: transfers.create(amount, currency, destination, metadata, idempotencyKey).

**Simple (like for a 10-year-old):** To record we need the job (who’s the cleaner, how many credits the job was). We need the cleaner’s tier or custom percent and the price per credit in config. To process we need the list of pending payouts and each cleaner’s Stripe Connect account ID (and that payouts aren’t paused). We need “payouts enabled,” currency, and Stripe key in config.

### 14. What does it produce or change?

**Technical:** It produces: (1) rows in payouts (cleaner_id, job_id, amount_credits, amount_cents, status pending/paid/failed, stripe_transfer_id); (2) Stripe Connect transfers (money to destination account); (3) payout_created and payout_batch_processed events; (4) logs (payout_recorded, payout_batch_success, payout_batch_failed, payout_missing_stripe_account). It updates payouts.status and payouts.stripe_transfer_id. It does not change credit_ledger or job status.

**Simple (like for a 10-year-old):** It creates and updates “payout” rows (who, which job, how much, pending/paid/failed, Stripe transfer ID). It sends money via Stripe to the cleaner’s Connect account. It sends “payout created” and “payout batch processed” to the app. It doesn’t change the credit ledger or the job’s status.

### 15. Who or what consumes its output?

**Technical:** Consumers of payouts table: admin/support (payout history), getCleanerPayouts(cleanerId) for cleaner dashboard, reconciliation (payout vs earnings). Consumers of payout_created / payout_batch_processed: event system → n8n, notifications (e.g. “payout sent”). Stripe holds the transfer; the cleaner’s Connect account receives the funds. metrics.payoutProcessed(amountCents, success) is recorded for observability.

**Simple (like for a 10-year-old):** Our “payout” rows are read by admins and by the cleaner’s dashboard (their payout history). The “payout created” and “payout batch processed” messages go to the event system and then to n8n and notifications so we can send “your payout was sent.” The actual money goes to the cleaner’s Stripe account. We also record numbers for dashboards.

### 16. What are the main steps or flow it performs?

**Technical:** **Record:** (1) getCleanerPayoutPercent(cleanerId) from cleaner_profiles (payout_percent or tier → env); (2) grossCents = job.credit_amount * CENTS_PER_CREDIT; payoutCents = round(grossCents * payoutPercent/100); (3) In transaction: check user exists, INSERT payouts (pending); (4) publish payout_created. **Process:** (1) If !PAYOUTS_ENABLED return; (2) SELECT pending payouts JOIN stripe_account_id, WHERE !payout_paused; (3) Group by cleaner_id; (4) For each cleaner: if !stripe_account_id mark failed, skip; else totalCents = sum(amount_cents), idempotencyKey = payout_${cleanerId}_${date}_${payoutIds}; (5) stripe.transfers.create(amount: totalCents, destination: stripe_account_id, idempotencyKey); (6) UPDATE payouts SET status='paid', stripe_transfer_id; (7) publish payout_batch_processed; on catch mark payouts failed, log, metrics.

**Simple (like for a 10-year-old):** When we record: we get the cleaner’s payout percent, multiply the job’s value by that percent, and insert a “pending payout” row in a transaction, then tell the app “payout created.” When we process: we load pending payouts, group by cleaner; for each cleaner with a Connect account we send one Stripe transfer for the total and mark those payouts “paid”; if they have no Connect account or Stripe fails we mark “failed” and log.

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) job must have cleaner_id for recordEarningsForCompletedJob; (2) user (cleaner) must exist before we insert payout; (3) PAYOUTS_ENABLED gates processPendingPayouts (when false we don’t call Stripe); (4) payouts with payout_paused=true are skipped (we don’t load them in the “pending” query—actually we filter COALESCE(cp.payout_paused, false) = false); (5) tier maps to fixed percentages (Bronze 80%, Silver 82%, Gold 84%, Platinum 85%) unless payout_percent is set. We don’t enforce: minimum payout amount; or “cleaner must have completed onboarding” beyond having stripe_account_id for payment.

**Simple (like for a 10-year-old):** We enforce: the job must have a cleaner before we record a payout; the cleaner must exist in the users table; we only send money when “payouts enabled” is on; we skip cleaners who have “payout paused”; and we use the tier percentages (or a custom percent if set). We don’t enforce a minimum payout or that the cleaner finished full onboarding beyond having a Connect account.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** recordEarningsForCompletedJob is triggered by: jobTrackingService (client approves job), jobsService (approve flow), autoExpireAwaitingApproval worker (auto-approve), disputesService (dispute resolved in cleaner’s favor and job (re-)approved). processPendingPayouts is triggered by: payoutWeekly worker (schedule, e.g. Monday 3 AM). Optionally: processSinglePayout(payoutId) for manual one-off; updatePayoutPause for pausing a cleaner. No trigger from client “request payout”—we batch on schedule.

**Simple (like for a 10-year-old):** “Record” is triggered when a job is approved—by the client, by auto-approve, or after a dispute. “Process” is triggered when the weekly worker runs (e.g. Monday 3 AM). We can also run “pay one payout” by hand or pause a cleaner. Cleaners don’t click “pay me now”—we pay on a schedule.

### 19. What could go wrong while doing its job?

**Technical:** (1) Cleaner has no stripe_account_id—we mark payouts failed and skip; they don’t get paid until they complete Connect onboarding. (2) stripe.transfers.create fails (Stripe down, insufficient balance, invalid account)—we catch, mark payouts failed, log; we don’t retry in this code. (3) recordEarningsForCompletedJob: user doesn’t exist—we throw with clear message; FK on payouts could also fail if cleaner_id is wrong. (4) Duplicate recordEarningsForCompletedJob for same job—we’d insert a second payout row (no unique constraint on job_id in payouts); so we could have two pending payouts for the same job if caller invokes twice—callers (jobTrackingService, jobsService) should only call once per approval. (5) Idempotency key collision if same cleaner same day same payout set—key includes payoutIds so different sets are different keys; retry same run is safe. (6) PAYOUTS_ENABLED false—we never send money; pending payouts accumulate.

**Simple (like for a 10-year-old):** Things that can go wrong: the cleaner hasn’t connected Stripe—we mark their payouts failed and skip. Stripe might be down or we might not have enough balance—we mark failed and log; we don’t retry here. When recording, if the cleaner doesn’t exist we throw. If someone calls “record” twice for the same job we could get two payout rows (we don’t block that in the DB)—the callers should only call once per approval. If “payouts enabled” is off we never send money; we just pile up pending payouts.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) payouts rows (status pending → paid or failed, stripe_transfer_id); (2) logs—payout_recorded, payout_batch_success, payout_batch_failed, payout_missing_stripe_account, no_pending_payouts; (3) metrics.payoutProcessed(amountCents, success); (4) Stripe Connect dashboard (transfers). We don’t have a dedicated “payout success rate” dashboard in this module; we’d query payouts and Stripe. Tests: payoutsService.test, payoutWeekly.test.

**Simple (like for a 10-year-old):** We know it’s working when we see payouts move from “pending” to “paid” with a transfer ID, and when we see “payout batch success” in the logs. We know something’s wrong when we see “failed” or “missing stripe account.” We have tests for record and process. We don’t have a single “payout health” dashboard yet—we’d look at the DB and Stripe.

### 21. What does it depend on to do its job?

**Technical:** It depends on: (1) Stripe API (transfers.create) and STRIPE_SECRET_KEY; (2) DB: payouts, cleaner_profiles (tier, payout_percent, stripe_account_id, payout_paused), users; (3) env: PAYOUTS_ENABLED, PAYOUT_CURRENCY, CENTS_PER_CREDIT, CLEANER_PAYOUT_PERCENT_BRONZE/SILVER/GOLD/PLATINUM; (4) event system (publishEvent); (5) reliability/tier populated in cleaner_profiles (reliabilityService or manual). It does not depend on creditsService for the transfer step (credits are already released elsewhere); it does not depend on the queue for record—only the worker uses the queue to run processPendingPayouts.

**Simple (like for a 10-year-old):** It needs Stripe (to send transfers), the database (payouts, cleaner profiles with tier and Connect account ID), config (payouts enabled, currency, price per credit, tier percentages), and the event system (to say “payout created” and “payout batch processed”). It needs the cleaner’s tier to be set (by the reliability system or by hand). It doesn’t need the credits service for the actual transfer—credits are already released when the job is approved.

### 22. What are the main config or env vars that control its behavior?

**Technical:** PAYOUTS_ENABLED—when false, processPendingPayouts does nothing (returns 0 processed). PAYOUT_CURRENCY (e.g. usd). CENTS_PER_CREDIT—same as payment flow for gross value. CLEANER_PAYOUT_PERCENT_BRONZE (80), SILVER (82), GOLD (84), PLATINUM (85)—tier percentages. STRIPE_SECRET_KEY—for Stripe API. cleaner_profiles.payout_percent overrides tier when set; payout_paused skips that cleaner.

**Simple (like for a 10-year-old):** The main settings are: “payouts enabled” (if off we don’t send money), currency, price per credit, and the four tier percentages (80, 82, 84, 85). We need the Stripe secret key. We can also set a custom payout percent per cleaner or pause payouts for one cleaner.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests: payoutsService.test (recordEarningsForCompletedJob creates payout with correct amount from tier; processPendingPayouts groups and marks paid/failed). payoutWeekly.test (worker calls processPendingPayouts, returns counts). We mock Stripe or use test mode; we mock query for some tests. We don’t run a full E2E “real transfer to Connect account” in CI.

**Simple (like for a 10-year-old):** We have tests that check: recording creates a payout row with the right amount for the tier, and processing groups payouts and marks them paid or failed. We mock Stripe or use test mode. We don’t run a full “real transfer to a real Connect account” in CI.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If recordEarningsForCompletedJob fails (user missing, FK)—caller (jobTrackingService, etc.) may retry; we have no idempotency on “record” so retry could create a second payout row for the same job (callers should only call once). If processPendingPayouts fails (Stripe error)—we mark those payouts failed; we don’t retry in this code; next run will only see other pending payouts (failed ones stay failed). Manual recovery: fix stripe_account_id or Stripe balance, then either re-create pending payouts for the failed jobs or add a “retry failed payouts” path that resets status to pending for a subset. We don’t have an automatic “retry failed” job today.

**Simple (like for a 10-year-old):** If recording fails (e.g. cleaner doesn’t exist) the caller might retry—we don’t prevent two payout rows for the same job, so callers should only call once. If processing fails (Stripe error) we mark those payouts failed and don’t retry here; the next run only sees other pending payouts. To fix we’d fix the Connect account or Stripe and then either re-record payouts or add a “retry failed” step. We don’t have an automatic retry for failed payouts yet.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: cleaners (they get paid); product and finance (tier policy and platform fee); support (debugging “I didn’t get paid”); engineering (reliability and Stripe Connect); compliance (we move money to connected accounts). Clients benefit indirectly (cleaners are paid so they stay on the platform).

**Simple (like for a 10-year-old):** People who care: the cleaners who get paid, the team that sets tier policy and fees, support when someone says “I didn’t get my payout,” and engineers who keep Stripe Connect working. Clients care indirectly because happy cleaners stay on the platform.

### 26. What are the security or privacy considerations for what it does?

**Technical:** We move money to Stripe Connect accounts; we must protect STRIPE_SECRET_KEY and ensure only our backend can call transfers.create. payout rows contain cleaner_id, amount—access should be restricted (cleaner sees own, admin sees all). stripe_account_id is sensitive (Stripe identity); store and log carefully. We don’t expose “retry payout” or “mark paid” to clients; only admin or backend. Idempotency key prevents double-send from replay. Tier and payout_percent are business data; changing them affects future payouts only.

**Simple (like for a 10-year-old):** We send real money to cleaners’ Stripe accounts, so we protect our Stripe key and only our server can do transfers. Payout rows show who got how much—only the cleaner and admins should see that. The Connect account ID is sensitive. We don’t let customers or cleaners trigger “pay me” or “mark paid”—only our backend or admin. We use an idempotency key so we don’t send the same money twice.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** Stripe has rate limits on transfers; batching (one transfer per cleaner per run) reduces API calls. If we have many cleaners with pending payouts we loop sequentially—we could parallelize with a cap. payouts table grows with completed jobs; we can index by cleaner_id, status, created_at. Platform balance must be sufficient for all transfers in a run (we don’t check “do we have enough” before calling transfers.create—Stripe will fail if not). No per-cleaner or per-run amount limit in this module.

**Simple (like for a 10-year-old):** Stripe limits how many transfers we can do; batching (one per cleaner per run) helps. If we have lots of cleaners we do them one after another—we could do some in parallel with a limit. The payouts table gets bigger as more jobs complete. We need enough money in our Stripe account to cover all transfers in a run; Stripe will fail if we don’t. We don’t limit “max payout per cleaner per run” here.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add idempotency on “record” (e.g. unique on (job_id) in payouts or “record only if no payout for this job”) to prevent duplicate payout rows. We’d use the Stripe wrapper for transfers.create (circuit breaker, retry). We’d add a “retry failed payouts” job or button (reset status to pending for failed payouts with stripe_account_id now set). We’d add payout_failed event for notifications. We’d add metrics (success rate, latency) and optional alerting. We’d document “platform balance required” and consider a pre-check before running the batch.

**Simple (like for a 10-year-old):** We’d prevent two “record” rows for the same job (e.g. unique constraint). We’d use our “safe Stripe” wrapper and retry on temporary failures. We’d add a way to “retry failed payouts” when the Connect account or balance is fixed. We’d send a “payout failed” message for notifications. We’d add dashboards and alerts. We’d document how much balance we need and maybe check before running the batch.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per payout row: (1) Start—recordEarningsForCompletedJob creates row (status 'pending'). (2) Process—worker runs processPendingPayouts; we load pending, create transfer, UPDATE status to 'paid', set stripe_transfer_id. (3) Finish—row is 'paid' or 'failed'. No further state transitions in this module (we don’t “reverse” or “refund” a payout here—that would be disputes/Stripe). Per run: processPendingPayouts starts, loops cleaners, finishes and returns { processed, failed, skipped }.

**Simple (like for a 10-year-old):** For each payout: we start when we record (status “pending”). We finish when the worker runs and either marks it “paid” (with transfer ID) or “failed.” We don’t “undo” a payout in this code—that would be elsewhere. For each run of the worker: it starts, processes each cleaner, and returns how many processed, failed, and skipped.

### 30. What state does it keep or track?

**Technical:** Persistent state: payouts (id, cleaner_id, job_id, stripe_transfer_id, amount_credits, amount_cents, status, created_at, updated_at). We read cleaner_profiles (tier, payout_percent, stripe_account_id, payout_paused) and users. No in-memory state in this module; all is DB and Stripe. Stripe holds the transfer record on their side.

**Simple (like for a 10-year-old):** We keep: the payouts table (who, which job, how much, pending/paid/failed, Stripe transfer ID). We read the cleaner’s tier and Connect account ID from their profile. We don’t keep anything in memory—everything is in the database and in Stripe.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) job.cleaner_id and job.credit_amount are set and valid when we record; (2) cleaner_profiles has tier or payout_percent (we default to Bronze 80% if missing); (3) users row exists for cleaner_id (we check before insert); (4) For process: cleaner_profiles.stripe_account_id is the correct Connect account for the cleaner; (5) Platform has sufficient balance in Stripe for transfers; (6) Stripe API is available; (7) recordEarningsForCompletedJob is called once per job approval (we don’t enforce uniqueness in payouts for job_id). We assume tier is kept in sync with reliability by reliabilityService or admin.

**Simple (like for a 10-year-old):** We assume the job has a cleaner and a credit amount when we record; we assume the cleaner has a tier (or we use 80%); we assume the cleaner exists in the users table. When we process we assume the Connect account ID is correct and we have enough money in Stripe. We assume “record” is only called once per approval—we don’t block duplicates in the DB. We assume someone else keeps the cleaner’s tier up to date (reliability system or admin).

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use recordEarningsForCompletedJob for: jobs that aren’t approved/completed (e.g. cancelled, disputed and not resolved); or when the job was already paid (we don’t check “existing payout for this job”). Don’t use processPendingPayouts for: paying someone other than cleaners (e.g. refunds go through payment/refund flow); or when PAYOUTS_ENABLED is false (we’d do nothing). Use something else for: client refunds (refundProcessor); or manual one-off payments outside Connect (we only do Connect transfers here).

**Simple (like for a 10-year-old):** Don’t use “record” for jobs that aren’t done and approved, or for a job we already recorded a payout for. Don’t use “process” when payouts are disabled—we’d do nothing. Use something else for refunds to clients or for paying people who aren’t cleaners via Connect.

### 33. How does it interact with other systems or features?

**Technical:** It receives calls from jobTrackingService, jobsService, autoExpireAwaitingApproval, disputesService (recordEarningsForCompletedJob). It calls getCleanerPayoutPercent (reads cleaner_profiles), Stripe transfers.create, publishEvent (payout_created, payout_batch_processed). It writes payouts. Consumers: admin/support (payout history), getCleanerPayouts, notifications (via events), metrics. Tier comes from reliabilityService (cleaner_profiles.tier); stripe_account_id comes from stripeConnectService (onboarding). creditsService.releaseJobCreditsToCleaner is separate (releases credits to ledger); payoutsService only moves money to Connect.

**Simple (like for a 10-year-old):** Job tracking and jobs and disputes call us to “record” when a job is approved. We read the cleaner’s tier and Connect account ID, call Stripe to send money, and tell the app “payout created” and “payout batch processed.” Admins and the cleaner dashboard read payout history. Notifications use the events. The reliability system sets tier; the Connect onboarding sets the cleaner’s Stripe account ID. Releasing credits to the cleaner in our ledger is separate—we only send money to their Stripe account.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure for record: we throw (e.g. job has no cleaner, user doesn’t exist, FK error)—caller sees error. Failure for process: we mark payouts status='failed' (no stripe_account_id or transfer threw); we log payout_batch_failed or payout_missing_stripe_account; we don’t throw for the whole run—we continue with other cleaners. We don’t publish a dedicated payout_failed event today; we could add one. We signal failure by: throw (record), or status=failed + logs (process).

**Simple (like for a 10-year-old):** Failure for “record” means we throw (e.g. no cleaner, user missing)—the caller sees an error. Failure for “process” means we mark those payouts “failed” and log; we don’t crash the whole run—we keep going for other cleaners. We don’t send a “payout failed” message to the app yet; we could add that. So failure is either “throw” or “status failed + logs.”

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we compute payout from job.credit_amount and tier (or payout_percent); we trust job and cleaner_profiles. Completeness: we can reconcile payouts (status paid) vs jobs (completed/approved) and vs Stripe transfers; reconciliationService or manual checks. We don’t have an automated “every completed job has a payout” or “every pending payout was processed or failed” check in this module. We rely on callers calling record once per approval and on the worker running on schedule.

**Simple (like for a 10-year-old):** We trust the job’s credit amount and the cleaner’s tier when we compute the payout. To see if everything is correct we can compare payouts to completed jobs and to Stripe transfers. We don’t have an automatic “every job has a payout” check here—we rely on the right code calling “record” and the worker running.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned in the repo; typically the backend or payments team would own the payout flow. Changes to tier percentages or PAYOUTS_ENABLED affect policy and money movement; document in DECISIONS.md. Stripe Connect and transfer API are maintained per Stripe’s docs.

**Simple (like for a 10-year-old):** The team that owns the backend (or payments) is responsible. When we change tier percentages or turn payouts on/off we should write it down. We keep our Stripe Connect usage in line with Stripe’s docs.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) idempotency on record (unique job_id in payouts or “record if not exists”); (2) retry failed payouts (job or admin action); (3) payout_failed event and notifications; (4) Stripe wrapper and retry for transfers; (5) multiple payout runs per week or “on demand” payout request by cleaner; (6) minimum payout amount or “hold until $X”; (7) reconciliation job (payouts vs Stripe vs ledger). As we add regions we might have different currencies or payout schedules.

**Simple (like for a 10-year-old):** As we grow we might prevent duplicate “record” for the same job, add a “retry failed” job or button, and send “payout failed” to notifications. We might use our “safe Stripe” wrapper and retry. We might let cleaners request “pay me now” or we might pay more than once a week. We might add a minimum payout or a reconciliation job. If we add regions we might have different currencies or schedules.

---

## Additional questions (A): Cost, performance, contract, resilience, metrics, access

### A1. What does it cost to run?

**Technical:** Cost is dominated by: (1) Stripe Connect transfer fees (if any per transfer); (2) platform balance (we pay out from our Stripe balance to connected accounts); (3) DB writes (payouts). We don’t pay Stripe per “record”—only when we actually transfer. Cost scales with completed jobs and payout runs.

**Simple (like for a 10-year-old):** We pay Stripe for transfers (if they charge per transfer) and we need money in our Stripe account to send to cleaners. We also write to the database. More completed jobs and more payout runs mean more cost. Recording a “pending payout” doesn’t cost money—only the actual transfer does.

### A2. How fast should it be? What's acceptable latency or throughput?

**Technical:** recordEarningsForCompletedJob should be fast (one transaction, one insert) so job approval isn’t delayed. processPendingPayouts runs in the worker; we process cleaners sequentially so run time grows with number of cleaners with pending payouts. We don’t want to block job approval; we don’t have an SLA for “money in cleaner account within X hours” (we batch weekly). Throughput is limited by Stripe transfer rate limits and our loop.

**Simple (like for a 10-year-old):** Recording should be quick so approving the job isn’t slow. Processing runs in the background; we do one cleaner after another so the run takes longer if there are many cleaners. We don’t promise “money in 24 hours”—we pay on a schedule (e.g. weekly). Stripe and our loop limit how fast we can pay everyone.

### A4. How long do we keep the data it uses or produces?

**Technical:** payouts rows are kept indefinitely unless we add retention. We don’t purge by age in this module. For compliance we might retain payout records for 7 years. Stripe retains transfer records per their policy.

**Simple (like for a 10-year-old):** We keep payout rows until we decide to delete them—we don’t auto-delete yet. For legal or tax we might keep them for several years. Stripe keeps their own records.

### A6. How do we change it without breaking callers?

**Technical:** Add new tier or payout_percent logic without removing existing tiers; keep CLEANER_PAYOUT_PERCENT_* env vars. When changing Stripe API version or transfer params, support both during migration. Don’t remove or rename payout_created / payout_batch_processed payload fields without notifying consumers. PAYOUTS_ENABLED is a kill switch; turning it off doesn’t break record—only process does nothing.

**Simple (like for a 10-year-old):** We add new tiers or percent logic without removing old ones. When we change how we call Stripe we support both during the change. We don’t change the “payout created” or “payout batch processed” message shape without telling anyone who listens. Turning off “payouts enabled” doesn’t break recording—only “process” does nothing.

### A7. What's the "contract" (API, events, schema) and how stable is it?

**Technical:** Contract: recordEarningsForCompletedJob(job: Job) => Promise<Payout>; processPendingPayouts() => Promise<{ processed, failed, skipped }>; getCleanerPayoutPercent(cleanerId) => Promise<number>. payouts table: cleaner_id, job_id, stripe_transfer_id, amount_credits, amount_cents, status. payout_created event: jobId, actorType, eventName: "payout_created", payload: { payoutId, cleanerId, grossCredits, payoutCredits, payoutCents, payoutPercent, platformFeeCents }. payout_batch_processed: payload: { cleanerId, transferId, totalCents, payoutCount }. Stability: we treat tier enum and event payloads as stable; new fields are additive.

**Simple (like for a 10-year-old):** The “deal” is: you pass a job to “record” and get back a payout row; you run “process” and get back how many processed, failed, and skipped. The payouts table has who, which job, how much, status, and transfer ID. The “payout created” and “payout batch processed” messages have a fixed shape. We try not to change those shapes; we add new fields when needed.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Record: we have no idempotency; calling recordEarningsForCompletedJob twice for the same job can create two payout rows (callers should only call once). Process: we use Stripe transfer idempotency key (payout_${cleanerId}_${date}_${payoutIds}); if we retry the same run Stripe returns the same transfer and we don’t double-send. Marking payouts “paid” is idempotent (we only update rows that are still “pending”). So: record is not idempotent; process is idempotent for the transfer and for the DB update.

**Simple (like for a 10-year-old):** “Record” isn’t idempotent—if we call it twice for the same job we could get two payout rows, so callers should only call once. “Process” is idempotent—we use an idempotency key with Stripe so if we run the worker twice we don’t send money twice, and we only mark “pending” payouts as “paid.” So recording twice is unsafe; processing twice is safe.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during record—we throw; caller sees error. If Stripe fails during process (transfers.create throws)—we catch, mark those payouts failed, log, continue with next cleaner; we don’t retry. If DB fails during process (e.g. UPDATE payouts)—we might have sent the transfer but not updated; on next run we’d have different idempotency key (different run) so we could double-send—we don’t have “transfer sent but not marked” recovery today. So we’re careful to UPDATE after transfer succeeds; if UPDATE throws we’ve already sent money and would need manual fix. If event system fails after record or process we still complete the DB work; we don’t retry publish.

**Simple (like for a 10-year-old):** If the DB fails when we record we throw and the caller sees an error. If Stripe fails when we process we mark those payouts failed and move on; we don’t retry. If the DB fails right after we sent the transfer we might have sent money but not marked “paid”—that would be a manual fix. If “publish event” fails we’ve already done the DB work; we don’t retry the publish.

### A12. What's the fallback or alternate path when the primary path fails?

**Technical:** If record fails the caller (e.g. jobTrackingService) might retry—we have no fallback; we’d want to avoid duplicate payout rows. If process fails (Stripe or no Connect account) we mark failed; we don’t have an automatic “retry failed” path. Fallback is manual: fix Connect account or Stripe balance, then re-record or add “retry failed” logic that resets status to pending for failed payouts that now have stripe_account_id. We don’t have another payment method (e.g. check, ACH) in this flow—only Stripe Connect.

**Simple (like for a 10-year-old):** If recording fails the caller might retry—we don’t have a fallback and we’d want to avoid two payout rows for the same job. If processing fails we mark failed and don’t retry automatically. The fallback is manual: fix the Connect account or Stripe and then either record again or add a “retry failed” step. We only pay via Stripe Connect—we don’t have checks or another method here.

### A13. If it breaks at 3am, who gets paged and what's the blast radius?

**Technical:** Paging follows the app’s on-call. Blast radius: if record fails (e.g. DB down) job approval might fail or throw—cleaners wouldn’t get a payout row until we fix it and the caller retries. If process fails (worker crashes or Stripe down) pending payouts stay pending; cleaners don’t get money until the next run or until we fix and retry. Existing paid payouts are unchanged. So impact is “new payouts not recorded” or “pending payouts not sent this run.”

**Simple (like for a 10-year-old):** Whoever is on call would get paged. If recording breaks, new job approvals might fail and cleaners won’t get a “pending payout” until we fix it. If processing breaks, pending payouts don’t get sent this run—cleaners wait until the next run or until we fix and run again. Already-paid payouts are fine. So the impact is “new payouts not recorded” or “this run didn’t send money.”

### A15. What business or product metric do we use to judge that it's "working"?

**Technical:** We don’t have a formal business metric in code. Operationally we’d use: (1) count of payouts (pending vs paid vs failed) per day/week; (2) processPendingPayouts return value (processed, failed, skipped); (3) Stripe Connect transfer count and volume. Product-level: “cleaners get paid on time” is the outcome; we’d measure via support tickets or cleaner surveys.

**Simple (like for a 10-year-old):** We don’t have one number in the code that says “payouts are working.” We’d look at: how many pending vs paid vs failed, what the worker returns (processed, failed, skipped), and Stripe’s dashboard. The real test is “do cleaners get paid on time?”—we’d see that from support or feedback.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** recordEarningsForCompletedJob is invoked by backend only (jobTrackingService, jobsService, autoExpireAwaitingApproval, disputesService)—no client-facing route. processPendingPayouts is invoked by the payoutWeekly worker (schedule) or by admin/script (processSinglePayout for one payout). updatePayoutPause and getCleanerPayouts may be exposed to admin or cleaner (own history). Configuration (PAYOUTS_ENABLED, CLEANER_PAYOUT_PERCENT_*) is env—whoever manages deployment. payout_percent and payout_paused in cleaner_profiles are typically admin or backend.

**Simple (like for a 10-year-old):** Only our backend calls “record” (when a job is approved)—no customer or cleaner button. “Process” is run by the weekly job or by an admin/script for one payout. Admins (or the cleaner for their own history) might see payout history. Only people who can change the server’s config can change “payouts enabled” and tier percentages. Admins or the system can set a cleaner’s custom percent or “payout paused.”

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_PAYMENT_FLOW.md`, `FOUNDER_BACKEND_REFERENCE.md` (reliability tier), `creditsService`, `stripeConnectService`, `payoutWeekly` worker.
