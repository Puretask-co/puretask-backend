# PureTask Automation Architecture — n8n

**Purpose:** Canonical description of how PureTask uses n8n as an event-driven automation and orchestration layer. All authoritative state and financial changes occur in the backend; n8n reacts to events and executes side-effect workflows (notifications, audit, optional API calls).

---

## Overview

PureTask uses n8n as an **event-driven automation and orchestration layer**, not as a source of truth.

- **Backend:** Authoritative for job state, payments, credits, payouts, refunds. Publishes events after (or when) those actions are done.
- **n8n:** Receives events via webhook, routes them, and runs workflows (notifications, reminders, alerts, audit). Does **not** execute payouts or refunds; it notifies and audits.

---

## Design principles

- **Event-first:** All automation begins with a published event from the backend.
- **Idempotent:** Every workflow is safe to retry (e.g. idempotency_key / n8n_event_log).
- **Low-touch:** Humans intervene only when policy requires it (e.g. escalate on dispute).
- **Auditable:** Every action is traceable to an event.
- **Scoped agents:** Each agent has a single responsibility; financial execution stays in the backend.

---

## Architecture flow

```
Backend action (e.g. client approves job)
   ↓
publishEvent()
   ↓
job_events table
   ↓
forwardEventToN8nWebhook (POST to N8N_WEBHOOK_URL)
   ↓
PT.N8N.EventRouter.Agent
   ↓
Specialized Agent (Notification / Payout-notify / etc.)
   ↓
Workflow execution (email, SMS, push, audit, optional POST /n8n/events)
   ↓
(Optional) POST /n8n/events back to backend (with HMAC)
```

---

## Agent model

| Agent | Responsibility |
|-------|----------------|
| **Core Operations Agent** | Governance & constraints (validate, idempotency, escalate, no financial execution by n8n). |
| **EventRouter Agent** | Routing only: validate eventName, apply idempotency, route to correct workflow; do not modify payload or execute business/financial logic. |
| **Notification Agent** | Messaging only: transactional email/SMS/push, reminders, template selection; never initiate job state or payments. |
| **Payout Agent** | Notifications and audit of payout/refund events only. Does **not** trigger payouts or issue refunds; the backend has already performed those actions before publishing the event. n8n notifies users (e.g. “Payout sent”, “Refund processed”) and may log or audit. |

Each agent operates with explicit guardrails; financial execution is backend-only.

---

## Security & compliance

- All inbound requests from n8n to the backend require **HMAC-SHA256** signatures (`x-n8n-signature`, `N8N_WEBHOOK_SECRET`).
- Financial actions (payments, payouts, refunds) are performed **only in the backend**; n8n does not move money.
- Independent contractors are never operationally controlled by automation; notifications are informational.
- Automation failures (n8n down, workflow error) never block core platform flows (backend still processes state and money).

---

## Why this matters

- Reduces operational cost (automated notifications, fewer manual steps).
- Minimizes human error (deterministic routing, idempotent workflows).
- Scales without adding staff (event-driven, auditable).
- Investor- and audit-ready (clear separation: backend = state/money, n8n = side-effects).
- Cleanly supports future AI copilots (same event stream, same routing table).

---

## Related docs

- **Event list and workflows:** `docs/active/N8N_WORKFLOWS_AND_EVENTS.md`
- **n8n reference (env, HMAC, API):** `docs/active/N8N_FULL_REFERENCE.md`
- **Agent package verification (routing and Payout scope):** `docs/active/N8N_AGENT_PACKAGE_VERIFICATION.md`
- **Event router (Switch by eventName):** `docs/active/02-MEDIUM/N8N_EVENT_ROUTER.md`

**Last updated:** 2026-01-31
