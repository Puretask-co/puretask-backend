# PureTask: Candidates for Founder-Style Deep Dive Docs

**What it is:** A list of systems, features, and functions within PureTask that would benefit from the same documentation style as **FOUNDER_BACKEND_REFERENCE.md**—eight main questions plus additional questions (see below), each with **Technical** and **Simple (10-year-old)** explanations.

**What it does:** Helps you decide what to document next and in what order.  
**How we use it:** Pick an item below, then create a new doc (or section) using the same structure as the Founder's Backend Reference.

---

## How to use this list

- **Systems** = Cross-cutting; span multiple files and flows (events, notifications, auth).
- **Features** = Product- or ops-facing; users or admins interact with them (subscriptions, AI, disputes).
- **Functions / modules** = Important libs, services, or flows that deserve their own “what/where/when/how/why” + Technical + Simple.

For each candidate, a short **Why document** is given. Use the same format as FOUNDER_BACKEND_REFERENCE: at least two sentences per answer, up to several paragraphs, with both Technical and Simple (10-year-old) for every question.

---

## 1. Systems (cross-cutting)

| # | System | Where it lives | Why document |
|---|--------|----------------|--------------|
| 1 | **Event system** | `src/lib/events.ts`, `job_events` table, `publishEvent`, n8n forwarding | Central to job lifecycle, notifications, and n8n; one place to explain what events exist, who publishes, who consumes, and how n8n fits in. |
| 2 | **Notification system** | `src/services/notifications/` (eventBasedNotificationService, notificationService, jobNotifications, templates, preferences, providers: SendGrid, Twilio, OneSignal) | How we send email/SMS/push, when we send, how templates and preferences work, and how retries work. |
| 3 | **Idempotency** | `src/lib/idempotency.ts`, payment flows, webhook handlers, queue jobs | Prevents double charges and duplicate side effects; explain keys, storage, and where we use them (payments, Stripe webhooks, queue). |
| 4 | **Queue system** | `src/lib/queue.ts`, `QUEUE_NAMES`, `queueProcessor` worker, enqueue/handle flow | Database-backed job queue; what queues exist, how jobs are enqueued and processed, and how idempotency/locking work. |
| 5 | **Webhook system** | Stripe webhook route, n8n webhook, `webhookRetryService`, signature verification | How we receive Stripe/n8n webhooks, verify signatures, handle retries, and avoid duplicate processing. |
| 6 | **Auth system** | `src/lib/auth.ts`, `authService`, JWT, sessions, `sessionManagementService`, `twoFactorService`, `oauthService`, middleware `requireAuth`/`requireRole` | Login, register, tokens, roles, 2FA, OAuth; who can do what and how we protect routes. |
| 7 | **Rate limiting** | `src/lib/security.ts`, `src/lib/rateLimitRedis.ts`, in-memory vs Redis, per-route and per-user limiters | How we throttle requests, when we use Redis vs in-memory, and how to tune limits. |
| 8 | **Circuit breaker + retry** | `src/lib/circuitBreaker.ts`, `src/lib/retry.ts`, `src/lib/stripeWrapper.ts` | When we stop calling a failing partner (e.g. Stripe) and when we retry; how this protects the app. |
| 9 | **MCP servers** | `mcp/` (configServer, docsServer, logsServer, opsServer), shared auth, rate limit, redact, tailFile | What MCP is, what each server does, and how Cursor/other tools use them. |

---

## 2. Features (product- or ops-facing)

| # | Feature | Where it lives | Why document |
|---|---------|----------------|--------------|
| 10 | **Subscriptions / recurring jobs** | `premiumService`, `premium` routes, `subscriptionJobs` worker, subscription-related queues | How recurring cleanings are created, billed, and run; what “subscription” means in product and code. |
| 11 | **Gamification** | `src/routes/gamification.ts`, `cleanerGoalsService`, tiers, boosts, `expireBoosts` worker | Cleaner goals, tiers, boosts; how they affect matching or pay and when boosts expire. |
| 12 | **AI assistant** | `aiService`, `aiCommunication`, `aiScheduling`, routes `ai`, `cleaner-ai-settings`, `cleaner-ai-advanced` | What the AI does (communication, scheduling, checklist, dispute?), how it’s configured, and where it’s used. |
| 13 | **Cleaner onboarding** | `cleanerOnboardingService`, `cleanerOnboarding` routes, `onboardingReminderService`, `onboardingReminders` worker, admin ID verification | Steps, progress, reminders, ID verification; how onboarding is tracked and completed. |
| 14 | **Admin dashboard** | `src/routes/admin/` (analytics, bookings, cleaners, clients, finance, risk, settings, system), `adminService`, `adminJobsService`, `adminRepairService` | What admins can see and do; how repair/override flows work and how they affect state. |
| 15 | **Manager dashboard** | `managerDashboardService`, `manager` routes | What managers see and do vs admins and cleaners. |
| 16 | **Disputes** | `disputesService`, dispute resolution, refund, reliability update, chargeback/refund processors | How a dispute is created, resolved, who gets refunded, and how reliability is updated. |
| 17 | **Photo proof** | `jobPhotosService`, `photos` routes, `photoRetentionCleanup` worker, retention policy | How before/after photos are stored, shown, and deleted (retention, policy). |
| 18 | **Tracking (GPS / job status)** | `jobTrackingService`, `tracking` routes, check-in, status updates | How cleaner location/check-in and job status are recorded and exposed. |
| 19 | **Message history / saved messages** | `message-history` routes, `messagesService` | How messages are stored and retrieved for clients/cleaners and how “saved” works. |
| 20 | **Referrals** | `referralService`, referral flows | How referral codes/links work and how rewards are applied. |
| 21 | **GDPR / data privacy** | `gdprService`, data export, deletion, consent | How we export or delete user data and how consent is recorded. |
| 22 | **Holidays** | `holidayService`, `holidays` routes | How holidays affect pricing, availability, or scheduling. |
| 23 | **Pricing** | `pricingService`, `pricing` routes, dynamic or tiered pricing | How price is calculated (per job, subscription, credits) and what inputs matter. |

