# Founder Reference: Notification System

**Candidate:** Notification system (System #2)  
**Where it lives:** `src/services/notifications/` (eventBasedNotificationService, notificationService, jobNotifications, templates, preferences, providers: SendGrid, Twilio, OneSignal)  
**Why document:** How we send email/SMS/push, when we send, how templates and preferences work, and how retries work.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Notification system is the subsystem that sends email, SMS, and push notifications to users (clients and cleaners). It consists of: (1) `notificationService.ts`—the main dispatcher that either uses event-based (n8n) delivery when `N8N_WEBHOOK_URL` and `USE_EVENT_BASED_NOTIFICATIONS` are set (for email/SMS), or falls back to direct provider calls (SendGrid, Twilio, OneSignal); (2) `eventBasedNotificationService.ts`—sends via `publishEvent` with a communication payload so n8n handles delivery; (3) `jobNotifications.ts`—job-specific helpers (notifyJobCreated, notifyJobAccepted, notifyCleanerOnTheWay, notifyJobCompleted, notifyJobCancelled, etc.); (4) `templates.ts`—template registry and renderer (renderNotification, getEmailSubject, getSmsBody, getPushTitle, etc.); (5) `preferencesService.ts`—user notification preferences (email_enabled, sms_enabled, push_enabled) in `notification_preferences`; (6) providers: SendGrid (email), Twilio (SMS), OneSignal (push). It supports idempotency via dedupe keys and logs all attempts to `notification_log` and failures to `notification_failures` for retry.

**Simple (like for a 10-year-old):** The Notification system is the part of the app that sends emails, text messages, and push notifications to customers and cleaners. When something important happens (job booked, cleaner on the way, job done, payment, etc.), we either tell n8n to send the message (if we use n8n) or we send it ourselves using SendGrid (email), Twilio (SMS), or OneSignal (push). We have templates for each kind of message, we remember user preferences (e.g. “no SMS”), and we try not to send the same message twice. If sending fails we save it and retry later.

### 2. Where it is used

**Technical:** The notification system is implemented in `src/services/notifications/`: `notificationService.ts` (sendNotification, sendNotificationToUser, getUserContactInfo, idempotency/dedupe, logDeliveryAttempt, recordNotificationFailure, sendEmailNotification, sendSmsNotification, sendPushNotification), `eventBasedNotificationService.ts` (sendNotificationViaEvent), `jobNotifications.ts` (notifyJobCreated, notifyJobAccepted, notifyCleanerOnTheWay, notifyJobStarted, notifyJobCompleted, notifyJobApproved, notifyJobDisputed, notifyJobCancelled, notifyCreditsLow, notifyPayoutProcessed, notifyWelcome), `templates.ts` (renderNotification, template registry), `preferencesService.ts` (getNotificationPreferences, updateNotificationPreferences), and `providers/` (SendGrid, Twilio, OneSignal). It is invoked from: jobsService, jobTrackingService, paymentService, payoutsService, disputesService, cancellationService, rescheduleService, adminService, referralService, weeklySummaryService, and workers (jobReminders, noShowDetection, retryFailedNotifications). Routes may expose preferences (e.g. notifications routes). Tables: `notification_log`, `notification_failures`, `notification_preferences`.

**Simple (like for a 10-year-old):** The “sending messages” code lives in one folder with several files: one that decides how to send (n8n or direct), one that builds the message content from templates, one that knows who to notify for each job event, and one that remembers user preferences. Lots of other parts of the app call these when a job is created, accepted, completed, cancelled, or when payment or payout happens. We also have a background job that retries failed sends.

### 3. When we use it

**Technical:** We use it whenever we need to notify a user: after job lifecycle events (created, accepted, on the way, started, completed, approved, disputed, cancelled), after payment events (credits purchased, credits low, payout processed, payout failed), after account events (welcome, password reset), and for reminders (job reminder 24h, 2h, no-show warning) and subscription renewal. Triggers are: application code after state changes (jobsService, jobTrackingService, paymentService, payoutsService, disputesService, cancellationService, rescheduleService, adminService, referralService), workers (jobReminders, noShowDetection), and the retry worker (retryFailedNotifications) for failed notifications. There is no fixed schedule for “all” notifications; each send is driven by one of these triggers.

**Simple (like for a 10-year-old):** We use it whenever we need to tell a user something: when they book a job, when a cleaner accepts or is on the way, when the job is done or cancelled, when they get paid or when we pay the cleaner, when they sign up or reset their password, and for reminders (e.g. 24 hours before the job). Each of those actions in the app triggers a notification. We also have a nightly job that retries any sends that failed earlier.

### 4. How it is used

**Technical:** Callers use `sendNotification(input: NotificationPayload)` or `sendNotificationToUser(userId, type, data, channels)`. Payload includes userId, email/phone/pushToken, type (NotificationType), channel (email|sms|push), data (template data), and optional dedupeKey. The service: (1) checks idempotency via alreadySent(dedupeKey) against notification_log (ever-sent or time-windowed by type); (2) if event-based is enabled (N8N_WEBHOOK_URL and USE_EVENT_BASED_NOTIFICATIONS and channel email or sms), calls sendNotificationViaEvent (maps type to template key and event name, builds communication payload, publishEvent); (3) else dispatches to sendEmailNotification (SendGrid), sendSmsNotification (Twilio), or sendPushNotification (OneSignal); (4) logs every attempt to notification_log (status sent/failed/skipped); (5) on failure, records to notification_failures for retry. Templates are in templates.ts (renderNotification(type, data, channels)); preferences are read from notification_preferences (not yet enforced in every path). Push always uses direct OneSignal.

**Simple (like for a 10-year-old):** Other code calls “send this type of message to this user on this channel” (email, SMS, or push). We first check if we already sent the same message (so we don’t double-send). If we use n8n for email/SMS we build the message content and publish an event so n8n sends it; otherwise we send it ourselves with SendGrid, Twilio, or OneSignal. We write down every try (sent, failed, or skipped) in a log and put failures in a “retry later” list. We have templates for each message type and we can remember user preferences (e.g. turn off SMS).

### 5. How we use it (practical)

**Technical:** In day-to-day development, services and workers call sendNotification or sendNotificationToUser (or the job-specific helpers in jobNotifications). Env controls behavior: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL (email); TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER (SMS); ONESIGNAL_APP_ID, ONESIGNAL_API_KEY (push); N8N_WEBHOOK_URL and USE_EVENT_BASED_NOTIFICATIONS (event-based email/SMS). Default for USE_EVENT_BASED_NOTIFICATIONS is true when n8n is configured. Preferences are stored in notification_preferences; routes may expose GET/PATCH for user preferences. The retryFailedNotifications worker reads notification_failures and retries; admin or support can query notification_log for delivery history.

**Simple (like for a 10-year-old):** In practice, other parts of the app call “send this notification” and pass the user, message type, and data. We set API keys for SendGrid, Twilio, and OneSignal in our config; if we use n8n we also set the n8n web address and turn on “use event-based notifications.” Users can turn email/SMS/push on or off in their preferences. When a send fails we save it and a nightly job tries again. Support can look at the log to see what was sent or skipped.

### 6. Why we use it vs other methods

**Technical:** A single notification service gives one place to choose channel (email/SMS/push), apply templates, enforce dedupe, and log. Event-based (n8n) lets us change copy and flows without code deploy and supports complex workflows; direct provider fallback keeps delivery working when n8n is off or for push (OneSignal). Idempotency via dedupe keys prevents duplicate emails/SMS for the same logical event (e.g. “job completed” once per job). Logging to notification_log and notification_failures gives audit trail and retry queue. Templates in code (templates.ts) give type-safe, versioned copy; preferences allow per-user channel control. Alternatives—each feature calling SendGrid/Twilio directly—would duplicate dedupe, logging, and template logic.

**Simple (like for a 10-year-old):** We use one “notification center” so we don’t have every feature calling SendGrid or Twilio on its own. Using n8n when we can lets us change message text and flows without changing code; when n8n isn’t used we still send ourselves. We avoid sending the same message twice by checking a “dedupe key.” We write down every send and every failure so we can debug and retry. Having templates and preferences in one place keeps things consistent and lets users control how they’re contacted.

### 7. Best practices

**Technical:** We use a single entry point (sendNotification), type-safe NotificationType and templates, dedupe (ever-sent or time-windowed by type), and log every attempt. We record failures for retry and use dynamic imports for SendGrid/Twilio to avoid loading them when not used. Gaps: preferences (email_enabled, sms_enabled, push_enabled) are not always checked before send in every code path; template version is logged but we don’t enforce “must use latest template.” Push is always direct (no n8n); event-based path doesn’t return a provider messageId. We don’t have rate limiting per user or per channel in this module.

**Simple (like for a 10-year-old):** We have one way to send, we use fixed message types and templates, we try not to send duplicates, and we log everything. We save failures and retry. What we could do better: we don’t always check user preferences before sending in every place; we don’t rate-limit how many messages one user gets. Push always goes through our own provider (OneSignal), not n8n.

### 8. Other relevant info

**Technical:** The notification system is critical for user experience: users expect email/SMS/push for job and payment events. Changing template content or adding new NotificationTypes requires code (templates.ts and possibly jobNotifications); n8n can change flows without code when event-based is used. notification_log and notification_failures tables are in 001_init.sql and 002_supplementary.sql; notification_preferences is used by preferencesService. The retryFailedNotifications worker processes notification_failures; see CRON_JOBS_AND_NOTIFICATIONS and NOTIFICATION_MATURITY_UPGRADES for more. Event-based path emits events that the event system forwards to n8n; see FOUNDER_EVENTS.md.

**Simple (like for a 10-year-old):** This system really matters—users rely on emails and texts to know what’s happening. We can change message text in code (templates) or, when using n8n, in n8n without code. We keep a log of what we sent and a list of what failed so we can retry. A background job retries failed sends. The “event” path works with the event system (see the Events founder doc).

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The notification system is supposed to (1) deliver email, SMS, and push notifications to users at the right time (job lifecycle, payment, account, reminders); (2) use templates for consistent, correct copy and URLs; (3) avoid duplicate sends via dedupe keys; (4) respect user preferences where enforced; (5) log all attempts and record failures for retry; and (6) support both event-based (n8n) and direct provider delivery. Success means: users receive the right message on the right channel when something happens, without duplicates, and failures are retried.

**Simple (like for a 10-year-old):** It’s supposed to get the right message to the right person at the right time (email, text, or push)—when they book a job, when the cleaner is on the way, when the job is done, when they get paid, etc. It’s supposed to use the same templates so messages look right, not send the same thing twice, and remember when a send failed so we can try again.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a single send means: sendNotification returned success: true (or we logged skipped for duplicate); if direct provider was used, the provider returned a messageId and we logged to notification_log with status sent; if event-based was used, publishEvent succeeded and we logged sent (actual delivery is by n8n). Observable results: row in notification_log with status sent or skipped; no row in notification_failures for this attempt; user receives email/SMS/push. Failure means success: false, row in notification_log with status failed, and row in notification_failures for retry.

**Simple (like for a 10-year-old):** Success for one notification means we either sent it (and wrote “sent” in our log) or we skipped it because we’d already sent the same one. The user gets the email or text or push. If we failed we write “failed” in the log and put it in the “retry later” list so the nightly job can try again.

### 11. What would happen if we didn't have it?

**Technical:** Without a centralized notification system users would not get timely email/SMS/push for job and payment events; each feature would need to implement its own sending, leading to inconsistent copy, no dedupe, no shared retry queue, and no single audit log. Support would have no single place to see “what did we send this user?” Adding a new channel or template would require changes in many places. Preferences and retry behavior would be duplicated or missing.

**Simple (like for a 10-year-old):** Without it we wouldn’t have one place that sends all the messages. Users might not get emails or texts when jobs are booked or completed, or we’d have to build sending into every feature separately—and we’d have no shared “don’t send twice” or “retry if it failed” or “what did we send?” log.

### 12. What is it not responsible for?

**Technical:** The notification system is not responsible for: deciding *when* to notify (that’s the caller—jobsService, paymentService, etc.); job state changes; event publishing (it uses the event system when event-based); content authoring beyond templates (e.g. marketing copy); delivery guarantees from n8n (we publish events; n8n delivers); or receiving inbound messages (e.g. SMS replies). It only sends outbound notifications and logs attempts/failures.

**Simple (like for a 10-year-old):** It doesn’t decide *when* something happened—other code tells it “send this now.” It doesn’t change the job or payment; it doesn’t run n8n—it just asks the event system to publish when we use n8n. It doesn’t promise that n8n will deliver; it only sends the event. It only sends messages out; it doesn’t handle replies.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Inputs for sendNotification: userId (optional), email or phone or pushToken (depending on channel), type (NotificationType), channel (email|sms|push), data (Record<string, unknown> for template data—jobId, clientName, cleanerName, address, scheduledDate, jobUrl, etc.), and optional dedupeKey. For sendNotificationToUser we need userId, type, data, and channels; we load email/phone/pushToken from getUserContactInfo (users table). Templates expect TemplateData (jobId, clientName, cleanerName, address, jobUrl, creditAmount, etc.). Preferences come from notification_preferences (user_id, email_enabled, sms_enabled, push_enabled). Provider config: SENDGRID_*, TWILIO_*, ONESIGNAL_*, N8N_WEBHOOK_URL, USE_EVENT_BASED_NOTIFICATIONS.

**Simple (like for a 10-year-old):** We need who to send to (user ID or email/phone), what kind of message (e.g. job created, job completed), which channel (email, SMS, or push), and the details to fill in the template (job address, date, link, etc.). We can optionally pass a “dedupe key” so we don’t send the same thing twice. We get user contact info from the database and user preferences from the preferences table. We need API keys and the n8n setting in config.

### 14. What does it produce or change?

**Technical:** It produces: (1) outbound email (SendGrid), SMS (Twilio), or push (OneSignal), or an event payload to n8n; (2) rows in notification_log (user_id, channel, type, payload, status sent/failed/skipped, error_message, sent_at); (3) rows in notification_failures on failure (user_id, channel, type, payload, error_message, retry_count) for retry worker; (4) log entries (notification_sent, notification_failed, email_sent, sms_sent, push_sent, etc.). It does not change job state, user state, or event tables; it only sends and logs.

**Simple (like for a 10-year-old):** It sends an email or text or push (or tells n8n to do it), writes a line in the “notification log” (sent, failed, or skipped), and if it failed it adds a row to the “failures” list so we can retry. It doesn’t change the job or the user—just sends the message and writes down what happened.

### 15. Who or what consumes its output?

**Technical:** The primary consumer is the end user (client or cleaner) who receives email, SMS, or push. Secondary consumers: n8n (when event-based) receives the event and performs delivery; support and admins query notification_log for “what did we send?”; the retryFailedNotifications worker reads notification_failures and calls sendNotification again. No other system “consumes” the notification payload as structured data; the output is human-facing messages and logs.

**Simple (like for a 10-year-old):** The main consumer is the person who gets the email or text or push. n8n consumes our event when we use event-based sending and then sends the message. Support and our retry job use the log and the failures list to see what was sent and what to retry.

### 16. What are the main steps or flow it performs?

**Technical:** For each sendNotification: (1) if dedupeKey provided, call alreadySent(dedupeKey, type) against notification_log (ever or time-windowed); if already sent, log skipped and return success; (2) if USE_EVENT_BASED_NOTIFICATIONS and N8N_WEBHOOK_URL and channel email or sms, call sendNotificationViaEvent (map type to template key and event name, get templateId from env, createCommunicationPayload, publishEvent), then logDeliveryAttempt and return; (3) else switch on channel: sendEmailNotification (renderNotification, SendGrid send), sendSmsNotification (renderNotification, Twilio), sendPushNotification (renderNotification, OneSignal); (4) logDeliveryAttempt(sent or failed); (5) on throw, recordNotificationFailure and return failure. sendNotificationViaEvent: map type to template key, validate templateId, build communication payload, publishEvent with communication + data, log notification_event_emitted, return success.

**Simple (like for a 10-year-old):** When we send: we check if we already sent this same message (dedupe). If we use n8n for email/SMS we build the message, publish an event, and log. Otherwise we pick the right provider (SendGrid, Twilio, or OneSignal), render the template, send, and log. If anything throws we save the failure for retry and return failure. The event-based path just publishes one event with all the message details and leaves delivery to n8n.

### 17. What rules or policies does it enforce?

**Technical:** It enforces: (1) dedupe by dedupeKey—ever-sent for job lifecycle, welcome, credits.purchased, payout.processed, etc.; time-windowed for password.reset (60 min), credits.low (24 h), payout.failed (24 h), subscription.renewal_reminder (24 h); (2) channel must be email, sms, or push; (3) for email we need SENDGRID_API_KEY and input.email; for SMS we need TWILIO_* and input.phone; for push we need ONESIGNAL_* and (pushToken or userId); (4) event-based path skips push (returns “not supported via events”). It does not enforce: user preferences (email_enabled, sms_enabled, push_enabled) in every code path; rate limits; or template version.

**Simple (like for a 10-year-old):** We enforce: don’t send the same logical message twice (either “ever” or “not within the last X hours” depending on type). We require the right config and recipient for each channel. When we use n8n we only do it for email and SMS, not push. We don’t always check “user turned off SMS” in every place yet.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** It is triggered by: (1) application code after state changes—jobsService (job created), jobTrackingService (accepted, on the way, started, completed), paymentService (credits purchased), payoutsService (payout processed/failed), disputesService, cancellationService, rescheduleService, adminService, referralService, weeklySummaryService; (2) workers—jobReminders (reminder_24h, reminder_2h), noShowDetection (no_show_warning), retryFailedNotifications (retries from notification_failures). Callers use sendNotification, sendNotificationToUser, or jobNotifications helpers (notifyJobCreated, notifyJobAccepted, etc.). There is no cron that “sends all pending notifications”; each send is triggered by a specific action or the retry worker.

**Simple (like for a 10-year-old):** It’s triggered whenever another part of the app says “send this notification”—when a job is created, accepted, started, completed, cancelled, when payment or payout happens, when we send reminders, or when the retry job runs for failed sends. Nothing runs on a timer just to “send notifications”; every send is tied to an action or to retry.

### 19. What could go wrong while doing its job?

**Technical:** (1) Provider down (SendGrid, Twilio, OneSignal)—send fails, we log and record to notification_failures; retry worker will retry. (2) n8n down or event not delivered—event-based path still “succeeds” from our perspective (publishEvent succeeded); n8n may not deliver; we don’t have a retry for “n8n didn’t deliver.” (3) Missing config (no SENDGRID_API_KEY, etc.)—we return success: false with “not configured” and don’t throw. (4) Missing template or templateId—event-based may return success with warning; direct path may fall back to legacy getEmailSubject/getEmailBody or fail. (5) alreadySent or logDeliveryAttempt DB failure—we fail open (allow send) and log. (6) Duplicate send if dedupeKey not passed—caller responsibility. (7) User preferences not checked—we may send to a channel the user disabled. (8) Rate limits—we don’t throttle; provider or app-level rate limits may apply.

**Simple (like for a 10-year-old):** Things that can go wrong: SendGrid or Twilio or OneSignal could be down—we’d log the failure and retry later. If we use n8n and n8n is down we might think we “sent” (we published the event) but the user might not get the message. If we don’t have an API key we return “not configured.” If we don’t pass a dedupe key we might send the same message twice. We might send to a channel the user turned off because we don’t check preferences everywhere yet.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) notification_log—status sent/failed/skipped per attempt; (2) notification_failures—count and retry_count for retries; (3) logs—notification_sent, notification_failed, email_sent, sms_sent, push_sent, notification_event_emitted; (4) provider dashboards (SendGrid, Twilio, OneSignal) for delivery stats; (5) n8n execution history when event-based. We don’t have a dedicated metric (e.g. “notifications sent per minute” or “failure rate”) in this module; those would be in a metrics layer. Tests: unit tests for templates and notification service; integration tests may send to test addresses or mock providers.

