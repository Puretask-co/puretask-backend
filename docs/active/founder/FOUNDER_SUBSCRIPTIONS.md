# Founder Reference: Subscriptions / Recurring Jobs

**Candidate:** Subscriptions / recurring jobs (Feature #10)  
**Where it lives:** `src/services/premiumService.ts` (subscriptions), `src/routes/premium.ts`, `src/routes/client.ts` (recurring-bookings), `src/workers/v3-automation/subscriptionJobs.ts`, `cleaning_subscriptions` table; paymentService (invoice.paid → subscription_credit)  
**Why document:** How recurring cleanings are created, billed, and run; what "subscription" means in product and code.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Subscriptions / recurring jobs in PureTask cover two related concepts: (1) **Recurring cleaning subscriptions**—a client sets up a repeating cleaning (weekly, biweekly, or monthly) stored in `cleaning_subscriptions` (client_id, cleaner_id optional, frequency, day_of_week, preferred_time, address, credit_amount, status active|paused|cancelled, next_job_date, jobs_created). A worker (`subscriptionJobs`) runs daily (e.g. 2 AM), finds subscriptions with next_job_date within the next 7 days, creates a job via jobsService.createJob, optionally assigns the preferred cleaner (UPDATE job cleaner_id, status accepted), and marks the subscription (markSubscriptionJobCreated: jobs_created + 1, next_job_date = calculateNextJobDate). (2) **Stripe subscription credits**—when Stripe sends invoice.paid (e.g. monthly billing), we grant credits to the user (addLedgerEntry reason "subscription_credit") from invoice metadata or SUBSCRIPTION_DEFAULT_CREDITS. The first is "recurring job creation"; the second is "recurring credit top-up" (Stripe-managed billing). premiumService also has boosts and rush jobs; this doc focuses on cleaning subscriptions and the subscription-jobs worker.

**Simple (like for a 10-year-old):** A "subscription" here can mean two things: (1) A client signs up for a cleaning every week (or every two weeks or every month). We save that in a list (cleaning_subscriptions). Every day a background job looks at that list and, for any subscription whose "next cleaning date" is coming up in the next week, it creates a real cleaning job and then sets the "next cleaning date" for the next time. (2) When the client pays monthly via Stripe (like a membership), we get "invoice paid" and we add credits to their account. So one is "recurring cleaning jobs" and the other is "recurring credits from Stripe."

### 2. Where it is used

**Technical:** Recurring cleaning subscriptions: `src/services/premiumService.ts` (createSubscription, getClientSubscriptions, updateSubscriptionStatus, cancelSubscription, getSubscriptionsDueForJobCreation, markSubscriptionJobCreated, calculateNextJobDate), `src/routes/premium.ts` (POST/GET /premium/subscriptions, PATCH /premium/subscriptions/:id/status, DELETE /premium/subscriptions/:id) with require client role; `src/routes/client.ts` (GET/POST/PATCH/DELETE /client/recurring-bookings) querying/updating cleaning_subscriptions; `src/routes/clientEnhanced.ts` (skip next occurrence, suggestions) updating cleaning_subscriptions; `src/workers/v3-automation/subscriptionJobs.ts` (runSubscriptionJobs: getSubscriptionsDueForJobCreation, createJob, markSubscriptionJobCreated). Table: cleaning_subscriptions (DB/migrations/015_referrals_and_boosts.sql, 016_v2_core additions). Stripe subscription credits: paymentService.handleInvoicePaid (invoice.paid → resolveUserIdByStripeCustomer, addLedgerEntry reason subscription_credit). Feature flag: subscriptions.enabled (feature_flags); index mounts /premium for subscriptions (V3 ENABLED).

**Simple (like for a 10-year-old):** The "create/list/pause/cancel subscription" code lives in the premium service and the premium and client routes. Clients use /premium/subscriptions or /client/recurring-bookings to create and manage recurring cleanings. A worker (subscriptionJobs) runs every day and creates jobs from subscriptions that are due. The list of subscriptions is in the cleaning_subscriptions table. When Stripe says "invoice paid" (monthly billing), the payment service adds credits to the user. We have a feature flag to turn subscriptions on or off.

### 3. When we use it

**Technical:** We use recurring cleaning subscriptions when: (1) a client creates a subscription—POST /premium/subscriptions or POST /client/recurring-bookings with frequency, address, creditAmount, etc.; (2) a client lists or updates or cancels—GET/PATCH/DELETE on premium or client routes; (3) the subscriptionJobs worker runs on a schedule (e.g. daily 2 AM via scheduler)—getSubscriptionsDueForJobCreation (next_job_date <= CURRENT_DATE + 7 days, status active), for each createJob and markSubscriptionJobCreated. We use Stripe subscription credits when Stripe sends invoice.paid—handleStripeEvent dispatches to handleInvoicePaid, which grants credits. There is no fixed "business" trigger for creating a subscription—the client does; job creation is time-based (worker + next_job_date).

**Simple (like for a 10-year-old):** We use it when a client sets up a recurring cleaning (they pick how often and where). We use it when they look at their subscriptions, pause them, or cancel them. We use it when the daily worker runs (e.g. 2 AM)—it finds subscriptions whose "next cleaning" is in the next week and creates a job for each, then sets the next date. We use the Stripe subscription credits when Stripe tells us "invoice paid" (e.g. monthly)—we add credits to the user. So the client triggers "create subscription"; the worker triggers "create jobs"; Stripe triggers "add credits."

### 4. How it is used

**Technical:** **Create subscription (premiumService):** calculateNextJobDate(frequency, dayOfWeek) for initial next_job_date; INSERT cleaning_subscriptions (client_id, cleaner_id, frequency, day_of_week, preferred_time, address, latitude, longitude, credit_amount, next_job_date); status default active. **Worker:** getSubscriptionsDueForJobCreation() → WHERE status='active' AND next_job_date <= CURRENT_DATE + 7 days ORDER BY next_job_date; for each: build scheduledStart from next_job_date + preferred_time (default 9 AM), scheduledEnd = start + 3h; createJob({ clientId, scheduledStartAt, scheduledEndAt, address, creditAmount }); if cleaner_id set, UPDATE jobs SET cleaner_id, status='accepted'; markSubscriptionJobCreated(subscriptionId, jobId) → jobs_created += 1, next_job_date = calculateNextJobDate(frequency, day_of_week). **calculateNextJobDate:** from "now," find next occurrence of preferredDayOfWeek (0–6); for weekly that’s +7 days (or same week); biweekly +14; monthly +1 month. **Pause/resume:** updateSubscriptionStatus sets status active|paused; if active, set next_job_date to next occurrence; if paused, set next_job_date NULL. **Cancel:** status cancelled, next_job_date NULL. **Stripe subscription credits:** handleInvoicePaid gets userId from Stripe customer, credits from invoice.metadata.credits or metadata.credits_per_cycle or SUBSCRIPTION_DEFAULT_CREDITS; addLedgerEntry(userId, deltaCredits, reason "subscription_credit").

**Simple (like for a 10-year-old):** To create a subscription we figure the first "next cleaning date" from the frequency and day of week, then save the subscription with that date. The worker finds subscriptions whose next date is in the next 7 days, creates a job for each (with time from the subscription or default 9 AM), assigns the preferred cleaner if there is one, then updates the subscription: one more job created and the next date set to the next week (or two weeks or next month). Pausing clears the next date; resuming sets it again. Cancelling sets status cancelled and clears the next date. For Stripe we get the user from the Stripe customer id and the credit amount from the invoice (or a default), then we add those credits to their account with reason "subscription_credit."

### 5. How we use it (practical)

**Technical:** In day-to-day: clients create subscriptions via app (POST /premium/subscriptions or /client/recurring-bookings) with frequency, address, credit amount, optional cleaner and day/time. They list and manage them (GET, PATCH status, DELETE). Run the subscriptionJobs worker on a schedule (e.g. npm run worker:subscription-jobs or scheduler at 2 AM). Env: SUBSCRIPTION_DEFAULT_CREDITS used when Stripe invoice has no metadata (invoice.paid path). Feature flag subscriptions.enabled can gate the feature. Client routes expose recurring-bookings with richer fields (base_hours, cleaning_type, skip, suggestions) where migrations added them. To debug: query cleaning_subscriptions by client_id, status, next_job_date; check jobs created for a subscription (jobs_created column); logs subscription_jobs_worker_started, subscription_job_created, subscription_job_creation_failed.

**Simple (like for a 10-year-old):** In practice the client goes to the app and creates a recurring cleaning (how often, where, how many credits, maybe which cleaner and which day). They can see their list, pause or cancel. We run the "subscription jobs" worker every day (e.g. 2 AM). When Stripe sends "invoice paid" we add credits using a default amount if the invoice doesn’t say how many. We can turn the feature on or off with a flag. To see what’s going on we look at the cleaning_subscriptions table and the jobs that were created and at the logs.

### 6. Why we use it vs other methods

**Technical:** Recurring cleaning subscriptions let clients set up repeat cleanings once instead of booking each time; the worker creates jobs in a batch (next_job_date within 7 days) so we have a predictable lead time for matching. Storing next_job_date and jobs_created in cleaning_subscriptions keeps state simple and avoids re-deriving "when is the next job" from a generic schedule. Stripe invoice.paid for subscription credits keeps billing and dunning in Stripe; we only grant credits when paid. Alternatives—client books each job manually (no automation); cron per subscription (many jobs); or we bill subscriptions ourselves (we’d own dunning and retries). We chose: one worker run per day, one row per subscription with next_job_date, and Stripe for subscription billing when we use it.

**Simple (like for a 10-year-old):** We use recurring subscriptions so the client doesn’t have to book every week by hand—they set it up once and we create the jobs. We look 7 days ahead so we have time to assign a cleaner. We store "next cleaning date" and "how many jobs we’ve created" so we know what to do next. When we use Stripe for monthly billing we let Stripe handle the billing and we just add credits when they say "paid." Doing it another way (manual booking every time, or us doing the billing) would be more work or more risk.

### 7. Best practices

**Technical:** We use a single table (cleaning_subscriptions) and one worker (subscriptionJobs) so behavior is consistent. getSubscriptionsDueForJobCreation limits to next 7 days to avoid creating jobs too far in advance. We assign preferred cleaner when set (cleaner_id) so repeat clients get the same cleaner when possible. markSubscriptionJobCreated updates next_job_date with calculateNextJobDate so the next run picks the next occurrence. Status active|paused|cancelled lets clients pause without losing the subscription. Stripe subscription_credit uses a dedicated ledger reason so we can report and audit. Gaps: calculateNextJobDate uses "now" as base—if worker runs late the "next" date is still from run time (acceptable for daily worker); we don’t enforce "subscriptions.enabled" in every route (premium routes may not check feature flag); client and premium routes both touch cleaning_subscriptions with slightly different shapes (base_hours, cleaning_type in client list)—schema may have evolved; invoice.payment_failed (dunning) is TODO.

**Simple (like for a 10-year-old):** We have one table and one worker so everything stays in sync. We only create jobs for subscriptions whose next date is in the next week. If the client picked a preferred cleaner we assign them to the job. After creating a job we set the next date so the next run does the next occurrence. Clients can pause or cancel. We use a special "subscription_credit" reason in the ledger when we add credits from Stripe. What we could do better: we might not check the "subscriptions enabled" flag everywhere; the client and premium routes might use slightly different fields; we haven’t finished "what to do when Stripe says payment failed" (dunning).

### 8. Other relevant info

**Technical:** Recurring jobs are normal jobs (jobsService.createJob)—they go through the same matching, tracking, payment, and payout flows once created. See FOUNDER_PAYMENT_FLOW (job payment, credits), FOUNDER_PAYOUT_FLOW (cleaner earnings), FOUNDER_QUEUE (no queue used for subscription job creation—worker runs inline). Stripe subscription billing (invoice.paid → subscription_credit) is separate from "recurring cleaning" and is optional (some deployments may not use Stripe subscriptions). premiumService also contains boosts and rush jobs; expireBoosts worker calls expireOldBoosts. QUEUE_NAMES.SUBSCRIPTION_JOB exists but subscriptionJobs worker does not enqueue to it—it creates jobs directly in a loop. Document any change to frequency semantics or next_job_date calculation in DECISIONS.md.

**Simple (like for a 10-year-old):** The jobs we create from subscriptions are normal jobs—they get matched, tracked, paid, and paid out like any other job. How payment and payouts work is in the payment and payout docs. The "Stripe subscription" that adds credits every month is separate from "recurring cleaning"—you can have one without the other. The premium service also has "boosts" and "rush jobs"; a different worker expires old boosts. We have a queue name for "subscription job" but the worker doesn’t use it—it just creates jobs in a loop. If we change how we calculate "next date" or what weekly/biweekly/monthly means, we should write it down.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Recurring cleaning subscriptions are supposed to: (1) let clients set up repeat cleanings (weekly, biweekly, monthly) with address, credits, optional preferred cleaner and day/time; (2) create a job automatically when the next_job_date falls within the next 7 days (worker runs daily); (3) advance next_job_date after each job so the cycle continues; (4) let clients pause or cancel. Stripe subscription credits are supposed to grant credits to the user when invoice.paid fires (e.g. monthly billing). Success means: subscriptions are stored, jobs are created on time, next_job_date advances correctly, and (if used) invoice.paid results in credits in the ledger.

**Simple (like for a 10-year-old):** It’s supposed to let clients say "I want a cleaning every week (or every two weeks or every month)" and then have the system create that cleaning job automatically when the date comes up. After each job we set the next date so it keeps going. Clients can pause or cancel. When we use Stripe for monthly billing, it’s supposed to add credits to the user when Stripe says "invoice paid." Success means subscriptions are saved, jobs get created when they should, and credits get added when Stripe says paid.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for create subscription: row in cleaning_subscriptions (status active, next_job_date set). Done for worker run: for each subscription due, createJob called, job created; if cleaner_id, job updated with cleaner and status accepted; markSubscriptionJobCreated run (jobs_created incremented, next_job_date updated). Done for pause: status paused, next_job_date NULL. Done for cancel: status cancelled, next_job_date NULL. Done for invoice.paid: addLedgerEntry(subscription_credit) for user. Observable: cleaning_subscriptions.next_job_date and jobs_created; jobs table with client_id and scheduled_start_at matching subscription; credit_ledger with reason subscription_credit; logs subscription_job_created, subscription_credits_granted.

**Simple (like for a 10-year-old):** Success for "create subscription": we have a row in the table with status active and a "next job date." Success for the worker: for each subscription that’s due we create a job, assign the cleaner if we have one, and update the subscription (one more job created, next date set). Success for pause: the subscription is paused and the next date is cleared. Success for cancel: the subscription is cancelled. Success for Stripe: we added credits to the user’s account. We can see success by looking at the subscription table (next date, jobs created), the jobs table, the credit ledger, and the logs.

### 11. What would happen if we didn't have it?

**Technical:** Without recurring cleaning subscriptions clients would have to book every cleaning manually—no "every Tuesday" automation. Without the subscriptionJobs worker we’d never create jobs from subscriptions (next_job_date would never result in jobs). Without Stripe subscription_credit handling we wouldn’t grant credits on invoice.paid (we’d need another way to top up subscription users). Product would lose a key retention and convenience feature.

**Simple (like for a 10-year-old):** Without it clients would have to book each cleaning one by one—no "clean every week" button. Without the worker we’d save the subscription but never create the jobs. Without the Stripe credit handling we wouldn’t add credits when they pay monthly. So the feature would be broken or missing.

### 12. What is it not responsible for?

**Technical:** Subscriptions are not responsible for: creating the Stripe subscription object (that’s Stripe or a separate billing flow); matching cleaners to the job (jobsService.createJob creates an unmatched job; we optionally set cleaner_id from subscription—matching otherwise is normal job flow); charging the client for each job (each job is paid when booked or at job time—subscription doesn’t auto-charge); sending reminders (that’s notifications/job reminders). invoice.paid handling doesn’t create cleaning_subscriptions—it only grants credits. The worker doesn’t enqueue jobs to a queue; it creates them synchronously.

**Simple (like for a 10-year-old):** It doesn’t create the Stripe subscription (that’s Stripe or another flow). It doesn’t do the full "find a cleaner" matching—we create the job and can set a preferred cleaner; the rest is normal job flow. It doesn’t charge the client for each job—each job is paid separately. It doesn’t send reminders—that’s the notification system. The "invoice paid" path only adds credits; it doesn’t create a cleaning subscription. The worker creates jobs directly; it doesn’t put them in a queue.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For createSubscription: clientId, cleanerId optional, frequency (weekly|biweekly|monthly), dayOfWeek optional (0–6), preferredTime optional, address, latitude/longitude optional, creditAmount. For getSubscriptionsDueForJobCreation: none (reads cleaning_subscriptions WHERE status active AND next_job_date <= CURRENT_DATE + 7 days). For markSubscriptionJobCreated: subscriptionId, jobId. For updateSubscriptionStatus: subscriptionId, clientId, status (active|paused). For cancelSubscription: subscriptionId, clientId. For handleInvoicePaid: Stripe invoice (customer, metadata.credits or metadata.credits_per_cycle), env SUBSCRIPTION_DEFAULT_CREDITS. DB: cleaning_subscriptions, jobs, users (resolveUserIdByStripeCustomer), credit_ledger.

**Simple (like for a 10-year-old):** To create a subscription we need the client, optional preferred cleaner, how often (weekly/biweekly/monthly), optional day and time, address, and credit amount. The worker doesn’t need any input—it just looks at subscriptions that are due. To mark a job created we need the subscription id and the job id. To pause or cancel we need the subscription id and the client id. For Stripe we need the invoice (customer and maybe how many credits) and a default credit amount in config. We need the cleaning_subscriptions table, the jobs table, and the credit ledger.

### 14. What does it produce or change?

**Technical:** createSubscription: INSERT cleaning_subscriptions (next_job_date from calculateNextJobDate). Worker: for each due subscription, createJob (INSERT jobs), optionally UPDATE jobs SET cleaner_id, status accepted; markSubscriptionJobCreated (UPDATE cleaning_subscriptions SET jobs_created += 1, next_job_date = next). Pause/resume/cancel: UPDATE cleaning_subscriptions status and next_job_date. handleInvoicePaid: addLedgerEntry(userId, deltaCredits, reason subscription_credit). So we produce: rows in cleaning_subscriptions, rows in jobs (from worker), and rows in credit_ledger (from invoice.paid).

**Simple (like for a 10-year-old):** Creating a subscription adds a row to the subscription table. The worker adds jobs to the jobs table and updates the subscription (jobs created, next date). Pausing or cancelling updates the subscription row. When Stripe sends "invoice paid" we add a row to the credit ledger (subscription_credit). So we produce subscription rows, job rows, and credit ledger rows.

### 15. Who or what consumes its output?

**Technical:** Consumers of cleaning_subscriptions: client (list, pause, cancel), worker (read due, update after job), clientEnhanced (skip, suggestions). Consumers of created jobs: normal job flow (matching if no cleaner assigned, tracking, payment, payout). Consumers of subscription_credit ledger entries: balance (getUserCreditBalance), reporting. No external system consumes cleaning_subscriptions directly; the worker is the only producer of jobs from subscriptions.

**Simple (like for a 10-year-old):** The client sees their list of subscriptions and can pause or cancel. The worker reads the list and creates jobs and updates the subscription. The jobs we create are used like any other job (matching, tracking, payment). The credit ledger entries from "subscription_credit" are used when we show the user’s balance or do reports. Nobody outside our system reads the subscription table—only our app and the worker.

### 16. What are the main steps or flow it performs?

**Technical:** **Create:** calculateNextJobDate(frequency, dayOfWeek); INSERT cleaning_subscriptions; return row. **Worker:** getSubscriptionsDueForJobCreation(); for each: build scheduledStart from next_job_date + preferred_time (default 9 AM), scheduledEnd = start + 3h; createJob(...); if cleaner_id UPDATE job SET cleaner_id, status accepted; markSubscriptionJobCreated(id, job.id) → SELECT subscription; nextDate = calculateNextJobDate(frequency, day_of_week); UPDATE cleaning_subscriptions SET jobs_created += 1, next_job_date = nextDate. **Pause:** UPDATE status paused, next_job_date NULL. **Resume:** UPDATE status active, next_job_date = calculateNextJobDate(...). **Cancel:** UPDATE status cancelled, next_job_date NULL. **invoice.paid:** resolveUserIdByStripeCustomer(customerId); credits from metadata or SUBSCRIPTION_DEFAULT_CREDITS; addLedgerEntry(userId, credits, subscription_credit).

**Simple (like for a 10-year-old):** To create we figure the first "next date" and save the subscription. The worker gets all subscriptions that are due (next date in the next 7 days), and for each one it builds the job time (from preferred time or 9 AM), creates the job, assigns the cleaner if we have one, then updates the subscription: one more job created and the next date set to the next week (or two weeks or month). Pause clears the next date; resume sets it again; cancel sets status cancelled and clears next date. For Stripe we find the user from the customer id, get the credit amount, and add it to their ledger with reason "subscription_credit."

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) only clients can create/manage subscriptions (premium routes check req.user.role === 'client'); (2) subscription belongs to client (createSubscription uses clientId; update/cancel require client_id match); (3) getSubscriptionsDueForJobCreation only returns status = 'active' and next_job_date <= CURRENT_DATE + 7 days; (4) next_job_date is a DATE (no time zone in column; worker uses preferred_time or default 9 AM local). We don’t enforce: max subscriptions per client; or that client has enough credits when the job is created (job creation doesn’t deduct credits—payment is when the job is booked or at job time per normal flow).

