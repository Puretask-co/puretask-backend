# Monitoring Setup Guide

**Last Updated**: 2026-01-29  
**Status**: ✅ Complete - Metrics integrated, verification script available

## Overview

**What it is:** The high-level summary of our monitoring stack (Sentry, metrics, UptimeRobot, logging).  
**What it does:** Describes what we monitor (errors, request rates, uptime) and why.  
**How we use it:** Read this first to understand the big picture before diving into each component below.

This document outlines the monitoring setup for PureTask Backend, including error tracking, metrics collection, and uptime monitoring.

**What this doc is for:** Use it when you need to set up or verify Sentry (errors), metrics (API/jobs/payments), UptimeRobot (uptime), or alerting. Each component below has a **What it is**, **Why it matters**, and **How to verify** so you know exactly what to do and how to confirm it works.

**Why monitoring matters:** Without error tracking you don't see production bugs until users complain. Without uptime checks you may not notice an outage. Without metrics you can't spot slowdowns or plan scaling. This doc ties all three together.

**In plain English:** *Sentry* = "when our app crashes, we see the error and where it happened." *UptimeRobot* = "a robot pings our app every few minutes; if the app doesn't answer, we get an alert." *Metrics* = "we count things (requests, errors) so we can graph them and set alerts like 'if errors go above 5%, notify us.'"

---

## New here? Key terms (plain English)

If you're new to backends or DevOps, these terms show up a lot. One-sentence meanings:

| Term | Plain English |
|------|----------------|
| **Production** | The live app that real users use. Changing it affects everyone. |
| **Staging** | A copy of the app used for testing before we push to production. |
| **Sentry** | A tool that catches errors from our app and shows them in a dashboard so we can fix bugs. |
| **DSN** | The web address Sentry gives us so our app knows where to send errors. We store it in env vars, not in code. |
| **Stack trace** | The list of function calls when an error happened—like a trail showing where the code broke. |
| **Metrics** | Numbers we record over time (e.g. how many requests per second, how many errors). Used for graphs and alerts. |
| **Migration** | A script that changes the database (add/remove tables or columns). We run them in order so everyone has the same schema. |
| **Circuit breaker** | When a partner service (e.g. Stripe) is down, we stop calling it for a short time so our app doesn't get stuck—like "don't retry the broken thing for 1 minute." |
| **Idempotency** | Sending the same request twice has the same effect as once (e.g. no double charge). We use idempotency keys so retries don't duplicate payments. |
| **CI/CD** | Scripts that run on every push: lint, test, build. They block bad code from being merged. |
| **Runbook** | Step-by-step instructions for a specific task (e.g. "how to restore from backup") so anyone can do it without guessing. |
| **Env vars / .env** | Configuration (API keys, database URL) stored in environment variables or a `.env` file—never committed to git. |

**Where to start:** See **[DOCUMENTATION_INDEX.md](../DOCUMENTATION_INDEX.md)** for the full doc list.

---

## Components

**What it is:** The set of monitoring pieces we use (Sentry, metrics, UptimeRobot, logs).  
**What it does:** Each piece captures a different kind of signal (errors, numbers, uptime, log lines).  
**How we use it:** Set up and verify each component below so production is observable.

### 1. Sentry (Error Tracking)
**Status**: ✅ Installed and configured with proper "init once" pattern  
**Integration**: Automatic error capture for 500+ errors, performance monitoring, profiling

**What it is:** Sentry is a service that captures unhandled errors and stack traces from your app and shows them in a dashboard.  
**What it does:** Records each error with stack trace and request context so we can fix bugs without guessing.  
**How we use it:** Add `SENTRY_DSN` to env, start app with `node -r ./dist/instrument.js`, and check the Sentry dashboard when things break. It can also record performance spans and user context (e.g. user ID, request path) so you can debug production issues quickly.

**Why it matters:** When something breaks in production, Sentry gives you the exact error, stack trace, and request context instead of guessing from logs. The "init once" pattern (preloading via `node -r ./dist/instrument.js`) ensures Sentry patches Node/Express before any other code runs, so errors and traces are captured correctly.