---

## 3. Functions / modules (libs, services, flows)

| # | Module | Where it lives | Why document |
|---|--------|----------------|--------------|
| 24 | **Stripe wrapper** | `src/lib/stripeWrapper.ts`, `executeStripeOperation`, circuit breaker around Stripe | How we call Stripe safely (retry, circuit breaker) and where we use the wrapper. |
| 25 | **n8n client** | `src/lib/n8nClient.ts`, trigger workflow, list, get status, retry | How the backend triggers n8n workflows and checks status; when we use it (e.g. after events). |
| 26 | **URL builder** | `src/lib/urlBuilder.ts`, client/cleaner job URLs | How we build links in emails/notifications so users land on the right job. |
| 27 | **Metrics** | `src/lib/metrics.ts`, recordMetric, incrementCounter, recordTiming | What we measure, where we send it (Sentry, etc.), and how to add new metrics. |
| 28 | **Request context** | `requestContextMiddleware`, request ID, enrich | How we attach request ID and context to logs and errors for tracing. |
| 29 | **Graceful shutdown** | `src/lib/gracefulShutdown.ts` | How we drain connections and finish in-flight work on SIGTERM. |
| 30 | **Sentry (instrument + error handler)** | `src/instrument.ts`, Sentry.init, setupExpressErrorHandler | How errors and performance are sent to Sentry and why we init once in instrument. |
| 31 | **Job events (publishEvent → notifications)** | Flow from `publishEvent` to eventBasedNotificationService / jobNotifications | End-to-end: job action → event → notification (email/SMS/push); who subscribes to what. |
| 32 | **Payment flow (intent → capture → credits)** | `paymentService`, Stripe intents, capture, creditsService, payment_succeeded event | How a client pays (Stripe), how we capture and grant credits, and what events we emit. |
| 33 | **Payout flow (tier → Connect → transfer)** | `payoutsService`, reliability tier, Stripe Connect, payout workers | How we compute payout amount from tier, and how we send money to cleaners via Connect. |
| 34 | **Credit economy (balance, spend, decay)** | `creditsService`, `creditEconomyService`, spend on job, decay, tier lock | How credits are earned and spent, and how decay/tier lock work in the economy. |
| 35 | **Calendar / availability** | `calendarService`, `availabilityService`, slots, conflicts | How we determine “cleaner is free at this time” and how we avoid double-booking. |
| 36 | **File upload** | `fileUploadService`, storage, URLs | How uploads (e.g. photos, documents) are stored and how URLs are generated. |
| 37 | **Background check** | `backgroundCheckService` | How background checks are triggered and how results are used (onboarding, risk). |
| 38 | **Reconciliation** | `reconciliationService`, payout vs earnings | How we detect mismatches between payouts and earnings and what we do about it. |

---

## 4. Founder explanation documents (created)

All candidates above have a dedicated founder-style doc under `docs/active/founder/`. Each doc answers the 8 main questions plus additional questions (section 6) with **Technical** and **Simple (10-year-old)** for that system, feature, or module.

### Systems (1–9)

| # | Document | What it explains |
|---|----------|------------------|
| 1 | [FOUNDER_EVENTS.md](founder/FOUNDER_EVENTS.md) | Event system: what events exist, who publishes, who consumes, and how n8n fits in. Central to job lifecycle and notifications. |
| 2 | [FOUNDER_NOTIFICATIONS.md](founder/FOUNDER_NOTIFICATIONS.md) | Notification system: how we send email/SMS/push, when we send, templates and preferences, and retries. |
| 3 | [FOUNDER_IDEMPOTENCY.md](founder/FOUNDER_IDEMPOTENCY.md) | Idempotency: keys, storage, and where we use them to prevent double charges and duplicate side effects (payments, webhooks, queue). |
| 4 | [FOUNDER_QUEUE.md](founder/FOUNDER_QUEUE.md) | Queue system: what queues exist, how jobs are enqueued and processed, and how idempotency/locking work. |
| 5 | [FOUNDER_WEBHOOKS.md](founder/FOUNDER_WEBHOOKS.md) | Webhook system: how we receive Stripe/n8n webhooks, verify signatures, handle retries, and avoid duplicate processing. |
| 6 | [FOUNDER_AUTH.md](founder/FOUNDER_AUTH.md) | Auth system: login, register, tokens, roles, 2FA, OAuth; who can do what and how we protect routes. |
| 7 | [FOUNDER_RATE_LIMITING.md](founder/FOUNDER_RATE_LIMITING.md) | Rate limiting: how we throttle requests, when we use Redis vs in-memory, and how to tune limits. |
| 8 | [FOUNDER_CIRCUIT_BREAKER_RETRY.md](founder/FOUNDER_CIRCUIT_BREAKER_RETRY.md) | Circuit breaker + retry: when we stop calling a failing partner (e.g. Stripe) and when we retry; how this protects the app. |
| 9 | [FOUNDER_MCP_SERVERS.md](founder/FOUNDER_MCP_SERVERS.md) | MCP servers: what MCP is, what each server does (docs, ops, logs, config), and how Cursor/other tools use them. |

