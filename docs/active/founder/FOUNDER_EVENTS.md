# Founder Reference: Event System

**Candidate:** Event system (System #1)  
**Where it lives:** `src/lib/events.ts`, `job_events` table, `publishEvent`, n8n forwarding, `src/services/jobEvents.ts`, `src/routes/events.ts`  
**Why document:** Central to job lifecycle, notifications, and n8n; one place to explain what events exist, who publishes, who consumes, and how n8n fits in.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Event system is the centralized subsystem that records and distributes job lifecycle and business events in PureTask. It consists of: (1) `publishEvent` in `src/lib/events.ts`, which writes to the `job_events` table (id, job_id, actor_type, actor_id, event_type, payload, created_at) and forwards events to an n8n webhook when `N8N_WEBHOOK_URL` is set; (2) the `job_events` table in the database as the audit log; (3) read helpers `getJobEvents`, `getEventsByType`, `getEventsByActor`; and (4) the POST `/n8n/events` and POST `/events` routes that accept events from n8n (with HMAC verification) and call `publishEvent`. Event types include job_created, job_accepted, cleaner_on_my_way, job_started, job_completed, client_approved, client_disputed, dispute_resolved_*, job_cancelled, job_auto_cancelled, job_overridden, payment_succeeded. The system does not send notifications itself; notifications are handled by n8n (or the notification service as fallback) based on these events.

**Simple (like for a 10-year-old):** The Event system is like a shared diary for everything important that happens to a cleaning job. When someone books a job, accepts it, starts it, finishes it, cancels it, or when money is paid, we write that down in one place. Other parts of the app (and an external tool called n8n) can read this diary to send emails, update screens, or run automations. We don’t send the emails ourselves from this system—we just write down what happened so others can react.

### 2. Where it is used

**Technical:** The event system is implemented in `src/lib/events.ts` (publishEvent, maybeForwardToN8n, getJobEvents, getEventsByType, getEventsByActor), `src/services/jobEvents.ts` (logJobEvent, getJobEventsForJob, getEventsByType, getEventsByActor—alternative write/read API), and `src/routes/events.ts` (POST /n8n/events and POST /events with verifyN8nSignature). The `job_events` table is defined in `DB/migrations/001_init.sql`. `publishEvent` is called from: jobsService, jobTrackingService, paymentService, payoutsService, disputesService, cancellationService, rescheduleService, adminService, adminRepairService, referralService, eventBasedNotificationService, webhookRetryService; and from workers: autoCancelJobs, autoExpireAwaitingApproval, noShowDetection (and deprecated/disabled stuckJobDetection). The app is mounted under the main Express app (e.g. at a path that includes the events router). Consumers of events include: n8n (via webhook), eventBasedNotificationService (which can publish events for notifications), and any code that reads from `job_events` (e.g. admin or support tooling).

**Simple (like for a 10-year-old):** The “diary” is kept in one main file of code and in a database table. Lots of other parts of the app write into it: when a job is created, when a cleaner accepts, when they start or finish, when someone cancels, when payment succeeds, and when admins fix things. There’s also a web address that n8n can call to add an event. Anything that needs to know what happened to a job can read from this diary.

### 3. When we use it

**Technical:** We use it whenever a job lifecycle or business action occurs that we want to record and/or react to. Triggers include: user actions (client books, cleaner accepts/starts/completes, client approves/disputes, admin overrides), background workers (auto-cancel, auto-expire awaiting approval, no-show detection), payment and payout flows (payment_succeeded, payout-related events), cancellation and reschedule flows, dispute resolution, referral completion, and webhook retries. We also use it when n8n sends an event back via POST /n8n/events or POST /events. There is no fixed schedule for publishing; every publish is driven by one of these triggers.

**Simple (like for a 10-year-old):** We write in the diary whenever something important happens: when a customer books, when a cleaner says “I’m on my way,” when the job is done, when someone cancels, when we get paid, or when the computer automatically cancels a job. We also write when n8n tells us something happened. There’s no timer—we only write when one of these things actually happens.

### 4. How it is used

**Technical:** Callers pass a `PublishEventInput`: optional jobId, actorType, actorId, eventName (JobEventType or string), and optional payload (JSON). `publishEvent` inserts into `job_events` only when jobId is present (schema requires job_id NOT NULL); otherwise it skips the insert but still logs and forwards to n8n. Insert errors (e.g. foreign key) are logged and not thrown so n8n forwarding can still run. After insert (or skip), it logs "job_event_published" and calls `maybeForwardToN8n` with jobId, actorType, actorId, eventName, payload, and timestamp; n8n forwarding is non-blocking (errors logged). Reading is via `getJobEvents(jobId, limit)`, `getEventsByType(eventType, limit)`, or `getEventsByActor(actorId, limit)` from `src/lib/events.ts`, or the equivalent functions in `src/services/jobEvents.ts`. The routes POST /n8n/events and POST /events validate body (jobId, actorType, actorId, eventType, payload), verify HMAC with `verifyN8nSignature`, then call `publishEvent` and return 204.

**Simple (like for a 10-year-old):** When something happens, we tell the system: “This job, this type of event, and maybe who did it and a few extra details.” The system writes that into the database (if we have a job ID) and sends the same information to n8n so it can send emails or do other automations. If the database write fails, we still try to tell n8n so we don’t lose the event. To look up what happened, we ask by job, by event type, or by who did it.

### 5. How we use it (practical)

**Technical:** In day-to-day development, you call `publishEvent({ jobId, actorType, actorId, eventName, payload })` from services or workers after a state change. Env controls behavior: `N8N_WEBHOOK_URL` (optional) enables forwarding to n8n; `N8N_WEBHOOK_SECRET` is required for the inbound POST /n8n/events and POST /events routes (HMAC verification). There is no UI in the backend for publishing; the frontend and n8n trigger actions that ultimately call the API or workers that publish. For debugging, you can query `job_events` in SQL or use the read helpers; logs show "job_event_published" and "n8n_forward_failed" when n8n is unreachable.

**Simple (like for a 10-year-old):** In practice, other parts of the app call one function and pass the job, the kind of event, and who did it. We set a web address for n8n in our config; if we don’t set it, we still save events but don’t send them to n8n. To see what happened, we look at the database or the logs. There’s no button in the app to “publish an event”—it happens automatically when people or the system do things.

### 6. Why we use it vs other methods

**Technical:** A single event pipeline gives one audit log and one place to attach side effects (n8n, future consumers). Alternatives would be each service calling notifications and n8n directly, which would duplicate logic and make it hard to add new consumers or replay events. Writing to `job_events` gives an ordered, queryable history per job and supports debugging and compliance. Forwarding to n8n asynchronously keeps request latency low and avoids failing the main flow if n8n is down. Not throwing on DB insert failure but still forwarding to n8n is a tradeoff: we might lose the DB row but still trigger automations.

**Simple (like for a 10-year-old):** We use one diary so we don’t have to tell five different systems the same thing five times. If we added a new way to react to events (e.g. a new tool), we’d only plug it into this one place. Writing everything down in the database lets us look back and see what happened. Sending to n8n in the background means the user’s action doesn’t have to wait for n8n; if n8n is slow or broken, we still record the event and try to send it.

### 7. Best practices

**Technical:** We use a single function `publishEvent` for all app-originated events so the contract (table + n8n payload) stays consistent. Event names are typed in `JobEventType` where possible. We log before and after and don’t throw on insert failure so n8n can still run. We forward to n8n in a fire-and-forget way and log errors so the main flow isn’t blocked. Inbound n8n events are validated (Zod) and protected with HMAC. Gaps: we don’t have idempotency keys per event, so duplicate calls (e.g. retries) can create duplicate rows; we don’t have a formal schema version or event versioning for the payload.

**Simple (like for a 10-year-old):** We have one way to write events and we use the same names so everyone agrees what each event means. We try not to let a broken database or n8n stop the main action—we log and move on. When n8n sends us an event, we check the secret so only n8n can do that. What we could do better: avoid writing the same event twice if someone retries, and be clearer about what extra data each event carries.

### 8. Other relevant info

**Technical:** The event system is foundational: notifications and many automations depend on it. Changing event names or payload shape can break n8n workflows and any code that subscribes by type; add new event types rather than changing existing ones when possible, and document in DECISIONS.md. The `job_events` table has ON DELETE CASCADE from jobs, so when a job is deleted its events are removed. There is a legacy `maybeSendNotifications` in `src/lib/events.ts` that is disabled in favor of n8n; eventBasedNotificationService can still publish events for notification flows that go through the notification layer.

**Simple (like for a 10-year-old):** This diary is very important—emails and automations depend on it. If we change what we write or what we call things, we have to be careful not to break n8n or other tools. When a job is deleted, its diary entries are deleted too. We used to send notifications from here; now we mostly let n8n do that, but the option to send via our notification service still exists.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The event system is supposed to (1) provide a single, ordered audit log of job and business events for every job; (2) distribute those events to downstream consumers (today: n8n webhook) without blocking the main request; and (3) support inbound events from n8n so external workflows can record actions back into the same log. Success means: every significant lifecycle and business action results in a written event (and optionally n8n receipt), and consumers can rely on the log for notifications, analytics, and automation.

**Simple (like for a 10-year-old):** It’s supposed to write down everything important that happens to a job in one place, and tell n8n so n8n can send emails and do other stuff. It’s also supposed to accept “notes” from n8n so the diary stays complete. Success means we never miss writing down something important and n8n gets the message.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a single publish means: the event is logged at info level; if jobId was provided, a row exists in `job_events` (unless insert failed, in which case we still attempted n8n); and if N8N_WEBHOOK_URL is set, a POST was attempted to n8n (success or failure is logged separately). Observable results: new row in `job_events` for that job_id and event_type, and n8n workflow runs if the webhook succeeded. There is no return value or callback that confirms n8n delivery; we rely on logs and n8n’s own monitoring.

**Simple (like for a 10-year-old):** Success for one event means we wrote it in our diary (when we have a job ID), we tried to tell n8n, and we didn’t crash. You can see success by checking the database for the new row and by seeing n8n do its job (e.g. email sent). We don’t get a direct “n8n got it” signal back—we just try and log if it failed.

### 11. What would happen if we didn't have it?

**Technical:** Without a centralized event system we’d have no single audit log; each service would need to call notifications, n8n, and any future consumers directly, leading to duplicated logic and inconsistent behavior. Adding a new consumer would require changing many call sites. Debugging “what happened to this job?” would require tracing multiple systems. n8n would have no single feed of events to trigger workflows. Compliance and support would lack a clear, queryable history per job.

**Simple (like for a 10-year-old):** Without it we’d have no shared diary. Every part of the app would have to tell emails and n8n and everyone else on its own, and we’d have to remember to do that in lots of places. It would be hard to add new reactions (like a new automation) and hard to look back and see what actually happened.

### 12. What is it not responsible for?

**Technical:** The event system is not responsible for: sending email/SMS/push (that’s n8n or the notification service); changing job state (that’s jobsService, cancellationService, etc.); deciding who to notify (n8n or notification logic); idempotency (we don’t dedupe duplicate publishes); delivery guarantees to n8n (we fire-and-forget); or business rules (e.g. when a job can be cancelled). It only records and forwards events.

**Simple (like for a 10-year-old):** It doesn’t send the emails—n8n or the notification service does. It doesn’t change the job (e.g. from “scheduled” to “cancelled”)—other code does that. It doesn’t decide who gets notified. It just writes down what happened and tells n8n. It also doesn’t stop us from writing the same thing twice if we call it twice by mistake.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Inputs for `publishEvent` are: jobId (optional; required for DB insert), actorType (client/cleaner/admin/system), actorId (optional), eventName (string, ideally a JobEventType), and payload (optional JSON object). The inbound POST /n8n/events and POST /events expect a JSON body with eventType (required), and optional jobId, actorType, actorId, payload, plus header x-n8n-signature for HMAC. The database expects job_id UUID, actor_type and event_type non-null text, actor_id nullable text, payload jsonb.

**Simple (like for a 10-year-old):** We need to know which job (if any), what happened (the event name), who did it (person or “system”), and sometimes a few extra details (the payload). When n8n sends us an event, we need the same kind of info plus a secret signature so we know it’s really n8n.

### 14. What does it produce or change?

**Technical:** It produces: (1) one new row in `job_events` per successful insert (when jobId is provided); (2) log entries "job_event_published" and possibly "job_event_insert_failed" or "n8n_forward_failed"; (3) one HTTP POST to N8N_WEBHOOK_URL with the event payload when configured. It does not change job state, user state, or any other domain tables; it only appends to the event log and triggers n8n.

**Simple (like for a 10-year-old):** It adds one line to the diary in the database, writes a line in our logs, and sends one message to n8n. It doesn’t change the job itself or the user—just the diary and n8n.

### 15. Who or what consumes its output?

**Technical:** Consumers of the event log: any code that calls getJobEvents, getEventsByType, getEventsByActor (e.g. admin tools, support, or future analytics). Consumer of the live stream: n8n (via webhook), which runs workflows for notifications and automation. The eventBasedNotificationService sometimes publishes events (e.g. for notification flows) and thus is both a publisher and a conceptual consumer of the “event-driven” design; actual notification delivery is done by n8n or the notification service, not by the event system itself.

**Simple (like for a 10-year-old):** The diary is read by people or tools that need to know what happened (e.g. support, admins). The live “copy” we send to n8n is used by n8n to send emails and run automations. So the main consumers are n8n and anyone who looks at the event history.

### 16. What are the main steps or flow it performs?

**Technical:** For each publishEvent call: (1) normalize inputs (defaults for jobId, actorType, actorId, payload); (2) serialize payload to JSON; (3) if jobId is present, INSERT into job_events (catch errors, log, don’t throw); (4) log "job_event_published"; (5) call maybeForwardToN8n (if N8N_WEBHOOK_URL is set, POST JSON with jobId, actorType, actorId, eventName, payload, timestamp; errors logged, not thrown). For inbound POST /n8n/events or /events: (1) verify HMAC; (2) validate body with Zod; (3) call publishEvent; (4) return 204 or 400/500 with error body.

**Simple (like for a 10-year-old):** When we publish: we take the details, write a row in the diary if we have a job ID, log that we published, then send the same info to n8n in the background. When n8n sends us an event: we check the secret, check the body, then publish it the same way so it goes into the diary and, if we have n8n configured, back out to n8n again (so n8n’s events are stored too).

### 17. What rules or policies does it enforce?

**Technical:** It enforces: (1) job_id NOT NULL for inserts (so events without jobId are not stored in DB); (2) inbound routes require valid HMAC (verifyN8nSignature) and Zod-valid body (eventType required); (3) event names are not validated against a fixed enum at runtime (we accept any string). It does not enforce: idempotency, ordering guarantees across callers, or that payload matches a schema. Business rules (e.g. “only one job_completed per job”) are not enforced here—they’re the responsibility of the services that change state and publish.

**Simple (like for a 10-year-old):** We only save to the diary if we have a job ID. When n8n sends us something, we check the secret and that the body has an event type. We don’t check that the same event wasn’t already written or that the extra details are in a special format—the code that calls us is responsible for that.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** It is triggered by: (1) application code after a state change—jobsService (job_created, job_accepted), jobTrackingService (cleaner_on_my_way, job_started, job_completed, etc.), paymentService (payment_succeeded), payoutsService, disputesService, cancellationService, rescheduleService, adminService, adminRepairService, referralService, eventBasedNotificationService, webhookRetryService; (2) workers—autoCancelJobs, autoExpireAwaitingApproval, noShowDetection (and deprecated stuckJobDetection); (3) HTTP POST to /n8n/events or /events from n8n (or any client with the correct HMAC). There is no cron or timer that publishes events by itself.

**Simple (like for a 10-year-old):** It’s triggered whenever something important happens in the app (booking, accept, start, complete, cancel, pay, dispute, admin fix, etc.) or when our nightly/background jobs do something (e.g. auto-cancel), or when n8n sends us an event. Nothing runs on a timer just to publish—every publish is a direct result of an action.

### 19. What could go wrong while doing its job?

**Technical:** (1) DB insert fails (e.g. foreign key if jobId is invalid, or connection error)—we log and continue, so n8n may still get the event but the audit log may miss it. (2) n8n webhook fails (timeout, 5xx, network)—we log "n8n_forward_failed"; event is in DB but n8n didn’t get it; no retry in this code. (3) Duplicate events if the caller retries or calls publishEvent twice—no idempotency key, so we can get duplicate rows. (4) Inbound POST with invalid or replayed body—HMAC limits to whoever has the secret; we don’t have nonce/replay protection. (5) Large payload or high volume could stress DB or n8n; we don’t throttle or size-limit in this module. (6) Event name or payload typo—downstream (n8n, consumers) may not handle it; we don’t validate schema.

**Simple (like for a 10-year-old):** Things that can go wrong: the database might be down so we don’t save the line in the diary (but we still try to tell n8n). n8n might be down so we don’t get the message through—we only try once. We might write the same event twice if someone triggers it twice. If someone has the secret, they could send us fake events. We don’t check that the extra details are in the right shape, so a mistake there could confuse n8n or other tools.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) logs—"job_event_published" for every publish; "job_event_insert_failed" or "n8n_forward_failed" when something fails; (2) data—query job_events for a job and confirm rows after actions; (3) n8n—workflows triggered and completion/failure in n8n’s own monitoring. We don’t have a dedicated metric or alert in the event system itself (e.g. “events published per minute” or “n8n forward failure rate”); those would be added in metrics/monitoring layer. Tests: `src/lib/__tests__/events.test.ts` and smoke tests in `src/tests/smoke/events.test.ts` cover publish and read paths.

