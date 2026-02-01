# Founder Reference: Disputes

**Candidate:** Disputes (Feature #16)  
**Where it lives:** `src/services/disputesService.ts`, `src/services/chargebackProcessor.ts`, `src/services/jobTrackingService.ts` (disputeJob), admin routes (`src/routes/admin.ts`, adminEnhanced, admin/risk), `disputes` table, reliabilityService (update on resolution)  
**Why document:** How a dispute is created, resolved, who gets refunded, and how reliability is updated.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Disputes feature is the subsystem that lets clients dispute a job (request a refund or escalation) and lets admins resolve disputes (refund client or side with cleaner). It consists of: (1) **Create dispute**—disputesService.createDispute (job must be awaiting_approval, client owns job, within DISPUTE_WINDOW_HOURS of job completion; INSERT disputes, UPDATE job status to disputed, publishEvent client_disputed) or jobTrackingService.disputeJob (job awaiting_approval or completed; INSERT disputes with client_notes and metadata.requestedRefund, UPDATE job to disputed, publishEvent job.disputed); (2) **Resolve dispute**—disputesService.resolveDisputeWithRefund (refundJobCreditsToClient, dispute status resolved_refund, job cancelled, publishEvent dispute_resolved_refund, updateCleanerReliability) or resolveDisputeWithoutRefund (releaseJobCreditsToCleaner, recordEarningsForCompletedJob, dispute resolved_no_refund, job completed, publishEvent dispute_resolved_no_refund, updateCleanerReliability); (3) **Admin routes**—GET /admin/disputes (getDisputes), POST /admin/disputes/:disputeId/resolve (resolution resolved_refund | resolved_no_refund; refund path calls chargebackProcessor.processChargeDispute with status "lost" to refund credits and cancel job; no_refund path UPDATE dispute to resolved_no_refund), POST /admin/disputes/job/:jobId/resolve (uses disputesService.resolveDispute for full flow); (4) **Stripe chargebacks**—paymentService handles charge.dispute.created / charge.dispute.closed; chargebackProcessor.processChargeDispute flags payout on dispute.created, clears flag on dispute.closed; on closed+lost refunds credits to client (addLedgerEntry reason refund) and sets job to cancelled; (5) **Payout hold**—payoutImprovementsService.holdPayoutForDispute (payout_adjustments dispute_hold), releaseDisputeHold (refund or release to cleaner). Dispute status enum: open, resolved_refund, resolved_no_refund.

**Simple (like for a 10-year-old):** Disputes are when a client says “this job wasn’t done right” and asks for their money back or for us to look into it. We create a dispute record and put the job in “disputed.” An admin then decides: either give the client a refund (credits back, job cancelled, cleaner’s reliability can go down) or side with the cleaner (no refund, job marked completed, cleaner gets paid, reliability still updated). We also handle Stripe chargebacks (when the client disputes the charge with their bank)—we flag the cleaner’s payout and if we lose the chargeback we refund the client and cancel the job. We can “hold” a cleaner’s payout while a dispute is open and then release it or keep it depending on the resolution.

### 2. Where it is used

**Technical:** Create dispute: disputesService.createDispute (used by routes that enforce 48h window and awaiting_approval; schema: job_completed_at, within_window), jobTrackingService.disputeJob (POST /tracking/:jobId/dispute; schema: client_notes, metadata). Resolve: disputesService.resolveDispute, resolveDisputeWithRefund, resolveDisputeWithoutRefund (POST /admin/disputes/job/:jobId/resolve); admin POST /admin/disputes/:disputeId/resolve uses processChargeDispute for refund path and direct UPDATE for no_refund. chargebackProcessor.processChargeDispute is called from paymentService (Stripe webhook charge.dispute.*) and from admin resolve (refund path). Tables: disputes (id, job_id, client_id, status, client_notes, admin_notes, job_completed_at, within_window, metadata, amount_cents, etc.—migrations 001_init, 017_policy_compliance, 019, 022), payout_adjustments (dispute_hold, dispute_release). Admin: getDisputes (adminService), getOpenDisputesCount, dispute insights/analyze (adminEnhanced), risk/disputes (admin/risk), holdPayoutForDispute, releaseDisputeHold. Notifications: job.disputed, dispute_resolved_*; reliabilityService.updateCleanerReliability after resolution.

**Simple (like for a 10-year-old):** Disputes are created from the disputes service (with a 48-hour window and “awaiting approval” check) or from the tracking route when a client disputes a job. They’re resolved by the disputes service (full flow: refund or no refund, credits, job status, events, reliability) or by the admin “resolve by dispute id” route (which uses the chargeback processor for refunds and a direct update for no refund). The chargeback processor is used when Stripe sends us “dispute created” or “dispute closed” and when an admin resolves with refund. We store disputes in the disputes table and payout holds in payout_adjustments. Admins see disputes in the admin and risk pages and can hold or release cleaner payouts.

### 3. When we use it

**Technical:** We use it when: (1) a client disputes a job—they call POST /tracking/:jobId/dispute (or a route that uses createDispute) with reason/notes; job must be awaiting_approval (or completed in tracking path), client must own the job, and (for createDispute) within DISPUTE_WINDOW_HOURS of job completion; (2) an admin resolves—POST /admin/disputes/:disputeId/resolve or POST /admin/disputes/job/:jobId/resolve with resolution and admin_notes; (3) Stripe sends charge.dispute.created or charge.dispute.closed—handleChargeDisputeEvent calls processChargeDispute (flag payout or clear flag; on closed+lost refund and cancel job); (4) admin holds or releases payout for dispute—holdPayoutForDispute, releaseDisputeHold. There is no scheduled “dispute” job; creation and resolution are user- or webhook-triggered.

**Simple (like for a 10-year-old):** We use it when a client says “I want to dispute this job” (they have to do it within 48 hours of the job ending and the job has to be in “awaiting approval” or “completed”). We use it when an admin decides “refund the client” or “no refund, side with the cleaner.” We use it when Stripe tells us “the client disputed the charge with their bank” (we flag the payout, and if we lose we refund and cancel the job). We use it when an admin holds a cleaner’s payout because of a dispute or releases that hold after resolution.

### 4. How it is used

**Technical:** **Create (disputesService.createDispute):** Verify job exists, client_id matches, status === awaiting_approval; if job.actual_end_at, check hours since completion <= DISPUTE_WINDOW_HOURS or throw DISPUTE_WINDOW_EXPIRED; INSERT disputes (job_id, client_id, client_notes, status 'open', job_completed_at, within_window); UPDATE jobs SET status='disputed'; publishEvent client_disputed. **Create (jobTrackingService.disputeJob):** Verify client owns job, status in [awaiting_approval, completed]; INSERT disputes (job_id, client_id, client_notes, status 'open', metadata { requestedRefund }); UPDATE jobs status disputed; publishEvent job.disputed. **Resolve with refund (disputesService):** refundJobCreditsToClient; UPDATE disputes status resolved_refund, admin_notes; UPDATE jobs status cancelled; publishEvent dispute_resolved_refund; updateCleanerReliability(cleaner_id). **Resolve no refund (disputesService):** releaseJobCreditsToCleaner, recordEarningsForCompletedJob; UPDATE disputes resolved_no_refund; UPDATE jobs completed; publishEvent dispute_resolved_no_refund; updateCleanerReliability. **Admin resolve by disputeId (refund):** processChargeDispute({ disputeId, jobId, clientId, amount, status: 'lost', eventType: 'charge.dispute.closed' })—addLedgerEntry refund, UPDATE job cancelled; dispute row is not updated to resolved_refund in this path (consider adding). **Admin resolve by disputeId (no_refund):** UPDATE disputes SET status resolved_no_refund, admin_notes. **processChargeDispute:** If jobId, find payout by job; on dispute.created set payouts.dispute_flag true; on dispute.closed set dispute_flag false. If closed+lost and clientId+amount, addLedgerEntry reason refund, UPDATE job cancelled. **holdPayoutForDispute:** INSERT payout_adjustments (dispute_hold, negative amount_cents). **releaseDisputeHold:** refund → no payout back to cleaner; release → INSERT payout_adjustments dispute_release (positive amount) to give back to cleaner.

**Simple (like for a 10-year-old):** To create a dispute we check the job is theirs and in the right status and (in one path) that they’re within 48 hours of completion; we add a dispute row and set the job to “disputed” and send an event. To resolve with refund we give credits back to the client, mark the dispute “resolved refund,” mark the job cancelled, send an event, and update the cleaner’s reliability. To resolve without refund we release the job credits to the cleaner and record their earnings, mark the dispute “resolved no refund,” mark the job completed, send an event, and update reliability. The admin “resolve by id” route can do refund via the chargeback processor (refund + cancel job) or no refund (just update dispute). The chargeback processor flags the payout when a Stripe dispute is created and clears it when closed; if we lose it refunds the client and cancels the job. Hold payout adds a negative adjustment; release either keeps that (refund) or adds a positive adjustment to give money back to the cleaner.

### 5. How we use it (practical)

**Technical:** In day-to-day: clients dispute via app (POST /tracking/:jobId/dispute with reason, requestedRefund) or a flow that uses createDispute (48h window). Admins list disputes (GET /admin/disputes), view job and dispute details, resolve via POST /admin/disputes/:disputeId/resolve or POST /admin/disputes/job/:jobId/resolve. Env: DISPUTE_WINDOW_HOURS (default 48). Admin settings (027) can include disputes.enabled, disputes.window_days, disputes.require_evidence, disputes.max_per_user_per_month. Status and admin dashboards show open dispute count. Stripe chargebacks are handled automatically when we receive charge.dispute.* webhooks. holdPayoutForDispute / releaseDisputeHold are admin actions. To debug: query disputes by status, job_id, client_id; check credit_ledger for refund entries; check job status and payouts.dispute_flag.

**Simple (like for a 10-year-old):** In practice the client goes to the app and disputes the job (with a reason and whether they want full or partial refund). Admins see a list of disputes, open one, and choose “refund” or “no refund.” We have a setting for how many hours after the job they can dispute (default 48). Stripe chargebacks happen when the client disputes with their bank; we handle those automatically. Admins can hold a cleaner’s payout while a dispute is open and then release it or keep it. To see what happened we look at the disputes table, the credit ledger (refunds), and the job and payout status.

### 6. Why we use it vs other methods

**Technical:** A dedicated disputes table and status (open, resolved_refund, resolved_no_refund) give a clear audit trail and let admins list and filter. Refund path uses creditsService (refundJobCreditsToClient or addLedgerEntry reason refund) so credits and ledger stay consistent. Reliability is updated on resolution so cleaner score reflects dispute outcomes. Stripe chargeback handling (processChargeDispute) keeps us in sync with the card network when the client disputes at the bank. Payout hold (payout_adjustments) lets us freeze cleaner pay when a dispute is open and release or claw back on resolution. Alternatives—no dispute flow would force all refunds through support and manual ledger; no chargeback handling would leave payouts and job status wrong when Stripe closes a dispute.

**Simple (like for a 10-year-old):** We use a disputes table so we have a clear record of what was disputed and how it was resolved. Refunds go through the credits system so the ledger is correct. We update the cleaner’s reliability when we resolve so their score reflects disputes. When the client disputes with their bank (Stripe chargeback) we flag the payout and if we lose we refund and cancel the job so we stay in sync with the bank. Holding payouts lets us hold the cleaner’s money until we decide. Without this we’d have to do everything by hand and could get out of sync with Stripe.

### 7. Best practices

**Technical:** We enforce 48-hour dispute window (DISPUTE_WINDOW_HOURS) in createDispute to match policy. We verify client owns job before creating. We use a single dispute status enum and update job status (disputed, cancelled, completed) in step with resolution. We publish events (client_disputed, job.disputed, dispute_resolved_refund, dispute_resolved_no_refund) for notifications and audit. We update reliability after resolution so scores stay accurate. processChargeDispute is idempotent (we don’t double-refund; addLedgerEntry for refund is idempotent by user_id, job_id, reason). Gaps: two create paths (createDispute vs disputeJob) with slightly different schema (job_completed_at/within_window vs metadata.requestedRefund); admin resolve by disputeId refund path does not update dispute row to resolved_refund (processChargeDispute doesn’t touch disputes table)—prefer using disputesService.resolveDispute for full flow or add UPDATE dispute in that route; no automated “max disputes per user per month” enforcement in code (admin settings exist but may not be enforced).

**Simple (like for a 10-year-old):** We only allow disputes within 48 hours of job completion (configurable). We check the client owns the job. We keep dispute status and job status in sync. We send events when a dispute is created or resolved so notifications and history work. We update the cleaner’s reliability after resolution. We avoid refunding twice. What we could do better: we have two ways to create a dispute with slightly different data; when an admin resolves with refund via the “by dispute id” route we don’t always update the dispute row to “resolved refund” (we could use the full resolve flow or add that update); we have a setting for “max disputes per user per month” but may not enforce it in code.

### 8. Other relevant info

**Technical:** Disputes affect credits (refund or release to cleaner), job status (disputed → cancelled or completed), payouts (dispute_flag, hold/release), and reliability (updateCleanerReliability). See FOUNDER_PAYMENT_FLOW (refunds, credits), FOUNDER_PAYOUT_FLOW (recordEarningsForCompletedJob, hold/release), FOUNDER_EVENTS (publishEvent), FOUNDER_NOTIFICATIONS (job.disputed templates). Stripe charge.dispute.* is handled in paymentService and chargebackProcessor; see FOUNDER_WEBHOOKS. disputes table schema evolved (001_init, 017 job_completed_at/within_window, 019 reason_code, resolution_type, etc.). AI dispute suggestion (generateDisputeSuggestion, enqueue AI_DISPUTE) is in aiService and queue; admin can call analyze or dispute-suggestion endpoints.

**Simple (like for a 10-year-old):** Disputes touch credits (refund or pay the cleaner), job status, payouts (flag and hold), and the cleaner’s reliability. How refunds and credits work is in the payment and payout docs; how events and notifications work is in the events and notifications docs. Stripe chargebacks are part of the webhook flow. The disputes table has been extended over time with more columns. We have AI that can suggest how to resolve a dispute; admins can use that from the admin or AI endpoints.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The Disputes feature is supposed to: (1) let clients formally dispute a job (with notes and optional requested refund type) within policy (e.g. 48h of completion, job in disputable status); (2) let admins resolve disputes by choosing refund (credits back, job cancelled, reliability updated) or no refund (credits to cleaner, job completed, reliability updated); (3) handle Stripe chargebacks (flag payout on dispute.created, on closed+lost refund client and cancel job); (4) optionally hold cleaner payout during dispute and release or keep on resolution. Success means: disputes are recorded, resolved consistently with credits and job status, reliability reflects outcomes, and chargebacks are reflected in our state.

**Simple (like for a 10-year-old):** It’s supposed to let clients say “I dispute this job” in a clear way (within the time limit and for jobs they’re allowed to dispute). It’s supposed to let admins decide “refund” or “no refund” and have the system give credits back or pay the cleaner and update the job and the cleaner’s score. It’s supposed to handle it when the client disputes the charge with their bank (Stripe)—we flag the payout and if we lose we refund and cancel. Success means every dispute is recorded and resolved in a way that matches our credits, job status, and reliability.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for create: dispute row (status open), job status disputed, event published (client_disputed or job.disputed). Done for resolve refund: dispute status resolved_refund, credits refunded to client, job cancelled, event dispute_resolved_refund, reliability updated. Done for resolve no refund: dispute resolved_no_refund, credits released to cleaner, earnings recorded, job completed, event dispute_resolved_no_refund, reliability updated. Done for Stripe closed+lost: processChargeDispute refunded credits, job cancelled, payout flag cleared. Done for hold: payout_adjustments row dispute_hold; release: dispute_release row or no additional payout. Observable: disputes table status, job status, credit_ledger refund/release entries, reliability metrics, events and notifications.

**Simple (like for a 10-year-old):** Success for “create dispute”: we have a dispute row, the job is “disputed,” and we sent an event. Success for “refund”: the client got their credits back, the dispute is “resolved refund,” the job is cancelled, we sent an event, and the cleaner’s reliability was updated. Success for “no refund”: the cleaner got paid, the dispute is “resolved no refund,” the job is completed, we sent an event, and reliability was updated. Success for a lost chargeback: we refunded the client and cancelled the job. Success for hold/release: we have a hold record and then either kept it (refund) or gave the money back to the cleaner (release). We can see success by looking at dispute status, job status, the credit ledger, and reliability.

### 11. What would happen if we didn't have it?

**Technical:** Without a dispute flow clients would have no in-app way to escalate or request a refund—support would handle everything manually and we might not track job status or credits consistently. Without chargeback handling (processChargeDispute) Stripe would close disputes and we wouldn’t refund or cancel the job or clear the payout flag—we’d be out of sync with the card network. Without reliability update on resolution cleaner scores wouldn’t reflect dispute outcomes. Without payout hold we couldn’t freeze cleaner pay during a dispute.

**Simple (like for a 10-year-old):** Without it clients couldn’t formally dispute a job in the app—everything would be manual and we might not keep credits and job status right. Without handling Stripe chargebacks we wouldn’t refund or cancel when the bank sides with the client, and our payouts and job status would be wrong. Without updating reliability we wouldn’t reflect disputes in the cleaner’s score. Without payout hold we couldn’t hold the cleaner’s money while we decide.

### 12. What is it not responsible for?

**Technical:** Disputes are not responsible for: validating that the client has evidence (admin settings may require evidence but enforcement may be process-only); determining refund amount (we do full job credit_amount refund or no refund; partial refund logic could be added); initiating Stripe refunds (we add ledger credits; actual Stripe refund may be in paymentService/refund flow); sending notifications (events trigger notificationService—disputes just publish events); calculating reliability (reliabilityService does that; we call updateCleanerReliability). It doesn’t decide dispute window—that’s DISPUTE_WINDOW_HOURS and policy; it only enforces it.

**Simple (like for a 10-year-old):** It doesn’t check that the client uploaded photos or evidence—that might be a policy thing. It doesn’t do “half refund” today—we do full refund or no refund. It doesn’t talk to Stripe to refund the card—that’s the payment/refund flow; we give credits back in our system. It doesn’t send the emails—the event triggers the notification system. It doesn’t compute the cleaner’s score—it just asks the reliability service to update. It doesn’t decide the 48-hour rule—we just enforce the setting.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For createDispute: jobId, clientId, clientNotes; job must exist, client_id match, status awaiting_approval, and (if actual_end_at) hours since completion <= DISPUTE_WINDOW_HOURS. For disputeJob: jobId, clientId, reason, requestedRefund (full|partial|none). For resolve: disputeId (or jobId in job resolve path), resolution (resolved_refund | resolved_no_refund), adminNotes. For processChargeDispute: disputeId, chargeId?, paymentIntentId?, jobId?, clientId?, amount, currency, status, eventType, reason?. For holdPayoutForDispute: cleanerId, jobId, amountCents, reason. For releaseDisputeHold: adjustmentId, resolution (refund|release). Env: DISPUTE_WINDOW_HOURS (default 48), CENTS_PER_CREDIT. DB: disputes, jobs, credit_ledger, payouts, payout_adjustments, earnings.

**Simple (like for a 10-year-old):** To create a dispute we need the job id, the client id, and their notes (and in one path we check the job is “awaiting approval” and within 48 hours of completion). The other create path needs job id, client id, reason, and whether they want full or partial refund. To resolve we need the dispute id (or job id), whether we’re refunding or not, and admin notes. For Stripe chargebacks we need the dispute id, job and client if we know them, amount, and whether it’s created or closed and won/lost. For hold we need cleaner, job, amount, and reason; for release we need the hold id and whether we’re refunding or releasing to the cleaner. We need the dispute window and cents-per-credit in config and the disputes, jobs, credits, and payout tables.

### 14. What does it produce or change?

**Technical:** Create: INSERT disputes (open), UPDATE jobs status disputed, publishEvent. Resolve refund: refundJobCreditsToClient (credit_ledger), UPDATE disputes resolved_refund, UPDATE jobs cancelled, publishEvent, updateCleanerReliability. Resolve no refund: releaseJobCreditsToCleaner, recordEarningsForCompletedJob (earnings, payouts), UPDATE disputes resolved_no_refund, UPDATE jobs completed, publishEvent, updateCleanerReliability. processChargeDispute: UPDATE payouts dispute_flag; on closed+lost addLedgerEntry refund, UPDATE job cancelled. holdPayoutForDispute: INSERT payout_adjustments (dispute_hold). releaseDisputeHold: optionally INSERT payout_adjustments (dispute_release). Notifications are a side effect of events (job.disputed, dispute_resolved_*).

**Simple (like for a 10-year-old):** Creating a dispute adds a dispute row and sets the job to “disputed” and sends an event. Resolving with refund gives credits back to the client, marks the dispute “resolved refund,” marks the job cancelled, sends an event, and updates the cleaner’s reliability. Resolving without refund pays the cleaner, marks the dispute “resolved no refund,” marks the job completed, sends an event, and updates reliability. The chargeback processor sets a flag on the payout and, if we lose, refunds the client and cancels the job. Hold adds a “dispute hold” adjustment; release either keeps that or adds a “release” adjustment to pay the cleaner. Sending emails is done by the notification system when it sees the events.

### 15. Who or what consumes its output?

**Technical:** Consumers of dispute creation: notifications (job.disputed template), admin dashboard (open disputes list), job detail (status disputed). Consumers of resolution: client (credits back or not), cleaner (reliability, payout release or not), notifications (dispute_resolved_*), jobsService (dispute_resolved_refund can trigger job logic). operationalMetricsService and status may surface open dispute count. Risk and admin/risk consume dispute lists and counts. No external system consumes dispute rows directly; events and credits/payouts are the visible outcomes.

**Simple (like for a 10-year-old):** When a dispute is created the client and cleaner may get an email and the admin sees it in the list. When it’s resolved the client gets credits or doesn’t, the cleaner’s score and payout are updated, and notifications may go out. Our status and risk pages use dispute counts. Nobody outside our system reads the dispute table—the outcomes (credits, job status, reliability, emails) are what matter.

### 16. What are the main steps or flow it performs?

**Technical:** **Create (createDispute):** SELECT job; validate client, status awaiting_approval; check 48h window; INSERT disputes; UPDATE job disputed; publishEvent client_disputed. **Create (disputeJob):** verifyClientJob; INSERT disputes (client_notes, metadata); UPDATE job disputed; publishEvent job.disputed. **Resolve with refund (disputesService):** getDisputeById, get job; refundJobCreditsToClient; UPDATE dispute resolved_refund, admin_notes; UPDATE job cancelled; publishEvent dispute_resolved_refund; updateCleanerReliability(cleaner_id). **Resolve no refund (disputesService):** getDisputeById, get job; releaseJobCreditsToCleaner; recordEarningsForCompletedJob; UPDATE dispute resolved_no_refund; UPDATE job completed; publishEvent dispute_resolved_no_refund; updateCleanerReliability. **processChargeDispute:** if jobId find payout; dispute.created → payouts.dispute_flag true; dispute.closed → dispute_flag false; if closed+lost and clientId+amount → addLedgerEntry refund, UPDATE job cancelled. **holdPayoutForDispute:** INSERT payout_adjustments dispute_hold (negative amount). **releaseDisputeHold:** if release → INSERT payout_adjustments dispute_release (positive); if refund → no payout back.

**Simple (like for a 10-year-old):** To create we check the job and client and (in one path) the 48-hour window, add the dispute, set the job to disputed, and send an event. To resolve with refund we give credits back, mark the dispute and job, send an event, and update the cleaner’s reliability. To resolve without refund we pay the cleaner, mark the dispute and job, send an event, and update reliability. For Stripe we set a flag when a dispute is created and clear it when closed; if we lose we refund and cancel the job. Hold is adding a negative adjustment; release is either giving that back to the cleaner (positive adjustment) or not (refund).

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) client must own the job to create a dispute; (2) job must be awaiting_approval (createDispute) or awaiting_approval|completed (disputeJob); (3) createDispute: dispute must be within DISPUTE_WINDOW_HOURS of job.actual_end_at (else DISPUTE_WINDOW_EXPIRED); (4) dispute status must be open to resolve; (5) resolution is binary (resolved_refund | resolved_no_refund). We don’t enforce in code: max disputes per user per month (admin settings exist); require_evidence; partial refund amounts (we do full or none).