### Features (10–23)

| # | Document | What it explains |
|---|----------|------------------|
| 10 | [FOUNDER_SUBSCRIPTIONS.md](founder/FOUNDER_SUBSCRIPTIONS.md) | Subscriptions / recurring jobs: how recurring cleanings are created, billed, and run; what “subscription” means in product and code. |
| 11 | [FOUNDER_GAMIFICATION.md](founder/FOUNDER_GAMIFICATION.md) | Gamification: cleaner goals, tiers, boosts; how they affect matching or pay and when boosts expire. |
| 12 | [FOUNDER_AI_ASSISTANT.md](founder/FOUNDER_AI_ASSISTANT.md) | AI assistant: what the AI does (communication, scheduling, checklist, dispute?), how it’s configured, and where it’s used. |
| 13 | [FOUNDER_CLEANER_ONBOARDING.md](founder/FOUNDER_CLEANER_ONBOARDING.md) | Cleaner onboarding: steps, progress, reminders, ID verification; how onboarding is tracked and completed. |
| 14 | [FOUNDER_ADMIN_DASHBOARD.md](founder/FOUNDER_ADMIN_DASHBOARD.md) | Admin dashboard: what admins can see and do; how repair/override flows work and how they affect state. |
| 15 | [FOUNDER_MANAGER_DASHBOARD.md](founder/FOUNDER_MANAGER_DASHBOARD.md) | Manager dashboard: what managers see and do vs admins and cleaners. |
| 16 | [FOUNDER_DISPUTES.md](founder/FOUNDER_DISPUTES.md) | Disputes: how a dispute is created, resolved, who gets refunded, and how reliability is updated. |
| 17 | [FOUNDER_PHOTO_PROOF.md](founder/FOUNDER_PHOTO_PROOF.md) | Photo proof: how before/after photos are stored, shown, and deleted (retention, policy). |
| 18 | [FOUNDER_TRACKING.md](founder/FOUNDER_TRACKING.md) | Tracking (GPS / job status): how cleaner location/check-in and job status are recorded and exposed. |
| 19 | [FOUNDER_MESSAGE_HISTORY.md](founder/FOUNDER_MESSAGE_HISTORY.md) | Message history / saved messages: how messages are stored and retrieved and how “saved” works. |
| 20 | [FOUNDER_REFERRALS.md](founder/FOUNDER_REFERRALS.md) | Referrals: how referral codes/links work and how rewards are applied. |
| 21 | [FOUNDER_GDPR.md](founder/FOUNDER_GDPR.md) | GDPR / data privacy: how we export or delete user data and how consent is recorded. |
| 22 | [FOUNDER_HOLIDAYS.md](founder/FOUNDER_HOLIDAYS.md) | Holidays: how holidays affect pricing, availability, or scheduling. |
| 23 | [FOUNDER_PRICING.md](founder/FOUNDER_PRICING.md) | Pricing: how price is calculated (per job, subscription, credits) and what inputs matter. |

### Functions / modules (24–38)

