# n8n Workflows & Events — Full List

**Purpose:** Single list of (1) every event the backend sends to n8n, (2) what each is for, and (3) exactly which workflows, notifications, and alerts to create or already use in n8n.

**Use this when:** You are building or updating n8n workflows, defining notification templates, or wiring alerts. All events below are POSTed to `N8N_WEBHOOK_URL` when `publishEvent()` runs (see `src/lib/events.ts` → `forwardEventToN8nWebhook`).

---

## 1. All events sent to n8n (by category)

Every row is an **eventName** the backend publishes. Each is forwarded to n8n as JSON: `{ jobId, actorType, actorId, eventName, payload, timestamp }`.

### 1.1 Job lifecycle (core state machine)

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `job_created` | Client books a job | `jobsService.ts` |
| `job_accepted` | Cleaner accepts job | `jobsService.ts` (transition) |
| `cleaner_on_my_way` | Cleaner marks “on my way” | `jobsService.ts` (transition) |
| `job_started` | Cleaner starts job | `jobsService.ts` (transition) |
| `job_completed` | Cleaner marks job complete | `jobsService.ts` (transition) |
| `client_approved` | Client approves job | `jobsService.ts` (transition) |
| `client_disputed` | Client opens dispute | `disputesService.ts` |
| `dispute_resolved_refund` | Admin resolves dispute with refund | `disputesService.ts` or `adminService.ts` |
| `dispute_resolved_no_refund` | Admin resolves dispute, no refund | `disputesService.ts` or `adminService.ts` |
| `job_cancelled` | Job cancelled (user or admin) | `jobsService.ts` (transition) or workers |
| `job_auto_cancelled` | Auto-cancel (e.g. no-show) | `autoCancelJobs.ts` worker |
| `job_overridden` | Admin overrides job status | `adminService.ts` |
| `payment_succeeded` | Payment captured, credits granted | `paymentService.ts` |
| `payment_failed` | Payment intent failed | `paymentService.ts` |

### 1.2 Tracking / GPS / check-in

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `job.cleaner_en_route` | Cleaner sets “en route” in app | `jobTrackingService.ts` |
| `job.cleaner_arrived` | Cleaner marks arrived | `jobTrackingService.ts` |
| `job.checked_in` | Cleaner checks in (GPS/button) | `jobTrackingService.ts` |
| `job.checked_out` | Cleaner checks out | `jobTrackingService.ts` |
| `cleaner.location_updated` | GPS location update | `jobTrackingService.ts` |
| `job.approved` | Client approves (tracking flow) | `jobTrackingService.ts` |
| `job.disputed` | Client disputes (tracking flow) | `jobTrackingService.ts` |

### 1.3 Admin / repair

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `job.force_completed` | Admin force-completes job | `adminRepairService.ts` |
| `job.force_cancelled` | Admin force-cancels job | `adminRepairService.ts` |
| `job.reassigned` | Admin reassigns job to another cleaner | `adminRepairService.ts` |

### 1.4 Payouts

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `payout_created` | Payout record created | `payoutsService.ts` |
| `payout_batch_processed` | Batch of payouts processed | `payoutsService.ts` |

### 1.5 Reschedule

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `reschedule.request_created` | Reschedule request created | `rescheduleService.ts` |
| `reschedule.accepted` | Reschedule accepted | `rescheduleService.ts` |
| `reschedule.declined` | Reschedule declined | `rescheduleService.ts` |

### 1.6 Cancellation (detailed)

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `cancellation.client_cancelled` | Client cancelled | `cancellationService.ts` |
| `cancellation.cleaner_cancelled` | Cleaner cancelled | `cancellationService.ts` |
| `cancellation.system_cancelled` | System cancelled | `cancellationService.ts` |
| (other `cancellation.*` by type) | By cancellation type | `cancellationService.ts` |

### 1.7 Workers / automation

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `job_no_show_warning` | No-show warning sent to cleaner | `noShowDetection.ts` worker |
| `job_auto_approved` | Job auto-approved (e.g. after window) | `autoExpireAwaitingApproval.ts` worker |

### 1.8 Referrals

| eventName | When it fires | Source (file) |
|-----------|----------------|---------------|
| `referral.rewarded` | Referral reward granted | `referralService.ts` |

---

## 2. What is for n8n (notifications, alerts, automations)