**Simple (like for a 10-year-old):** We enforce: only clients can create and manage subscriptions. The subscription must belong to the client (we check client id on update and cancel). The worker only looks at subscriptions that are "active" and whose next date is in the next 7 days. We don’t limit how many subscriptions a client can have, and we don’t check their credit balance when we create the job—payment happens when they book or at job time like any other job.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Creating and managing subscriptions is triggered by the client (POST/GET/PATCH/DELETE on premium or client routes). Job creation from subscriptions is triggered by the subscriptionJobs worker run (e.g. daily 2 AM via scheduler or cron). Stripe subscription credits are triggered by Stripe (invoice.paid webhook). No HTTP endpoint triggers the worker—only the scheduler or manual run.

**Simple (like for a 10-year-old):** The client triggers "create subscription" or "pause" or "cancel" when they use the app. The worker is triggered by the scheduler (e.g. every day at 2 AM). Stripe triggers "add credits" when they send "invoice paid." Nothing on the website starts the worker—only the scheduler or a manual run.

### 19. What could go wrong while doing its job?

**Technical:** (1) createJob fails in worker—we log subscription_job_creation_failed, increment failed count, don’t markSubscriptionJobCreated so next run will retry (same next_job_date). (2) markSubscriptionJobCreated fails after createJob—job exists but subscription not updated; next run might create a duplicate job for same next_job_date (no idempotency key per subscription+date). (3) calculateNextJobDate uses "now"—if worker doesn’t run for days we might create multiple jobs in one run when we catch up (getSubscriptionsDueForJobCreation returns all with next_job_date <= today+7, so we only create one job per subscription per run and then advance next_job_date; if we missed a day we’d create one job and set next to next week—we wouldn’t double-create unless markSubscriptionJobCreated failed). (4) resolveUserIdByStripeCustomer returns null—we don’t grant credits, log invoice_paid_no_user_mapping. (5) invoice metadata missing credits—we use SUBSCRIPTION_DEFAULT_CREDITS or 0 and may log warning. (6) Client route and premium route both write cleaning_subscriptions—schema (base_hours, cleaning_type) may exist in one path and not the other; migrations 016 may have added columns.