**Simple (like for a 10-year-old):** We enforce: only the client who booked the job can dispute it; the job has to be in “awaiting approval” (or in one path “completed”); in the path that has a time limit, they have to dispute within 48 hours of the job ending; you can only resolve a dispute that’s still “open”; and the only outcomes we support are “refund” or “no refund.” We don’t yet enforce in code “max X disputes per user per month” or “must attach evidence” or “partial refund of Y%.”

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Creation is triggered by the client (POST /tracking/:jobId/dispute or a route that calls createDispute). Resolution is triggered by an admin (POST /admin/disputes/:disputeId/resolve or POST /admin/disputes/job/:jobId/resolve). Stripe chargeback handling is triggered by Stripe webhooks (charge.dispute.created, charge.dispute.closed) via paymentService.handleStripeEvent. Hold/release are triggered by admin actions (holdPayoutForDispute, releaseDisputeHold). No cron or scheduled job for disputes themselves.

**Simple (like for a 10-year-old):** The client triggers “create dispute” when they click to dispute. An admin triggers “resolve” when they choose refund or no refund. Stripe triggers our chargeback logic when they send “dispute created” or “dispute closed.” An admin triggers hold or release. Nothing runs on a timer for disputes.

### 19. What could go wrong while doing its job?

**Technical:** (1) Client disputes after window—createDispute throws DISPUTE_WINDOW_EXPIRED. (2) Job not in disputable status—create or disputeJob throws. (3) resolveDisputeWithRefund fails (e.g. refundJobCreditsToClient throws)—transaction or partial state; we may need idempotent retry. (4) processChargeDispute can’t find job/client—we don’t refund (no addLedgerEntry); job may stay completed and payout flagged. (5) Admin resolve by disputeId refund path doesn’t set dispute status to resolved_refund—dispute row stays open; list views may show it as open. (6) Two resolve paths (by disputeId vs by jobId) can behave differently (one uses processChargeDispute and doesn’t update dispute status or publish dispute_resolved_* event). (7) reliability update fails—we log reliability_update_on_dispute_failed but don’t fail the resolve; score may be stale.