n8n is the **single place** to decide:

- **Notifications:** Email (SendGrid), SMS (Twilio), Push (OneSignal) — who gets what and when, based on `eventName`.
- **Alerts:** Ops/Slack or alert email (e.g. disputes, payouts held, fraud).
- **Automations:** Update spreadsheets, CRMs, internal tools when events occur.

The backend **only** sends the event to n8n; it does **not** send email/SMS itself when event-driven notifications are used (see `events.ts`: `maybeSendNotifications` is disabled in favor of n8n).

---

## 3. Notifications — what n8n should do per event

For each event, the table below defines: **recipient**, **channel**, and **purpose**. Create one n8n workflow (or one Switch branch) per row, or combine related events into fewer workflows.

### 3.1 Job lifecycle → client/cleaner notifications

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `job_created` | Client | Email | Booking confirmation (use SendGrid template or equivalent). |
| `job_created` | Cleaner | Email / Push | New job / match notification (if applicable). |
| `job_accepted` | Client | Email + Push | “Cleaner confirmed your booking”. |
| `cleaner_on_my_way` | Client | Email + Push | “Cleaner on the way”. |
| `job_started` | Client | Email + Push | “Cleaner arrived / started”. |
| `job_completed` | Client | Email + Push | “Please approve & pay”. |
| `client_approved` | Client | Email | Receipt + review request. |
| `client_approved` | Cleaner | Email | “Job approved” / earnings notice. |
| `client_disputed` | Cleaner | Email | “Job disputed” — update bank / support. |
| `client_disputed` | Admin / Ops | Slack or Email | Dispute alert. |
| `dispute_resolved_refund` | Client | Email | Refund confirmation. |
| `dispute_resolved_refund` | Cleaner | Email | Dispute closed, no payment. |
| `dispute_resolved_no_refund` | Client | Email | Dispute closed, no refund. |
| `dispute_resolved_no_refund` | Cleaner | Email | Dispute closed, payment released. |
| `job_cancelled` | Client + Cleaner | Email | Cancellation notice. |
| `job_auto_cancelled` | Client + Cleaner | Email | Same as cancelled. |
| `job_overridden` | Admin / audit | Email or Slack | Admin override notice (optional). |
| `payment_succeeded` | Client | Email | Payment receipt. |
| `payment_failed` | Client | Email | “Update payment method”. |

### 3.2 Tracking / GPS events (optional notifications)

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `job.cleaner_en_route` | Client | Push | “Cleaner on the way” (if not already from `cleaner_on_my_way`). |
| `job.cleaner_arrived` | Client | Push | “Cleaner arrived”. |
| `job.checked_in` | Client | Push | “Cleaner checked in”. |
| `job.checked_out` | Client | Push | “Cleaner checked out”. |

(You can dedupe with lifecycle events: e.g. use either `cleaner_on_my_way` or `job.cleaner_en_route` for “on the way”, not both.)

### 3.3 Payouts

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `payout_created` | Cleaner | Email | “Payout processing”. |
| `payout_batch_processed` | Admin / Ops | Slack or Email | Batch summary (optional). |
| (Cleaner “payout sent”) | Cleaner | Email | “Payout sent” (often tied to payout status, not necessarily one event name). |

### 3.4 Reschedule

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `reschedule.request_created` | Client or Cleaner | Email / Push | “Reschedule requested”. |
| `reschedule.accepted` | Both parties | Email / Push | “Reschedule accepted”. |
| `reschedule.declined` | Requester | Email / Push | “Reschedule declined”. |

### 3.5 Cancellation

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `cancellation.*` | Client + Cleaner | Email | Cancellation notice (with type/fee if needed). |

### 3.6 Workers / no-show & auto-approval

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `job_no_show_warning` | Cleaner | SMS + Push | “Check in or contact support” (see NOTIFICATION_TEMPLATES_OUTLINE). |
| `job_auto_approved` | Client + Cleaner | Email | “Job auto-approved”. |

### 3.7 Reminders (time-based, not from publishEvent)

These are **not** sent as `publishEvent` from the backend; workers write to `job_events` (e.g. `job_reminder_24h_sent`, `job_reminder_2h_sent`). Options:

- **Option A:** Backend worker sends email/SMS itself (current pattern).
- **Option B:** Backend calls n8n (e.g. webhook or cron in n8n that reads “jobs needing reminder” and n8n sends email/SMS). If you choose B, add a small API or webhook “get jobs due for reminder” and one n8n workflow per reminder type.

| Logical trigger | Recipient | Channel(s) | Purpose |
|-----------------|-----------|------------|---------|
| 24h before job | Client | Email + Push | “Cleaning tomorrow” (see NOTIFICATION_TEMPLATES_OUTLINE). |
| 2h before job | Cleaner | SMS + Push | “Job in 2 hours” (see NOTIFICATION_TEMPLATES_OUTLINE). |

### 3.8 Referrals & account

| eventName | Recipient | Channel(s) | Purpose / n8n action |
|-----------|-----------|------------|----------------------|
| `referral.rewarded` | Referrer | Email | “You earned a reward”. |
| (Account: welcome, password reset) | User | Email | Handled by backend today; can move to n8n if desired (welcome, verification, password reset). |

---

## 4. Alerts — what the backend does today (can mirror in n8n)

The backend uses `sendAlert()` / `alertTemplates` in `src/lib/alerting.ts` to send:

- **Slack:** `ALERT_SLACK_WEBHOOK_URL` — message with title + body.
- **Email:** `ALERT_EMAIL_TO` / `ALERT_EMAIL_FROM` + SendGrid — plain text alert.

**Alert types (from code):**

| Alert | When | Suggested n8n use |
|-------|------|--------------------|
| Payout held | Admin holds a payout | On payout_created with “held” or internal event → Slack + email. |
| Payout reversed | Admin reverses payout | Slack + email. |
| Reconciliation resolved | Payout recon flag resolved | Optional Slack. |
| Dispute routed | Dispute routed to queue | Slack + email. |
| Fraud resolved | Fraud alert resolved | Optional Slack. |
| Stuck jobs / payouts / ledger / fraud / webhooks | Stuck job detection worker (disabled) | If you re-enable, could forward to n8n and let n8n send Slack/email. |
| Invoice/other failures | Invoice service | Optional: forward to n8n, n8n alerts. |

You can **keep alerts in the backend** (current) or **duplicate/move to n8n** (e.g. n8n listens for certain events and posts to Slack/sends email). If you move to n8n, the backend would either emit a dedicated “alert” event to n8n or you’d derive alerts from existing events (e.g. `client_disputed` → n8n sends Slack).

---

## 5. SendGrid template env vars (for n8n or backend)

If n8n sends email via SendGrid, use the same template IDs as the backend so copy stays consistent. Env vars (from `src/config/env.ts` and `src/lib/communicationValidation.ts`):

| Env var | Purpose |
|---------|---------|
| `SENDGRID_TEMPLATE_CLIENT_JOB_BOOKED` | Client: job created. |
| `SENDGRID_TEMPLATE_CLIENT_JOB_ACCEPTED` | Client: job accepted. |
| `SENDGRID_TEMPLATE_CLIENT_CLEANER_ON_MY_WAY` | Client: cleaner on the way. |
| `SENDGRID_TEMPLATE_CLIENT_JOB_COMPLETED` | Client: job completed. |
| `SENDGRID_TEMPLATE_CLEANER_JOB_APPROVED` | Cleaner: job approved. |
| `SENDGRID_TEMPLATE_CLEANER_JOB_DISPUTED` | Cleaner: job disputed. |
| `SENDGRID_TEMPLATE_USER_JOB_CANCELLED` | User: job cancelled. |
| `SENDGRID_TEMPLATE_CLIENT_CREDIT_PURCHASE` | Client: credit purchase. |
| `SENDGRID_TEMPLATE_CLEANER_PAYOUT_SENT` | Cleaner: payout sent. |
| `SENDGRID_TEMPLATE_USER_WELCOME` | User: welcome. |
| `SENDGRID_TEMPLATE_USER_EMAIL_VERIFICATION` | User: email verification. |
| `SENDGRID_TEMPLATE_USER_PASSWORD_RESET` | User: password reset. |
| `SMS_TEMPLATE_EMERGENCY` | SMS: emergency. |
| `SMS_TEMPLATE_JOB_REMINDER` | SMS: job reminder. |

n8n can read these from env or from a config node and pass the same template IDs to SendGrid.

---

## 6. Workflows to create in n8n (checklist)