**Simple (like for a 10-year-old):** We know it’s working when we see the “event published” lines in the logs and when we see new rows in the diary for a job. We know something’s wrong when we see “insert failed” or “n8n forward failed” in the logs. We can also check n8n to see if it ran. We don’t have a special dashboard just for events—we rely on logs and the database.

### 21. What does it depend on to do its job?

**Technical:** It depends on: (1) PostgreSQL with the `job_events` table (from 001_init.sql) and the `jobs` table (for foreign key when jobId is set); (2) the DB client used by `query()` in src/lib/events.ts (and config for connection); (3) env: N8N_WEBHOOK_URL (optional) for forwarding, N8N_WEBHOOK_SECRET for inbound route verification; (4) httpClient.postJson for n8n POST; (5) logger; (6) for inbound routes, Express, Zod, and auth.verifyN8nSignature. It does not depend on Redis, queues, or the notification service for the core publish path.

**Simple (like for a 10-year-old):** It needs the database where the diary lives, and the jobs table so the diary can point to the right job. To send to n8n it needs the n8n web address in config; to accept events from n8n it needs the shared secret. It also needs the usual logging and HTTP client. It doesn’t need the queue or the email-sending service to do its main job.

### 22. What are the main config or env vars that control its behavior?

**Technical:** N8N_WEBHOOK_URL: if set, we POST each event to this URL; if empty, we skip n8n forwarding. N8N_WEBHOOK_SECRET: required for verifying HMAC on POST /n8n/events and POST /events; wrong or missing secret causes 401/403. Database connection is via the app’s general DB config (not event-specific). There are no feature flags or tunables in the event code itself (e.g. no batch size, no retry count).