**Simple (like for a 10-year-old):** Things that can go wrong: the client tries to dispute after 48 hours—we reject. The job isn’t in the right status—we reject. Refunding might fail (e.g. credits service error)—we might be in a half-done state. For Stripe we might not know which job/client the chargeback is for—then we don’t refund and the job might stay as is. When an admin resolves with refund via the “by dispute id” route we don’t always update the dispute to “resolved refund” so it can still look open. The two resolve flows (by id vs by job) don’t do exactly the same things. If updating the cleaner’s reliability fails we log it but don’t fail the whole resolve—their score might be wrong for a bit.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: dispute rows (status open vs resolved_*), job status (disputed, cancelled, completed), credit_ledger (refund entries), payouts.dispute_flag, reliability metrics. Logs: dispute_created, dispute_resolved_with_refund, dispute_resolved_without_refund, job_disputed, chargeback_client_refund, reliability_update_on_dispute_failed. Admin dashboard shows open dispute count; status endpoint can include openDisputes. We don’t have a single “dispute health” metric; we rely on correctness of credits and job status. Tests: disputeFlow, jobLifecycle dispute flow, resolve tests, chargebackProcessor tests.

**Simple (like for a 10-year-old):** We know it’s working when dispute status and job status match what we did (open vs resolved, disputed vs cancelled/completed), when the credit ledger shows refunds when we refunded, and when the payout flag is set or cleared for chargebacks. We see logs like “dispute created,” “dispute resolved,” “chargeback client refund.” Admins see open dispute counts. We don’t have one “dispute health” number—we rely on credits and job status being right. We have tests for the dispute and resolve flows.

