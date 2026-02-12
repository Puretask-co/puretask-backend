# ENGINE_ANALYTICS_KPIS

## Status
Canonical - Final Form Specification  
Part of PURETASK_FINAL_BLUEPRINT

---

## 1. Purpose of the Analytics and KPI Engine

Provides continuous visibility into health, performance, and economics of PureTask. Goals: enable data-driven decisions, detect issues early, measure marketplace health, track financial correctness, support ops/product/leadership, and feed automated safeguards and alerts. Analytics are observational only; they never mutate core state.

---

## 2. Design Philosophy

- Snapshot over streams: periodic snapshots favored over complex real-time streaming for simplicity, determinism, and debuggability.  
- Job-centric metrics: KPIs roll up from job events for revenue, reliability, supply/demand, performance.  
- Separation of audiences: supports ops, product, finance, leadership with different lenses on the same data.

---

## 3. Core Metric Categories

- Marketplace health: jobs created/completed, completion rate, cancellation rate (client vs cleaner), no-show rate, assignment latency, coverage gaps.  
- Supply metrics: active cleaners, jobs per cleaner, reliability distribution, tier distribution, earnings distribution, availability coverage.  
- Demand metrics: active clients, repeat booking rate, subscription adoption, churn indicators, dispute rate per client.  
- Financial metrics: gross job value, net platform revenue, refund rate, dispute cost, outstanding escrow, payout volume, negative balances.  
- Operational metrics: worker success/failure rates, retry counts, automation lag, manual intervention rate.

---

## 4. KPI Snapshots

- Daily snapshots via workers: aggregates, health indicators, trend deltas; snapshots are immutable.  
- Weekly/Monthly rollups derived from daily snapshots for smoothed trends and strategic review.

---

## 5. Alerts and Thresholds

Alerts when completion drops, no-show spikes, refunds exceed range, payout failures rise, assignment latency grows, or risk flags surge. Alerts may notify ops, trigger audits, throttle growth, or escalate to admin review.

---

## 6. Interaction With Other Engines

- Booking: supplies job lifecycle events.  
- Credit & Payment: supplies financial data, escrow balances, refund activity.  
- Payout: supplies payout success/failure data.  
- Reliability & Tier: supplies score distributions.  
- Risk & Fraud: supplies flagged behavior metrics.  
- Admin & Ops: consumes dashboards and responds to alerts.

---

## 7. Automation and Workers

Workers: kpiDailySnapshot, weeklySummary, backupDaily. Generate snapshots, persist aggregates, produce summaries, support audits. Workers must be deterministic, idempotent, and fail safely.

---

## 8. Data Model (Conceptual)

Key entities: kpi_daily_snapshots, kpi_weekly_summaries, kpi_metrics, alert_events. Snapshots are append-only.

---

## 9. Dashboards and Access

Dashboards: marketplace overview, financial health, cleaner performance, client behavior, risk/disputes. Access is role-based.

---

## 10. Failure and Edge Case Handling

Handle partial data days, late-arriving events, worker downtime, backfilled data. Snapshots may be re-run but never overwritten.

---

## 11. Canonical Rules

- Analytics do not mutate state.  
- Snapshots are immutable.  
- Metrics are derived, not stored raw.  
- Alerts are explainable.  
- Financial metrics must reconcile.  

---

## 12. Versioning Guidance

- V1: Core job and financial metrics.  
- V2: Reliability and ops metrics.  
- V3: Subscription and cohort analysis.  
- V4+: Predictive analytics.  

---

End of document.