| # | Document | What it explains |
|---|----------|------------------|
| 24 | [FOUNDER_STRIPE_WRAPPER.md](founder/FOUNDER_STRIPE_WRAPPER.md) | Stripe wrapper: how we call Stripe safely (retry, circuit breaker) and where we use the wrapper. |
| 25 | [FOUNDER_N8N_CLIENT.md](founder/FOUNDER_N8N_CLIENT.md) | n8n client: how the backend triggers n8n workflows and checks status; when we use it (e.g. after events). |
| 26 | [FOUNDER_URL_BUILDER.md](founder/FOUNDER_URL_BUILDER.md) | URL builder: how we build links in emails/notifications so users land on the right job. |
| 27 | [FOUNDER_METRICS.md](founder/FOUNDER_METRICS.md) | Metrics: what we measure, where we send it (Sentry, etc.), and how to add new metrics. |
| 28 | [FOUNDER_REQUEST_CONTEXT.md](founder/FOUNDER_REQUEST_CONTEXT.md) | Request context: how we attach request ID and context to logs and errors for tracing. |
| 29 | [FOUNDER_GRACEFUL_SHUTDOWN.md](founder/FOUNDER_GRACEFUL_SHUTDOWN.md) | Graceful shutdown: how we drain connections and finish in-flight work on SIGTERM. |
| 30 | [FOUNDER_SENTRY.md](founder/FOUNDER_SENTRY.md) | Sentry (instrument + error handler): how errors and performance are sent to Sentry and why we init once in instrument. |
| 31 | [FOUNDER_JOB_EVENTS_FLOW.md](founder/FOUNDER_JOB_EVENTS_FLOW.md) | Job events (publishEvent → notifications): end-to-end job action → event → notification (email/SMS/push); who subscribes to what. |
| 32 | [FOUNDER_PAYMENT_FLOW.md](founder/FOUNDER_PAYMENT_FLOW.md) | Payment flow (intent → capture → credits): how a client pays (Stripe), how we capture and grant credits, and what events we emit. |
| 33 | [FOUNDER_PAYOUT_FLOW.md](founder/FOUNDER_PAYOUT_FLOW.md) | Payout flow (tier → Connect → transfer): how we compute payout amount from tier and send money to cleaners via Connect. |
| 34 | [FOUNDER_CREDIT_ECONOMY.md](founder/FOUNDER_CREDIT_ECONOMY.md) | Credit economy: how credits are earned and spent, and how decay/tier lock work in the economy. |
| 35 | [FOUNDER_CALENDAR_AVAILABILITY.md](founder/FOUNDER_CALENDAR_AVAILABILITY.md) | Calendar / availability: how we determine “cleaner is free at this time” and how we avoid double-booking. |
| 36 | [FOUNDER_FILE_UPLOAD.md](founder/FOUNDER_FILE_UPLOAD.md) | File upload: how uploads (e.g. photos, documents) are stored and how URLs are generated. |
| 37 | [FOUNDER_BACKGROUND_CHECK.md](founder/FOUNDER_BACKGROUND_CHECK.md) | Background check: how background checks are triggered and how results are used (onboarding, risk). |
| 38 | [FOUNDER_RECONCILIATION.md](founder/FOUNDER_RECONCILIATION.md) | Reconciliation: how we detect mismatches between payouts and earnings and what we do about it. |

**Path:** All documents live in `docs/active/founder/` (e.g. `docs/active/founder/FOUNDER_EVENTS.md`). Links above are relative to `docs/active/`.

---

## 5. Suggested order (if you do them one at a time)

**High impact (understand money and trust first):**

1. Event system (events underpin notifications and n8n).  
2. Notification system (how users get email/SMS/push).  
3. Payment flow (intent → capture → credits).  
4. Payout flow (tier → Connect → transfer).  
5. Idempotency (avoid double charge and duplicate work).  
6. Auth system (who can do what).  

**Then (operational and product clarity):**

7. Queue system.  
8. Webhook system (Stripe + n8n).  
9. Disputes.  
10. Subscriptions / recurring jobs.  
11. Cleaner onboarding.  
12. Admin dashboard.  

**Then (resilience and observability):**

13. Circuit breaker + retry.  
14. Rate limiting.  
15. Sentry (instrument + error handler).  
16. Metrics.  
17. Graceful shutdown.  

**Then (remaining features and modules):**

18–38 in any order (AI, gamification, referrals, GDPR, holidays, pricing, MCP, URL builder, request context, job events flow, credit economy, calendar/availability, file upload, background check, reconciliation, etc.).

---

## 6. Questions to ask for each candidate (8 main + 29 additional)

Answer every question in the context of **what the thing is, what it does, and what it is supposed to accomplish**. For each answer use **Technical** (2+ sentences, up to paragraphs) and **Simple (10-year-old)**. Skip a question only if it truly does not apply to that candidate.

### The 8 main questions

1. **What it is** — Definition and role; what the thing is and what it's for.  
2. **Where it is used** — Technical + Simple.  
3. **When we use it** — Triggers: what kicks it off (user action, cron, API call, event).  
4. **How it is used** — Data flow, API surface, inputs and outputs; how it does its job.  
5. **How we use it (practical)** — Day-to-day: APIs, env, scripts, UI; how people actually use it.  
6. **Why we use it vs other methods** — Design rationale and alternatives; why we do it this way to accomplish the goal.  
7. **Best practices** — Whether we follow them and any gaps; what good looks like for this kind of thing.  
8. **Other relevant info** — Risks, dependencies, founder-level notes.

### Additional questions (tied to what it is, does, or accomplishes)

**Purpose and outcome**

9. **What is it supposed to accomplish?** — The intended outcome or goal; what "success" means for this thing in product or business terms.  
10. **What does "done" or "success" look like for it?** — How we know it has finished successfully; observable result or state change.  
11. **What would happen if we didn't have it?** — What would break or be missing; why we need it to accomplish our goals.  
12. **What is it not responsible for?** — Boundaries; what other systems or features handle so we don't duplicate or blur responsibility.  

**Inputs, outputs, and flow**

13. **What are the main inputs it needs?** — Data, context, or preconditions required for it to do its job.  
14. **What does it produce or change?** — Outputs, side effects, state changes; what is different after it runs.  
15. **Who or what consumes its output?** — Who uses the result (users, other systems, workers) to accomplish their own goals.  
16. **What are the main steps or flow it performs?** — The sequence of actions or decisions it takes to accomplish its goal.  
17. **What rules or policies does it enforce?** — Business rules, validations, or constraints it applies to do its job correctly.  

