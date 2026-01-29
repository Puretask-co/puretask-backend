# Monitoring Setup Guide

## Overview
This document outlines the monitoring setup for PureTask Backend, including error tracking, metrics collection, and uptime monitoring.

## Components

### 1. Sentry (Error Tracking)
**Status**: ✅ Installed and configured

**Setup**:
1. Create a Sentry account at https://sentry.io
2. Create a new project (Node.js/Express)
3. Copy the DSN from the project settings
4. Add to `.env`:
   ```
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```

**Features**:
- Automatic error capture for 500+ errors
- Performance monitoring (10% sample rate in production)
- User context tracking
- Request ID correlation

**Verification**:
- Check logs for "sentry_initialized" message on startup
- Trigger a test error and verify it appears in Sentry dashboard
- Check that errors include request context (path, method, user ID)

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
**Status**: ✅ Basic metrics system created

**Location**: `src/lib/metrics.ts`

**Usage**:
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

## Monitoring Checklist

### Initial Setup
- [ ] Create Sentry account and project
- [ ] Add SENTRY_DSN to environment variables
- [ ] Verify Sentry initialization in logs
- [ ] Test error capture
- [ ] Set up UptimeRobot account
- [ ] Configure health check monitors
- [ ] Test alert notifications
- [ ] Enable metrics collection (optional)

### Ongoing Monitoring
- [ ] Review Sentry errors daily
- [ ] Check UptimeRobot status weekly
- [ ] Review metrics trends monthly
- [ ] Set up alert thresholds
- [ ] Create runbooks for common errors

## Alert Thresholds

### Critical Alerts
- Service down for > 5 minutes
- Error rate > 5% for 10 minutes
- Database connection failures
- Payment processing failures

### Warning Alerts
- Response time > 2 seconds (p95)
- Error rate > 1% for 10 minutes
- High memory usage (> 80%)
- High CPU usage (> 80%)

### Info Alerts
- Service recovered
- Deployment completed
- Scheduled maintenance started

## Next Steps

1. **Integrate Metrics Service**: Connect metrics to Datadog/Prometheus
2. **Create Dashboards**: Build visualizations for key metrics
3. **Set Up Alerts**: Configure alerting rules based on thresholds
4. **Log Aggregation**: Set up centralized log collection
5. **Performance Monitoring**: Add APM (Application Performance Monitoring)
6. **Synthetic Monitoring**: Add synthetic tests for critical user flows