**Simple (like for a 10-year-old):** We know it’s working when we see “sent” in the log and the user gets the message. We know something’s wrong when we see “failed” and a row in the failures table, or when the retry job runs. We can also check SendGrid/Twilio/OneSignal and n8n for their own stats. We don’t have a single “notification health” number in the app yet.

### 21. What does it depend on to do its job?

**Technical:** It depends on: (1) DB for notification_log, notification_failures, notification_preferences, and users (getUserContactInfo); (2) env: SENDGRID_API_KEY, SENDGRID_FROM_EMAIL; TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER; ONESIGNAL_APP_ID, ONESIGNAL_API_KEY; N8N_WEBHOOK_URL, USE_EVENT_BASED_NOTIFICATIONS; (3) event system (publishEvent) when event-based; (4) httpClient or fetch for SendGrid/Twilio/OneSignal (SendGrid and Twilio use their SDKs, OneSignal uses fetch); (5) urlBuilder for job URLs in templates; (6) logger. It does not depend on the queue for the main send path; the retry worker may use the queue.

**Simple (like for a 10-year-old):** It needs the database (for the log, failures, preferences, and user email/phone). It needs API keys for SendGrid, Twilio, and OneSignal, and the n8n web address and “use event-based” flag when we use n8n. It needs the event system when we send via n8n. It needs the URL builder to put the right links in messages. It doesn’t need the job queue to send—only the retry job might use the queue.