**Triggers and behavior**

18. **What triggers it or kicks it off?** — The event, user action, or schedule that causes it to run.  
19. **What could go wrong while doing its job?** — Failure modes, edge cases, what breaks and how (e.g. partner down, bad input, race condition).  
**Dependencies, config, and operations**

20. **How do we know it's doing its job correctly?** — Monitoring, metrics, alerts, logs; how we detect success and failure for this thing.  
21. **What does it depend on to do its job?** — DB tables, env vars, other services, third-party APIs; what must exist for it to work.  
22. **What are the main config or env vars that control its behavior?** — Tunables, feature flags, secrets; where they live and what they control for this thing.  
23. **How do we test that it accomplishes what it should?** — Unit tests, integration tests, manual checks; how we verify its behavior and outcomes.  
24. **How do we recover if it fails to accomplish its job?** — Rollback, fallback, manual steps, runbooks; what to do when it doesn't succeed.  

**Stakeholders, security, and limits**

25. **Who are the main stakeholders (who cares that it accomplishes its goal)?** — Users, cleaners, admins, support, partners; who depends on it and why.  
26. **What are the security or privacy considerations for what it does?** — Data sensitivity, access control, PII, compliance; what we protect given its role.  
27. **What are the limits or scaling considerations for what it does?** — Rate limits, volume limits, cost, performance; what happens when load grows and it has to do more.  
28. **What would we change about how it accomplishes its goal if we could?** — Tech debt, known gaps, future improvements; what we'd do differently with more time or resources.  

**Lifecycle, state, and boundaries**

29. **How does it start and finish (lifecycle)?** — When it begins, when it's considered done, and any states or phases in between; relevant to what it's supposed to accomplish.  
30. **What state does it keep or track?** — Persistent or in-memory state; what we store so it can do its job or so we can tell if it succeeded.  
31. **What assumptions does it make to do its job?** — Preconditions, invariants, or expectations about data or environment; what must be true for it to accomplish its goal correctly.  
32. **When should we not use it (or use something else)?** — Edge cases, alternatives, or situations where this thing is the wrong tool for the goal.  
33. **How does it interact with other systems or features?** — APIs, events, queues, shared data; how it fits into the bigger picture and what it expects from or provides to others.  

**Failure, correctness, and ownership**

34. **What does "failure" mean for it, and how do we signal it?** — Error types, user-visible vs internal; how we know it didn't accomplish its goal and how that is communicated.  
35. **How do we know its outputs are correct or complete?** — Validation, consistency checks, or guarantees; how we verify it did what it was supposed to do.  
36. **Who owns or maintains it?** — Code ownership, who to ask when it doesn't accomplish what it should; who is responsible for it doing its job.  
37. **How might it need to change as the product or business grows?** — Expected evolution; what we might add or change so it keeps accomplishing its goal at scale or under new requirements.  

You can create one big “Founder Reference” doc that grows by section, or separate docs per system/feature (e.g. `FOUNDER_EVENTS_AND_NOTIFICATIONS.md`, `FOUNDER_PAYMENTS_AND_PAYOUTS.md`). This list is the backlog of candidates. Use all questions (8 main + additional) where they apply; for very small modules, some of the additional questions may be one short paragraph (Technical + Simple) each.

---

## 7. Additional questions we are not asking (or should ask)

**What this section is:** A gap analysis of the current question set. The 8 main + 29 additional questions above cover *what it is*, *what it does*, *what it accomplishes*, *inputs/outputs*, *triggers*, *dependencies*, *recovery*, *stakeholders*, *security*, *lifecycle*, *failure*, and *ownership*. The list below identifies angles we are **not** asking (or only partly asking) that are relevant to what the thing is, does, or accomplishes. Use these as a **deeper-dive checklist** or fold the most relevant into the main list when documenting a candidate.

### Cost, performance, and time

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A1 | **What does it cost to run?** — Money (APIs, infra), time (CPU, latency), or other resources. | We ask limits/scaling but not explicit cost; founders need to know "what does this cost us?" |
| A2 | **How fast should it be? What's acceptable latency or throughput?** — SLA or target (e.g. &lt;200ms, 100 req/s). | We ask "limits" but not "what's the *target* performance" for it to accomplish its goal. |
| A3 | **Is it real-time, near-real-time, batch, or eventually consistent?** — When must it run or complete? | Clarifies timing expectations and what "done" means in time (e.g. within seconds vs by end of day). |

### Data lifecycle and retention

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A4 | **How long do we keep the data it uses or produces?** — Retention policy, expiry, purge. | We ask "what state does it keep" but not "how long" or "when do we delete it"; critical for compliance and storage. |
| A5 | **Who can access or export that data, and under what conditions?** — Access control, export (e.g. GDPR), audit. | Complements security/privacy with concrete "who can see it" and "how do we hand it over." |

