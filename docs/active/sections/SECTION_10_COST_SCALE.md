# Section 10 — Cost, Scale & Performance Planning (Full Runbook)

**Objective:** Platform stays fast as usage grows, cheap relative to revenue, scales predictably, with clear “upgrade triggers” (when to add Redis, queues, replicas, etc.).

**Exit condition:** Hard limits, dashboards, and scaling levers so growth increases profit, not chaos.

---

## 10.1 Scaling Tiers (Targets)

| Tier | Load | Requests/day | Workers |
|------|------|--------------|---------|
| **A — MVP / Early** | 50–500 bookings/week | < 10k/day | 1 worker process |
| **B — Growth** | 1k–10k bookings/week | 50k–300k/day | Multiple workers; strict dashboards |
| **C — Scale** | 10k+ bookings/week | 1M+ requests/day | Job queue, replicas, multi-region considerations |

**Rule:** Don’t prematurely build for Tier C; design for an easy path to it.

---

## 10.2 Cost Centers

| Category | Examples |
|----------|----------|
| **Infrastructure** | Railway compute, Neon Postgres, Redis, logging/monitoring |
| **Providers** | Stripe fees, SendGrid, Twilio (expensive), OneSignal, maps/geocoding |
| **Storage** | Job photos (S3/R2), CDN bandwidth (egress) |
| **Support/ops** | Disputes, refunds, arbitration (human time) |

**Deliverable:** Cost map doc — each tool with unit cost, what triggers cost growth, how to reduce it.

---

## 10.3 Performance Budgets

For critical endpoints:

- p50 latency < 200ms  
- p95 latency < 800ms  
- Error rate < 0.5%  
- Queue lag < 1 minute (for important async tasks)  

**Slow query budget:** Most queries < 50ms; expensive queries intentional and indexed; any query > 250ms investigated.

---

## 10.4 Hot Paths & Query Optimization

- **Hot paths:** Jobs feed/search/filter, booking creation, job completion + evidence upload, disputes listing, ledger/payout calculations, admin dashboards.  
- Add targeted composite indexes (from Section 5); avoid offset pagination at scale; prefer cursor pagination; avoid %LIKE% scans; use full-text or constrained filters.  
- **Lock contention:** For money-related ops, lock only what you must; keep transactions small; avoid long-running transactions in API handlers.

---

## 10.5 Caching Strategy

| Cache | TTL | Notes |
|-------|-----|------|
| Public config / service types | 30–300s | High value |
| Pricing rules (if global) | 30–300s | High value |
| Admin stats aggregates | Short TTL | High value |
| Location-based search | Short TTL | High value |

**Do NOT cache:** Balances, job state transitions, payout eligibility (must be instantly correct).

**Deliverable:** Caching allowed list + TTL policy.

---

## 10.6 Worker Scaling & Backpressure

- **Queues by priority:** critical (payment events, payouts, dispute actions); standard (notifications, emails, n8n); low (cleanup, analytics rollups).  
- **Backpressure:** When providers down or traffic spikes, queue grows; retry policy prevents spam loops; dead-letter catches permanent failures; system stable but delayed.  
- **Autoscaling triggers:** Queue length > threshold; job latency > threshold; payout processing time > threshold.

---

## 10.7 Provider Cost Control

| Provider | Discipline |
|----------|------------|
| **Twilio (SMS)** | SMS only for high-urgency; push/email for non-urgent; batch where possible; user preferences |
| **SendGrid** | Avoid “too many” transactional emails; consolidate messages; move non-critical to push/in-app |
| **OneSignal** | Segment pushes; avoid spammy patterns; throttle for churn risk |

**Deliverable:** Notification policy table — channel by message type.

---

## 10.8 Storage & Image Cost Control

- Compress images on upload (or client-side); max resolution and size; short-lived signed URLs; lifecycle rules (move old photos to cheaper tier; expire non-critical after X months — policy-driven).  
- **Bandwidth:** CDN for delivery; do not proxy images through API; use signed links directly.

---

## 10.9 Rate Limits at Scale

- Per-user + per-IP limits (per-IP alone isn’t enough at scale: NAT, carriers, shared wifi).  
- Strict limits on search, auth, booking creation; admin heavily limited.

---

## 10.10 Upgrade Triggers

| Move | When |
|------|------|
| **Add Redis** | Rate limiting needs shared state across replicas; caching saves significant DB load; distributed locks/nonce replay protection |
| **Add real queue (BullMQ/SQS)** | Job volume high; delayed retries reliably; priority queues and concurrency control |
| **Add DB read replicas** | Reads dominate writes; dashboards/reporting hurt core performance |
| **Split services** | Team size grows; deploy cadence conflicts; scaling needs diverge (payments vs search vs notifications) |

**Rule:** No splitting services until measurable pain point.

---

## 10.11 Dashboards

