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

- [ ] Scaling tiers defined with realistic targets  
- [ ] Cost centers mapped with unit economics awareness  
- [ ] Performance budgets set for critical endpoints  
- [ ] Hot query paths identified and optimized  
- [ ] Caching allowed list and TTL policy established  
- [ ] Worker queues prioritized and backpressure defined  
- [ ] Notification channel policy (cost-aware) defined  
- [ ] Storage and bandwidth policies defined  
- [ ] Rate-limit strategy prevents abuse and runaway costs  
- [ ] Dashboards for performance and cost planned  
- [ ] Upgrade triggers documented (Redis/queue/replicas/services)  

---

**See also:** [MASTER_CHECKLIST.md](../MASTER_CHECKLIST.md) — Section 10 checklist.