### 21. What does it depend on to do its job?

**Technical:** It depends on: creditsService (refundJobCreditsToClient, releaseJobCreditsToCleaner, addLedgerEntry), payoutsService (recordEarningsForCompletedJob), reliabilityService (updateCleanerReliability), events (publishEvent), db/client, env (DISPUTE_WINDOW_HOURS, CENTS_PER_CREDIT, PAYOUT_CURRENCY). chargebackProcessor uses creditsService.addLedgerEntry and query for payouts/jobs. holdPayoutForDispute/releaseDisputeHold use payout_adjustments table. Admin routes use auth (requireAdmin), getDisputes (adminService), processChargeDispute, disputesService.resolveDispute.

**Simple (like for a 10-year-old):** It needs the credits service (to refund or release), the payouts service (to record earnings), the reliability service (to update the cleaner’s score), and the events system (to publish events). It needs the database and config (dispute window, cents per credit). The chargeback processor uses the credits service and the payouts/jobs tables. Hold and release use the payout adjustments table. The admin routes need auth, the admin service to list disputes, and the chargeback processor or disputes service to resolve.

### 22. What are the main config or env vars that control its behavior?

**Technical:** DISPUTE_WINDOW_HOURS (default 48)—max hours after job completion to allow dispute in createDispute. CENTS_PER_CREDIT used when converting amount to credits in processChargeDispute. PAYOUT_CURRENCY in admin resolve (processChargeDispute). Admin settings (027) can store disputes.enabled, disputes.window_days, disputes.auto_refund_threshold, disputes.require_evidence, disputes.max_per_user_per_month—enforcement in code may be partial or process-only.

