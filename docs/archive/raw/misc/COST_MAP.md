# Cost Map

**Purpose:** Unit costs for external services used by PureTask backend. Use for budgeting, forecasting, and cost optimization.  
**Update:** Refresh periodically; provider pricing changes.

---

## Scaling tiers (Section 10)

| Tier | Description | Targets |
|------|-------------|---------|
| **MVP** | Single region, one app instance, one worker process | &lt; 50 RPS; DB connections &lt; 20; no Redis required |
| **Growth** | Redis for rate limit/cache; separate worker process; CRONS_ENQUEUE_ONLY=true | &lt; 500 RPS; queue depth &lt; 1000; p95 &lt; 500ms on key endpoints |
| **Scale** | Read replicas; multiple app/worker replicas; dedicated job queue | &gt; 500 RPS; horizontal scale; p95 &lt; 300ms |

**Upgrade triggers:** Add Redis when rate limit or cache is needed. Split workers when cron work blocks the API. Add replicas when CPU or connection pool is saturated. See RUNBOOK § 1.3 for worker setup.

## Performance budgets (Section 10)

- **Health:** p50 &lt; 50ms, p95 &lt; 200ms
- **Auth (login, me):** p95 &lt; 500ms
- **List endpoints (jobs, cleaners):** p95 &lt; 1s
- **Error rate:** &lt; 0.1% for non-5xx

Use SLOW_QUERY_MS (default 1000) and slow_query logs to find hot paths; add indexes per DB/docs/INDEX_MAP.md and 030_performance_indexes.sql.

---

## Stripe

| Item | Unit cost | Notes |
|------|-----------|-------|
| Payment (card, US) | 2.9% + $0.30 | Per successful charge |
| Payment (international) | 3.1–3.9% + $0.30 + 1.5% | Cross-border fee applies |
| Connect payout | 1% of payout (default) | Or custom pricing |
| Dispute (chargeback) | $15 | Per dispute, regardless of outcome |
| Refund | $0.30 retained | Stripe fee not refunded |
| ACH | 0.8% capped at $5 | If using ACH |

---

## SendGrid (Email)

| Item | Unit cost | Notes |
|------|-----------|-------|
| Overage (above plan) | ~$0.00133/email | ~$1.33 per 1,000 emails |
| Plans | Tiered | $15+/month; volume tiers (e.g. 50k, 300k, 700k emails/month) |

---

## Twilio (SMS)

| Item | Unit cost | Notes |
|------|-----------|-------|
| US SMS (send/receive) | ~$0.0079–0.0083/msg | Varies by carrier |
| International | Varies by country | India ~$0.08; check Twilio pricing page |
| Failed message fee | $0.001 | Per failed message |

---

## Other Services

| Service | Unit cost | Notes |
|---------|-----------|-------|
| OneSignal (push) | Free tier available | Paid plans for higher volume |
| Neon (database) | Usage-based | Compute + storage; check Neon dashboard |
| Railway (hosting) | Usage-based | Per service, build minutes |
| Sentry (errors) | Free tier; paid tiers | Events-based |

---

## Quick Estimates (per transaction)

- **$100 job**: Stripe ~$3.20 (2.9% + $0.30) + email (~$0.001) + optional SMS (~$0.008) ≈ **~$3.21**
- **Dispute**: **$15** flat
- **1,000 emails/month overage**: **~$1.33**

---

*Check provider dashboards for current rates. Volume discounts may apply.*