**Simple (like for a 10-year-old):** The main settings are: the n8n web address (if we set it, we send events there; if not, we don’t), and the secret we share with n8n so only n8n can send events back to us. Everything else uses the same database and app config as the rest of the app.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests in `src/lib/__tests__/events.test.ts` cover: publishEvent with jobId (expects row in job_events), publishEvent without jobId (no insert), getJobEvents, getEventsByType, getEventsByActor; and error handling (e.g. insert failure doesn’t throw). Smoke tests in `src/tests/smoke/events.test.ts` hit the HTTP layer. Integration tests (e.g. job lifecycle) publish events and assert on state and sometimes on job_events. We don’t have an end-to-end test that asserts n8n receipt; that would require a mock or real n8n endpoint.

**Simple (like for a 10-year-old):** We have tests that publish events and check that the diary gets a new row, and that we can read events by job, type, or actor. We also have tests that call the web endpoint. We don’t automatically test that n8n really received the event—that would need a fake n8n or a real one in tests.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If DB insert fails: we log and continue; n8n may still get the event via maybeForwardToN8n. We don’t retry the insert in this code. If n8n forward fails: we log "n8n_forward_failed"; the event is in DB but n8n didn’t get it. Recovery options: (1) n8n could poll job_events or an API that exposes recent events (we don’t provide that today); (2) a separate retry job could read failed forwards from logs or a “pending n8n” store (we don’t have that); (3) manual replay is possible by re-publishing from logs or DB if we add a replay endpoint. For inbound route failures (validation, HMAC): we return 400/500; the sender (n8n) must retry. There is no built-in runbook; operations would use logs and DB queries.