**Simple (like for a 10-year-old):** Things that can go wrong: creating the job fails—we log it and don’t update the subscription, so the next day we’ll try again. If we create the job but then fail to update the subscription we might try to create another job for the same date next time (we don’t have a "we already created a job for this date" check). If we don’t know which user the Stripe customer is we don’t add credits and log it. If the invoice doesn’t say how many credits we use a default. The client and premium routes might use slightly different fields in the table.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: cleaning_subscriptions (next_job_date advancing, jobs_created incrementing), jobs table (jobs with client_id and scheduled_start_at matching subscription address/date), credit_ledger (reason subscription_credit). Logs: subscription_created, subscription_job_created, subscription_job_creation_failed, subscription_jobs_worker_completed, subscription_credits_granted, invoice_paid_no_user_mapping. We don’t have a single "subscription health" metric; we rely on next_job_date and jobs_created and manual inspection. Tests: v3Features.test (create subscription, get, pause, resume, cancel).

**Simple (like for a 10-year-old):** We know it’s working when the subscription’s "next date" moves forward and "jobs created" goes up, when we see jobs in the jobs table for that client and date, and when we see "subscription_credit" in the ledger after an invoice. We see logs like "subscription job created" and "subscription credits granted." We don’t have one "subscription health" number—we look at the table and the jobs and the ledger. We have tests that create, list, pause, resume, and cancel subscriptions.