**Architecture**:
- ✅ `src/instrument.ts` - The ONLY place `Sentry.init()` is called
- ✅ `src/index.ts` - Requires `instrument.ts` FIRST (before any other imports)
- ✅ Follows Sentry's recommended pattern for Express apps

**Setup**:
1. Create a Sentry account at https://sentry.io
2. Create a new project (select **Node.js**, then **Express** framework)
3. Copy the **DSN** from the project settings (it's a long URL like `https://abc123@o123.ingest.sentry.io/456`—Sentry uses it to receive errors from your app).
4. Add to `.env` (or Railway environment variables):
   ```
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   NODE_ENV=production
   ```

**Railway Setup**:
In Railway → your service → Variables, add:
- `SENTRY_DSN` = your DSN (the https://… string)
- `NODE_ENV` = production

**Important**: The `start` script in `package.json` uses `node -r ./dist/instrument.js` to preload Sentry before any other code runs. This ensures Sentry can properly instrument Express, HTTP, and database calls even with TypeScript's import hoisting.

**Features**:
- Automatic error capture for 500+ errors
- Performance monitoring (10% sample rate in production)
- User context tracking
- Request ID correlation

**Verification**:
- Check logs for "sentry_initialized" message on startup
- Test error capture: `GET /health/debug-sentry` (intentionally triggers an error)
- In Sentry dashboard, you should see:
  - Error event "Sentry test error from PureTask"
  - Logs (if enabled)
  - Performance traces (if sampling allows)
- Check that errors include request context (path, method, user ID)

**Test Route**:
```bash
# After deployment, test Sentry:
curl https://your-railway-url/health/debug-sentry
```

**How to Know It's Working**:
- ✅ Errors appear in Sentry dashboard
- ✅ Stack traces are captured
- ✅ User context is included
- ✅ Performance data is visible

**How to Know It's NOT Working**:
- ❌ No errors in Sentry dashboard
- ❌ Logs show "sentry_not_configured" warning
- ❌ Errors don't include context

### 2. Metrics System
**Status**: ✅ Fully integrated and recording

**What it is:** A small in-process metrics module that records counts and timings for API requests, jobs, payments, payouts, and errors.  
**What it does:** Aggregates numbers over time (request rate, error rate, payment volume) so we can graph and alert.  
**How we use it:** Set `ENABLE_METRICS=true`, use `metrics.*` in code for custom counters; later wire to Prometheus/Datadog for dashboards. Data is kept in memory and can later be exported to Prometheus, Datadog, or CloudWatch.

**Why it matters:** Metrics let you see trends (e.g. request rate, error rate, payment volume) and set alerts (e.g. "error rate > 5%"). They don't replace Sentry—Sentry is for individual errors; metrics are for aggregates over time.

**Location**: `src/lib/metrics.ts`

**Automatic Recording**:
- ✅ API requests (duration, status codes) - recorded in `src/index.ts` request middleware
- ✅ Errors (by code and path) - recorded in error handler
- ✅ Job creation - recorded in `src/services/jobsService.ts`
- ✅ Job completion - recorded in `src/services/jobTrackingService.ts`
- ✅ Payment processing - recorded in `src/services/paymentService.ts`
- ✅ Payout processing - recorded in `src/services/payoutsService.ts`

**Manual Usage** (for custom metrics):
```typescript
import { metrics } from "./lib/metrics";

// Record API request
metrics.apiRequest("POST", "/jobs", 200, 150);

// Record database query
metrics.dbQuery("SELECT", 25, true);

// Record job event
metrics.jobCreated("job-123");
```

**Enable Metrics**:
Add to `.env`:
```
ENABLE_METRICS=true
```

**Current Metrics**:
- `api.request.duration` - Request latency
- `api.request.count` - Request count by method/path/status
- `db.query.duration` - Database query latency
- `db.query.count` - Database query count
- `job.created` - Job creation events
- `job.completed` - Job completion events
- `payment.processed` - Payment processing
- `payout.processed` - Payout processing
- `error.count` - Error counts by code

**Future Integration**:
- Send metrics to Datadog, Prometheus, or CloudWatch
- Create dashboards for key metrics
- Set up alerts based on metric thresholds

### 3. UptimeRobot (Uptime Monitoring)
**Status**: ⚠️ Manual setup required

**What it is:** An external service that periodically HTTP-pings your app (e.g. `/health`) from the internet.  
**What it does:** Detects when the app is down or slow and sends alerts (email, Slack, PagerDuty).  
**How we use it:** Create monitors in UptimeRobot for `/health` and `/health/ready`, attach alert contacts, so we know when production is unreachable. If the app doesn't respond, UptimeRobot marks it "Down" and can send you an alert (email, Slack, PagerDuty).

**Why it matters:** UptimeRobot runs outside your infrastructure, so it can detect outages even when your host or region is down. Without it, you might not notice the app is unreachable until users report it.

**Setup Steps**:
1. Create account at https://uptimerobot.com
2. Add a new monitor:
   - **Type**: HTTP(s)
   - **URL**: `https://your-api-domain.com/health`
   - **Interval**: 5 minutes
   - **Alert Contacts**: Add email/SMS
3. Add additional monitors:
   - `/health/ready` - Readiness check
   - `/status` - Operational status

**Recommended Monitors**:
- Main health endpoint (5 min interval)
- Readiness endpoint (5 min interval)
- Database connectivity (15 min interval via custom endpoint)
- Critical API endpoints (optional, 15 min interval)

**Alert Configuration**:
- **Critical**: Service down for > 5 minutes
- **Warning**: Service degraded (response time > 2s)
- **Info**: Service recovered

**How to Know It's Working**:
- ✅ UptimeRobot shows "Up" status
- ✅ Alerts are received when service goes down
- ✅ Response times are tracked

**How to Know It's NOT Working**:
- ❌ UptimeRobot shows "Down" status
- ❌ No alerts received (check email/spam)
- ❌ Response times not recorded

### 4. Log Aggregation
**Status**: ✅ Structured logging in place

**What it is:** Central storage and search for application logs (e.g. Datadog, ELK, CloudWatch).  
**What it does:** Collects logs from all instances into one place so we can search and correlate during incidents.  
**How we use it:** App already writes JSON logs; optionally ship them to Datadog/CloudWatch/ELK and use that for debugging across requests. Right now the app writes structured JSON logs; log aggregation would collect those logs from all instances into one place so you can search and correlate.

**Why it matters:** When debugging an incident, you often need to see logs from multiple requests or servers. Without aggregation, you're SSHing into hosts or reading host-specific log files. Optional until you have multiple instances or need cross-request debugging.

**Current Setup**:
- JSON-formatted logs
- Request context (requestId, correlationId, userId)
- Error stack traces
- Sensitive data redaction

**Future Integration Options**:
- **Datadog**: Log ingestion and analysis
- **Logtail**: Simple log aggregation
- **CloudWatch**: AWS-native logging
- **Elasticsearch**: Self-hosted log aggregation

**Log Format**:
```json
{
  "level": "info",
  "msg": "http_request",
  "time": "2024-01-29T00:00:00.000Z",
  "service": "puretask-backend",
  "method": "POST",
  "path": "/jobs",
  "status": 200,
  "durationMs": 150,
  "requestId": "req-123",
  "userId": "user-456"
}
```

## Verification

**What it is:** A script that checks that Sentry, metrics, DB, health endpoints, and logging are configured.  
**What it does:** Runs automated checks so we don't assume monitoring is on when it isn't.  
**How we use it:** Run `npm run monitoring:verify` after setup or before go-live to confirm everything is wired.

Run the verification script to check monitoring setup:
```bash
npm run monitoring:verify
```

This will check:
- ✅ Sentry configuration
- ✅ Metrics system availability
- ✅ Database connectivity
- ✅ Health endpoints
- ✅ Logging system

## Monitoring Checklist

**What it is:** A tick-list of monitoring tasks (initial setup, alerting, ongoing habits).  
**What it does:** Ensures nothing is missed: Sentry, UptimeRobot, alerts, and regular review.  
**How we use it:** Work through Initial Setup once, configure Error alerting, then follow Ongoing so monitoring stays useful.

### Initial Setup
**What it is:** One-time steps to get Sentry, metrics, and UptimeRobot in place.  
**What it does:** Ensures we have error tracking, metrics, and uptime checks before production.  
**How we use it:** Tick each item; run verification script when done.
- [x] ✅ Metrics system created and integrated
- [x] ✅ Metrics recording added to critical operations
- [x] ✅ Verification script created
- [ ] Create Sentry account and project
- [ ] Add SENTRY_DSN to environment variables
- [ ] Verify Sentry initialization in logs
- [ ] Test error capture
- [ ] Set up UptimeRobot account
- [ ] Configure health check monitors
- [ ] Test alert notifications

### Error alerting (Sentry + UptimeRobot)
**What it is:** Rules and contacts so Sentry and UptimeRobot notify someone when errors spike or the app goes down.  
**What it does:** Sends alerts to email/Slack/PagerDuty so we respond instead of discovering outages from users.  
**How we use it:** In Sentry create alert rules (e.g. event count > 50/hour); in UptimeRobot add alert contacts and attach them to monitors.

1. **Sentry:** Project → Alerts → Create Alert. Rule: e.g. "When event count is above 50 in 1 hour" or "When an issue is first seen." Action: Send to email or webhook (Slack incoming webhook URL, or PagerDuty). Save.
2. **UptimeRobot:** Alert Contacts → Add contact (email, Slack webhook, or PagerDuty). Attach contacts to your API monitors so you get notified when checks fail.
3. **Runbooks:** See `docs/runbooks/handle-incident.md` and `docs/runbooks/rollback-deploy.md` for incident and rollback steps.

### Ongoing Monitoring
**What it is:** Regular habits (daily/weekly/monthly) so we don't ignore monitoring data.  
**What it does:** Keeps the team looking at errors, uptime, and trends so issues are caught early.  
**How we use it:** Review Sentry daily, UptimeRobot weekly, metrics monthly; set alert thresholds and use runbooks when alerts fire.

- [ ] Review Sentry errors daily
- [ ] Check UptimeRobot status weekly
- [ ] Review metrics trends monthly
- [ ] Set up alert thresholds (see Error alerting above)
- [x] Runbooks for common operations: `docs/runbooks/`

## Alert Thresholds

**What it is:** Rules that define when we get notified (critical vs warning vs info).  
**What it does:** Prevents alert spam while ensuring we're notified for real problems.  
**How we use it:** Configure Sentry/UptimeRobot and dashboards with these thresholds; Critical = page, Warning = investigate, Info = FYI.

### Critical Alerts
**What it is:** Conditions that require immediate response (e.g. service down, error rate high).  
**What it does:** Ensures someone is paged when production is seriously broken.  
**How we use it:** Map these to PagerDuty or high-priority Slack/email so on-call acts.
- Service down for > 5 minutes
- Error rate > 5% for 10 minutes
- Database connection failures
- Payment processing failures

### Warning Alerts
**What it is:** Conditions that need investigation soon but aren't full outages.  
**What it does:** Surfaces degradation (slow responses, rising errors) before they become critical.  
**How we use it:** Set in monitoring tools; investigate within hours and fix or escalate.

- Response time > 2 seconds (p95)
- Error rate > 1% for 10 minutes
- High memory usage (> 80%)
- High CPU usage (> 80%)

### Info Alerts
**What it is:** Informational notifications (recovery, deploy complete, maintenance).  
**What it does:** Confirms that an incident ended or a change was applied.  
**How we use it:** Optional; use for audit trail or low-priority channels.

- Service recovered
- Deployment completed
- Scheduled maintenance started

## Next Steps

**What it is:** Follow-up work to deepen monitoring (dashboards, APM, synthetic tests).  
**What it does:** Extends what we have so we can spot more issues and trends.  
**How we use it:** Prioritize after initial setup is done; integrate metrics, add dashboards, then APM and synthetics.

1. **Integrate Metrics Service**: Connect metrics to Datadog/Prometheus
2. **Create Dashboards**: Build visualizations for key metrics
3. **Set Up Alerts**: Configure alerting rules based on thresholds
4. **Log Aggregation**: Set up centralized log collection
5. **Performance Monitoring**: Add APM (Application Performance Monitoring)
6. **Synthetic Monitoring**: Add synthetic tests for critical user flows
