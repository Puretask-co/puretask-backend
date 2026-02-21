# n8n Agent Package Verification

**Purpose:** Verify the PureTask Core Operations Agent + child agents + routing table + architecture doc against the **actual backend behavior**. This doc states what is correct, what must be changed, and why.

**Bottom line:** The agent prompts and architecture are **mostly correct and will operate as intended** — **except** the **Payout Agent scope** and the **routing table** for financial events. In PureTask, **the backend performs all settlement and refunds before (or when) publishing events**. n8n must **not** execute payouts or refunds; it only **notifies** and **audits**.

---

## 1. What is correct ✅

### 1.1 EventRouter Agent (PT.N8N.EventRouter.Agent)

- **Correct:** Validate `eventName`, idempotency, route by taxonomy, reject unknown events, do not modify payload or call backend unless instructed, structured JSON output.
- **Operates as needed:** Yes. Use it as the first node after the Webhook trigger.

### 1.2 Notification Agent (PT.N8N.Notification.Agent)

- **Correct:** Trigger transactional notifications (email, SMS, push), reminders, template selection, idempotent delivery. Never initiate job state, payments, or marketing.
- **Operates as needed:** Yes. Use it for all user-facing messaging driven by events.

### 1.3 Core Operations Agent (governance)

- **Correct:** Treat inputs as untrusted, enforce rules, idempotency, escalate when required, no financial state change by n8n.
- **Operates as needed:** Yes. Use as the system-level spec; child agents inherit constraints.

### 1.4 Architecture doc (flow and principles)

- **Correct:** Event-first, idempotent, low-touch, auditable, scoped agents. Backend is source of truth; n8n reacts via events. HMAC for inbound n8n calls; financial actions gated; IC guardrails.
- **Operates as needed:** Yes. One fix: Payout Agent responsibility (see below).

### 1.5 Security & compliance bullets

- **Correct:** HMAC-SHA256 for n8n → backend; financial actions gated; no operational control of ICs; automation failures don’t block core flows.
- **Operates as needed:** Yes.

---

## 2. What must be corrected ⚠️

### 2.1 Payout Agent (PT.N8N.Payout.Agent) — scope

**As written:** “Trigger scheduled or instant payouts”, “Validate payout eligibility”, “Trigger payout”, “financial_action: payout | refund”.

**Actual PureTask behavior:**

- **client_approved:** Backend (`jobsService`) on transition to `completed`: (1) releases credits to cleaner, (2) updates reliability, (3) creates payout record (`recordEarningsForCompletedJob`), (4) **then** `publishEvent(client_approved)`. Actual Stripe transfer is later (e.g. weekly payout worker).
- **dispute_resolved_refund:** Backend (`disputesService`) (1) refunds credits to client, (2) marks dispute resolved, (3) **then** `publishEvent(dispute_resolved_refund)`.
- **dispute_resolved_no_refund:** Backend marks dispute resolved, **then** publishes event.
- **payment_succeeded:** Backend (`paymentService`) (1) captures payment, (2) grants credits, (3) **then** `publishEvent(payment_succeeded)`.

So by the time n8n receives these events, **settlement and refunds are already done (or queued) in the backend**. n8n does **not** trigger payouts or refunds.

**Correct scope for Payout Agent:**

- **Do:** Notify users about payout/refund outcomes (e.g. “Payout sent”, “Refund processed”). Optionally call backend APIs for **audit** or **status** only, if such APIs exist.
- **Do not:** “Trigger payouts”, “issue refunds”, or set `financial_action: payout | refund` as something n8n executes. Money movement is backend-only.

**Suggested prompt change (summary):** Replace “Trigger scheduled or instant payouts” / “Trigger payout” with “Notify users and systems about payout/refund events that the backend has already processed; optionally record or audit such events.” Keep “Never initiate payouts without explicit authorization” but clarify: “Authorization is evidenced by the backend having already published the event after performing the financial action.”

---

### 2.2 Routing table — financial rows

**As written:**

| eventName                 | Routed Agent   | Workflow                 |
|---------------------------|----------------|---------------------------|
| client_approved           | EventRouter → **Payout** | **settle_cleaner_payout** |
| dispute_resolved_refund   | EventRouter → **Payout** | **issue_refund_and_close** |
| dispute_resolved_no_refund | EventRouter → **Payout** | **close_dispute_no_refund** |
| payment_succeeded        | EventRouter    | **grant_credits_and_notify** |

**Problem:**

- **client_approved:** Backend has **already** released credits and created the payout record before publishing. n8n should **not** “settle” again. It should **notify** (e.g. receipt to client, “Job approved” to cleaner).
- **dispute_resolved_refund:** Backend has **already** refunded credits before publishing. n8n should **not** “issue_refund”. It should **notify** (e.g. “Refund processed” to client, optional audit).
- **dispute_resolved_no_refund:** Backend has already closed dispute. n8n should **notify** (e.g. “Dispute closed” to client/cleaner).
- **payment_succeeded:** Backend has **already** granted credits before publishing. n8n should **not** “grant_credits”. It should **notify** (e.g. “Payment received” / “Credits granted” to client).