### 21. What does it depend on to do its job?

**Technical:** premiumService depends on: db/client, logger, jobsService.createJob (worker), creditsService.addLedgerEntry (invoice.paid path). subscriptionJobs worker depends on: pool, query, premiumService (getSubscriptionsDueForJobCreation, markSubscriptionJobCreated), jobsService.createJob. handleInvoicePaid depends on: resolveUserIdByStripeCustomer (users/Stripe customer mapping), creditsService.addLedgerEntry, env SUBSCRIPTION_DEFAULT_CREDITS. Routes depend on auth (require client), premiumService or direct query (client recurring-bookings).

**Simple (like for a 10-year-old):** The premium service needs the database and the logger; the worker needs the premium service and the job creation service. The Stripe "invoice paid" path needs a way to map Stripe customer to our user and the credits service to add the credits, plus a default credit amount in config. The routes need auth (only clients) and the premium service or the database.

### 22. What are the main config or env vars that control its behavior?

**Technical:** SUBSCRIPTION_DEFAULT_CREDITS (env)—used when Stripe invoice has no metadata.credits or credits_per_cycle (default e.g. 100 from env). Feature flag subscriptions.enabled (feature_flags table)—may gate UI or routes (check if enforced in backend). Worker schedule (scheduler or cron)—e.g. daily 2 AM. No env in premiumService for dispute window or frequency limits; calculateNextJobDate is pure logic (weekly/biweekly/monthly).