### Safe change, contract, and visibility

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A6 | **How do we change it without breaking callers?** — Versioning, backward compatibility, deprecation. | We ask "how might it need to change" but not "how do we change it *safely*." |
| A7 | **What's the "contract" (API, events, schema) and how stable is it?** — Can external parties or other services depend on it? | Clarifies what we promise to consumers and what we can change without coordination. |
| A8 | **What do end users (clients, cleaners, admins) actually see or experience from this?** — User-visible vs internal. | We ask stakeholders but not "what's visible to whom"; product and support need this. |
| A9 | **Where is this documented, and how would a new dev find it?** — Docs, code comments, runbooks. | Ensures the thing is discoverable and maintainable. |

### Resilience and behavior under failure

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A10 | **Can we run it twice safely (idempotency)? What happens if we replay an event or retry?** | Critical for payments, webhooks, queues; we don't ask this explicitly. |
| A11 | **When a dependency (DB, API, queue) fails, what does this thing do?** — Fallback, degrade, fail open/closed. | We ask "what could go wrong" and "depends on" but not "behavior when *dependency X* fails." |
| A12 | **What's the fallback or alternate path when the primary path fails?** — Manual process, read-only mode, cached value. | Complements "how do we recover" with "what do we do *instead* when we can't do the main thing." |
| A13 | **If it breaks at 3am, who gets paged and what's the blast radius?** — On-call, impact (which users/features break). | Ops and incident response need this; we ask recovery but not incident impact. |

### Correctness and consistency

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A14 | **Does order of operations matter?** — Strong consistency vs eventual; race conditions. | Affects design and debugging; we don't ask explicitly. |
| A15 | **What business or product metric do we use to judge that it's "working"?** — KPIs, success metrics (e.g. delivery rate, error rate). | We ask "how do we know it's doing its job" (monitoring) but not "what *business* success looks like." |

### Access, rollout, and isolation

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A16 | **Who is allowed to invoke it or change its configuration?** — Roles, permissions, admin-only. | We ask security but not "who can trigger or configure *this* thing." |
| A17 | **How do we turn it on/off or roll it out gradually?** — Feature flags, canary, kill switch. | Important for risky or new behavior; we ask config but not rollout. |
| A18 | **If we have multiple tenants or regions, is data or behavior isolated?** — Per-tenant, per-region. | Relevant for scaling and compliance; we don't ask explicitly. |

### External and compliance

| # | Question we're not asking (or should ask) | Why it matters |
|---|-------------------------------------------|----------------|
| A19 | **Does it call or expose anything to third parties? What do we promise them (SLA, format)?** | Payments, webhooks, integrations; we need "what do we promise externals." |
| A20 | **Do we log or audit what it does for compliance or debugging?** — Audit trail, retention, access. | Complements security with concrete audit/compliance angle. |

**How to use this list:** When writing a founder-style doc for a candidate, scan this section and add any of A1–A20 that apply. For high-risk or high-impact candidates (payments, auth, notifications, queues), A1–A2, A4, A6–A7, A10–A13, and A15–A16 are especially relevant.

---

## 8. How to answer every question for every candidate

**Goal:** For each of the 38 candidates (systems, features, functions), answer **every** question that applies—using the **8 main + 29 additional** questions (section 6), and for deeper coverage the **A1–A20** questions (section 7)—with **two answers per question: Technical** and **Simple (10-year-old)**. Skip a question only if it truly does not apply.

### Scope at a glance

| Item | Count |
|------|--------|
| Candidates | 38 (9 systems + 14 features + 15 functions/modules) |
| Core questions per candidate | 37 (8 main + 29 additional) |
| Optional deeper questions | Up to 20 (A1–A20; use where relevant) |
| Answers per question | 2 (Technical + Simple) |
| Minimum per answer | 2 sentences; expand to paragraphs where needed |

So for one candidate: at least **37 × 2 = 74** answer blocks (Technical + Simple) if you use only core questions; up to **57 × 2 = 114** if you also answer all A1–A20. For all 38 candidates: **~2,800–4,300** answer blocks total. This is a large writing project; the steps below keep it consistent and sustainable.

---

### Step 1: Choose your question set

- **Standard (recommended for every candidate):** Answer the **37 core questions** (8 main + 29 additional) in section 6. Every answer = Technical + Simple.
- **Full (for high-impact or risky candidates):** Also answer the **A1–A20** questions from section 7 that apply. Use the "How to use" note in section 7 to pick which A-questions matter (e.g. payments, auth, notifications, queues → A1–A2, A4, A6–A7, A10–A13, A15–A16).
- **Skip a question only when:** It genuinely does not apply (e.g. "multi-tenant isolation" for a single-tenant lib). In that case, add one short line: *"N/A: [reason]."* so reviewers know it was considered.

---

### Step 2: Use the same answer format for every question

For **every** question, use this structure so all docs look the same:

```markdown
#### [Question title — e.g. "What it is"]

**Technical:** [2+ sentences, up to several paragraphs. Define, cite code paths, env, APIs, data flow, and how it accomplishes its goal.]

**Simple (like for a 10-year-old):** [2+ sentences. Same idea in plain language: what it is, what it does, and why it matters to users or the business.]
```

- **Technical:** Engineer- and founder-ready. Include file names, env vars, APIs, DB tables, and behavior. Explain *how* it accomplishes its goal.
- **Simple:** No jargon. Explain *what* it is and *why* it matters so a non-technical reader (or a 10-year-old) can understand.