### 22. What are the main config or env vars that control its behavior?

**Technical:** SENDGRID_API_KEY, SENDGRID_FROM_EMAIL—email delivery; if missing, email path returns “not configured.” TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER—SMS; if missing, SMS returns “not configured.” ONESIGNAL_APP_ID, ONESIGNAL_API_KEY—push; if missing, push returns “not configured.” N8N_WEBHOOK_URL—when set with USE_EVENT_BASED_NOTIFICATIONS, email/SMS use event-based path. USE_EVENT_BASED_NOTIFICATIONS—default true when n8n is configured (env.ts); when false we always use direct providers for email/SMS. Template IDs may be in env (e.g. SendGrid template IDs) via communicationValidation/getTemplateIdFromEnvVar. No feature flags beyond USE_EVENT_BASED_NOTIFICATIONS in this module.

**Simple (like for a 10-year-old):** The main settings are: SendGrid and Twilio and OneSignal API keys and from-address/from-number. If we set the n8n web address and leave “use event-based notifications” on (default), email and SMS go through n8n; otherwise we send ourselves. We can turn off event-based with one env var. Template IDs for SendGrid might also be in config.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests cover: templates (renderNotification for types and channels), dedupe logic (getDedupeWindow, alreadySent), and possibly sendNotification with mocked DB and providers. Integration tests may call sendNotification with test credentials or mock SendGrid/Twilio/OneSignal; we may use test email/phone or sandbox mode. We don’t have an end-to-end test that asserts delivery to a real inbox; that would require a test account and provider. retryFailedNotifications worker has its own tests. Manual checks: send a test notification, query notification_log and notification_failures, and confirm provider delivery (or n8n execution).