**Simple (like for a 10-year-old):** The main setting is how many hours after the job the client can dispute (default 48). We also use “cents per credit” when we turn a refund amount into credits for the chargeback path. We have admin settings for “disputes enabled,” “window in days,” “auto refund threshold,” “require evidence,” and “max disputes per user per month”—some of that may be enforced in code and some may be policy only.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: createDispute (window check, status check), resolveDisputeWithRefund / resolveDisputeWithoutRefund (credits, job status, dispute status, event), processChargeDispute (flag, clear flag, refund on closed+lost), disputeJob (tracking route), admin resolve by disputeId and by jobId. Tests use mocks or test DB. disputeFlow.test, jobLifecycle dispute flow, refundChargebackProcessors.test, adminFlows (route dispute). State machine tests cover transition to disputed on client_disputed.

**Simple (like for a 10-year-old):** We have tests that check: creating a dispute (including 48-hour window and job status), resolving with refund (credits back, job cancelled, dispute status), resolving without refund (cleaner paid, job completed), the chargeback processor (flag payout, refund on lost), the tracking dispute route, and the admin resolve routes. We use a test database or mocks. We also test that the job state machine can go to “disputed” when the client disputes.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If create fails (e.g. window expired)—client gets 400; they can contact support for exceptions. If resolve fails mid-way (e.g. refundJobCreditsToClient throws)—we may have updated dispute but not credits, or vice versa; fix manually (run refund or revert dispute status) and ensure idempotency if retrying. If processChargeDispute didn’t find job/client—we can’t auto-refund; manual lookup by payment_intent_id or charge_id and run refund/update job if needed. If dispute row left open after admin resolve by id (refund path)—manually UPDATE disputes SET status = 'resolved_refund' WHERE id = ? or re-run resolve using disputesService.resolveDispute. If reliability update failed—run updateCleanerReliability(cleaner_id) manually.