**Quality bar:** Minimum 2 sentences per part. Use more when the question is central to the candidate (e.g. "What it is," "What could go wrong," "How do we recover").

---

### Step 3: Process for one candidate (repeat for all 38)

Do this for **each** candidate in the order you choose (see Step 4):

1. **Pick the candidate** (e.g. Event system, Payment flow).
2. **List the questions** you will answer: all 37 core, plus any A1–A20 that apply. Optionally copy the question list from section 6 (and 7) into a checklist so you can tick them off.
3. **Gather facts:** Read the code and config for "Where it lives" (tables in sections 1–3). Open the relevant files, trace one or two flows, note env vars and dependencies. Use FOUNDER_BACKEND_REFERENCE.md as a style reference.
4. **For each question, in order:**
   - Write the **Technical** answer first (you have the code fresh).
   - Then write the **Simple** answer (same idea, no jargon).
   - If the question does not apply, add *"N/A: [reason]."* and move on.
5. **Review:** Ensure every answered question has both Technical and Simple; every part has at least 2 sentences; and the whole section stays true to *what the thing is, does, and accomplishes*.

---

### Step 4: Recommended order of work

Use **section 5** as your execution order. Suggested sequence:

1. **First batch (high impact):** Event system → Notification system → Payment flow → Payout flow → Idempotency → Auth system.
2. **Second batch (operational):** Queue system → Webhook system → Disputes → Subscriptions/recurring jobs → Cleaner onboarding → Admin dashboard.
3. **Third batch (resilience/observability):** Circuit breaker + retry → Rate limiting → Sentry → Metrics → Graceful shutdown.
4. **Remaining 18–38** in any order (AI, gamification, referrals, GDPR, holidays, pricing, MCP, URL builder, request context, job events flow, credit economy, calendar/availability, file upload, background check, reconciliation, etc.).

Doing high-impact candidates first gives you the most value and establishes the format; later candidates can reuse phrases and cross-references.

---

### Step 5: Where to put the answers

- **Option A — One doc per candidate (recommended):** Create `docs/active/founder/FOUNDER_[NAME].md` (e.g. `FOUNDER_EVENTS.md`, `FOUNDER_PAYMENTS.md`). Each doc contains every question you chose for that candidate, each with Technical + Simple. Easier to assign, review, and update; less risk of merge conflicts.
- **Option B — One big doc:** Append each candidate as a new section in a single doc (e.g. `FOUNDER_FULL_REFERENCE.md`). Good for a single reader who wants everything in one place; harder to maintain and to split work.
- **Option C — Hybrid:** Keep FOUNDER_BACKEND_REFERENCE.md for the "Engines, Workers, State machine, …" already documented; add new founder docs under `docs/active/founder/` for the 38 candidates from this list. Link to them from DOCUMENTATION_INDEX.md.

Whichever you choose, **use the same format** (Step 2) and the **same question set** per candidate (Step 1) so the corpus is consistent.

---

### Step 6: Track progress

Keep a simple checklist so you know what’s done and what’s next. Example:

| # | Candidate | Core 37 done (T+S) | A1–A20 (if used) | Doc location |
|---|-----------|--------------------|------------------|--------------|
| 1 | Event system | ☐ | ☐ | `founder/FOUNDER_EVENTS.md` |
| 2 | Notification system | ☐ | ☐ | `founder/FOUNDER_NOTIFICATIONS.md` |
| … | … | … | … | … |
| 38 | Reconciliation | ☐ | ☐ | `founder/FOUNDER_RECONCILIATION.md` |

**Full checklist (all 38 candidates):** Use the table below. Tick "Core" when all 37 core questions are answered (Technical + Simple) for that candidate; tick "A" when any A1–A20 you chose for that candidate are done. Fill in "Doc" when the file exists.