**Simple (like for a 10-year-old):** We have tests that check template rendering and dedupe logic, and we can mock the email/SMS/push providers so we don’t really send. We don’t automatically test “did the user really get the email”—that would need a test inbox. We can manually send a test and look at the log and at SendGrid/Twilio/n8n to confirm.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** On send failure we record to notification_failures; the retryFailedNotifications worker periodically reads notification_failures, calls sendNotification again, and on success deletes the row (or increments retry_count and backs off). Manual recovery: fix provider config (API key, from address), fix n8n if event-based, then trigger retries or re-send from support. We don’t have automatic rollback (notifications are side effects); we only retry. If event-based send “succeeded” but n8n didn’t deliver, we have no built-in retry for that—we’d need n8n to poll or replay events. Logs and notification_log help debug “why did this user not get the message?”

**Simple (like for a 10-year-old):** When a send fails we save it in the failures table and the retry job tries again later. To fix things we fix the API keys or n8n and then let the retry job run or manually trigger a resend. We can’t “undo” a send; we can only retry. If we thought we sent via n8n but n8n didn’t deliver, we don’t have an automatic “send again” for that—we’d need to improve n8n or add a replay.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders include: end users (clients and cleaners) who expect timely email/SMS/push; product and support (reliable delivery and audit trail); engineering (single place to add templates and channels); ops (provider config and retry job); and compliance (if we need to prove what was sent). n8n operators care when event-based is used. Marketing or growth may care about templates and preferences for future campaigns.