**Simple (like for a 10-year-old):** We have a default number of credits to grant when Stripe doesn’t say how many (e.g. 100). We have a feature flag to turn subscriptions on or off. The worker runs on a schedule (e.g. 2 AM every day). There’s no setting in the premium service for "max subscriptions" or "dispute window"—the next date is just calculated from weekly/biweekly/monthly.

### 23. How do we test that it accomplishes what it should?

**Technical:** Integration tests: v3Features.test—create subscription (POST /premium/subscriptions), get client subscriptions, pause (PATCH status paused), resume (PATCH status active), cancel (DELETE). We use test DB and auth. We don’t have an E2E test that runs the worker and asserts job creation; we could add one that creates a subscription with next_job_date today, runs runSubscriptionJobs, and asserts one job created and next_job_date updated.

**Simple (like for a 10-year-old):** We have tests that create a subscription, get the list, pause it, resume it, and cancel it. We use a test database and fake auth. We don’t have a test that runs the worker and checks that a job was created—we could add one.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If createJob fails in worker we don’t call markSubscriptionJobCreated—next run will pick the same subscription again (same next_job_date) and retry. If markSubscriptionJobCreated fails after createJob we have an orphan job and subscription still has old next_job_date—next run could create another job for same date (duplicate). Recovery: manually set next_job_date on subscription to the next occurrence after the job we created, or add idempotency (e.g. "last_created_job_date" or check for existing job for this client+date). If handleInvoicePaid can’t resolve user we log and skip; recovery: fix Stripe customer → user mapping and re-run or manually add credits. If worker doesn’t run for days we only create one job per subscription per run (we advance next_job_date once)—we don’t backfill multiple jobs for missed days; product may want "catch up" or not.