**Simple (like for a 10-year-old):** If the client is past the window we just say no; they can contact support. If resolution fails partway we might have to fix credits or dispute status by hand and then retry safely. If we didn’t know which job a chargeback was for we can’t auto-refund—we’d have to look it up and do it manually. If the dispute row is still “open” after an admin refund we can update it by hand or use the full resolve flow. If the cleaner’s reliability didn’t update we can run the reliability update for that cleaner manually.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: clients (they want a fair way to dispute and get refunds when appropriate), cleaners (they want pay when they’re in the right and fairness in reliability), admins (they need to list, resolve, and hold/release), support (dispute volume and resolution consistency), finance (refunds and payout holds). Product cares about policy (window, evidence, max per user).

**Simple (like for a 10-year-old):** People who care: clients (they want to be able to dispute and get refunds when it’s fair), cleaners (they want to get paid when they did the job and want fair reliability), admins (they need to see and resolve disputes and hold payouts), support (they deal with dispute volume and consistency), and finance (refunds and holds matter for money).

### 26. What are the security or privacy considerations for what it does?

**Technical:** Only the job’s client can create a dispute (we check client_id). Only admins can resolve (requireAdmin), hold payout, or release. Dispute and admin_notes may contain PII or sensitive details—access to disputes table should be restricted. Stripe chargeback payload may contain payment details—handle in paymentService/chargebackProcessor with same care as payment data. Events (client_disputed, dispute_resolved_*) may be forwarded to n8n or stored in job_events—ensure redaction if needed.

**Simple (like for a 10-year-old):** Only the client who booked the job can dispute it. Only admins can resolve or hold/release payouts. Dispute notes might have private info—only the right people should see them. Stripe chargeback data is payment-related—we treat it like other payment data. The events we send might be stored or sent to n8n—we should redact if necessary.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** One dispute per job (job_id unique in disputes in 001_init; later migrations may allow multiple—check schema). DISPUTE_WINDOW_HOURS bounds when disputes can be created. Admin resolve is synchronous (refund/release and DB updates in one flow); under load we might want to queue resolution or make it idempotent for retries. Open disputes list (getDisputes, getOpenDisputes) can grow; we filter by status and limit. No hard cap on “disputes per user” in code unless enforced in create path.

**Simple (like for a 10-year-old):** We effectively have one dispute per job (the table might only allow one row per job). The 48-hour window limits when disputes can be filed. Resolving is done in one go; if the server is busy we might want to make it safer to retry. The list of open disputes can get long; we filter and limit. We might have a “max disputes per user” in settings but it may not be enforced in code yet.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d unify the two create paths (createDispute vs disputeJob) and one resolve path (admin by disputeId should update dispute status to resolved_refund when using processChargeDispute, or use disputesService.resolveDisputeWithRefund for full flow including event and reliability). We’d enforce max_disputes_per_user_per_month in create if policy requires. We’d add partial refund (e.g. refund_amount_credits or percent) if product needs it. We’d add idempotency for resolve (e.g. dispute status check and skip if already resolved) to allow safe retries. We’d document which route to use for “full” resolve (by jobId + disputesService) vs “light” (by disputeId + processChargeDispute).

