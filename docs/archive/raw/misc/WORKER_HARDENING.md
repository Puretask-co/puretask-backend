# Worker Hardening & Reliability

This document describes the worker infrastructure hardening implemented in Section 6, including idempotency, lock recovery, dead-letter handling, scheduling, and observability.

## Overview

The worker system has been hardened to ensure:
- **Idempotency**: Jobs cannot be enqueued twice
- **Crash Recovery**: Expired locks are automatically recovered
- **Dead-Letter Handling**: Permanently failed jobs are tracked
- **Centralized Scheduling**: Single source of truth for cron schedules
- **Observability**: Metrics and alerts for worker health

## Features

### 1. Job Idempotency Keys

**Problem**: Jobs could be enqueued multiple times, causing duplicate processing.

**Solution**: Add `idempotency_key` to `job_queue` table with unique constraint.

**Usage**:
```typescript
import { enqueue } from "../lib/queue";

// Enqueue with idempotency key
await enqueue(QUEUE_NAMES.CALENDAR_SYNC, payload, {
  idempotencyKey: `calendar_sync:${userId}:${jobId}`
});

// If same key is used again, returns existing job ID (no duplicate)
```

**Format**: `{queue_name}:{unique_identifier}`

### 2. Expired Lock Recovery

**Problem**: If a worker crashes while processing a job, the job stays in "processing" status forever.

**Solution**: Automatic recovery of expired locks.

**How it works**:
- Jobs locked for >30 minutes are considered expired
- `recover_expired_job_locks()` function resets them to "pending"
- Lock recovery runs every 15 minutes via scheduler

**Manual recovery**:
```bash
npm run worker:lock-recovery
```

### 3. Dead-Letter Queue

**Problem**: Jobs that permanently fail just stay "failed" with no visibility.

**Solution**: Jobs that exceed `max_attempts` are moved to "dead" status.

**Features**:
- `dead_letter_reason` field explains why job failed
- `dead_letter_at` timestamp for tracking
- Admin can retry dead-letter jobs via API
- View dead-letter queue: `SELECT * FROM dead_letter_queue;`

**Retry a dead-letter job**:
```typescript
import { queueService } from "../lib/queue";

await queueService.retryDeadLetterJob(jobId);
```

### 4. Centralized Scheduler

**Problem**: Cron schedules scattered across Railway config, scripts, and code.

**Solution**: Single source of truth in `src/workers/scheduler.ts`.

**Configuration**:
```typescript
export const WORKER_SCHEDULES: WorkerSchedule[] = [
  {
    workerName: "auto-cancel",
    cronExpression: "*/5 * * * *", // Every 5 minutes
    description: "Auto-cancel stale bookings",
    enabled: true,
  },
  // ... more schedules
];
```

**Usage Options**:

**Option A: Railway Cron** (Recommended)
```bash
# In Railway, create cron service:
# Schedule: 0 2 * * *
# Command: node dist/workers/scheduler.js subscription-jobs
```

**Option B: Internal Scheduler** (Requires node-cron)
```typescript
import { startInternalScheduler } from "./workers/scheduler";

// In src/index.ts, after server starts:
if (process.env.USE_INTERNAL_SCHEDULER === "true") {
  await startInternalScheduler();
}
```

**Option C: Manual Execution**
```bash
npm run worker:scheduler <worker-name>
```

### 5. Worker Observability

**Metrics Endpoint**: `GET /health/workers`

Returns:
```json
{
  "healthy": true,
  "metrics": {
    "timestamp": "2025-01-15T10:00:00Z",
    "jobQueue": {
      "pending": 5,
      "processing": 2,
      "completed": 1000,
      "failed": 3,
      "dead": 1
    },
    "workerRuns": {
      "running": 1,
      "success": 50,
      "failed": 2,
      "expired": 0
    },
    "stuckJobs": 0,
    "deadLetterJobs": 1
  },
  "alerts": []
}
```

**Alerts** (automatically checked):
- Stuck jobs > 10
- Dead-letter jobs > 50
- Failed worker runs > 5 (last 24h)
- Pending jobs backlog > 1000

**Database Views**:
- `job_queue_stats`: Statistics by queue and status
- `dead_letter_queue`: All dead-letter jobs
- `stuck_jobs`: Jobs stuck in processing

## Database Migration

Apply the migration:
```bash
# Migration adds:
# - idempotency_key column
# - dead_letter_reason, dead_letter_at columns
# - locked_by, locked_at columns
# - Helper functions for lock recovery
# - Views for observability

psql $DATABASE_URL -f DB/migrations/038_worker_hardening.sql
```

## Worker Scripts

New scripts added to `package.json`:
```json
{
  "worker:lock-recovery": "ts-node src/workers/lockRecovery.ts",
  "worker:scheduler": "ts-node src/workers/scheduler.ts"
}
```

## Best Practices

1. **Always use idempotency keys** for critical jobs:
   ```typescript
   await enqueue(QUEUE_NAMES.SUBSCRIPTION_JOB, payload, {
     idempotencyKey: `subscription:${clientId}:${date}`
   });
   ```

2. **Monitor worker health** regularly:
   ```bash
   curl http://localhost:4000/health/workers
   ```

3. **Review dead-letter queue** weekly:
   ```sql
   SELECT * FROM dead_letter_queue ORDER BY dead_letter_at DESC LIMIT 20;
   ```

4. **Set up alerts** for worker failures (integrate with your monitoring system).

5. **Use Railway cron** for production (more reliable than internal scheduler).

## Troubleshooting

### Jobs stuck in "processing"
```bash
# Run lock recovery
npm run worker:lock-recovery

# Or manually:
SELECT recover_expired_job_locks(30);
```

### Too many dead-letter jobs
1. Check `dead_letter_reason` to understand failures
2. Fix underlying issue
3. Retry jobs: `queueService.retryDeadLetterJob(jobId)`

### Duplicate jobs being processed
- Ensure idempotency keys are used
- Check for unique constraint violations in logs

## Related Files

- `DB/migrations/038_worker_hardening.sql`: Database schema changes
- `src/lib/queue.ts`: Queue service with idempotency and dead-letter
- `src/workers/lockRecovery.ts`: Lock recovery worker
- `src/workers/scheduler.ts`: Centralized scheduler
- `src/lib/workerMetrics.ts`: Metrics and alerts