| # | Candidate | Core 37 | A1–A20 | Doc |
|---|-----------|:-------:|:------:|-----|
| 1 | Event system | ☑ | ☑ | `founder/FOUNDER_EVENTS.md` |
| 2 | Notification system | ☑ | ☑ | `founder/FOUNDER_NOTIFICATIONS.md` |
| 3 | Idempotency | ☑ | ☑ | `founder/FOUNDER_IDEMPOTENCY.md` |
| 4 | Queue system | ☑ | ☑ | `founder/FOUNDER_QUEUE.md` |
| 5 | Webhook system | ☑ | ☑ | `founder/FOUNDER_WEBHOOKS.md` |
| 6 | Auth system | ☑ | ☑ | `founder/FOUNDER_AUTH.md` |
| 7 | Rate limiting | ☑ | ☑ | `founder/FOUNDER_RATE_LIMITING.md` |
| 8 | Circuit breaker + retry | ☑ | ☑ | `founder/FOUNDER_CIRCUIT_BREAKER_RETRY.md` |
| 9 | MCP servers | ☑ | ☑ | `founder/FOUNDER_MCP_SERVERS.md` |
| 10 | Subscriptions / recurring jobs | ☑ | ☑ | `founder/FOUNDER_SUBSCRIPTIONS.md` |
| 11 | Gamification | ☑ | ☑ | `founder/FOUNDER_GAMIFICATION.md` |
| 12 | AI assistant | ☑ | ☑ | `founder/FOUNDER_AI_ASSISTANT.md` |
| 13 | Cleaner onboarding | ☑ | ☑ | `founder/FOUNDER_CLEANER_ONBOARDING.md` |
| 14 | Admin dashboard | ☑ | ☑ | `founder/FOUNDER_ADMIN_DASHBOARD.md` |
| 15 | Manager dashboard | ☑ | ☑ | `founder/FOUNDER_MANAGER_DASHBOARD.md` |
| 16 | Disputes | ☑ | ☑ | `founder/FOUNDER_DISPUTES.md` |
| 17 | Photo proof | ☑ | ☑ | `founder/FOUNDER_PHOTO_PROOF.md` |
| 18 | Tracking (GPS / job status) | ☑ | ☑ | `founder/FOUNDER_TRACKING.md` |
| 19 | Message history / saved messages | ☑ | ☑ | `founder/FOUNDER_MESSAGE_HISTORY.md` |
| 20 | Referrals | ☑ | ☑ | `founder/FOUNDER_REFERRALS.md` |
| 21 | GDPR / data privacy | ☑ | ☑ | `founder/FOUNDER_GDPR.md` |
| 22 | Holidays | ☑ | ☑ | `founder/FOUNDER_HOLIDAYS.md` |
| 23 | Pricing | ☑ | ☑ | `founder/FOUNDER_PRICING.md` |
| 24 | Stripe wrapper | ☑ | ☑ | `founder/FOUNDER_STRIPE_WRAPPER.md` |
| 25 | n8n client | ☑ | ☑ | `founder/FOUNDER_N8N_CLIENT.md` |
| 26 | URL builder | ☑ | ☑ | `founder/FOUNDER_URL_BUILDER.md` |
| 27 | Metrics | ☑ | ☑ | `founder/FOUNDER_METRICS.md` |
| 28 | Request context | ☑ | ☑ | `founder/FOUNDER_REQUEST_CONTEXT.md` |
| 29 | Graceful shutdown | ☑ | ☑ | `founder/FOUNDER_GRACEFUL_SHUTDOWN.md` |
| 30 | Sentry (instrument + error handler) | ☑ | ☑ | `founder/FOUNDER_SENTRY.md` |
| 31 | Job events (publishEvent → notifications) | ☑ | ☑ | `founder/FOUNDER_JOB_EVENTS_FLOW.md` |
| 32 | Payment flow (intent → capture → credits) | ☑ | ☑ | `founder/FOUNDER_PAYMENT_FLOW.md` |
| 33 | Payout flow (tier → Connect → transfer) | ☑ | ☑ | `founder/FOUNDER_PAYOUT_FLOW.md` |
| 34 | Credit economy (balance, spend, decay) | ☑ | ☑ | `founder/FOUNDER_CREDIT_ECONOMY.md` |
| 35 | Calendar / availability | ☑ | ☑ | `founder/FOUNDER_CALENDAR_AVAILABILITY.md` |
| 36 | File upload | ☑ | ☑ | `founder/FOUNDER_FILE_UPLOAD.md` |
| 37 | Background check | ☑ | ☑ | `founder/FOUNDER_BACKGROUND_CHECK.md` |
| 38 | Reconciliation | ☑ | ☑ | `founder/FOUNDER_RECONCILIATION.md` |

---

### Step 7: Tips to stay consistent and sustainable

- **Batch similar candidates:** Do Event system then Notification system then Job events flow so the "event → notification" story is fresh; do Payment flow then Payout flow then Credit economy together.
- **Reuse and cross-reference:** Once "Event system" is written, later docs can say "See FOUNDER_EVENTS.md" for how events work instead of repeating long explanations.
- **Pace yourself:** One candidate per session (or 2–3 for small modules) is enough. Quality (clear Technical + clear Simple) matters more than speed.
- **Use the code:** Answer Technical from actual code paths and config; then translate that into Simple. Avoid guessing—if something is unclear, note "TBD" and fill in after checking.
- **N/A is OK:** If a question really doesn’t apply, say so in one line. That still counts as "answered" and keeps the checklist honest.

---

### Summary

| Step | Action |
|------|--------|
| 1 | Choose question set: 37 core for all; add A1–A20 for high-impact/risky candidates. |
| 2 | Use the same format for every question: **Technical** + **Simple (10-year-old)**, 2+ sentences each. |
| 3 | Per candidate: list questions → gather facts from code → answer each question (T + S) or N/A. |
| 4 | Work in the order of section 5 (high impact first, then operational, then the rest). |
| 5 | Put output in one doc per candidate (recommended) under `docs/active/founder/`. |
| 6 | Track progress with a checklist (e.g. table above). |
| 7 | Batch similar candidates, reuse cross-references, and keep a sustainable pace. |

If you follow this for **every** system, feature, and function, you will have asked and answered **every** question we outlined, in the **two-answer system** (Technical + Simple), for each candidate.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_BACKEND_REFERENCE.md` (example of the format), `DOCUMENTATION_INDEX.md` (full doc list).