**Simple (like for a 10-year-old):** If the database is down we don’t save the event but we still try to tell n8n. If n8n is down we only try once and then log it; the event is in the diary but n8n didn’t get it. To fix that we’d have to either have n8n ask us “what’s new?” later or build something that retries sending. If someone sends us a bad or fake event we reject it and they have to fix and try again. We don’t have a written playbook yet—we’d use logs and the database to figure out what failed.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders include: product and ops (reliable audit trail and automations), engineering (single place to add new consumers, debug flows), support (event history for a job), n8n operators (events as trigger for workflows), and compliance (if we need to prove what happened when). Clients and cleaners benefit indirectly via correct notifications and job behavior that depend on events being published and consumed.

**Simple (like for a 10-year-old):** People who care: the team that wants the diary to be complete and n8n to run; engineers who want one place to plug in new reactions; support when they need to see what happened; and in the long run, customers and cleaners, because emails and job behavior depend on this working.

### 26. What are the security or privacy considerations for what it does?

**Technical:** Event payloads can contain PII or business data (e.g. job address, amounts); they’re stored in job_events (DB) and sent to n8n. Access control: only backend code and n8n (with secret) can publish; read access to job_events should be restricted (e.g. admin/support only). Inbound POST /n8n/events and /events are protected by HMAC (N8N_WEBHOOK_SECRET); without the secret an attacker can’t forge accepted events. We don’t redact payloads in logs—so logs may contain PII; that’s a general logging policy question. Retention of job_events is tied to job deletion (CASCADE); we don’t purge by age in this module.