**Simple (like for a 10-year-old):** People who care: the users who get the messages, the team that wants delivery to be reliable and traceable, the engineers who maintain templates and providers, and anyone on call when providers or n8n break. If we use n8n, the people who run n8n care too.

### 26. What are the security or privacy considerations for what it does?

**Technical:** Notifications carry PII (email, phone, name, address, job details). We send to external providers (SendGrid, Twilio, OneSignal) and, when event-based, to n8n; we must trust their handling of PII and comply with their terms and privacy policy. Logs and notification_log may contain recipient and template data; access should be restricted (e.g. support/admin only). We don’t redact in logs in this module. Dedupe keys and payloads in notification_failures may include jobId and user data; same access controls. Outbound only—we don’t receive or store inbound SMS/email content in this service. User preferences (notification_preferences) should be respected and disclosed in privacy policy.

**Simple (like for a 10-year-old):** Messages contain personal stuff (email, phone, name, address). We send that to SendGrid, Twilio, OneSignal, and sometimes n8n—we rely on them to handle it safely. Our log of what we sent also has that info, so only trusted people should see it. We should honor “user turned off SMS” and say so in our privacy policy. We only send messages out; we don’t store what people reply.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** Each send is one or more provider API calls (or one publishEvent); under high volume we’re limited by provider rate limits (SendGrid, Twilio, OneSignal) and by our DB (notification_log and notification_failures grow). We don’t batch sends or use a queue for the main path; callers await sendNotification. Retry worker processes notification_failures in batches but we don’t throttle outbound rate in this module. Event-based path shifts load to n8n; n8n’s own limits apply. No formal SLA; we treat delivery as best-effort with retry.

**Simple (like for a 10-year-old):** If we send a lot of messages we’re limited by SendGrid/Twilio/OneSignal limits and by how fast we can write to the log. We don’t batch or queue sends in the main path—each call sends one message. The retry job helps with failures but we don’t slow down sends to stay under a rate. When we use n8n, n8n has its own limits. We don’t promise a strict “delivered in X seconds” guarantee.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d enforce preferences (email_enabled, sms_enabled, push_enabled) in every send path. We’d add metrics (sent/min, failure rate by channel) and alerts. We’d consider a queue for outbound notifications so we don’t block callers and can throttle. We’d add retry or replay for event-based path when n8n doesn’t deliver. We’d document and enforce template version. We’d add rate limiting per user or per channel to avoid abuse. We’d fix the bug where event-based branch uses `rendered` before it’s defined in notificationService (logDeliveryAttempt). We’d consider moving template IDs and copy to a CMS or n8n entirely for non-engineer edits.