**Simple (like for a 10-year-old):** We’d have one clear way to create a dispute and one clear way to resolve so the dispute row and events always match. We’d enforce “max disputes per user per month” in code if we have that policy. We’d support “refund half” or a custom amount if the product needs it. We’d make resolve safe to retry (e.g. if already resolved, do nothing). We’d write down which admin flow does the “full” resolve (with event and reliability) and which is the “light” one.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per dispute: (1) Created—client creates dispute, row status open, job status disputed. (2) Optional—admin may hold payout (payout_adjustments dispute_hold). (3) Resolved—admin resolves refund or no refund; dispute status resolved_refund or resolved_no_refund, job cancelled or completed, credits and reliability updated. (4) Optional—admin releases hold (releaseDisputeHold). Stripe chargeback: dispute.created → flag payout; dispute.closed → clear flag, and if lost refund + cancel job. No TTL on open disputes—they stay until resolved or manually closed.

**Simple (like for a 10-year-old):** A dispute starts when the client creates it—status “open,” job “disputed.” The admin might hold the cleaner’s payout. It finishes when the admin resolves “refund” or “no refund”—then the dispute is resolved, the job is cancelled or completed, and credits and reliability are updated. The admin might then release the hold. For Stripe we set a flag when the dispute is created and clear it when it’s closed; if we lose we refund and cancel the job. Open disputes don’t expire—we resolve them by hand.

### 30. What state does it keep or track?

**Technical:** Persistent: disputes (id, job_id, client_id, status, client_notes, admin_notes, job_completed_at, within_window, metadata, amount_cents, routed_to, route_note, etc.), jobs (status disputed/cancelled/completed), credit_ledger (refund entries), payouts (dispute_flag), payout_adjustments (dispute_hold, dispute_release). job_events and published events (client_disputed, job.disputed, dispute_resolved_*). Reliability is in cleaner_metrics / reliability tables (updated on resolution). No in-memory dispute state beyond request.

**Simple (like for a 10-year-old):** We keep the disputes table (who, which job, status, notes, window, etc.), the job status (disputed, cancelled, completed), the credit ledger (refunds), the payout flag and payout adjustments (holds and releases). We record events for disputes. The cleaner’s reliability is updated when we resolve. We don’t keep dispute state in memory between requests.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) job has at most one open dispute per job (schema or convention); (2) client_id on job matches the disputing user; (3) DISPUTE_WINDOW_HOURS and actual_end_at are set when we use createDispute; (4) credits and ledger are the source of truth for refunds (refundJobCreditsToClient / addLedgerEntry); (5) resolve is called once per dispute (we don’t enforce idempotent “already resolved” in all paths); (6) processChargeDispute is called with correct eventType and status (closed+lost for refund). We don’t assume: Stripe always sends job/client (we may not have them for chargebacks).

**Simple (like for a 10-year-old):** We assume one dispute per job, the disputing person is the client who booked, and when we use the 48-hour path the job has a completion time. We assume the credits system is right for refunds. We assume we only resolve once (we don’t always check “already resolved” in every path). We assume when we’re told “chargeback closed, we lost” we should refund. We don’t assume we always know which job or client a Stripe chargeback is for.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use createDispute for jobs not in awaiting_approval or outside the dispute window—use policy exceptions or support flow. Don’t use disputeJob for jobs not in awaiting_approval|completed if business rule is stricter. Don’t use processChargeDispute for in-app dispute resolution—use disputesService resolve; use processChargeDispute for Stripe webhook and (currently) admin “resolve by disputeId” refund path. Don’t hold payout for non-dispute reasons—use other adjustment types. Use something else for “cancel and refund without dispute” (cancellation/refund flow).

**Simple (like for a 10-year-old):** Don’t create a dispute when the job isn’t in the right status or the client is past the time limit—handle those as policy exceptions. Don’t use the chargeback processor for normal “admin clicked refund”—use the disputes service resolve. Use the chargeback processor for Stripe chargebacks and for the admin “resolve by id” refund path. Don’t use “hold for dispute” for other kinds of holds. For “cancel and give money back” without a dispute use the normal cancel/refund flow.

### 33. How does it interact with other systems or features?

**Technical:** Disputes call creditsService (refund, release), payoutsService (recordEarningsForCompletedJob), reliabilityService (updateCleanerReliability), publishEvent (events). Events trigger notifications (job.disputed, dispute_resolved_*). Stripe chargebacks come from paymentService webhook (charge.dispute.*) and call chargebackProcessor. Admin routes use adminService.getDisputes, payoutsService/payoutImprovementsService for hold/release. Job state machine allows transition to disputed on client_disputed / job.disputed. See FOUNDER_PAYMENT_FLOW (refunds), FOUNDER_PAYOUT_FLOW (earnings, hold), FOUNDER_EVENTS, FOUNDER_NOTIFICATIONS, FOUNDER_WEBHOOKS (Stripe).

**Simple (like for a 10-year-old):** Disputes use the credits system (refund or release), the payouts system (record earnings, hold/release), the reliability system (update score), and the events system (publish events). Those events trigger notifications. Stripe chargebacks come from the payment webhook and use the chargeback processor. The admin dispute list and hold/release use the admin and payout services. The job can move to “disputed” when the client disputes. How payments, payouts, events, notifications, and webhooks work is in their own docs.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) create failed—job not found, not authorized, wrong status, DISPUTE_WINDOW_EXPIRED; we throw with statusCode 400 and code DISPUTE_WINDOW_EXPIRED or message. (2) resolve failed—dispute not found, already resolved; we throw 404 or 400. (3) refund failed—refundJobCreditsToClient or addLedgerEntry throws; we throw and may leave partial state. (4) processChargeDispute can’t find job/client—we don’t throw; we just don’t refund (log if needed). (5) reliability update failed—we log reliability_update_on_dispute_failed, don’t fail resolve. We signal via HTTP status and error body (code, message) to API callers; Stripe gets 200 from webhook either way.