- **Technical:** p95 latency by route; error rate by route; slow DB queries; queue backlog + lag; webhook failure rate.  
- **Cost:** Twilio messages/day + cost estimate; SendGrid sends/day; Stripe fees/week; storage growth (GB/month); compute usage trends.

---

## 10.12 Done Checklist

*Each item includes status, assessment, and references.*

---

### 1. Scaling tiers defined with realistic targets

**Status:** ✅ **Done**

**Answer:** Scaling tiers are defined in Section 10.1 above:

| Tier | Load | Requests/day | Workers |
|------|------|--------------|---------|
| **A — MVP / Early** | 50–500 bookings/week | < 10k/day | 1 worker process |
| **B — Growth** | 1k–10k bookings/week | 50k–300k/day | Multiple workers; strict dashboards |
| **C — Scale** | 10k+ bookings/week | 1M+ requests/day | Job queue, replicas, multi-region considerations |

**Reference:** This document, Section 10.1.

---

### 2. Cost centers mapped with unit economics awareness

**Status:** ⚠️ **Partial**

**Answer:** Cost categories are listed in Section 10.2 (Infrastructure, Providers, Storage, Support/ops). **What exists:** ENV vars for Stripe, SendGrid, Twilio, OneSignal, Redis, Neon Postgres, Railway. **What’s missing:** A cost map with unit costs, cost growth triggers, and reduction tactics per tool (e.g., Twilio ~$0.0075/SMS, SendGrid tiered pricing).

**Reference:** Section 10.2; `ENV_VARS_CHECKLIST.md`; `src/config/env.ts`; `docs/active/MASTER_CHECKLIST.md` — "Map cost centers" still open.

---

### 3. Performance budgets set for critical endpoints

**Status:** ⚠️ **Partial**

**Answer:** Targets are in Section 10.3 (p50 < 200ms, p95 < 800ms, error rate < 0.5%, queue lag < 1 min). **What exists:** Operational health checks (`/status`) and DB latency logging; `PRODUCTION_READINESS_ROADMAP.md` targets p95 < 200ms; `SECTION_14_LAUNCH.md` mentions p95 latency. **What’s missing:** Active enforcement or alerts against these budgets; no route-level p95/error budgets wired into dashboards or tests.

**Reference:** Section 10.3; `src/routes/status.ts`; `src/services/operationalMetricsService.ts`; `docs/active/PRODUCTION_READINESS_ROADMAP.md`.

---

### 4. Hot query paths identified and optimized

**Status:** ⚠️ **Partial**

**Answer:** Hot paths are listed in Section 10.4 (jobs feed/search, booking creation, job completion + evidence, disputes, ledger/payouts, admin dashboards). **What exists:** Composite indexes in migrations (e.g. `idx_jobs_status`, `idx_jobs_client_id`, `idx_messages_job`, `idx_cleaner_profiles_tier`); DB query patterns in services. **What’s missing:** A documented hot-path vs index map; formal slow-query review; cursor pagination vs offset in hot paths.

**Reference:** Section 10.4; `DB/migrations/*.sql`; `docs/database/`; `src/services/jobsService.ts`, `creditsService.ts`, `payoutsService.ts`.

---

### 5. Caching allowed list and TTL policy established

**Status:** ⚠️ **Partial**

**Answer:** Section 10.5 defines cacheable items (public config, pricing rules, admin aggregates, location search) and a 30–300s TTL range. **What exists:** `runtimeConfigLoader` with in-memory cache; `clearConfigCache` in admin level-tuning; signed URLs with 15‑min TTL for photo uploads; gamification choice TTL (14 days). **What’s missing:** A single allowed list document; explicit TTL per cache type; policy that balances, job state, and payout eligibility are never cached.

**Reference:** Section 10.5; `src/services/runtimeConfigLoader.ts`; `src/services/jobPhotosService.ts` (signed URL TTL 900s); `src/services/gamificationRewardService.ts` (CHOICE_TTL_DAYS); `src/routes/admin/levelTuning.ts` (clear-cache).

---

### 6. Worker queues prioritized and backpressure defined

**Status:** ⚠️ **Partial**

**Answer:** Section 10.6 defines critical (payments, payouts, disputes), standard (notifications, emails, n8n), and low (cleanup, analytics). **What exists:** `job_queue` and `durable_jobs` tables; `job_queue` with `priority`; `queueService`, `durableJobService`; `webhook_retry`, `payout_retry_queue`; lock recovery and dead-letter handling. **What’s missing:** A single priority mapping from queue names to critical/standard/low; documented backpressure behavior when providers fail; autoscaling triggers tied to queue depth or latency.

**Reference:** Section 10.6; `src/lib/queue.ts`; `src/services/durableJobService.ts`; `src/workers/durableJobWorker.ts`; `DB/migrations/hardening/906_durable_jobs.sql`; `docs/active/founder/FOUNDER_QUEUE.md`.

---

### 7. Notification channel policy (cost-aware) defined

**Status:** ⚠️ **Partial**