**Simple (like for a 10-year-old):** We’d always check user preferences before sending. We’d add dashboards and alerts for “how many sent” and “how many failed.” We might use a queue so sending doesn’t slow down the main action. We’d have a way to retry when n8n didn’t deliver. We’d rate-limit so one user can’t get thousands of messages. We’d fix the small bug where we use a variable before it’s set in one code path. We might let non-engineers edit message text in n8n or a CMS.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** There is no long-lived process; each sendNotification is a single invocation. Lifecycle per call: start when caller invokes sendNotification; check dedupe; choose event-based or direct; send (or publishEvent); log; on failure record to notification_failures; return. The retry worker has its own lifecycle: run on schedule, read notification_failures, call sendNotification for each, delete or update row. notification_log rows are final once inserted; notification_failures rows are removed on success or updated (retry_count). No “pending” or “in progress” state for a notification in this module.

**Simple (like for a 10-year-old):** Each send is one shot: we’re called, we check dedupe, we send (or publish), we log, we return. The retry job runs on a schedule, reads the failures list, tries again, and removes or updates the row. We don’t keep a “sending in progress” state—we either sent or we failed and saved for retry.

### 30. What state does it keep or track?

**Technical:** Persistent state: notification_log (user_id, channel, type, payload, status, error_message, sent_at)—every attempt; notification_failures (user_id, channel, type, payload, error_message, retry_count)—failed sends for retry; notification_preferences (user_id, email_enabled, sms_enabled, push_enabled). No in-memory state in this module; no cache. We don’t track “last send per user” or “pending batch” in the DB beyond notification_failures.

**Simple (like for a 10-year-old):** We keep: the log of every send (who, what, sent/failed/skipped), the list of failures to retry, and user preferences (email/SMS/push on or off). We don’t keep anything in memory between requests—just the database tables.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) DB is available and notification_log, notification_failures, notification_preferences exist; (2) callers pass valid NotificationType and channel and recipient (email/phone/pushToken or userId for sendNotificationToUser); (3) template data (data) contains the keys required by the template (e.g. jobId, address, jobUrl); (4) when event-based, the event system and n8n are configured and n8n consumes the event; (5) providers (SendGrid, Twilio, OneSignal) are up and credentials are valid; (6) dedupeKey, when provided, is unique per logical event so we don’t double-send. We don’t assume preferences are checked by the caller; we don’t assume idempotency of provider calls (we rely on our own dedupe).

**Simple (like for a 10-year-old):** We assume the database and tables exist, that the caller gives us a valid message type and channel and recipient, and that the data has the right fields for the template. When we use n8n we assume the event system and n8n are set up. We assume SendGrid/Twilio/OneSignal are up and our keys are right. We assume that when a dedupe key is passed it really means “same event” so we can skip duplicates. We don’t assume the caller already checked user preferences.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use sendNotification for: (1) high-frequency, low-value signals (e.g. every click)—use metrics or in-app only; (2) bulk marketing blasts without batching and rate limits—we don’t throttle; (3) inbound message handling (SMS reply, email reply)—this is outbound only; (4) content that must not go through third parties (use a different channel or on-prem provider). Use something else when: you need guaranteed delivery with ack (we have best-effort + retry); you need to send to a list without per-user dedupe (we’re per-send); or you need real-time delivery SLA (we don’t promise latency).

**Simple (like for a 10-year-old):** Don’t use it for tiny updates on every click—use analytics for that. Don’t use it for huge marketing blasts without planning—we don’t slow down for rate limits. Don’t use it to handle replies—we only send out. Use something else when you need “guaranteed delivered and acknowledged” or when you need to send to a big list in a special way—we’re built for “send this one message and retry if it fails.”

### 33. How does it interact with other systems or features?

**Technical:** It receives calls from jobsService, jobTrackingService, paymentService, payoutsService, disputesService, cancellationService, rescheduleService, adminService, referralService, weeklySummaryService, and workers (jobReminders, noShowDetection, retryFailedNotifications). It uses the event system (publishEvent) when event-based. It uses urlBuilder for job URLs in templates. It reads users (email) and notification_preferences. It calls SendGrid, Twilio, OneSignal APIs. It writes notification_log and notification_failures. So the main interactions are: many callers → notification service → (event system → n8n) or (SendGrid/Twilio/OneSignal); and retry worker → notification_failures → notification service.

**Simple (like for a 10-year-old):** Lots of parts of the app call us to send a message. When we use n8n we ask the event system to publish an event and n8n sends the message. We use the URL builder to put the right links in the message. We read user email and preferences from the database. We call SendGrid, Twilio, and OneSignal to actually send. We write the log and the failures list. The retry job reads the failures list and calls us again.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure means: sendNotification returned success: false (error string set); we logged notification_failed; we wrote notification_log with status failed and wrote notification_failures. We signal failure by return value and logs; we don’t throw from sendNotification (we catch and return). Callers can check result.success and result.error. Event-based path may return success: true after publishEvent even if n8n later fails—so “failure” for event-based is only when publishEvent throws or we can’t build the payload. Provider “not configured” returns success: false without throwing.

**Simple (like for a 10-year-old):** Failure means we couldn’t send—we return “failed” and an error message, we write “failed” in the log, and we add a row to the failures list. We don’t crash the caller—we catch and return. When we use n8n we might return “success” after we published the event even if n8n doesn’t deliver—so “failure” for that path is only when we couldn’t publish. If the provider isn’t configured we return “not configured” and don’t throw.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we don’t validate template data against a strict schema at runtime; we trust callers. We validate NotificationType and channel. Completeness: we log every attempt so we can audit “did we try to send this?” We don’t verify that the user actually received the email/SMS/push (no read receipt); we rely on provider delivery reports or n8n execution. So we infer correctness from logs and provider dashboards; we don’t have automated “delivery confirmed” checks.