**Simple (like for a 10-year-old):** The diary can contain sensitive stuff (addresses, who did what). So only our backend and n8n (with the secret) should be able to write; only trusted people (e.g. admins) should read the diary. When n8n sends us an event we check the secret so strangers can’t fake events. We should be careful what we put in logs because it might repeat that sensitive info. We don’t automatically delete old events—they go away when the job is deleted.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** Every publish does one INSERT and optionally one HTTP POST; under high load the DB and n8n could become bottlenecks. We don’t batch inserts or forwards; we don’t use a queue for n8n. job_events grows unbounded per job (we only limit read queries with LIMIT); for very active jobs or long-lived tenants the table could get large. Indexes on job_id, event_type, created_at help reads. No rate limit in the event module itself; inbound POST is subject to app-level rate limiting. No formal SLA; we treat it as best-effort for n8n delivery.

**Simple (like for a 10-year-old):** If we have tons of events, the database and n8n might get slow because we write and send one at a time. We don’t bundle events or use a queue here. The diary can get big for jobs that have lots of events; we only limit how many we read at once. We don’t promise n8n will always get the event right away—we try our best.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add idempotency keys (caller-provided or derived) so retries don’t create duplicate rows. We’d consider a small outbound queue for n8n (or use the existing queue system) so we can retry failed forwards without blocking publish. We’d add metrics (events published/min, n8n success/failure rate) and optional alerts. We’d document payload schema per event type and optionally validate. We might add a replay or “events since X” API for n8n to catch up after downtime. We’d consider retention/archival for job_events to cap table size. Formal event versioning would help when we change payload shape.

**Simple (like for a 10-year-old):** We’d avoid writing the same event twice when someone retries. We’d have a way to try again to send to n8n if the first try failed. We’d add numbers and alerts so we can see if events are piling up or n8n is failing. We’d write down what each event’s extra data should look like and maybe check it. We might let n8n ask “what’s new since yesterday?” so it can catch up. We might also clean up old diary entries so the table doesn’t get huge.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** There is no long-lived process; each publishEvent is a single invocation. Lifecycle per call: start when caller invokes publishEvent (or when request hits POST /n8n/events or /events); then insert (if jobId), log, maybeForwardToN8n; finish when the function returns (n8n forward is not awaited for success). The job_events table has no “status” per row—each row is final once inserted. Events don’t expire or transition state; they’re append-only.