**Simple (like for a 10-year-old):** If creating the job fails we don’t update the subscription so the next day we try again. If we create the job but fail to update the subscription we might create a duplicate next time—we’d have to fix the subscription’s next date by hand or add a check so we don’t create two jobs for the same date. If we can’t find the user for a Stripe customer we don’t add credits; we’d fix the mapping and maybe add credits manually. If the worker doesn’t run for a few days we only create one job per subscription when it runs again—we don’t automatically create "missed" jobs.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who care that it accomplishes its goal)?

**Technical:** Stakeholders: clients (they want recurring cleanings without rebooking each time), product (retention and convenience), operations (worker must run on schedule), finance (Stripe subscription billing and credits). Cleaners benefit from repeat jobs (preferred cleaner assignment).

**Simple (like for a 10-year-old):** People who care: clients who want "clean every week" without booking every time, the team that cares about keeping customers, ops who need to make sure the worker runs, and finance who care about Stripe billing and credits. Cleaners benefit when the same client keeps booking them.

### 26. What are the security or privacy considerations for what it does?

**Technical:** Only clients can create and manage their own subscriptions (we check client_id on create/update/cancel). Premium and client routes use auth (requireAuth; premium checks role client). Worker runs with server credentials—it reads all due subscriptions and creates jobs; no user input. Stripe invoice.paid uses customer id to resolve user—we trust Stripe webhook signature (see FOUNDER_WEBHOOKS). Subscription rows contain address and optional cleaner_id—access to cleaning_subscriptions should be restricted. We don’t expose other clients’ subscriptions.

**Simple (like for a 10-year-old):** Only clients can create and change their own subscriptions; we check they’re logged in and that they’re the client for that subscription. The worker runs on the server and reads the table—no user input. We trust Stripe’s webhook when they say "invoice paid." The subscription table has addresses and cleaner info—only the right people should see it. We don’t show one client another client’s subscriptions.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** getSubscriptionsDueForJobCreation returns all active subscriptions with next_job_date in next 7 days—no limit; if thousands are due we create thousands of jobs in one run (sequential loop). Worker runs once per day—throughput is one batch per day. createJob is synchronous—no queue; if createJob is slow the worker run gets longer. No max subscriptions per client in code. Stripe subscription_credit is one addLedgerEntry per invoice.paid. cleaning_subscriptions table grows with clients and subscriptions; no automatic purge of cancelled (we keep them for history).

**Simple (like for a 10-year-old):** The worker gets every subscription that’s due in the next week and creates a job for each—if there are a lot we do them one by one in one run. We only run the worker once a day so we can’t create more than one batch per day. We don’t limit how many subscriptions a client can have. We don’t delete cancelled subscriptions—we keep them for history.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add idempotency for "job created for this subscription on this date" (e.g. store last_created_job_date or check for existing job for client+subscription+date) to avoid duplicate jobs if markSubscriptionJobCreated fails. We’d consider enqueueing "create job for subscription X" to QUEUE_NAMES.SUBSCRIPTION_JOB and processing in queue for scalability and retry. We’d enforce subscriptions.enabled in premium and client routes. We’d implement handleInvoicePaymentFailed (dunning) per spec. We’d add metrics (subscriptions due, jobs created per run, failures). We’d document that calculateNextJobDate is relative to "now" (worker run time).

**Simple (like for a 10-year-old):** We’d add a check so we don’t create two jobs for the same subscription and date if something failed. We might put "create this job" in a queue so we can scale and retry. We’d make sure we check the "subscriptions enabled" flag everywhere. We’d finish "what to do when Stripe says payment failed." We’d add numbers (how many subscriptions due, how many jobs created, how many failed). We’d write down that the "next date" is calculated from when the worker runs.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per subscription: (1) Created—client POST create, row inserted (status active, next_job_date set). (2) Recurring—worker runs daily, when next_job_date <= today+7 creates job, marks job created, advances next_job_date. (3) Optional pause—status paused, next_job_date NULL; resume sets status active and next_job_date again. (4) Cancel—status cancelled, next_job_date NULL; no more jobs created. No TTL on cancelled rows—they stay. Stripe subscription_credit: one-off per invoice.paid (no subscription row in our DB for that).

**Simple (like for a 10-year-old):** A subscription starts when the client creates it—we save it with status active and a next date. While it’s active the worker creates jobs when the date comes up and sets the next date. The client can pause (we clear the next date) or cancel (we mark it cancelled and clear the next date). We don’t delete cancelled subscriptions. The Stripe "subscription credit" is just "add credits when we get invoice paid"—we don’t have a subscription row for that in our cleaning table.

### 30. What state does it keep or track?

**Technical:** Persistent: cleaning_subscriptions (id, client_id, cleaner_id, frequency, day_of_week, preferred_time, address, latitude, longitude, credit_amount, status, next_job_date, jobs_created, created_at, updated_at; and any columns added in 016 e.g. base_hours, cleaning_type). Jobs created by worker reference the subscription only implicitly (same client_id, address, scheduled_start_at). We don’t store subscription_id on the job row unless a migration added it. credit_ledger entries (reason subscription_credit) for invoice.paid. No in-memory subscription state beyond request.