**Simple (like for a 10-year-old):** We don’t double-check that every field in the template data is correct—we trust the caller. We do check that the message type and channel are valid. We know we “tried” because we log every attempt. We don’t verify “user opened the email”—we rely on SendGrid/n8n for that. So we use the log and provider stats to know we did our part.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned in the repo; typically the backend or product team would own the notification system. Changes to NotificationType, templates, or provider logic require code changes; event-based flows can be changed in n8n. DECISIONS.md or NOTIFICATION_* docs are the place to record why we added a type or switched provider. Template changes (copy, URLs) may involve product or marketing.

**Simple (like for a 10-year-old):** The team that owns the backend (or the person named as owner) is responsible. When we add a new message type or change templates we need to update code (and maybe n8n). We should write down big changes in our docs. Changing the actual message text might involve product or marketing too.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) enforce preferences in every path and add more preference granularity (e.g. per notification type); (2) queue-based sending so we don’t block callers and can throttle by provider; (3) metrics and alerts (sent/min, failure rate by channel); (4) retry or replay for event-based when n8n doesn’t deliver; (5) rate limiting per user/channel; (6) template versioning and A/B tests; (7) multi-region or multi-tenant provider config; (8) move more copy to n8n or CMS for non-engineer edits. As we add channels (e.g. in-app, WhatsApp) we’d extend NotificationChannel and add providers.

**Simple (like for a 10-year-old):** As we grow we might always check preferences and let users choose more finely. We might use a queue so sending doesn’t slow down the app and we can respect rate limits. We’d add dashboards and alerts. We’d have a way to retry when n8n didn’t deliver. We might let non-engineers edit message text in n8n or a CMS. If we add new channels (e.g. WhatsApp) we’d add new providers and types.

---

## Additional questions (A): Cost, performance, contract, resilience, metrics, access

### A1. What does it cost to run?

**Technical:** Cost is dominated by: (1) provider APIs—SendGrid (email), Twilio (SMS), OneSignal (push) per message or per recipient; (2) DB—notification_log and notification_failures storage and writes; (3) n8n hosting when event-based. We don’t batch; each send is one or more API calls. Cost scales with notification volume. No dedicated infra for this module; it shares the app process and DB.

**Simple (like for a 10-year-old):** We pay for each email (SendGrid), each SMS (Twilio), and each push (OneSignal), and for database space for the log and failures. When we use n8n we pay for n8n too. More messages mean more cost. We use the same server and database as the rest of the app.

### A2. How fast should it be? What's acceptable latency or throughput?

**Technical:** sendNotification is synchronous from the caller’s perspective—we await provider calls or publishEvent. Target: sub-second for direct provider (SendGrid/Twilio/OneSignal typically 200–500 ms); event-based is fast (publishEvent + return). We don’t want notification sending to block the main request for long; if we add a queue later, “accept and queue” would be fast and delivery would be async. No formal SLA for “message delivered in X seconds”; throughput is limited by provider rate limits and our DB write rate.

**Simple (like for a 10-year-old):** Sending should be quick so the user’s action (e.g. “complete job”) doesn’t wait too long. Usually the provider answers in under a second. We don’t promise “user gets the email in 5 seconds”—we just try to send quickly. If we ever use a queue, we’d “accept” instantly and send in the background.

### A4. How long do we keep the data it uses or produces?

**Technical:** notification_log: we don’t purge by age in this module; retention is “forever” unless we add a job to delete old rows (e.g. older than 1 year). notification_failures: rows are deleted on successful retry or may be kept for audit; we could add retention. notification_preferences: kept for the life of the user. Template data in payloads may contain PII; same retention as log. For compliance we might add retention (e.g. 2 years) and archival.

**Simple (like for a 10-year-old):** We keep the log of sends until we decide to delete old rows—we don’t auto-delete yet. We keep failures until we retry and succeed (then we delete the row). We keep user preferences as long as the user exists. We might later add “delete log older than X years” for privacy or storage.

### A6. How do we change it without breaking callers?

**Technical:** Add new NotificationType and template rather than removing or renaming existing ones. Add optional fields to NotificationPayload and TemplateData; keep existing fields. When changing template copy or required data, add a new template or version and migrate callers. When switching provider or adding event-based, keep fallback (direct provider) so callers don’t need to change. Env flags (USE_EVENT_BASED_NOTIFICATIONS) let us toggle without code change. Document new types and template keys in types.ts and templates.ts.

**Simple (like for a 10-year-old):** We add new message types and templates instead of changing old ones. We add optional fields rather than removing required ones. When we change the text or required data we add a new version and move callers over. We keep the “send ourselves” path so we can turn off n8n without breaking anything. We document new types and templates.

### A7. What's the "contract" (API, events, schema) and how stable is it?

**Technical:** Contract: sendNotification(input: NotificationPayload) => Promise<NotificationResult>; sendNotificationToUser(userId, type, data, channels?) => Promise<NotificationResult[]>; NotificationPayload (userId, email?, phone?, pushToken?, type, channel, data, dedupeKey?); NotificationResult (success, messageId?, error?, channel?). Event-based: we publish an event with communication payload (templateKey, templateId, to_email/to_phone, channel, dynamic_data) and event name per NOTIFICATION_TYPE_TO_EVENT_NAME. Stability: we treat NotificationType and channel as stable; new types are additive. Payload data shape is per-template; we don’t version it in the API. Provider and n8n payloads may change; we document in NOTIFICATION_* docs.

