# Founder's Backend Reference (Index)

**What it is:** Index to founder-level deep dives: what each major piece of the PureTask backend is, where and when it's used, how and why we use it, and how it aligns with best practices.  
**What it does:** Points you to the right doc so you can reason about architecture, tradeoffs, and changes.  
**How we use it:** Read the topic doc when making product/tech decisions or onboarding technical leads.

Each topic doc in `founder/` answers (where applicable): What it is • Where it is • When we use it • How it is used • How we use it (practical) • Why we use it vs other methods • Best practices • Other relevant info. Many include both a **Technical** and a **Simple** (plain-English) explanation.

**Full single-doc version (archived):** The previous single-file deep dive (engines, workers, state machine, services, routes, integrations) is preserved at `docs/archive/raw/consolidated-sources/FOUNDER_BACKEND_REFERENCE_FULL.md`.

---

## Topic index (founder/*.md)

| Topic | Doc | One-line |
|-------|-----|----------|
| Admin dashboard | [FOUNDER_ADMIN_DASHBOARD.md](./founder/FOUNDER_ADMIN_DASHBOARD.md) | Admin UI, RBAC, control plane |
| AI assistant | [FOUNDER_AI_ASSISTANT.md](./founder/FOUNDER_AI_ASSISTANT.md) | In-app AI assistant flow and integration |
| Auth | [FOUNDER_AUTH.md](./founder/FOUNDER_AUTH.md) | Login, register, JWT, sessions |
| Background check | [FOUNDER_BACKGROUND_CHECK.md](./founder/FOUNDER_BACKGROUND_CHECK.md) | Cleaner background verification |
| Calendar & availability | [FOUNDER_CALENDAR_AVAILABILITY.md](./founder/FOUNDER_CALENDAR_AVAILABILITY.md) | Cleaner availability and scheduling |
| Circuit breaker & retry | [FOUNDER_CIRCUIT_BREAKER_RETRY.md](./founder/FOUNDER_CIRCUIT_BREAKER_RETRY.md) | Resilience for external services |
| Cleaner onboarding | [FOUNDER_CLEANER_ONBOARDING.md](./founder/FOUNDER_CLEANER_ONBOARDING.md) | Onboarding flow and checks |
| Credit economy | [FOUNDER_CREDIT_ECONOMY.md](./founder/FOUNDER_CREDIT_ECONOMY.md) | Credits, ledger, packages |
| Disputes | [FOUNDER_DISPUTES.md](./founder/FOUNDER_DISPUTES.md) | Dispute handling and resolution |
| Events | [FOUNDER_EVENTS.md](./founder/FOUNDER_EVENTS.md) | Event system and publish/subscribe |
| File upload | [FOUNDER_FILE_UPLOAD.md](./founder/FOUNDER_FILE_UPLOAD.md) | Uploads, storage, photos |
| Gamification | [FOUNDER_GAMIFICATION.md](./founder/FOUNDER_GAMIFICATION.md) | Levels, goals, rewards |
| GDPR | [FOUNDER_GDPR.md](./founder/FOUNDER_GDPR.md) | Data export, deletion, consent |
| Graceful shutdown | [FOUNDER_GRACEFUL_SHUTDOWN.md](./founder/FOUNDER_GRACEFUL_SHUTDOWN.md) | Shutdown and drain |
| Holidays | [FOUNDER_HOLIDAYS.md](./founder/FOUNDER_HOLIDAYS.md) | Holiday and availability rules |
| Idempotency | [FOUNDER_IDEMPOTENCY.md](./founder/FOUNDER_IDEMPOTENCY.md) | Idempotency keys and dedupe |
| Job events flow | [FOUNDER_JOB_EVENTS_FLOW.md](./founder/FOUNDER_JOB_EVENTS_FLOW.md) | Job lifecycle and events |
| Manager dashboard | [FOUNDER_MANAGER_DASHBOARD.md](./founder/FOUNDER_MANAGER_DASHBOARD.md) | Manager-facing dashboard |
| MCP servers | [FOUNDER_MCP_SERVERS.md](./founder/FOUNDER_MCP_SERVERS.md) | MCP integration |
| Message history | [FOUNDER_MESSAGE_HISTORY.md](./founder/FOUNDER_MESSAGE_HISTORY.md) | In-app messaging and history |
| Metrics | [FOUNDER_METRICS.md](./founder/FOUNDER_METRICS.md) | Metrics and observability |
| N8N client | [FOUNDER_N8N_CLIENT.md](./founder/FOUNDER_N8N_CLIENT.md) | n8n event router and webhooks |
| Notifications | [FOUNDER_NOTIFICATIONS.md](./founder/FOUNDER_NOTIFICATIONS.md) | Email, SMS, push and templates |
| Payment flow | [FOUNDER_PAYMENT_FLOW.md](./founder/FOUNDER_PAYMENT_FLOW.md) | Stripe payments and intents |
| Payout flow | [FOUNDER_PAYOUT_FLOW.md](./founder/FOUNDER_PAYOUT_FLOW.md) | Cleaner payouts and Connect |
| Photo proof | [FOUNDER_PHOTO_PROOF.md](./founder/FOUNDER_PHOTO_PROOF.md) | Job photos and verification |
| Pricing | [FOUNDER_PRICING.md](./founder/FOUNDER_PRICING.md) | Pricing and credit math |
| Queue | [FOUNDER_QUEUE.md](./founder/FOUNDER_QUEUE.md) | Job queue and durable jobs |
| Rate limiting | [FOUNDER_RATE_LIMITING.md](./founder/FOUNDER_RATE_LIMITING.md) | Rate limits and throttling |
| Reconciliation | [FOUNDER_RECONCILIATION.md](./founder/FOUNDER_RECONCILIATION.md) | Payment and ledger reconciliation |
| Referrals | [FOUNDER_REFERRALS.md](./founder/FOUNDER_REFERRALS.md) | Referral program and tracking |
| Request context | [FOUNDER_REQUEST_CONTEXT.md](./founder/FOUNDER_REQUEST_CONTEXT.md) | Request-scoped context and auth |
| Sentry | [FOUNDER_SENTRY.md](./founder/FOUNDER_SENTRY.md) | Error tracking and performance |
| Stripe wrapper | [FOUNDER_STRIPE_WRAPPER.md](./founder/FOUNDER_STRIPE_WRAPPER.md) | Stripe SDK usage and patterns |
| Subscriptions | [FOUNDER_SUBSCRIPTIONS.md](./founder/FOUNDER_SUBSCRIPTIONS.md) | Subscription lifecycle and billing |
| Tracking | [FOUNDER_TRACKING.md](./founder/FOUNDER_TRACKING.md) | Job tracking and check-in/out |
| URL builder | [FOUNDER_URL_BUILDER.md](./founder/FOUNDER_URL_BUILDER.md) | Role-correct URLs (client/cleaner) |
| Webhooks | [FOUNDER_WEBHOOKS.md](./founder/FOUNDER_WEBHOOKS.md) | Incoming webhooks and verification |

---

**Consolidation (2026-02):** This file was turned into an index; the previous single-file deep dive is in `docs/archive/raw/consolidated-sources/FOUNDER_BACKEND_REFERENCE_FULL.md`. Topic content lives only in `founder/*.md` to avoid duplication.