**Simple (like for a 10-year-old):** We keep the cleaning_subscriptions table: who, which cleaner (optional), how often, day and time, address, credits, status, next date, how many jobs we’ve created, and when. The jobs we create don’t necessarily have a "subscription id" on them—they’re just normal jobs for that client and address. We keep credit ledger entries when we add subscription credits from Stripe. We don’t keep any subscription state in memory between requests.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) worker runs at least daily (e.g. 2 AM) so next_job_date within 7 days is processed in time; (2) createJob succeeds or we don’t call markSubscriptionJobCreated (so we retry next run); (3) client_id and address on subscription are valid (job is created for that client); (4) preferred_time is parseable (HH:MM or similar) or we use 9 AM; (5) for invoice.paid we have a mapping from Stripe customer to user (resolveUserIdByStripeCustomer). We don’t assume: client has enough credits when job is created (payment is separate); or that Stripe subscription is always used (subscription_credit is optional).

**Simple (like for a 10-year-old):** We assume the worker runs every day so we don’t miss a date. We assume if creating the job fails we don’t update the subscription so we can try again. We assume the client and address on the subscription are correct. We assume the preferred time is in a format we can read or we use 9 AM. We assume we can find our user from the Stripe customer id when we get "invoice paid." We don’t assume the client has credits when we create the job—they pay when they book or at job time. We don’t assume everyone uses Stripe subscriptions.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use cleaning_subscriptions for one-off jobs—use normal job creation. Don’t use the worker to create jobs for a single client on demand—the worker is batch/scheduled. Don’t use subscription_credit for non-Stripe subscription top-ups (e.g. manual credit grant)—use another reason. Use something else for "recurring billing only" without recurring jobs (e.g. Stripe subscription + invoice.paid → credits, no cleaning_subscriptions). Don’t run the worker more than once per day without considering duplicate job risk (we advance next_job_date once per run—if we run twice same day we’d process same subscriptions twice and create two jobs; getSubscriptionsDueForJobCreation doesn’t exclude "already created today").

**Simple (like for a 10-year-old):** Don’t use subscriptions for a single cleaning—use normal booking. Don’t use the worker to create one job for one person on demand—it’s for the daily batch. Don’t use "subscription_credit" when we’re adding credits by hand—use a different reason. If we only want "bill monthly and add credits" without recurring cleanings we can do that with Stripe and invoice.paid only. Don’t run the worker twice in the same day without thinking about it—we might create two jobs for the same date.

### 33. How does it interact with other systems or features?

**Technical:** Subscriptions use jobsService.createJob (same as one-off jobs)—so jobs go through matching, tracking, payment, payout. premiumService is used by premium routes (subscriptions, boosts, rush); expireBoosts worker uses expireOldBoosts. paymentService.handleInvoicePaid uses creditsService.addLedgerEntry (reason subscription_credit). Client routes and premium routes both read/write cleaning_subscriptions (client has recurring-bookings with optional base_hours, cleaning_type; premium has subscriptions). propertiesService checks cleaning_subscriptions before deleting a property (cannot delete if active subscriptions). See FOUNDER_PAYMENT_FLOW, FOUNDER_PAYOUT_FLOW, FOUNDER_QUEUE (worker doesn’t use queue).

**Simple (like for a 10-year-old):** The jobs we create from subscriptions are normal jobs—they use the same matching, tracking, payment, and payout as any other job. The premium service is also used for boosts and rush jobs; another worker expires old boosts. When Stripe says "invoice paid" we use the credits service to add the credits. Both the client routes and the premium routes use the subscription table (client has "recurring bookings" with extra fields, premium has "subscriptions"). We check for active subscriptions before letting someone delete a property. How payment and payouts work is in those docs.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) createSubscription fails (e.g. DB error)—we throw; route returns 500. (2) createJob fails in worker—we catch, log subscription_job_creation_failed, don’t call markSubscriptionJobCreated; we don’t throw so we continue with next subscription. (3) markSubscriptionJobCreated fails—we don’t catch in worker so we throw and worker run fails; subscription not updated. (4) updateSubscriptionStatus or cancelSubscription—subscription not found or not client’s; we throw 404. (5) handleInvoicePaid can’t resolve user—we log and return (no credits); we don’t signal to Stripe (we already returned 200 from webhook). We signal via HTTP status and error body to API callers; worker logs and exit code.

**Simple (like for a 10-year-old):** Failure means: we couldn’t create the subscription (we return 500). Or the worker couldn’t create a job for one subscription—we log it and go on to the next; we don’t update that subscription so we’ll try again tomorrow. Or we created the job but failed to update the subscription—then the whole worker run might fail. Or the client tried to pause/cancel someone else’s subscription—we return 404. Or we couldn’t find the user for a Stripe invoice—we log it and don’t add credits. We tell the client or admin with HTTP status and error messages; the worker logs and exits with a code.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust calculateNextJobDate for next_job_date; we trust createJob to create a valid job. Completeness: we can audit cleaning_subscriptions (next_job_date, jobs_created) vs jobs (count of jobs per client in date range). We don’t have an automated "every due subscription got a job" check; we rely on logs and manual inspection. Stripe subscription_credit: we trust addLedgerEntry and reason subscription_credit; we can query credit_ledger for that reason.