**Corrected routing (canonical for PureTask):**

| eventName                 | Routed Agent        | Workflow (n8n)                    |
|---------------------------|---------------------|-----------------------------------|
| client_approved           | EventRouter → **Notification** | **notify_job_approved** (client receipt + cleaner “Job approved”) |
| dispute_resolved_refund   | EventRouter → **Notification** | **notify_dispute_resolved_refund** |
| dispute_resolved_no_refund | EventRouter → **Notification** | **notify_dispute_resolved_no_refund** |
| payment_succeeded         | EventRouter → **Notification** | **notify_payment_succeeded** (credits already granted by backend) |

Optional: a **Payout Agent** (or “Payout & settlement **notification** agent”) that only handles **notify_payout_sent**, **notify_refund_processed**, and audit logging — no execution of money movement.

---

### 2.3 Routing table — “Nothing outside this list should ever execute”

**As written:** “Nothing outside this list should ever execute.”

**Reality:** The backend sends many more events (see `N8N_WORKFLOWS_AND_EVENTS.md`): e.g. `payment_failed`, `payout_created`, `payout_batch_processed`, `job.cleaner_en_route`, `job.checked_in`, `reschedule.*`, `cancellation.*`, `job_no_show_warning`, `referral.rewarded`, etc.

**Correct wording:** “This table is canonical for the events listed. Unknown or unsupported event names should be rejected or escalated. Extend the table when adding new event types and workflows.”

---

## 3. Corrected routing table (production-grade for PureTask)

Use this as the single routing authority for the events below. Extend as you add events.

### Job lifecycle

| eventName           | Routed Agent   | Workflow                 |
|---------------------|----------------|---------------------------|
| job_created         | EventRouter → Notification | notify_job_created       |
| job_accepted        | EventRouter → Notification | notify_job_accepted      |
| cleaner_on_my_way   | EventRouter → Notification | notify_cleaner_on_my_way |
| job_started         | EventRouter → Notification | notify_job_started       |
| job_completed       | EventRouter → Notification | notify_job_completed (e.g. “Approve & pay”) |

### Approval & dispute (backend already did settlement/refund)

| eventName                 | Routed Agent   | Workflow                             |
|---------------------------|----------------|--------------------------------------|
| client_approved           | EventRouter → Notification | notify_job_approved                  |
| client_disputed           | EventRouter → Notification | notify_dispute_opened (+ escalate)   |
| dispute_resolved_refund   | EventRouter → Notification | notify_dispute_resolved_refund       |
| dispute_resolved_no_refund | EventRouter → Notification | notify_dispute_resolved_no_refund    |

### Cancellation / admin

| eventName           | Routed Agent   | Workflow                 |
|---------------------|----------------|---------------------------|
| job_cancelled       | EventRouter → Notification | notify_job_cancelled     |
| job_auto_cancelled  | EventRouter → Notification | notify_job_auto_cancelled |
| job_overridden      | EventRouter   | admin_override_audit      |

### Payment (backend already granted credits)

| eventName         | Routed Agent   | Workflow                      |
|-------------------|----------------|-------------------------------|
| payment_succeeded | EventRouter → Notification | notify_payment_succeeded     |
| payment_failed    | EventRouter → Notification | notify_payment_failed       |

Optional: add rows for `payout_created`, `payout_batch_processed`, `reschedule.*`, `cancellation.*`, `job_no_show_warning`, `referral.rewarded`, etc., as you implement workflows (see `N8N_WORKFLOWS_AND_EVENTS.md`).

---

## 4. Summary

| Artifact                 | Correct? | Action |
|--------------------------|----------|--------|
| Core Operations Agent    | ✅       | Use as-is. |
| EventRouter Agent        | ✅       | Use as-is. |
| Notification Agent      | ✅       | Use as-is. |
| Payout Agent            | ⚠️       | Narrow scope to **notify/audit only**; do not “trigger payouts” or “issue refunds”. |
| Routing table (financial rows) | ⚠️ | Point client_approved, dispute_resolved_*, payment_succeeded to **Notification** workflows; no n8n settlement/refund execution. |
| Routing table (other rows)    | ✅ | Keep; add “extend table for new events” instead of “nothing outside list”. |
| Architecture doc         | ⚠️       | In “Payout Agent” row, state “Notifications and audit of payout/refund events only; no execution of money movement.” |

With these corrections, the package **will operate as you need**: safe, predictable, aligned with PureTask (backend = source of truth for state and money; n8n = event-driven notifications and audit).

**Last updated:** 2026-01-31