**Simple (like for a 10-year-old):** Each time something happens we run once: write the line, log, send to n8n in the background, and we’re done. There’s no “event in progress”—once we write it, that’s it. Events don’t change or get deleted (except when the whole job is deleted).

### 30. What state does it keep or track?

**Technical:** Persistent state: rows in job_events (id, job_id, actor_type, actor_id, event_type, payload, created_at). No in-memory state in the event module; no cache. We don’t track “last n8n forward” or “pending retries” in the DB; that would be a separate feature. So the only state we keep is the event log itself.

**Simple (like for a 10-year-old):** We only keep the diary in the database—one row per event. We don’t keep a separate list of “what we tried to send to n8n” or “what’s pending.” So the only state is the diary.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) DB is available and job_events table exists with the expected schema; (2) job_id, when provided, exists in jobs (otherwise FK can fail); (3) N8N_WEBHOOK_SECRET is set and correct for inbound routes; (4) callers pass meaningful eventName and consistent actorType/actorId; (5) payload is JSON-serializable and not huge (no explicit size limit); (6) n8n, when configured, accepts POST and doesn’t require different auth. We don’t assume ordering across different callers or idempotency of callers.

**Simple (like for a 10-year-old):** We assume the database is there and the diary table exists, and that when we’re given a job ID it’s a real job. We assume the secret for n8n is set correctly. We assume the caller gives us a sensible event name and who did it. We don’t assume they’ll only call us once per happening—so we might write duplicates if they do.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use publishEvent for: (1) high-frequency, high-volume telemetry (would flood job_events and n8n; use metrics/logs instead); (2) events that must never be lost and need guaranteed delivery (we don’t have retries or a queue); (3) internal-only signals that don’t need audit or n8n (could use an in-process bus or direct calls to avoid DB write); (4) very large payloads (no size limit; could stress DB and n8n). Use something else when you need strong ordering across services (event system doesn’t enforce global order) or exactly-once delivery (we don’t have idempotency keys).

**Simple (like for a 10-year-old):** Don’t use it for millions of tiny updates (that would fill the diary and overwhelm n8n)—use metrics for that. Don’t use it when you absolutely must not lose the message and need retries—we don’t do that here. Don’t use it for huge blobs of data. Use something else when you need “exactly once” or strict order across the whole system.

### 33. How does it interact with other systems or features?

**Technical:** It receives calls from: jobsService, jobTrackingService, paymentService, payoutsService, disputesService, cancellationService, rescheduleService, adminService, adminRepairService, referralService, eventBasedNotificationService, webhookRetryService, and workers (autoCancelJobs, autoExpireAwaitingApproval, noShowDetection). It writes to job_events (DB) and calls postJson to N8N_WEBHOOK_URL. It is invoked from routes/events.ts for inbound n8n events. It does not call the notification service directly (maybeSendNotifications is disabled). Consumers that read job_events are not defined in this codebase (admin/support or n8n polling would be separate). So the main interaction is: many publishers → event system → DB + n8n; and n8n → POST /events → event system → DB (+ optional n8n forward again).

**Simple (like for a 10-year-old):** Lots of parts of the app call us when something happens; we write to the database and send to n8n. n8n can also call our web endpoint to add an event, and we’ll store it and optionally send it back to n8n. We don’t talk to the email-sending service directly—n8n does that. So we’re in the middle: many writers, us, then the diary and n8n.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) DB insert failed—we log "job_event_insert_failed" with jobId, eventName, error; we don’t throw, so the caller doesn’t see failure. (2) n8n forward failed—we log "n8n_forward_failed" (or "n8n_forward_failed_non_blocking"); we don’t throw. (3) Inbound route: validation or HMAC failure returns 400/500 with error body; success returns 204. So for the main publish path we don’t signal failure to the caller; we only log. Callers can’t distinguish “event in DB but n8n failed” from “all good” without checking logs or DB.

**Simple (like for a 10-year-old):** If the diary write or n8n send fails we write that in our logs; we don’t crash the main request or tell the caller “failed.” So the person who did the action usually doesn’t see an error—we just log it. When n8n sends us a bad or fake event we respond with an error code and message so they know it didn’t work.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we don’t validate payload schema or event name against an enum; we trust callers. Completeness: we can query job_events for a job and compare to expected events (e.g. in tests or support). We don’t have automated checks that “every job has at least job_created and one of job_completed/job_cancelled.” We don’t verify that n8n received the same bytes we sent; we only log HTTP errors. So we rely on tests, manual inspection, and downstream behavior (e.g. n8n workflows running) to infer correctness and completeness.