**Simple (like for a 10-year-old):** We trust the "next date" calculation and the job creation. To see if we’re correct we can compare the subscription table (next date, jobs created) with the jobs table. We don’t have an automatic "every subscription that was due got a job" check—we rely on logs and manual checks. For Stripe we trust that we added the credits and we can look at the ledger for "subscription_credit."

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. Typically product owns subscription feature (recurring cleanings and Stripe subscription billing); backend owns premiumService, subscriptionJobs worker, and routes. Ops runs the worker on a schedule. Changes to frequency semantics, next_job_date logic, or invoice.paid handling should be documented and coordinated (jobs, credits).

**Simple (like for a 10-year-old):** Product usually owns the subscription feature; the backend team owns the premium service, the worker, and the routes. Ops makes sure the worker runs on schedule. When we change how we calculate "next date" or how we handle "invoice paid" we should write it down and coordinate with jobs and credits.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) idempotency for job creation per subscription+date to avoid duplicates; (2) enqueue subscription job creation to QUEUE_NAMES.SUBSCRIPTION_JOB for scale and retry; (3) handleInvoicePaymentFailed (dunning) and notifications; (4) max subscriptions per client or per property; (5) subscription_id on jobs for reporting; (6) catch-up logic if worker missed runs (e.g. create multiple jobs for missed dates or skip); (7) feature flag enforcement in all routes; (8) metrics and alerts (jobs created per run, failures). As we add more frequencies or billing models we’d extend the schema and logic.

**Simple (like for a 10-year-old):** As we grow we might add a check so we don’t create two jobs for the same subscription and date. We might put job creation in a queue so we can scale and retry. We might implement "what to do when Stripe says payment failed" and notify the user. We might limit how many subscriptions a client can have. We might store the subscription id on the job so we can report. We might add "catch up" if the worker missed a few days. We’d enforce the feature flag everywhere and add dashboards and alerts. If we add new frequencies or billing we’d extend the table and the logic.

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: no separate subscription infra; we use the same app and DB. Worker runs once per day (createJob per due subscription—each createJob does DB inserts and possibly matching logic). Stripe invoice.paid adds one addLedgerEntry per invoice. cleaning_subscriptions table storage grows with number of subscriptions (cancelled kept). Under high subscription volume the worker run could create many jobs in one go (sequential).

**Simple (like for a 10-year-old):** We use the same server and database as the rest of the app. The worker runs once a day and creates as many jobs as there are subscriptions due—each job creation uses the database. When Stripe sends "invoice paid" we add one ledger entry. The subscription table gets bigger as we have more subscriptions. If we have a lot of subscriptions due on the same day the worker does a lot of work in one run.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** createSubscription is not idempotent—two creates with same params create two rows. Worker: getSubscriptionsDueForJobCreation returns same subscriptions until we call markSubscriptionJobCreated; if we run twice without advancing next_job_date we’d create two jobs for same subscription (duplicate). So worker is idempotent only after markSubscriptionJobCreated succeeds. Retrying a failed createJob (next run) is safe—we’ll create one job and then advance. Retrying after createJob succeeded but markSubscriptionJobCreated failed is not safe—we’d create a second job. handleInvoicePaid: addLedgerEntry is not idempotent by invoice id (we don’t store invoice id in ledger); Stripe may retry invoice.paid—we rely on stripe_events_processed or paymentService idempotency for Stripe events to avoid double-granting.

**Simple (like for a 10-year-old):** Creating a subscription twice gives two subscriptions. If we run the worker twice and don’t update the subscription after the first run we’d create two jobs for the same date—so the worker is only safe if we successfully update the subscription after creating the job. If creating the job failed and we retry the next day that’s safe. If we created the job but failed to update the subscription, running again would create a duplicate job. For Stripe "invoice paid" we rely on not processing the same Stripe event twice so we don’t add credits twice.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during createSubscription—we throw; client gets 500. If DB fails during worker getSubscriptionsDueForJobCreation—we throw; worker run fails. If createJob fails (e.g. DB or validation)—we catch in worker, log, don’t call markSubscriptionJobCreated; we continue to next subscription. If markSubscriptionJobCreated fails—query or UPDATE throws; worker throws and run fails; subscription not updated. If resolveUserIdByStripeCustomer fails (no mapping)—we log and don’t add credits. If addLedgerEntry fails in handleInvoicePaid—we throw; webhook handler may queue for retry (see FOUNDER_WEBHOOKS). We don’t retry createJob or markSubscriptionJobCreated in worker; next run retries.

**Simple (like for a 10-year-old):** If the database fails when creating a subscription the client sees 500. If the database fails when the worker is getting the list we fail the whole run. If creating a job fails we log it and go to the next subscription—we don’t update the one that failed so we’ll try again tomorrow. If updating the subscription after creating the job fails the worker run fails and that subscription doesn’t get its next date updated. If we can’t find the user for a Stripe invoice we don’t add credits and log it. If adding credits fails we throw and the webhook might retry. We don’t retry inside the worker—we rely on the next day’s run.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Only authenticated clients can create/update/cancel their own subscriptions (premium and client routes check auth and client_id). Worker is run by scheduler or ops (no user invocation). Stripe invokes invoice.paid (webhook). Configuration: SUBSCRIPTION_DEFAULT_CREDITS is env (ops/deploy); subscriptions.enabled is feature_flags (admin). Worker schedule is scheduler or cron (ops).

**Simple (like for a 10-year-old):** Only logged-in clients can create and manage their own subscriptions. The worker is run by the scheduler or by ops—users don’t start it. Stripe starts the "add credits" when they send the webhook. The default credits and the "subscriptions enabled" flag are set by config or admin. The worker schedule is set by ops.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_PAYMENT_FLOW.md`, `FOUNDER_PAYOUT_FLOW.md`, `FOUNDER_WEBHOOKS.md`, `DB/migrations/015_referrals_and_boosts.sql`, `016_v2_core.sql`.
