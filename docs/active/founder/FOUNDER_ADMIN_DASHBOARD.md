# Founder Reference: Admin Dashboard

**Candidate:** Admin dashboard (Feature #14)  
**Where it lives:** `src/routes/admin.ts` (main admin API), `src/routes/admin/` (analytics, bookings, cleaners, clients, finance, risk, messages, system, settings), `src/routes/adminEnhanced.ts`, `src/routes/adminIdVerifications.ts`, `src/routes/onboardingReminders.ts`; `src/services/adminService.ts`, `src/services/adminRepairService.ts`, `src/services/userManagementService.ts`, `src/services/riskService.ts`, `src/services/reconciliationService.ts`, `src/services/payoutImprovementsService.ts`, `src/services/creditEconomyService.ts` (fraud alerts), `refundProcessor`, `chargebackProcessor`, `paymentService` (invoices), `payoutsService` (pause); middleware `requireAdmin` / `requireRole("admin")`  
**Why document:** What admins can see and do; how repair/override flows work and how they affect state.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The admin dashboard in PureTask is the set of backend APIs and services that let users with role "admin" view and act on platform state. It includes: (1) **Read-only views**—KPIs (jobs, credits escrowed, payouts, active cleaners/clients, ratings, duration), job list and details with full timeline, job events, disputes list, payouts list, user list and stats and per-user detail, system health, stuck jobs/payouts, ledger inconsistencies, fraud alerts, invoices (Stripe), risk review queue and per-user risk profile; (2) **Operational actions**—resolve disputes (with refund or no refund, update job status and events), override job status (any status + reason), force-complete / force-cancel / reassign stuck jobs (with optional refund, audit log, event), adjust user credits (ledger-backed, audit), force-process payout, reverse payout, hold/release payout for dispute; (3) **Financial and risk**—pause payouts per cleaner, approve invoices, resolve fraud alerts, resolve payout reconciliation flags; (4) **User management**—create/update/delete users, reset password, adjust credits; (5) **Sub-dashboards**—analytics, bookings, cleaners, clients, finance, risk, messages, system, settings (each in `src/routes/admin/`); (6) **ID verification**—list and approve/reject cleaner ID documents (`adminIdVerifications`); (7) **Onboarding reminders**—list abandoned onboarding, trigger send (`onboardingReminders`). All admin routes are protected by `requireAdmin` or `requireRole("admin")`. Repair actions publish events and create audit logs (e.g. `createAuditLog` in creditEconomyService).

**Simple (like for a 10-year-old):** It’s the “back office” that only admins can use. They can see numbers (how many jobs, how much money, how many cleaners and clients), look at any job or user in detail, see disputes and payouts and “stuck” things. They can fix problems: resolve disputes (refund or not), change a job’s status, force a job to complete or cancel, reassign a job to another cleaner, add or subtract credits from a user, trigger a payout, reverse a payout, or put a hold on payouts for a cleaner. They can also pause payouts, approve invoices, clear fraud alerts, manage users (create, edit, delete, reset password), review risk, and handle ID verification and onboarding reminders. Everything they do is gated by “you must be an admin.”

### 2. Where it is used

**Technical:** Main API: `src/routes/admin.ts` mounted at `/admin`—GET /kpis, /jobs, /jobs/:jobId, /jobs/:jobId/events, POST /jobs/:jobId/override; GET /disputes, POST /disputes/resolve; GET /payouts, POST /payouts/:cleanerId/pause; GET /users, /users/stats, /users/:userId, POST /users (create), PATCH /users/:userId, DELETE /users/:userId, POST reset-password, adjust-credits; GET /system/health, /system/stuck-jobs, /system/stuck-payouts, /system/ledger-issues; POST repair/force-complete, force-cancel, reassign, adjust-credits, force-process-payout; payout improvements (reverse, hold, release); reconciliation (get flags, resolve); GET /fraud/alerts, POST resolve; GET /invoices, /invoices/pending-approval, /invoices/:id, POST approve; GET /risk/review, /risk/:userId. Sub-routes: `src/routes/admin/index.ts` mounts at `/admin` analytics, bookings, cleaners, clients, finance, risk, messages, system, settings. Additional: `adminEnhanced.ts` at `/admin` (real-time, insights); `adminIdVerifications.ts` at `/admin/id-verifications`; `onboardingReminders.ts` at `/admin/onboarding-reminders`. Services: adminService (KPIs, disputes, override, payouts list, job list/details/events), adminRepairService (stuck detection, force-complete, force-cancel, reassign, adjustCredits, forceProcessPayout, runSystemHealthCheck), userManagementService (users CRUD, stats, sanitize), riskService (review queue, risk profile), reconciliationService, payoutImprovementsService, creditEconomyService (fraud alerts), refundProcessor, chargebackProcessor, paymentService (invoices), payoutsService (pause).

**Simple (like for a 10-year-old):** It’s used in the admin app or any client that calls the `/admin` APIs. The main place is the file that defines all those routes (admin.ts) and the sub-folders for analytics, bookings, cleaners, clients, finance, risk, messages, system, and settings. There are also routes for ID verification and onboarding reminders. The “work” is done in services: admin service (numbers, disputes, jobs, payouts), repair service (find stuck things and fix them), user management, risk, reconciliation, payout improvements, fraud alerts, refunds, chargebacks, invoices, and payout pause.

### 3. When we use it

**Technical:** We use it when an admin (or support/ops) needs to: inspect platform health (KPIs, stuck jobs, stuck payouts, ledger issues, system health); investigate a job or user (job details, events, user profile); resolve a dispute (POST resolve with refund or no refund); unstick a job (override status, force-complete, force-cancel, reassign); fix credits (adjust-credits) or payouts (force-process, reverse, hold, release); manage users (CRUD, reset password); approve an invoice or resolve a fraud/reconciliation flag; review risk (queue, per-user); approve/reject ID documents; trigger onboarding reminders. Triggers are admin actions (UI → API). Some flows are triggered by other systems (e.g. dispute resolution may be invoked after support review). No cron directly in “admin dashboard”—stuck detection is on-demand when admin opens the repair views; workers (payout, subscription, etc.) run separately.

**Simple (like for a 10-year-old):** We use it whenever an admin needs to look at the big picture (numbers, stuck jobs, money issues) or dig into one job or one user. We use it when they resolve a dispute, fix a stuck job, give or take credits, trigger or reverse a payout, add or edit users, approve an invoice, clear a fraud flag, check risk, approve an ID, or send onboarding reminders. The trigger is always “admin did something in the panel.” We don’t have a robot doing admin actions on a schedule—admins open the dashboard and click.

### 4. How it is used

**Technical:** Admin authenticates (JWT or session), middleware requireAdmin checks role; then they call GET/POST/PATCH/DELETE on admin routes. GETs return JSON (KPIs, job list, job details with timeline, events, disputes, payouts, users, stuck jobs, ledger issues, fraud alerts, invoices, risk queue, etc.). Mutating actions: POST /disputes/resolve (jobId, resolution, adminNotes) → adminService.resolveDispute → update disputes + jobs, publish event; POST /jobs/:jobId/override (newStatus, reason) → overrideJobStatus → update jobs, publish event; POST repair/force-complete, force-cancel, reassign, adjust-credits, force-process-payout → adminRepairService → update jobs/payouts/ledger, publishEvent, createAuditLog; payout reverse/hold/release → payoutImprovementsService; reconciliation resolve → reconciliationService; fraud resolve → resolveFraudAlert; invoice approve → paymentService.adminApproveInvoice; payout pause → updatePayoutPause. All mutations should pass adminId (req.user.id) for audit. Sub-routes (analytics, bookings, cleaners, etc.) may have their own GET/POST for filtered lists and actions.

**Simple (like for a 10-year-old):** The admin logs in and then uses the app to hit our APIs. When they load a page we send GET requests and show the data. When they click “resolve dispute” or “force complete job” we send a POST with the details; our code updates the database, writes an audit log, and may send an event. Same idea for override status, force-cancel, reassign, adjust credits, process payout, reverse payout, hold, release, resolve fraud, approve invoice, pause payouts. We always record who (admin id) did what for auditing. The sub-sections (analytics, cleaners, etc.) have their own pages and API calls.

### 5. How we use it (practical)

**Technical:** In day-to-day: admins use the admin frontend (or Postman/curl) against the backend with a valid admin JWT. Env: same as main app (DB, Stripe, etc.); no separate “admin backend.” To see KPIs: GET /admin/kpis?dateFrom=&dateTo=. To fix a stuck job: GET /admin/system/stuck-jobs, then POST /admin/repair/force-complete (or force-cancel, reassign) with jobId, reason. To resolve dispute: GET /admin/disputes, POST /admin/disputes/resolve with jobId, resolution, adminNotes. To adjust credits: POST /admin/users/:userId/adjust-credits. To pause payouts: POST /admin/payouts/:cleanerId/pause. ID verification: GET /admin/id-verifications, POST /admin/id-verifications/:id/approve or reject. Onboarding reminders: GET /admin/onboarding-reminders/abandoned, POST /admin/onboarding-reminders/send. Logs: admin actions log job_force_completed, dispute_resolved, job_status_overridden, etc.; audit logs in credit economy / audit table. Some routes are commented out (e.g. kpis/history, metrics/operational)—V2 features disabled.

**Simple (like for a 10-year-old):** In practice admins log into the admin site and use the same server as everyone else (no separate admin server). They open “KPIs” or “Stuck jobs” or “Disputes” and then take action (resolve, force complete, adjust credits, pause payouts, approve ID, send reminders). We log what they did and keep an audit trail. A few “fancy” routes (like KPI history) are turned off for now.

### 6. Why we use it vs other methods

**Technical:** Centralized admin API with requireAdmin ensures only authorized users can see PII and financial data and perform dangerous actions. Repair actions (force-complete, force-cancel, reassign) let ops fix edge cases (stuck in accepted, in_progress, awaiting_approval) without code deploys. Audit logs and events make actions traceable for compliance and debugging. Separate sub-routes (analytics, cleaners, clients, finance, risk) keep the surface organized and allow different UIs (tabs or micro-frontends). Alternatives: no admin API (only DB access—risky, no audit); separate admin app with direct DB (bypasses business logic); read-only admin (no repair—would need eng for every stuck job). We chose: one API, role-gated, with repair and audit.

**Simple (like for a 10-year-old):** We use it so only admins can see sensitive stuff and do risky things, and so we have one place to “fix” the system (stuck jobs, disputes, credits) without touching the database by hand. We write down who did what (audit) so we can check later. We split the dashboard into sections (analytics, cleaners, finance, risk) so it’s not one huge page. Doing it another way (e.g. only DB access, or no way to fix stuck jobs) would be either unsafe or slow.

### 7. Best practices

**Technical:** All admin routes must use requireAdmin (or requireRole("admin")). Mutations should pass adminId to services for audit. Repair actions should publish events and createAuditLog so we have a trail. Reason codes or notes on override/resolve/force actions help later. Stuck detection (findStuckJobs, findStuckPayouts, findLedgerInconsistencies) is read-only; repair is explicit (admin clicks force-complete, etc.). Don’t expose internal IDs or raw PII in logs beyond what’s needed. Sub-routes can use requireSuperAdmin for sensitive settings (e.g. system, settings). Gaps: some routes may not validate input strictly (e.g. jobId format); idempotency not always applied (e.g. resolve dispute twice could be ambiguous); no “dry run” for repair; KPI history and some metrics routes disabled (V2).

**Simple (like for a 10-year-old):** We always check “is this user an admin?” before doing anything. We record who did what and why when they change something. “Find stuck jobs” only lists them; the admin has to click “force complete” (or cancel, reassign) to actually change things. We try not to log sensitive data. For the most dangerous settings we could require a “super admin.” What we could do better: check inputs more, make “resolve dispute” safe to click twice, add a “preview” before repair, and turn on the disabled KPI history when we’re ready.

### 8. Other relevant info

**Technical:** Design doc: docs/blueprint/ENGINE_ADMIN_OPS.md (automation by default, safe power, observability). Admin can resolve dispute by jobId (adminService.resolveDispute); there is also dispute resolution by disputeId elsewhere—see FOUNDER_DISPUTES. Override job status does not run full state-machine checks; use with care. forceCancelJob can optionally refund credits (INSERT credit_ledger reason refund). adjustCredits goes through adminRepairService and creates ledger entry + audit. Reconciliation and payout improvements interact with payouts and disputes (hold/release). Fraud alerts come from creditEconomyService (getOpenFraudAlerts, resolveFraudAlert). Invoices: Stripe invoices, admin approval flow (getAdminInvoices, adminApproveInvoice). Risk: riskService.getRiskReviewQueue, getUserRiskProfile, calculateRiskScore. Document any new admin action in this doc and in ENGINE_ADMIN_OPS if it affects policy.

**Simple (like for a 10-year-old):** We have a design doc that says “automate what we can, but when a human does something, make it safe and visible.” Admins can resolve a dispute by picking the job; there’s another way to resolve by dispute id (see the disputes doc). When they override a job’s status we don’t run all the normal “can this status change?” rules—so they have to be careful. Force-cancel can give the client their credits back. Adjust credits adds a row to the ledger and an audit log. Reconciliation and payout hold/release tie into payouts and disputes. Fraud alerts are a list we can clear. Invoices are from Stripe and an admin can approve them. Risk is a queue of users to review and a per-user risk score. If we add new admin actions we should write them down here and in the design doc.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The admin dashboard is supposed to: (1) give admins visibility into platform state (KPIs, jobs, users, disputes, payouts, system health, stuck items, ledger issues, fraud, risk, invoices); (2) let them resolve disputes and override job status when automation or normal flow isn’t enough; (3) let them repair stuck jobs (force-complete, force-cancel, reassign) and fix ledger/payout issues (adjust credits, force-process payout, reverse, hold, release); (4) let them manage users (CRUD, reset password, adjust credits) and control payouts (pause per cleaner); (5) let them approve invoices and resolve fraud/reconciliation flags; (6) let them review risk and approve/reject ID documents and trigger onboarding reminders. Success means: admins can see what they need and safely fix what’s broken or policy-driven without direct DB access or code changes.

**Simple (like for a 10-year-old):** It’s supposed to show admins everything important (numbers, jobs, users, disputes, payouts, what’s stuck, what’s risky) and let them fix things: resolve disputes, change job status, force jobs to complete or cancel, reassign jobs, add or take credits, trigger or reverse payouts, hold payouts, manage users, approve invoices, clear fraud flags, review risk, approve IDs, and send reminders. Success is: they can see and fix without going into the database or asking an engineer.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a read: API returns 200 and the expected JSON (KPIs, job list, job details, etc.). Done for resolve dispute: dispute status updated, job status updated (completed or cancelled), event published, admin sees success. Done for override: job status updated, event published. Done for force-complete / force-cancel / reassign: job (and optionally ledger) updated, event and audit log created. Done for adjust-credits: ledger entry and audit log. Done for force-process-payout: payout processed (or queued). Done for reverse/hold/release: payout state updated per payoutImprovementsService. Done for fraud/reconciliation resolve: alert/flag resolved. Done for invoice approve: paymentService marks invoice approved and may grant credits. Observable: DB state (jobs.status, disputes.status, payouts, credit_ledger, id_verifications), job_events and audit logs, API response and logs.

**Simple (like for a 10-year-old):** Success for “look at something” is we return the data and they see it. Success for “do something” is we update the database, write who did it, and maybe send an event; they see success in the UI. We can check success by looking at the database (job status, dispute status, ledger, payouts, etc.) and at the audit logs and events.

### 11. What would happen if we didn't have it?

**Technical:** Admins would have no single place to see KPIs, job lifecycle, disputes, payouts, users, or system health—they’d query the DB or use ad-hoc scripts. Stuck jobs (e.g. awaiting_approval for 7+ days) would require engineering to fix (direct DB or code change). Disputes would have no resolution path in the product. Credit or payout errors would need manual ledger/payout fixes by devs. User management (reset password, adjust credits) would be DB-only. Risk and ID verification would have no workflow. Product and ops would be slower and less auditable; compliance would be harder.

**Simple (like for a 10-year-old):** Without it admins couldn’t see the big picture or fix stuck jobs, disputes, or money issues from the app—they’d have to ask engineers or use the database directly. There’d be no audit trail for “who did what.” Managing users and risk and IDs would be messy. So the platform would be harder to run and less safe.

### 12. What is it not responsible for?

**Technical:** The admin dashboard is not responsible for: running background workers (payout, subscription, reminders, etc.—those are workers); executing the normal job state machine (that’s jobTrackingService, etc.—admin override bypasses it); sending client/cleaner notifications (that’s notification system); Stripe webhook handling (that’s webhook route); matching cleaners to jobs (that’s matching logic); calculating reliability or payouts in the normal flow (that’s payoutsService, reliability). It is a viewer and an override/repair layer; it does not replace the core flows. The frontend (admin UI) is separate—this doc is the backend API and services.

**Simple (like for a 10-year-old):** It doesn’t run the daily jobs (payouts, subscriptions, reminders)—those run on their own. It doesn’t do the normal “job status changes” or “send email to client”—that’s the rest of the app. It doesn’t handle Stripe webhooks or match cleaners to jobs. It’s for looking and for fixing when something is stuck or needs a human decision. The actual admin website (pages and buttons) is built separately; this is the backend that the website calls.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Auth: admin JWT (or session) so requireAdmin passes. Per endpoint: query params (dateFrom, dateTo, status, limit, offset, etc.), path params (jobId, userId, cleanerId, disputeId, alertId, invoiceId), body (e.g. newStatus, reason, resolution, adminNotes, refundCredits, amount). Services need DB (jobs, disputes, payouts, users, credit_ledger, job_events, kpi_snapshots, id_verifications, etc.), Stripe (invoices), and sometimes other services (publishEvent, createAuditLog, paymentService, payoutsService, refundProcessor, chargebackProcessor). Env: same as main app. No separate admin-only config except optional requireSuperAdmin for some routes.

**Simple (like for a 10-year-old):** We need the admin to be logged in. Then each page or action sends what it needs: dates, filters, job id, user id, and for actions things like “new status,” “reason,” “refund or not,” “amount.” The services need the database and sometimes Stripe and other services (events, audit, payment, payout). We use the same environment as the main app.

### 14. What does it produce or change?

**Technical:** GETs: no state change; return JSON. Mutations: resolveDispute → UPDATE disputes, jobs, publish event; overrideJobStatus → UPDATE jobs, publish event; forceCompleteJob / forceCancelJob / reassignJob → UPDATE jobs (and optionally credit_ledger for refund), publishEvent, createAuditLog; adjustCredits → INSERT credit_ledger, createAuditLog; forceProcessPayout → enqueue or run payout; reversePayout, holdPayoutForDispute, releaseDisputeHold → UPDATE payouts / dispute state; resolveReconciliationFlag, resolveFraudAlert → UPDATE flags/alerts; adminApproveInvoice → mark invoice, possibly addLedgerEntry; updatePayoutPause → UPDATE cleaner or payout config; user create/update/delete, resetPassword, adjustUserCredits → users, client_profiles/cleaner_profiles, credit_ledger. ID verification approve/reject → UPDATE id_verifications. Onboarding reminder send → SendGrid + UPDATE onboarding_reminder_sent_at. So we produce: updated rows in jobs, disputes, payouts, users, credit_ledger, id_verifications, cleaner_profiles; new rows in job_events, audit logs; and side effects (emails, Stripe, events).

**Simple (like for a 10-year-old):** When they just look at a page we don’t change anything—we just return data. When they do something we update the database: job status, dispute status, credits, payout status, user info, ID status, reminder sent, etc. We also write events and audit logs and sometimes send email or call Stripe. So we change jobs, disputes, payouts, users, ledger, IDs, and send events and logs.

### 15. Who or what consumes its output?

**Technical:** Consumers: admin frontend (human) for all GET and POST; no other backend service “calls admin API” as a primary consumer. Downstream effects: resolve dispute → notification system may send emails (via events); override/force-complete/force-cancel → job state change may trigger other logic (e.g. payout eligibility); adjust credits → balance visible to user and used in future bookings; payout pause → payoutsService skips that cleaner; invoice approve → paymentService may grant credits. Audit logs and events are consumed by support/compliance and by debugging. So the direct consumer is the admin UI; the indirect consumers are the rest of the platform (notifications, payouts, balance).

**Simple (like for a 10-year-old):** The main consumer is the admin using the dashboard (the website that calls these APIs). Nothing else in our system “calls the admin API” automatically. But when an admin does something, the rest of the app reacts: e.g. resolving a dispute might send emails, pausing payouts means we don’t pay that cleaner, approving an invoice might add credits. Support and compliance use the audit logs to see who did what.

### 16. What are the main steps or flow it performs?

**Technical:** **View flows:** GET kpis → getAdminKPIs (queries jobs, credit_ledger, payouts, etc.) → return counts/averages. GET jobs → listJobsForAdmin(filters) → return jobs + total. GET jobs/:id → getJobDetails (job + client + cleaner + events + dispute + payments + payout + photos) → return full timeline. GET disputes, payouts, users, stuck-jobs, stuck-payouts, ledger-issues, fraud-alerts, invoices, risk/review, risk/:userId similarly. **Action flows:** POST disputes/resolve → get dispute by jobId → update dispute + job → publish event. POST jobs/:id/override → overrideJobStatus → update job → publish event. POST repair/force-complete → forceCompleteJob → update job status + actual_end_at → publishEvent, createAuditLog. force-cancel (optional refund → credit_ledger), reassign (update cleaner_id), adjust-credits (ledger + audit), force-process-payout (trigger payout). Payout reverse/hold/release and reconciliation resolve and fraud resolve and invoice approve and payout pause each call the corresponding service. ID verification and onboarding reminders: see FOUNDER_CLEANER_ONBOARDING.

**Simple (like for a 10-year-old):** For “view” we run a query and return the numbers or list (KPIs, jobs, disputes, users, stuck items, fraud, risk, etc.). For “resolve dispute” we find the dispute by job, update it and the job, and send an event. For “override status” we change the job status and send an event. For “force complete” we set the job to completed and write an event and audit log. Same idea for force-cancel (maybe refund), reassign, adjust credits, process payout, reverse, hold, release, resolve fraud, approve invoice, pause payouts. ID verification and reminders are their own flows (see the onboarding doc).

### 17. What rules or policies does it enforce?

**Technical:** requireAdmin (or requireRole("admin")) on every admin route. resolveDispute: dispute must exist and be open; resolution is resolved_refund or resolved_no_refund; job status set to cancelled or completed accordingly. Override: any valid JobStatus allowed (no state-machine check). forceCompleteJob: job must exist. forceCancelJob: optional refund; refund writes credit_ledger reason refund. reassignJob: job must exist; newCleanerId required. adjustCredits: amount and reason; creates ledger entry and audit. forceProcessPayout: payout must be in correct state. Reverse/hold/release: per payoutImprovementsService and reconciliation logic. Fraud resolve: alert must exist. Invoice approve: invoice must be in approvable state. Payout pause: cleanerId required. User delete may have guards (e.g. no active jobs). Sub-routes (system, settings) may use requireSuperAdmin. We do not enforce “reason required” on every mutation in code—some routes require reason (e.g. override), others may not; policy doc (ENGINE_ADMIN_OPS) says reason codes for high-risk actions.

**Simple (like for a 10-year-old):** Only admins can call these APIs. When they resolve a dispute we check the dispute is open and set the job to completed or cancelled. When they override status we allow any status (we don’t double-check the “normal” rules). Force complete/cancel/reassign only work if the job exists; cancel can optionally refund. Adjust credits adds a ledger row and an audit. Other actions (payout, fraud, invoice, pause) have their own checks. We might require “super admin” for the most sensitive settings. We don’t always require a “reason” in code even though the design doc says we should for risky actions.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** All triggers are admin-initiated: admin opens dashboard and loads a view (GET) or clicks an action (POST). No cron or worker calls admin APIs. Stuck-job detection runs when admin opens “stuck jobs” (GET /admin/system/stuck-jobs). Reminder send is admin-triggered (POST /admin/onboarding-reminders/send) or could be run by a worker that calls the same service—the worker is separate. So the only trigger is “admin uses the UI (or API directly).”

**Simple (like for a 10-year-old):** Everything is started by an admin: they open a page (we load data) or they click a button (we do the action). Nothing runs by itself on a schedule. “Stuck jobs” are only computed when they open that page. Sending onboarding reminders can be triggered by an admin or by a daily job that uses the same “send” logic—but the job is separate from the dashboard.

### 19. What could go wrong while doing its job?

**Technical:** Auth: if requireAdmin is missing on a route, non-admin could call it (critical). Wrong jobId/userId → 404 or wrong resource updated. resolveDispute twice: second call may fail “dispute not found or already resolved” or could leave inconsistent state if logic allows. Override to invalid status: DB might accept; downstream logic may assume valid transitions. forceCancelJob with refund: if ledger insert fails after job update, job is cancelled but client not refunded (need transaction). adjustCredits: negative balance possible if not validated. forceProcessPayout: could double-process if not idempotent. Rate or timeout: admin doing many actions could hit limits. PII: logging userId or jobId is fine; logging email or name in every log line could leak. Dependency failure: DB or Stripe down → 500; admin sees error.

**Simple (like for a 10-year-old):** If we ever forget to check “is admin” someone could do admin things without being admin. Wrong id could change the wrong job or user. Resolving the same dispute twice might error or do something weird. Force-cancelling and refunding: if the refund step fails we might cancel the job but not add credits back. We might not check that credits don’t go too negative. Doing “process payout” twice might pay twice if we’re not careful. Too many clicks could hit limits. We might log something we shouldn’t. If the database or Stripe is down the admin will see an error.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** Logs: dispute_resolved, job_status_overridden, job_force_completed, job_force_cancelled, job_reassigned, id_verification_status_updated, etc. Audit logs (createAuditLog) record actor, action, resourceType, resourceId, oldValue, newValue, metadata. Events (publishEvent) record job_overridden, job.force_completed, dispute_resolved_*, etc. API returns 200 + expected body on success; 4xx/5xx on failure. No built-in dashboard metrics for “admin actions per day” or “repair success rate”; could add. Monitoring: same as main app (errors, latency); alert on 5xx or critical action failures if desired.

**Simple (like for a 10-year-old):** We look at logs (dispute resolved, job overridden, job force-completed, etc.) and at the audit log (who did what to which resource). We know the API worked when we get 200 and the right data. We don’t have a special “admin dashboard health” dashboard; we could add one to see how often admins do things and if repairs succeed.

### 21. What does it depend on to do its job?

**Technical:** DB: jobs, disputes, payouts, users, client_profiles, cleaner_profiles, credit_ledger, job_events, kpi_snapshots, id_verifications, cleaner_profiles (onboarding_reminder_sent_at), etc. Auth: JWT/session and role admin. Services: adminService, adminRepairService, userManagementService, riskService, reconciliationService, payoutImprovementsService, creditEconomyService (createAuditLog, getOpenFraudAlerts, resolveFraudAlert), refundProcessor, chargebackProcessor, paymentService (invoices, adminApproveInvoice), payoutsService (updatePayoutPause), onboardingReminderService (send), file storage (ID doc URLs). Events: publishEvent. Stripe: for invoices and payout operations. SendGrid (or equivalent) for onboarding reminders. No separate admin DB or cache.

**Simple (like for a 10-year-old):** It needs the database (jobs, disputes, payouts, users, ledger, events, IDs, etc.), login with admin role, and all the services that do the real work (admin, repair, users, risk, reconciliation, payout improvements, fraud, refund, chargeback, payment, payouts, reminders). It needs events (to publish) and Stripe and email for some actions. Everything uses the same database and app.

### 22. What are the main config or env vars that control its behavior?

**Technical:** No admin-specific env vars; admin uses same DB, Stripe, SendGrid, etc. as main app. Feature flags: none in code that gate “admin dashboard” as a whole; sub-features (e.g. risk, reconciliation) may depend on services being configured. Middleware: requireAdmin vs requireRole("admin") and requireSuperAdmin (for system/settings) control who can hit which route. Log level and audit retention are general app config.

**Simple (like for a 10-year-old):** There aren’t special “admin only” env vars—admins use the same database and Stripe and email as everyone else. We don’t have an on/off switch for the whole admin dashboard. Who can do what is controlled by “admin” vs “super admin” in the middleware. How much we log and how long we keep audit logs is the same as the rest of the app.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests: adminService (getAdminKPIs, getDisputes, resolveDispute, listJobsForAdmin, etc.), adminRepairService (findStuckJobs, forceCompleteJob, forceCancelJob, reassignJob, adjustCredits, etc.) with mocked DB. Integration/API tests: admin routes with admin JWT, assert 200 and response shape; non-admin should get 403. Manual: run through resolve dispute, override status, force-complete, force-cancel, reassign, adjust credits in staging; check DB and audit log. No dedicated “admin E2E” suite mentioned; could add.

**Simple (like for a 10-year-old):** We have tests that call the admin and repair services with a fake database and check the results. We have (or can add) tests that call the admin APIs with an admin token and check we get the right data, and with a non-admin token and check we get “forbidden.” We can also do it by hand in a test environment and check the database and audit log.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If a mutation fails mid-way (e.g. job updated but event publish failed): we have inconsistent state; fix by re-running the mutation or fixing DB manually; audit log may still have been written. If resolve dispute fails: dispute may be open still; retry with same payload (idempotent if we check “already resolved”). If force-complete fails after job update: job might be completed; idempotent to call again. If adjustCredits fails after ledger insert: duplicate ledger row possible—need idempotency or transaction. Recovery: inspect logs and DB; re-run action if safe; for financial actions (refund, payout) involve ops and possibly manual ledger correction. No formal runbook; document critical flows (dispute resolve, force-complete, adjust-credits) in runbook or this doc.

**Simple (like for a 10-year-old):** If something fails halfway we might have half-done state (e.g. job updated but no event). We’d look at the logs and database and either try again or fix by hand. For disputes we can often retry safely. For credits or payouts we’d be careful and maybe get ops to fix the ledger. We don’t have a written “if this breaks do this” runbook yet; we should for the most important flows.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders?

**Technical:** Ops/support: use dashboard daily to resolve disputes, fix stuck jobs, adjust credits, manage users. Finance: care about payouts, reconciliation, invoices, fraud alerts. Trust & safety: care about risk queue, ID verification, fraud. Product: care about KPIs and funnel. Engineering: care that repair actions are audited and don’t bypass critical checks inappropriately. Compliance/legal: care about audit trail and PII access.

**Simple (like for a 10-year-old):** Support and ops use it to fix problems and look at users and jobs. Finance cares about payouts and money and fraud. Trust and safety cares about risk and IDs. Product cares about the numbers. Engineering cares that when we “fix” something we log it and don’t break the rest of the system. Compliance cares that we have a record of who did what and who saw what.

### 26. What are the security or privacy considerations?

**Technical:** Admin-only access: requireAdmin on every route; no privilege escalation (admin cannot grant themselves super-admin if that’s separate). PII: admins can see user email, name, job details, address—restrict to need-to-know and log access if required for compliance. ID documents and photos: only admin (and cleaner) should access; URLs should be signed or scoped. Audit log: immutable, who did what when; protect audit log from tampering. No sharing of admin JWT; session timeout as per main app. Rate limit admin routes to avoid abuse (e.g. bulk export). Consider IP allowlist or VPN for admin frontend in production.

**Simple (like for a 10-year-old):** Only admins can use these APIs and we must never let a normal user get admin. Admins can see a lot of personal data (names, emails, addresses, IDs)—we should only show what’s needed and maybe log when they look at something. The “who did what” log should be protected so nobody can change it. We shouldn’t share admin logins and we should lock the session after a while. We might want to limit how many requests an admin can make so someone can’t steal a lot of data at once. In production we might only allow admin from a certain network.

### 27. What are the limits or scaling considerations?

**Technical:** Admin usage is low volume (tens to hundreds of requests per day per admin). Stuck-job and ledger queries can be heavy if jobs/payouts/ledger tables are huge; add limit and index (e.g. created_at, status). List endpoints (jobs, users, disputes) use limit/offset; ensure max limit and index. No pagination on some GETs (e.g. stuck-jobs returns all)—cap or paginate if needed. Audit log growth: retain and archive; query by resourceId or actorId with date range. Sub-routes (analytics, cleaners, etc.) may have their own query patterns; tune per view. Admin JWT/session: same as main app scaling.

**Simple (like for a 10-year-old):** Not many people use the admin panel at once, so we don’t need to scale it like the main app. But “list all stuck jobs” or “list all users” could get slow if we have millions of rows—we use limits and indexes. Some lists might return everything; we might need to add “next page.” The audit log will get big over time so we might archive old entries. Each section (analytics, cleaners, etc.) might need its own tuning.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** Add transactions for multi-step repairs (e.g. force-cancel + refund in one transaction). Enforce “reason required” and “adminNotes” on all mutations and store in audit. Add idempotency keys for resolve dispute, force-complete, adjust-credits to make retries safe. Add “dry run” or preview for force-complete/force-cancel (show what would change). Re-enable and polish KPI history and metrics routes (V2). Add admin action metrics (count by action type, error rate). Paginate stuck-jobs, ledger-issues; add filters. Require super-admin or second factor for high-impact actions (delete user, bulk adjust credits). Document runbooks for dispute resolve, force-complete, and ledger correction.

**Simple (like for a 10-year-old):** We’d make “cancel job and refund” one atomic step so we never cancel without refunding if we meant to refund. We’d always require a reason and save it. We’d make “resolve dispute” and “force complete” safe to click twice. We’d add a “preview” before big repairs. We’d turn on the KPI history and make it useful. We’d add numbers like “how many admin actions today.” We’d add “next page” and filters where lists are big. For really dangerous actions we’d require a second check or super-admin. We’d write down step-by-step “if X breaks do Y” for the most important flows.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** No “lifecycle” of the dashboard itself—it’s always available to admins. Session lifecycle: admin logs in (auth), gets JWT/session; each request is authenticated and authorized (requireAdmin). A “task” like “resolve dispute” starts when admin clicks resolve and finishes when API returns 200 and DB + event + audit are updated. Repair actions are one-shot: find stuck → admin clicks repair → one POST → done. No long-running “admin workflow” in the backend; the frontend may have multi-step wizards (e.g. “confirm force-complete”) but the API is single-call per action.

**Simple (like for a 10-year-old):** The dashboard doesn’t “start” or “end”—it’s just there when an admin is logged in. Each time they do something (resolve, force-complete, etc.) that action starts when they click and finishes when we’ve updated the database and written the log. We don’t have a multi-step “admin workflow” in the backend; the website might ask “are you sure?” but our API is one request per action.

### 30. What state does it keep or track?

**Technical:** The admin dashboard does not “own” state; it reads and mutates state owned by other domains: jobs, disputes, payouts, users, credit_ledger, job_events, id_verifications, etc. It does produce: audit log entries (actorId, action, resourceType, resourceId, oldValue, newValue, metadata) and events (publishEvent). KPI snapshots (kpi_snapshots table) are written by a worker (saveKpiSnapshot) or could be triggered by admin; that’s historical state for trends. So the state it “keeps” is audit and events; the state it “tracks” is whatever it reads (jobs, users, etc.).

**Simple (like for a 10-year-old):** The dashboard doesn’t have its own database tables for “admin state.” It reads and changes the same tables as the rest of the app (jobs, disputes, users, ledger, etc.). What it adds is the audit log (who did what) and events. There’s also a table of KPI snapshots (numbers over time) that might be filled by a job or by the dashboard; that’s for showing trends.

### 31. What assumptions does it make to do its job?

**Technical:** Assumes admin role exists and is assigned only to trusted users. Assumes requireAdmin is on every admin route (or equivalent). Assumes DB has jobs, disputes, payouts, users, credit_ledger, job_events, etc. Assumes repair actions (force-complete, force-cancel) are acceptable even though they bypass normal state machine. Assumes audit log and events are sufficient for compliance and debugging. Assumes Stripe and other services are available when admin approves invoice or triggers payout. Assumes frontend sends correct ids and body (we validate but may not validate every edge case). Assumes idempotency where we implemented it (e.g. resolve dispute once); may assume “admin won’t double-click” where we didn’t.

**Simple (like for a 10-year-old):** We assume only real admins get the admin role and that we never forget to check “is admin” on a route. We assume the database has all the tables we need. We assume it’s okay that “force complete” and “override status” skip the normal rules—that’s the point. We assume the audit log is enough for compliance. We assume Stripe and other services are up when we need them. We assume the admin app sends the right ids and data; we might not catch every bad input. We assume they won’t double-click where we didn’t add “safe to run twice.”

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use admin override for “normal” job state changes—use the normal flow (cleaner/client actions, state machine). Don’t use admin adjust-credits for routine refunds that should go through refundProcessor/chargebackProcessor. Don’t use force-complete when the job can be completed through the app (client approve). Use dispute resolution (POST resolve) for disputes; don’t only override job status and leave dispute open. For bulk changes (e.g. many users, many jobs) consider a script or bulk API rather than clicking one-by-one. For debugging, use read-only views and logs first; only then use repair actions. Don’t give admin JWT to automated systems unless they are admin bots with audit.

**Simple (like for a 10-year-old):** Don’t use “override status” or “force complete” when the normal flow can do it (e.g. client can approve). Don’t use “adjust credits” for normal refunds—use the refund flow. When there’s a dispute, use “resolve dispute” so the dispute and the job are both updated. For changing lots of things at once, use a bulk tool or script instead of clicking many times. When something’s wrong, look at the data and logs first; only then “fix” with admin actions. Don’t hand an admin login to a robot unless we really mean it and log it.

### 33. How does it interact with other systems or features?

**Technical:** Auth: requireAdmin uses same auth as main app. Events: publishEvent (job_overridden, job.force_completed, dispute_resolved_*, etc.) so notification system and other subscribers can react. Audit: createAuditLog (creditEconomyService) for repair and financial actions. Disputes: adminService.resolveDispute ties to FOUNDER_DISPUTES (resolution path by jobId). Payouts: adminRepairService.forceProcessPayout, payoutImprovementsService (reverse, hold, release), payoutsService (pause)—see FOUNDER_PAYOUT_FLOW. Credits: adjustCredits, forceCancelJob refund → credit_ledger; see FOUNDER_PAYMENT_FLOW / credit economy. Invoices: paymentService.adminApproveInvoice. Risk: riskService. ID verification and onboarding reminders: see FOUNDER_CLEANER_ONBOARDING. Refund/chargeback: refundProcessor, chargebackProcessor for manual or Stripe-driven refunds/chargebacks. Reconciliation: reconciliationService. Fraud: creditEconomyService.getOpenFraudAlerts, resolveFraudAlert. No direct call from workers to admin API; workers use their own services (e.g. payout worker uses payoutsService).

**Simple (like for a 10-year-old):** It uses the same login as the rest of the app. When an admin does something we send events so other parts of the app (e.g. notifications) can react. We write audit logs for money and repair actions. Resolving a dispute is part of the “disputes” feature (see disputes doc). Payouts (process, reverse, hold, pause) tie into the payout flow. Credits (adjust, refund on cancel) tie into the payment/credit system. Invoices and risk and ID verification and reminders each have their own docs or sections. We don’t have background jobs calling the admin API—they use the same services directly.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure: API returns 4xx/5xx; body { error: { code, message } }. 401 Unauthorized if not logged in; 403 Forbidden if not admin. 404 if resource not found (jobId, userId, disputeId, etc.). 500 on DB or service error. Logs: list_admin_jobs_failed, override_job_status_failed, get_admin_kpis_failed, etc. with error message and context (adminId, jobId). Validation failure (e.g. invalid body): 400 with message. We don’t return partial success (e.g. “job updated but event failed”) in a single response; we return 200 when we consider the action done or 500 when something failed (and state may be partial). Signal: HTTP status + error code + log.

**Simple (like for a 10-year-old):** Failure means we return an error code (401, 403, 404, 500) and an error message. If they’re not logged in or not admin we return “unauthorized” or “forbidden.” If the job or user doesn’t exist we return “not found.” If something crashes we return 500 and log it. If they send bad data we return 400. We don’t say “half done”—we either say success (200) or failure (error). We use the same error shape everywhere and we log what went wrong.

### 35. How do we know its outputs are correct or complete?

**Technical:** Read outputs: we trust the queries (getAdminKPIs, listJobsForAdmin, getJobDetails, etc.); correctness is same as main app (joins, filters). Mutation outputs: we verify by reading back (e.g. GET job after override) or by checking DB; no automatic “verify after write” in the API. Audit log and events are the record of what was requested and what was done; we don’t checksum. Tests assert service behavior (e.g. resolveDispute updates dispute and job). In production we rely on monitoring (errors, latency) and occasional spot-checks (e.g. “after resolve dispute, job status is completed”). No formal “admin action verification” pipeline.

**Simple (like for a 10-year-old):** For “read” we trust our queries. For “write” we don’t automatically double-check in the same request; the admin can refresh and see the new state. The audit log is the proof of what we did. We have tests that check that e.g. resolving a dispute really updates the dispute and the job. In production we watch for errors and sometimes manually check that after an action the database looks right. We don’t have an automated “verify every admin action” step.

### 36. Who owns or maintains it?

**Technical:** Code is in routes (admin.ts, admin/*, adminEnhanced, adminIdVerifications, onboardingReminders) and services (adminService, adminRepairService, userManagementService, riskService, reconciliationService, payoutImprovementsService, etc.). No single OWNER file; ownership typically follows “platform” or “ops” or the team that owns each underlying domain (disputes, payouts, users, risk). Changes to admin-only behavior (new action, new route) should update this doc and ENGINE_ADMIN_OPS; changes to repair logic should consider audit and events.

**Simple (like for a 10-year-old):** The team that owns “platform” or “ops” or the part of the product that the action touches (disputes, payouts, users, risk) usually owns the admin dashboard. The code is in the admin routes and in the services they call. When we add a new admin action or change how repair works we should update this doc and the design doc.

### 37. How might it need to change as the product or business grows?

**Technical:** Add more repair actions (e.g. bulk reassign, bulk pause payouts). Add more views (e.g. cleaner reliability over time, client lifetime value). Add role-based admin (support vs finance vs super-admin) with different permissions per route. Add “reason code” dropdown and require it for high-impact actions. Add approval workflow for very high-impact actions (e.g. second admin approval for large credit adjustment). Add export (CSV/Excel) for disputes, jobs, users—with rate limit and audit. Add more KPIs and trends (re-enable KPI history, add charts). Integrate with support tools (e.g. link to Zendesk). Scale read path (cache KPIs, read replicas for list queries). Add admin action rate limit and anomaly detection (e.g. alert if one admin does 100 actions in a minute).

**Simple (like for a 10-year-old):** We might add more “fix” buttons (e.g. bulk reassign, bulk pause). We might add more pages (e.g. cleaner performance over time, how much each client has spent). We might have different kinds of admins (support vs finance) with different permissions. We might require picking a “reason” from a list for big actions. We might require a second admin to approve really big changes. We might add “export to spreadsheet” with limits and logging. We might add more charts and history. We might plug into a support ticket system. We might make the “read” path faster with caching. We might alert if an admin does way too many actions at once.

---

## Optional deeper questions (selected)

### A8. What do end users (clients, cleaners, admins) actually see or experience?

**Technical:** Admins see: dashboard UI (tabs or pages for KPIs, jobs, disputes, payouts, users, system, repair, risk, invoices, ID verification, onboarding reminders). They see lists (filterable, paginated), detail views (job timeline, user profile), and action buttons (resolve, override, force-complete, approve, etc.). They get success/error toasts or messages after actions. Clients and cleaners do not see the admin dashboard; they may see the outcome (e.g. dispute resolved, job status changed, payout paused) via notifications or in-app state.

**Simple (like for a 10-year-old):** Admins see the dashboard: numbers, lists of jobs and users and disputes, and buttons to fix things. They see success or error after they click. Clients and cleaners don’t see the dashboard—they just see the result (e.g. “your dispute was resolved,” “your job was completed,” or “payouts are paused”) in the app or in an email.

### A10. Can we run it twice safely (idempotency)?

**Technical:** resolveDispute: second call with same jobId may throw “dispute not found or already resolved”—safe. overrideJobStatus: setting same status again is idempotent (job already in that state). forceCompleteJob: idempotent (job already completed). forceCancelJob: second call might try to cancel again—job already cancelled; refund might double-add credits if we don’t check (need to guard). reassignJob: idempotent if same newCleanerId. adjustCredits: not idempotent by default—two calls add twice; need idempotency key or idempotent “set balance” semantic. forceProcessPayout: must be idempotent (payout already processed). Fraud resolve, invoice approve: typically idempotent (already resolved/approved). So: some actions are idempotent; adjustCredits and possibly forceCancelJob refund are not—add keys or guards if we want safe retries.

**Simple (like for a 10-year-old):** Resolving a dispute twice: the second time we’ll say “already resolved.” Override and force-complete are safe to run again (nothing changes). Force-cancel: job is already cancelled; refund might be added twice if we’re not careful. Adjust credits: clicking twice would add twice—we’d need a “submit once” key to make it safe. So some actions are safe to retry and some aren’t; we should fix the ones that aren’t.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Only users with role admin can invoke admin routes (requireAdmin). Some sub-routes (system, settings) may require requireSuperAdmin for destructive or config changes. Configuration (env, feature flags) is changed by ops/deploy, not via admin UI. No “admin can grant admin” in code (role change would be through userManagementService.updateUser or direct DB by another admin)—ensure role assignment is controlled. Audit log should record who did what so we can revoke access if needed.

**Simple (like for a 10-year-old):** Only admins can use the dashboard. For the riskiest settings we might require “super admin.” Changing server config (env, flags) is done by the team that deploys, not through the dashboard. We don’t let an admin give themselves a new role through the UI without control. We keep a log of who did what so we can take away access if someone misbehaves.

---

*End of Founder Reference: Admin Dashboard*