**Simple (like for a 10-year-old):** The “deal” is: callers pass user, message type, channel, and data; we return success or failure and maybe a message ID. When we use n8n we send an event with the message details and a fixed set of event names. We try not to change existing types or remove fields; we add new types and optional fields. The exact shape of what we send to SendGrid/n8n might change and we document that in our docs.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** We support idempotency via dedupeKey: alreadySent(dedupeKey, type) checks notification_log (ever-sent or time-windowed). If the same dedupeKey was already sent we skip and return success. So calling sendNotification twice with the same dedupeKey is idempotent (second call is skipped). If the caller doesn’t pass dedupeKey we may send twice. Retry worker uses the same payload from notification_failures so dedupeKey is preserved; retrying is idempotent if the first retry succeeds and we delete the row. Replaying an old notification (e.g. from log) would need a new dedupeKey or would send again.

**Simple (like for a 10-year-old):** If the caller gives us a “dedupe key” we check if we already sent that same message. If we did we skip and return success—so calling us twice with the same key is safe. If they don’t pass a key we might send twice. When the retry job runs it uses the same key so we don’t double-send. If someone re-sends an old message without a new key we might send a duplicate.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails during alreadySent or logDeliveryAttempt: we catch and log; for alreadySent we fail open (return false so we allow send); for logDeliveryAttempt we don’t throw so send still returns. If SendGrid/Twilio/OneSignal fails: we catch, log, recordNotificationFailure, return success: false. If publishEvent fails (event system or DB): event-based path throws, we catch in sendNotification, recordNotificationFailure, return success: false. So we degrade gracefully: we try to send and log; we don’t crash the caller; we record failures for retry.

**Simple (like for a 10-year-old):** If the database is down when we check “already sent” we allow the send (we don’t block). If the database is down when we write the log we still return the send result. If SendGrid or Twilio or OneSignal is down we log, save to failures, and return failed. If the event system is down when we use n8n we save to failures and return failed. We never crash the main request—we always catch and return.

### A12. What's the fallback or alternate path when the primary path fails?

**Technical:** When event-based is enabled we use it for email/SMS; when it’s disabled or n8n is not configured we fall back to direct SendGrid/Twilio. There is no “if n8n fails then try SendGrid” in the same request—we choose one path at the start. So the only “fallback” is config: set USE_EVENT_BASED_NOTIFICATIONS=false to force direct providers. Push has no fallback (OneSignal only). On failure we have the retry worker as the “alternate path” (later in time), not a synchronous fallback.

**Simple (like for a 10-year-old):** We don’t have “if n8n fails then send ourselves” in the same request. We either use n8n or we send ourselves, based on config. So the fallback is to change config (turn off event-based) to use SendGrid/Twilio directly. For push we only have OneSignal. When a send fails the “fallback” is the retry job later—not a second try right away.

### A13. If it breaks at 3am, who gets paged and what's the blast radius?

**Technical:** Paging is not defined in this module; it follows the app’s on-call. Blast radius: if the notification system is broken (e.g. all providers down, or bug in sendNotification), no new email/SMS/push is delivered. Users wouldn’t get job or payment notifications; reminders and retries would fail. Existing data (jobs, payments) is unchanged; only the “tell the user” side fails. So impact is “no new notifications”; core app (book job, complete job, pay) can still work. If only one provider is down (e.g. SendGrid), only that channel fails; we’d still send SMS/push if configured.

**Simple (like for a 10-year-old):** Whoever is on call for the app would get paged. If notifications are broken, no one gets new emails or texts or push—but the rest of the app (booking, completing, paying) still works. If only email is broken (e.g. SendGrid down), SMS and push could still work if we use them.

### A15. What business or product metric do we use to judge that it's "working"?

**Technical:** We don’t have a formal business metric in code. Operationally we’d use: (1) notification_log status distribution (sent vs failed vs skipped); (2) notification_failures count and retry success rate; (3) provider delivery rates (SendGrid/Twilio/OneSignal); (4) n8n execution success when event-based. Product-level: “users receive job and payment notifications when expected” is the outcome; we’d measure via delivery rates or user reports, not a single metric from this module.

**Simple (like for a 10-year-old):** We don’t have one number that says “notifications are working.” We’d look at: how many sent vs failed in the log, how many failures we have and how many we retry successfully, and provider stats. The real test is “do users get the messages they expect?”—we’d see that from delivery stats or support tickets.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Any backend code that can call sendNotification or sendNotificationToUser can invoke it—jobsService, jobTrackingService, paymentService, workers, etc. There’s no role check inside the notification service. Configuration (env vars) is changed by whoever manages deployment (ops, CI/CD); no separate “notification admin” role. Preferences (notification_preferences) are updated by the user (via routes) or by support/admin if we expose that. So “who can invoke” is “any backend caller”; “who can configure” is “whoever controls env”; “who can change preferences” is “user or admin.”

**Simple (like for a 10-year-old):** Any part of our backend that needs to send a message can call us—we don’t check “is this an admin.” Only people who can change the server’s env can change API keys and the n8n flag. Users can change their own preferences (email/SMS/push on/off) in the app; we might let support change them too.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md` (candidate list), `FOUNDER_EVENTS.md` (event system), `FOUNDER_BACKEND_REFERENCE.md` (format reference), `docs/active/02-MEDIUM/NOTIFICATION_*.md` (maturity, templates, sender analysis).