**Simple (like for a 10-year-old):** Failure means: we couldn’t create the dispute (job wrong, or past the window)—we return 400 and a message. Or we couldn’t resolve (dispute not found or already resolved)—we return 404 or 400. Or the refund failed—we throw and might be half-done. For chargebacks if we don’t know the job we don’t refund and we don’t throw. If updating the cleaner’s reliability fails we log it and don’t fail the whole resolve. We tell the client or admin with HTTP status and an error code/message; Stripe always gets 200 from our webhook.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust refundJobCreditsToClient / addLedgerEntry for refund amounts; we trust releaseJobCreditsToCleaner and recordEarningsForCompletedJob for no-refund path. Completeness: we can audit disputes (status, admin_notes), job status, credit_ledger (refund rows), payouts.dispute_flag. We don’t have an automated “every open dispute was resolved” or “every refund matched a dispute” check; we rely on admin process and tests.

**Simple (like for a 10-year-old):** We trust the credits and payout logic for the right amounts. To see if we’re correct we can check the dispute status, job status, and credit ledger. We don’t have an automatic “every dispute was resolved” or “every refund is tied to a dispute” check—we rely on admins and tests.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. Typically product/ops owns dispute policy (window, evidence, max per user); backend owns disputesService, chargebackProcessor, and admin resolve flows. Support may own process and escalation. Changes to dispute window, resolution outcomes, or chargeback behavior should be documented and coordinated (credits, payouts, reliability).

**Simple (like for a 10-year-old):** Product or ops usually own the “rules” (48 hours, evidence, max disputes). The backend team owns the dispute and chargeback code and the admin flows. Support owns how we handle escalations. When we change the window, the resolution options, or how we handle chargebacks we should write it down and coordinate with credits, payouts, and reliability.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) unify create and resolve paths and ensure dispute status and events are always updated; (2) enforce max_disputes_per_user_per_month; (3) partial refund (amount or percent); (4) idempotent resolve (skip if already resolved); (5) dispute workflow states (e.g. investigating, pending_evidence); (6) evidence attachment (photos, docs); (7) cleaner response or appeal flow; (8) metrics (dispute rate, resolution time, refund rate). As we add more resolution types or policies we’d extend the enum and flows.

**Simple (like for a 10-year-old):** As we grow we might have one clear create and resolve flow and always update the dispute row and send events. We might enforce “max disputes per user per month.” We might support “refund 50%” or a custom amount. We might make resolve safe to retry. We might add more states (e.g. “investigating”) and let clients attach photos or the cleaner respond. We’d add numbers (how many disputes, how long to resolve, how often we refund). If we add new resolution types we’d extend the options and flows.

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: no separate dispute infra; we use the same app and DB. Dispute creation and resolution are request-scoped (credits, job update, events, reliability update). processChargeDispute runs on webhook and admin resolve. holdPayoutForDispute / releaseDisputeHold are admin actions. Under high dispute volume we pay for more DB writes (disputes, credit_ledger, jobs, payouts, reliability). Notifications (events) may trigger email/SMS—cost there.

**Simple (like for a 10-year-old):** We use the same server and database as the rest of the app—we don’t pay for a separate dispute system. Creating and resolving disputes use the database and the credits/payout/reliability services. Chargeback handling runs when Stripe sends us an event or when an admin resolves. If there are lots of disputes we do more DB updates and might send more emails.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Create: not idempotent—two creates for same job could insert two disputes if schema allows or hit unique constraint (job_id unique in 001_init). Resolve: resolveDisputeWithRefund/WithoutRefund check dispute.status === 'open'; second resolve would throw “already resolved.” Admin resolve by disputeId (refund path) calls processChargeDispute which does addLedgerEntry(refund)—idempotent by (user_id, job_id, reason) in creditsService; job UPDATE cancelled is idempotent. So retrying resolve is safe for credits; dispute row may stay open in that path. processChargeDispute (flag/clear, refund) is safe to run again for same event (idempotency in paymentService for Stripe events).

**Simple (like for a 10-year-old):** Creating a dispute twice for the same job might hit a “one dispute per job” rule or create two—depends on the schema. Resolving twice: the full resolve flow checks “dispute is open” so the second time we’d say “already resolved.” The admin “by id” refund path does a refund that’s safe to do once (credits service won’t double-refund); the dispute row might not get updated so it could still look open. Running the chargeback processor again for the same Stripe event is safe because we don’t process the same event twice.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during create—we throw; client gets 500. If DB fails during resolve—we throw; admin gets 500; we may have partial state (e.g. dispute updated but credits not). If creditsService.refundJobCreditsToClient throws—resolve throws; dispute may be updated or not depending on order of operations. If reliabilityService.updateCleanerReliability throws—we log and don’t fail resolve. If Stripe webhook fails before processChargeDispute—webhook retry will call handleStripeEvent again. We don’t retry resolve automatically; admin can retry (idempotent for credits in refund path).

**Simple (like for a 10-year-old):** If the database fails during create or resolve we throw and the client or admin sees an error; we might be half-done on resolve. If the credits refund fails we throw and the dispute might or might not be updated. If updating the cleaner’s reliability fails we log it and don’t fail the whole resolve. If the Stripe webhook fails we’ll retry it later. We don’t automatically retry resolve—the admin can try again (and the refund part is safe to retry).

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Only the client who owns the job can create a dispute (enforced by client_id check). Only admins can resolve (requireAdmin), hold payout, or release (admin routes). getDisputes, getOpenDisputes, getDisputeById, getDisputeByJobId, getDisputesForClient are used by admin or client-scoped routes (client sees their own). Configuration: DISPUTE_WINDOW_HOURS is env (ops/deploy); admin settings (disputes.enabled, window_days, etc.) are in DB (admin can change). No public “create dispute” without auth and ownership check.

**Simple (like for a 10-year-old):** Only the client who booked the job can dispute it. Only admins can resolve, hold payout, or release. Admins and (for their own data) clients can see dispute lists and details. The dispute window and other settings are in config or admin settings (ops or admins). You can’t create a dispute without being logged in and being the client for that job.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_PAYMENT_FLOW.md`, `FOUNDER_PAYOUT_FLOW.md`, `FOUNDER_EVENTS.md`, `FOUNDER_NOTIFICATIONS.md`, `FOUNDER_WEBHOOKS.md`, `DB/migrations/001_init.sql`, `017_policy_compliance.sql`.
