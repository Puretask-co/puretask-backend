# Founder Reference: Job Events (publishEvent → notifications)

**Candidate:** Job events flow (Module #31)  
**Where it lives:** `src/lib/events.ts` (publishEvent, maybeForwardToN8n, maybeSendNotifications), `src/services/notifications/eventBasedNotificationService.ts` (sendNotificationViaEvent), `src/services/notifications/jobNotifications.ts` (notifyJobCreated, etc.), `job_events` table  
**Why document:** End-to-end: job action → event → notification (email/SMS/push); who subscribes to what.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The job events flow is the path from "something happened on a job" to "user gets an email or SMS." (1) **Publish:** When job state changes (accept, check-in, complete, approve, dispute, cancel, etc.), the code calls `publishEvent({ jobId, actorType, actorId, eventName, payload })`. publishEvent inserts into `job_events` (job_id, actor_type, actor_id, event_type, payload, created_at), logs, and forwards to n8n (maybeForwardToN8n) non-blocking. Legacy maybeSendNotifications is disabled; notifications are event-driven via n8n. (2) **n8n:** If N8N_WEBHOOK_URL is set, we POST the event to n8n; n8n workflows can then trigger email/SMS (or other actions). (3) **Event-based notification service:** sendNotificationViaEvent maps NotificationType to template keys and event names, builds a payload, and can publish to n8n or hand off to a provider. (4) **Job notifications:** jobNotifications.ts has notifyJobCreated, notifyJobAccepted, etc., which use urlBuilder (buildClientJobUrl, buildCheckInUrl, etc.) and sendNotificationToUser/sendNotification. So the flow is: domain code → publishEvent → job_events + n8n webhook; n8n (or our notification service) then sends email/SMS using templates and URLs from urlBuilder. Who subscribes: n8n workflows subscribe to the webhook; our notificationService can also send (sendNotificationToUser) when called directly or from a workflow.

**Simple (like for a 10-year-old):** When something happens on a job (cleaner accepts, client approves, etc.), we "publish an event"—we save it in the job_events table and send it to n8n. n8n then runs workflows that send emails or texts. We also have a "job notifications" module that knows how to send "job created," "job accepted," and similar messages with the right links (from the URL builder). So the flow is: something happens → we record the event and tell n8n → n8n (or our notification code) sends the email or SMS with the right link.

### 2. Where it is used

**Technical:** **Publishers:** jobTrackingService, jobsService, paymentService, payoutsService, adminService, adminRepairService, disputesService, cancellationService, rescheduleService, webhookRetryService, referralService, events routes, noShowDetection, autoCancelJobs, autoExpireAwaitingApproval—all call publishEvent. **events.ts:** publishEvent, maybeForwardToN8n, maybeSendNotifications (disabled). **eventBasedNotificationService:** sendNotificationViaEvent (notification type → template, then n8n or provider). **jobNotifications:** notifyJobCreated, notifyJobAccepted, notifyCleanerOnMyWay, etc., use sendNotificationToUser/sendNotification and urlBuilder. **Consumers:** n8n (webhook); notificationService (when called with a type that triggers jobNotifications or eventBased path). job_events table stores every event for audit and admin timeline.

**Simple (like for a 10-year-old):** Lots of places call publishEvent: when a job is accepted, when someone checks in, when the client approves, when there's a dispute, when we pay out, etc. The event code saves to job_events and sends to n8n. The "event-based notification" code turns a notification type into a template and sends via n8n or the email/SMS provider. The "job notifications" code sends specific messages (job created, job accepted, etc.) with the right links. n8n and our notification service are the "subscribers" that actually send the emails and texts.

### 3. When we use it

**Technical:** We use it whenever a job lifecycle or payment/payout action occurs: job created, accepted, on_my_way, started, completed, awaiting_approval, approved, disputed, cancelled; payment_succeeded; dispute_resolved_*; job_overridden; job_auto_cancelled; etc. Trigger: the domain action (e.g. jobTrackingService.acceptJob) does its work then calls publishEvent. The event is stored and forwarded to n8n; n8n runs on its schedule (or immediately for webhook). maybeSendNotifications is not called (disabled); so today delivery is via n8n webhook or wherever sendNotificationToUser is invoked (e.g. from jobNotifications if something calls those functions). So "when" is: on every publishEvent (store + n8n); actual email/SMS when n8n workflow runs or when notification service is called.

**Simple (like for a 10-year-old):** We use it every time something important happens on a job or payment: job created, accepted, started, completed, approved, disputed, cancelled, or payment succeeded. The code that does the action (e.g. "accept job") then publishes the event. We save the event and send it to n8n; n8n then sends the email or SMS. The old "send notification right here" path is turned off—we rely on n8n (or explicit calls to the notification helpers) for delivery.

### 4. How it is used

**Technical:** **publishEvent:** Build payload; if jobId, INSERT into job_events (job_id, actor_type, actor_id, event_type, payload); log job_event_published; maybeForwardToN8n(jobId, actorType, actorId, eventName, payload).catch(...) (non-blocking). **maybeForwardToN8n:** If env.N8N_WEBHOOK_URL, postJson(webhookUrl, { jobId, actorType, actorId, eventName, payload }). **sendNotificationViaEvent:** Map type to template key and event name; get template id from env; build payload; publish to n8n or call provider (implementation may publish event for n8n to consume). **jobNotifications:** Get job, user names, build jobUrl/checkInUrl from urlBuilder; call sendNotificationToUser(userId, type, { jobId, jobUrl, ... }). So: publishEvent → DB + n8n; n8n or notificationService → email/SMS with URLs from urlBuilder.

**Simple (like for a 10-year-old):** When we publish an event we save it to the database (if we have a job id), log it, and send it to n8n's webhook (if the webhook is set). We don't wait for n8n—we fire and forget. The event-based notification code turns the type into a template and sends via n8n or the provider. The job notification helpers build the job link and check-in link and call "send notification to user" with that data. So the flow is: save event → send to n8n → n8n (or our code) sends the email/SMS with the right links.

### 5–8. Practical use, why, best practices, other info (condensed)

**Technical:** Ensure N8N_WEBHOOK_URL is set if we want n8n to handle delivery. job_events gives admin a full timeline (getJobEventsForAdmin). Use publishEvent for every meaningful job/payment action so n8n and audit have data. Don't block the request on n8n—maybeForwardToN8n is .catch() so failures are logged only. Best practice: one event per action; include jobId, actorType, actorId, eventName, payload. See FOUNDER_EVENTS (event system), FOUNDER_NOTIFICATIONS (templates, channels), FOUNDER_URL_BUILDER (links in notifications).

**Simple (like for a 10-year-old):** We set the n8n webhook URL if we want n8n to send the emails. The job_events table lets admins see everything that happened on a job. We publish an event for every important action so n8n and the audit trail have it. We don't wait for n8n to respond—we just send and log errors. We should send one event per action with who did it and what happened. See the event, notification, and URL builder docs.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: connect job (and payment) actions to user-visible notifications (email/SMS) and to an audit trail (job_events). Success: every key action publishes an event; events are stored and forwarded to n8n; n8n (or notification service) delivers with correct template and links. Without it we'd have no event trail and no automated notifications from actions. Not responsible for: content of templates (that's notification/template config); delivery retries (that's notification/webhook retry); or business logic of the action (that's the service that calls publishEvent).

**Simple (like for a 10-year-old):** It's there so when something happens on a job we record it and the user gets an email or text with the right link. Success is we publish every important action, save it, send it to n8n, and the user gets the message. Without it we wouldn't have a history of events or automatic emails. It doesn't write the email copy or retry sending—only connects "this happened" to "send a notification."

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs to publishEvent: jobId?, actorType?, actorId?, eventName, payload?. Outputs: row in job_events (if jobId); log; POST to n8n (if configured). Flow: action → publishEvent → INSERT job_events + maybeForwardToN8n → n8n runs workflow → email/SMS. Rules: job_id required in schema for INSERT (events without jobId are not stored in DB but still logged and can be forwarded); eventName and payload shape are convention.

**Simple (like for a 10-year-old):** We pass the job id (if any), who did it, what happened (event name), and extra data (payload). We get: a row in job_events, a log line, and a POST to n8n. The flow is: do the action → publish → save and send to n8n → n8n sends the email. We only save to the database when we have a job id; we always log and we always try to send to n8n if the webhook is set.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by domain code after job/payment actions. Failure: job_events INSERT can fail (e.g. FK)—we log and don't throw so n8n still gets the event. n8n POST can fail—we log in .catch. Depends on DB, env N8N_WEBHOOK_URL, httpClient postJson. Config: N8N_WEBHOOK_URL. Test: unit test publishEvent (mock query, mock postJson); integration test with real job_events insert. Recovery: webhook retry is in webhookRetryService if we store failed forwards. Stakeholders: product (users get notified), ops (event trail). Stateless. Assumption: n8n workflows consume the payload and send email/SMS. When not to use: for non-job events we can still publish (jobId null) but they won't be in job_events. Interacts with events.ts, job_events, n8n, notificationService, jobNotifications, urlBuilder. Owner: platform. Evolution: re-enable or replace maybeSendNotifications for fallback when n8n is down; add more event types and template mappings.

**Simple (like for a 10-year-old):** The code that does the action (accept job, complete job, etc.) triggers it. If saving the event fails we log and still send to n8n. If n8n fails we log. We need the database and the n8n webhook URL. We test by mocking the DB and the HTTP call. Product and ops care. We don't keep state. We assume n8n knows what to do with the event. This ties together events, job_events, n8n, notifications, and the URL builder. The platform team owns it. Later we might add a fallback when n8n is down or add more event types.

---

*End of Founder Reference: Job Events Flow*