Create **one webhook-triggered workflow** that receives the backend payload (or one workflow per group). Inside it, use a **Switch** on `eventName` (see `docs/active/02-MEDIUM/N8N_EVENT_ROUTER.md`).

### 6.1 Must-have (notifications)

- [ ] **job_created** → Client: booking confirmation email (and optionally cleaner match).
- [ ] **job_accepted** → Client: “Cleaner confirmed” email + push.
- [ ] **cleaner_on_my_way** → Client: “Cleaner on the way” email + push.
- [ ] **job_started** → Client: “Cleaner arrived” email + push.
- [ ] **job_completed** → Client: “Approve & pay” email + push.
- [ ] **client_approved** → Client: receipt + review; Cleaner: “Job approved” email.
- [ ] **client_disputed** → Cleaner: “Job disputed” email; Admin: Slack/email alert.
- [ ] **dispute_resolved_refund** / **dispute_resolved_no_refund** → Client + Cleaner: resolution email.
- [ ] **job_cancelled** / **job_auto_cancelled** → Client + Cleaner: cancellation email.
- [ ] **payment_succeeded** → Client: payment receipt email.
- [ ] **payment_failed** → Client: “Update payment method” email.
- [ ] **payout_created** / payout-sent logic → Cleaner: “Payout sent” email.

### 6.2 Should-have (tracking, reschedule, cancellation)

- [ ] **job.cleaner_en_route** / **job.cleaner_arrived** / **job.checked_in** / **job.checked_out** → Client: push (if not duplicating lifecycle emails).
- [ ] **reschedule.request_created** / **accepted** / **declined** → Parties: email/push.
- [ ] **cancellation.*** → Client + Cleaner: cancellation email.
- [ ] **job_no_show_warning** → Cleaner: SMS + push (or ensure worker still sends; see NOTIFICATION_TEMPLATES_OUTLINE).
- [ ] **job.force_completed** / **job.force_cancelled** / **job.reassigned** → Admin/audit or notify parties.

### 6.3 Nice-to-have (alerts, referrals, account)

- [ ] **referral.rewarded** → Referrer: email.
- [ ] Ops alerts: dispute routed, payout held/reversed, fraud resolved → Slack or alert email (in n8n or keep in backend).
- [ ] Optional: welcome, email verification, password reset via n8n (backend does these today).

### 6.4 Time-based (reminders)

- [ ] 24h reminder → Client (email + push); either backend cron + n8n webhook or n8n cron + “jobs due for 24h reminder” API.
- [ ] 2h reminder → Cleaner (SMS + push); same as above.

---

## 7. Summary table: event → n8n responsibility

| Category | Events | n8n responsibility |
|----------|--------|---------------------|
| **Job lifecycle** | job_created … payment_succeeded, payment_failed | All client/cleaner notifications (email, SMS, push). |
| **Tracking** | job.cleaner_en_route, job.checked_in, etc. | Optional push/email; avoid duplicate with lifecycle. |
| **Disputes** | client_disputed, dispute_resolved_* | Notify parties + ops alert. |
| **Payouts** | payout_created, payout_batch_processed | Cleaner “payout sent”; optional admin summary. |
| **Reschedule** | reschedule.* | Notify both parties. |
| **Cancellation** | job_cancelled, job_auto_cancelled, cancellation.* | Cancellation emails. |
| **Workers** | job_no_show_warning, job_auto_approved | No-show SMS+push; auto-approval email. |
| **Admin repair** | job.force_completed, job.force_cancelled, job.reassigned | Admin/audit or party notification. |
| **Alerts** | (backend sendAlert today) | Optional: n8n sends Slack/email for disputes, payouts, fraud. |
| **Reminders** | (workers / cron) | 24h + 2h reminders (n8n or backend). |

---

**See also:**

- `docs/active/N8N_FULL_REFERENCE.md` — env, HMAC, API, troubleshooting.
- `docs/active/02-MEDIUM/N8N_EVENT_ROUTER.md` — Switch by eventType, body shape.
- `docs/active/NOTIFICATION_TEMPLATES_OUTLINE.md` — Copy and channels for reminders, no-show, payment failed.
- `src/lib/events.ts` — `publishEvent` and forward to n8n.
- `src/lib/alerting.ts` — `sendAlert` and alert templates.

**Last updated:** 2026-01-31