**Answer:** Section 10.7 specifies Twilio (SMS) for high‑urgency only; SendGrid for transactional; OneSignal for push with throttling. **What exists:** `NotificationChannel` (email, sms, push); event-based notification service; SendGrid, Twilio, OneSignal providers; SendGrid template IDs; password-reset rate limiting. **What’s missing:** A single policy table mapping notification type → preferred channel(s); explicit "avoid SMS unless …" rules; per-channel cost controls or caps.

**Reference:** Section 10.7; `src/services/notifications/`; `src/services/notifications/types.ts`; `src/config/env.ts` (SENDGRID_*, TWILIO_*, ONESIGNAL_*).

---

### 8. Storage and bandwidth policies defined

**Status:** ⚠️ **Partial**

**Answer:** Section 10.8 calls for image compression, max size, short-lived signed URLs, lifecycle rules, CDN delivery. **What exists:** Signed URLs (15 min TTL); MIME allowlist; 10MB limit for profile/ID uploads; presigned URL flow for job photos. **What’s missing:** Compression on upload; lifecycle rules (e.g., move/expire old photos); formal policy for max resolution and CDN usage; explicit ban on proxying images through the API.

**Reference:** Section 10.8; `src/services/jobPhotosService.ts`; `src/services/fileUploadService.ts`; `docs/active/MASTER_CHECKLIST.md` — secure file upload.

---

### 9. Rate-limit strategy prevents abuse and runaway costs

**Status:** ✅ **Done**

**Answer:** Per-IP and per-endpoint rate limiting is implemented. **What exists:** In-memory and Redis rate limiters; `USE_REDIS_RATE_LIMITING`; endpoint-specific limits for auth, payments, jobs, admin, webhooks; `authRateLimiter`, `generalRateLimiter`, `stripeWebhookRateLimiter`, `passwordResetRateLimiter`; rate limit headers (`X-RateLimit-Limit`, `-Remaining`, `-Reset`). Stricter limits on auth (200/15min login, 50/hr register), payments (10/min), job creation (20/min). **Gap:** Per-user limits exist but per-IP is primary; combined IP+user limiter available but not applied everywhere.

**Reference:** `src/lib/security.ts` (endpointRateLimits); `src/lib/rateLimitRedis.ts`; `src/middleware/productionRateLimit.ts`; `src/index.ts`; `docs/active/founder/FOUNDER_RATE_LIMITING.md`.

---

### 10. Dashboards for performance and cost planned

**Status:** ⚠️ **Partial**

**Answer:** Section 10.11 specifies technical (p95, error rate, slow queries, queue lag, webhook failures) and cost (Twilio, SendGrid, Stripe, storage, compute). **What exists:** `/status` and operational metrics; `workerMetrics` for job queue stats; Sentry for errors; structured logging. **What’s missing:** p95 latency and error-rate dashboards; cost dashboards (messages/day, sends/day, storage growth); formal plan for where these dashboards live (Sentry, Grafana, provider consoles).

**Reference:** Section 10.11; `src/routes/status.ts`; `src/lib/workerMetrics.ts`; `src/services/operationalMetricsService.ts`; `docs/active/MASTER_CHECKLIST.md` — "Build performance dashboards" still open.

---

### 11. Upgrade triggers documented (Redis/queue/replicas/services)

**Status:** ✅ **Done**

**Answer:** Section 10.10 documents upgrade triggers:

| Move | When |
|------|------|
| **Add Redis** | Rate limiting shared state across replicas; caching saves DB load; distributed locks |
| **Add real queue (BullMQ/SQS)** | High job volume; reliable delayed retries; priority queues |
| **Add DB read replicas** | Reads dominate; dashboards hurt core performance |
| **Split services** | Team size, deploy cadence, or scaling needs diverge |

**Current state:** Redis optional (`REDIS_URL`, `USE_REDIS_RATE_LIMITING`); DB-backed `job_queue` and `durable_jobs`; no read replicas or service split. Path to Redis, BullMQ/SQS, and replicas is documented.

**Reference:** Section 10.10; `src/config/env.ts`; `src/lib/redis.ts`; `src/services/durableJobService.ts`.

---

### Summary

| # | Item | Status |
|---|------|--------|
| 1 | Scaling tiers | ✅ Done |
| 2 | Cost centers mapped | ⚠️ Partial |
| 3 | Performance budgets | ⚠️ Partial |
| 4 | Hot query paths optimized | ⚠️ Partial |
| 5 | Caching allowed list + TTL | ⚠️ Partial |
| 6 | Worker queues + backpressure | ⚠️ Partial |
| 7 | Notification channel policy | ⚠️ Partial |
| 8 | Storage and bandwidth policies | ⚠️ Partial |
| 9 | Rate-limit strategy | ✅ Done |
| 10 | Dashboards planned | ⚠️ Partial |
| 11 | Upgrade triggers | ✅ Done |

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 10 checklist.