**Simple (like for a 10-year-old):** We don’t double-check that the event name or extra data are “correct”—we trust whoever called us. To see if we got everything we can look at the diary for a job and see if the important events are there. We don’t verify that n8n actually got the message—we just log if the send failed. So we use tests and real-world checks (did the email send?) to know we’re right.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned in the repo; typically the backend or platform team would own the event system and the job_events schema. Changes to event names, payload shape, or the n8n contract should be coordinated with anyone using n8n workflows and with services that publish or consume events. DECISIONS.md is the place to record why we added or changed events.

**Simple (like for a 10-year-old):** The team that owns the backend (or the person who’s named as owner) is responsible. When we change what we write or what we call things, we need to coordinate with anyone who uses n8n or reads the diary. We should write down big changes in our decisions doc.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) idempotency and/or idempotency keys to support retries and avoid duplicates; (2) outbound queue or retry for n8n so we don’t lose events when n8n is down; (3) event versioning and payload schema so we can evolve without breaking n8n; (4) retention or archival for job_events to control size and cost; (5) metrics and alerts (publish rate, n8n failure rate); (6) “events since” or replay API for n8n to catch up; (7) multiple n8n endpoints or routing by event type if we split workflows. As we add more consumers we might add a proper event bus or message queue instead of direct POST to n8n.

**Simple (like for a 10-year-old):** As we grow we might need to avoid writing the same event twice, retry when n8n is down, and version our “extra data” so old automations don’t break. We might need to clean up old diary entries and add dashboards and alerts. We might let n8n ask “what’s new since X?” and we might support more than one n8n or more than one kind of workflow. If we get many consumers we might use a proper message queue instead of calling n8n directly.

---

## Additional questions (A): Cost, performance, contract, resilience, metrics, access

### A1. What does it cost to run?

**Technical:** Cost is dominated by: (1) PostgreSQL—storage and write IO for job_events; (2) optional HTTP calls to n8n (network and n8n’s own cost); (3) log volume. We don’t batch inserts or forwards, so cost scales roughly with event count. No dedicated infra for the event module; it shares the app’s DB and process. Cost of n8n is external (their hosting or ours).

**Simple (like for a 10-year-old):** We pay for database space and writes (each event is one row), and for the HTTP calls to n8n if we use it. More events mean more cost. We use the same database and server as the rest of the app, so we don’t have a separate “event bill.”

### A2. How fast should it be? What's acceptable latency or throughput?

**Technical:** publishEvent should add minimal latency to the caller—we do one INSERT and one fire-and-forget POST. Target: sub-50ms for the DB insert and return; n8n forward is async so it doesn’t block. No formal SLA. Throughput is limited by DB write rate and n8n’s capacity; we don’t throttle or batch, so under heavy load the caller might see higher latency if the DB is slow. Acceptable: we don’t want event publishing to be the bottleneck for booking or completing a job.

**Simple (like for a 10-year-old):** Writing the event should be quick so the user doesn’t wait. Sending to n8n happens in the background so it doesn’t slow the user down. We don’t have a strict “must be under X ms” rule, but we don’t want this to be what makes the app feel slow.

### A4. How long do we keep the data it uses or produces?

**Technical:** job_events rows are kept until the job is deleted (ON DELETE CASCADE from jobs). We don’t purge by created_at or cap rows per job in this module. So retention is “forever for the life of the job.” For compliance or storage we might add a retention policy later (e.g. archive or delete events older than N years). n8n may keep its own copy of payloads; we don’t control that.

**Simple (like for a 10-year-old):** We keep the diary for as long as the job exists. When the job is deleted, the diary entries for that job are deleted too. We don’t delete old events just because of age—we might add that later for space or privacy.

### A6. How do we change it without breaking callers?

**Technical:** Add new event types and new optional payload fields rather than renaming or removing existing ones. Document new/optional fields so n8n and consumers can ignore or use them. If we must change event names or payload shape, version the event (e.g. event_type v2 or payload.version) and support both in n8n until callers migrate. Changing the schema of job_events (e.g. new column) requires a migration and backfill; existing callers that don’t set the new column are fine if it’s nullable or has a default. Inbound route contract (POST body) should be extended with optional fields rather than breaking existing required fields.

**Simple (like for a 10-year-old):** We add new kinds of events or new optional details instead of changing what we already have. If we have to change something, we do it in a way that old automations still work (e.g. support both old and new for a while). When we change the database we do a migration and make sure existing code still works.

### A7. What's the "contract" (API, events, schema) and how stable is it?

**Technical:** Contract: (1) publishEvent(input: PublishEventInput) => Promise<void>; (2) job_events table: job_id, actor_type, actor_id, event_type, payload, created_at; (3) n8n payload: jobId, actorType, actorId, eventName, payload, timestamp; (4) POST /n8n/events and POST /events: body with eventType (required), optional jobId, actorType, actorId, payload; header x-n8n-signature. Stability: we treat event names and the shape of payload as stable for existing types; new event types and optional payload fields are additive. We don’t have a written API version or event version field; stability is by convention and DECISIONS.md.

**Simple (like for a 10-year-old):** The “deal” is: we have a function that takes job, event name, who did it, and optional extra data; we store that and send the same to n8n. The web endpoint for n8n expects the same kind of info plus a signature. We try not to change the names or shapes we already use; when we add new things we add them in a way that doesn’t break old ones.

### A10. Can we run it twice safely (idempotency)? What happens if we replay an event or retry?

**Technical:** We do not have idempotency keys. Calling publishEvent twice with the same logical event produces two rows in job_events and two POSTs to n8n. So we are not idempotent. Replaying an event (e.g. from logs or DB) would create a new row and trigger n8n again; that might be desired (e.g. “resend to n8n”) or harmful (duplicate notifications). To make it idempotent we’d need callers to pass an idempotency key and we’d dedupe by key (e.g. in DB or Redis) before insert and forward.

**Simple (like for a 10-year-old):** Right now, if we accidentally call “publish” twice for the same thing, we write two lines in the diary and send two messages to n8n. So it’s not “safe to run twice.” To make it safe we’d need a unique label per happening and skip writing/sending if we already did that label.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails on insert: we catch, log "job_event_insert_failed", and continue to maybeForwardToN8n—so n8n may still get the event. If n8n POST fails: we catch in the .catch() on maybeForwardToN8n, log "n8n_forward_failed_non_blocking", and return; the event is in DB (if insert succeeded) but n8n didn’t get it. We don’t retry either. If the DB is down and jobId is null we don’t insert and we still try n8n. So we degrade gracefully: we try to preserve at least one copy (DB or n8n) and we never throw to the caller.

**Simple (like for a 10-year-old):** If the database is down we don’t save but we still try to send to n8n. If n8n is down we log it and give up (we don’t try again). We never crash the main request—we just log and continue. So at least one of “diary” or “n8n” might have it, but we don’t guarantee both.

### A12. What's the fallback or alternate path when the primary path fails?

**Technical:** There is no automated fallback. If DB insert fails the “fallback” is that we still forward to n8n (so n8n might have the only copy). If n8n fails we have no retry or queue—the only fallback would be manual: re-publish from logs or build a “replay events since X” tool. We don’t have a “send to notification service instead of n8n” path in this code (maybeSendNotifications is disabled). So the only built-in fallback is “n8n when DB fails”; for “n8n failed” we have no alternate path in code.

**Simple (like for a 10-year-old):** When the database fails we still send to n8n. When n8n fails we don’t have another automatic path—we’d have to fix n8n or later build something to “send again.” We don’t switch to sending email ourselves from here.

### A13. If it breaks at 3am, who gets paged and what's the blast radius?

**Technical:** Paging is not defined in the event module; it follows the app’s general on-call and alerting. Blast radius: if event publishing is broken (e.g. DB down or code bug), then no new events are written and n8n doesn’t get them—so notifications and automations stop for new actions. Existing job_events and past behavior are unchanged. Users would see: actions (book, complete, cancel, etc.) might succeed in the app but no email or n8n workflow would run. So the impact is “no new event-driven side effects”; the core app can still change state if those code paths don’t depend on publishEvent returning or on reading events.

**Simple (like for a 10-year-old):** Whoever is on call for the app would get paged if something big breaks. If the event system breaks, new “diary entries” and messages to n8n stop—so new emails and automations stop. Old data is fine. People can still use the app (e.g. book, complete), but the follow-up (emails, n8n) won’t happen until we fix it.

### A15. What business or product metric do we use to judge that it's "working"?

**Technical:** We don’t have a formal business metric in code. Operationally we’d use: (1) volume of job_event_published logs vs expected (e.g. per job lifecycle); (2) absence of job_event_insert_failed / n8n_forward_failed spikes; (3) n8n workflow success rate and notification delivery. Product-level: “notifications and automations run when they should” is the outcome; we’d measure that via notification delivery rates or user reports, not directly from the event system. So the metric is indirect: event system is “working” if downstream (n8n, notifications) are working.

**Simple (like for a 10-year-old):** We don’t have one number that says “events are working.” We’d look at: are we writing lots of events when we expect to? Are we rarely seeing “insert failed” or “n8n failed”? Are emails and n8n workflows actually running? So we judge by “did the right things happen after an action?” rather than a single event metric.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Invoke: any backend code that can call publishEvent (services, workers) and any client that can POST to /n8n/events or /events with a valid HMAC (in practice n8n, or anyone with N8N_WEBHOOK_SECRET). There’s no role check inside publishEvent. Configuration: N8N_WEBHOOK_URL and N8N_WEBHOOK_SECRET are env vars—whoever can change env (ops, deploy pipeline) can change behavior. So “who can invoke” is “any backend code + anyone with the webhook secret”; “who can configure” is whoever manages env.

**Simple (like for a 10-year-old):** Any part of our backend can publish. Anyone who has the n8n secret can send us events via the web endpoint (usually n8n). Only people who can change our server’s settings can change the n8n web address and secret. We don’t have a separate “only admins can publish” check inside the event code.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md` (candidate list), `FOUNDER_BACKEND_REFERENCE.md` (format reference), `docs/active/02-MEDIUM/N8N_EVENT_ROUTER.md` (n8n context).
