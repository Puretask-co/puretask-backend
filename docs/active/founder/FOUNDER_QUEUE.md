# Founder Reference: Queue System

**Candidate:** Queue system (System #4)  
**Where it lives:** `src/lib/queue.ts`, `QUEUE_NAMES`, `queueProcessor` worker, `job_queue` table, `lockRecovery.ts`  
**Why document:** Database-backed job queue; what queues exist, how jobs are enqueued and processed, and how idempotency/locking work.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The Queue system is a database-backed job queue that lets the app defer work to background workers. It consists of: (1) **Queue service**—`src/lib/queue.ts` (queueService singleton) with `enqueue`, `processQueue`, `registerHandler`, and helpers (getDeadLetterJobs, retryDeadLetterJob, getQueueStats, cleanupOldJobs, recoverExpiredLocks); (2) **Queue names**—`QUEUE_NAMES` (calendar_sync, ai_checklist, ai_dispute, weekly_report, subscription_job, notification, webhook_retry) as type-safe constants; (3) **Storage**—`job_queue` table (id, queue_name, payload, status, priority, attempts, max_attempts, scheduled_at, started_at, completed_at, error_message, idempotency_key, locked_by, locked_at, dead_letter_reason, dead_letter_at, created_at); (4) **Processor**—`src/workers/v2-operations/queueProcessor.ts` runs a loop every 5 seconds, calls `processQueue` for each queue, and registers handlers for calendar_sync, ai_checklist, ai_dispute (other queue names may be used by other workers or reserved); (5) **Locking**—`FOR UPDATE SKIP LOCKED` when claiming jobs so multiple workers don’t take the same job; (6) **Dead letter**—jobs that exceed max_attempts move to status `dead` with dead_letter_reason/at; (7) **Lock recovery**—`lockRecovery.ts` and DB function `recover_expired_job_locks` re-queue jobs stuck in `processing` longer than 30 minutes (crashed workers).

**Simple (like for a 10-year-old):** The queue is a “to-do list” for the computer. When we need to do something later (like sync a calendar or run an AI task), we add a job to the list instead of doing it right away. A background worker keeps reading the list, grabs a few jobs, does them, and marks them done. If a job fails we retry it a few times; if it keeps failing we put it in a “dead letter” pile so someone can look at it. If a worker crashes, we have a recovery step that puts stuck jobs back on the list so another worker can try.

### 2. Where it is used

**Technical:** The queue is implemented in `src/lib/queue.ts` (QueueService, enqueue, processQueue, QUEUE_NAMES, EnqueueOptions, QueueJob) and the `job_queue` table (DB/migrations/016_v2_core.sql, 038_worker_hardening.sql). The processor is `src/workers/v2-operations/queueProcessor.ts` (registers handlers for CALENDAR_SYNC, AI_CHECKLIST, AI_DISPUTE; polls every 5s). Enqueue call sites: `calendarService.ts` (enqueue QUEUE_NAMES.CALENDAR_SYNC for syncJobToCalendar), `aiService.ts` (enqueue QUEUE_NAMES.AI_CHECKLIST, QUEUE_NAMES.AI_DISPUTE). Lock recovery is `src/workers/lockRecovery.ts` (recoverExpiredJobLocks via queueService.recoverExpiredLocks). QUEUE_NAMES also includes weekly_report, subscription_job, notification, webhook_retry—handlers for those may live in other workers (e.g. subscriptionJobs, webhookRetry, retryFailedNotifications) or are reserved for future use.

**Simple (like for a 10-year-old):** The “add to the list” and “process the list” code lives in the queue lib and one table (job_queue). The main worker that processes the list is queueProcessor; it only handles “calendar sync,” “AI checklist,” and “AI dispute” jobs. The calendar and AI services add jobs to the queue when they need to do that work in the background. We have a separate “lock recovery” step that puts stuck jobs back. Other queue names (weekly report, subscription job, notification, webhook retry) exist in the list; some may be used by other workers or saved for later.

### 3. When we use it

**Technical:** We use the queue when: (1) calendar sync is requested—calendarService enqueues CALENDAR_SYNC with userId, jobId, eventData; (2) AI checklist or dispute is requested—aiService enqueues AI_CHECKLIST or AI_DISPUTE with jobId/disputeId and input; (3) the queueProcessor worker runs every 5 seconds—processAllQueues iterates QUEUE_NAMES, processQueue(queueName, 10) for each; (4) lock recovery runs (e.g. via scheduler or cron)—recoverExpiredJobLocks(30) re-queues jobs stuck in processing > 30 minutes. There is no fixed “business” schedule for enqueue—it’s triggered by API or service calls; processing is continuous (5s poll).

**Simple (like for a 10-year-old):** We add a job when someone asks for a calendar sync or when we need to run an AI checklist or dispute suggestion—we don’t do it right away, we put it on the list. The worker looks at the list every 5 seconds and does up to 10 jobs per queue per run. We also run a “recover stuck jobs” step (e.g. on a schedule) that puts jobs that were being worked on but the worker died back on the list.

### 4. How it is used

**Technical:** **Enqueue:** `enqueue(queueName, payload, { priority?, scheduledAt?, maxAttempts?, idempotencyKey? })`. If idempotencyKey: SELECT existing job by queue_name + idempotency_key; if found return existing id. Else INSERT job_queue (queue_name, payload, priority, scheduled_at, max_attempts, idempotency_key) RETURNING id. On unique violation (23505) for idempotency_key, SELECT existing and return that id. **Process:** processQueue(queueName, batchSize=10). workerId = `worker-${pid}-${Date.now()}`. UPDATE job_queue SET status=processing, started_at=NOW(), attempts=attempts+1, locked_by=workerId, locked_at=NOW() WHERE id IN (SELECT id FROM job_queue WHERE queue_name=? AND status=pending AND scheduled_at<=NOW() AND attempts<max_attempts ORDER BY priority DESC, scheduled_at ASC LIMIT ? FOR UPDATE SKIP LOCKED) RETURNING *. For each row: run registered handler(payload). On success: UPDATE status=completed, completed_at=NOW(), locked_by=NULL. On failure: if attempts<max_attempts then status=pending, scheduled_at+=backoff, else status=dead, dead_letter_reason/at set; clear locked_by. **Recover:** recoverExpiredLocks(30): SELECT recover_expired_job_locks(30)—UPDATE job_queue SET status=pending, locked_by=NULL, attempts=attempts+1 WHERE status=processing AND locked_at < NOW() - 30 minutes AND attempts<max_attempts.

**Simple (like for a 10-year-old):** To add a job we call enqueue with the queue name and the job data; we can optionally give a “key” so we don’t add the same job twice. To process, the worker grabs up to 10 pending jobs at a time (using a lock so two workers don’t take the same job), runs the handler for each, and marks them completed or failed. If a job fails we retry it later (with a delay); if it fails too many times we mark it “dead” so we can look at it. To recover from a crashed worker we run a function that finds jobs stuck “in progress” for more than 30 minutes and puts them back to “pending.”

### 5. How we use it (practical)

**Technical:** In day-to-day: run the queueProcessor worker continuously (`node dist/workers/queueProcessor.js` or via scheduler). Env: same DB as the app (no separate queue broker). To enqueue from code: `import { enqueue, QUEUE_NAMES } from "../lib/queue"; await enqueue(QUEUE_NAMES.CALENDAR_SYNC, { userId, jobId, eventData }, { idempotencyKey: "calendar:${jobId}" });`. Handlers are registered in queueProcessor at startup (registerHandler). To debug: query job_queue by queue_name, status; getQueueStats(queueName); getDeadLetterJobs(queueName). Lock recovery: run lockRecovery (e.g. from scheduler) or call queueService.recoverExpiredLocks(30). Cleanup: cleanupOldJobs(7) deletes completed/failed jobs older than 7 days (run on a schedule if desired). Retry dead letter: retryDeadLetterJob(jobId) (admin).

**Simple (like for a 10-year-old):** In practice we run the queue worker as a separate process that keeps looping. We use the same database as the rest of the app. When we want to add a job we call enqueue with the queue name and the data; we can pass an idempotency key so the same job isn’t added twice. To see what’s in the queue we look at the job_queue table or call getQueueStats. We can run “recover expired locks” on a schedule. We can delete old completed jobs so the table doesn’t grow forever. Admins can “retry” a dead-letter job.

### 6. Why we use it vs other methods

**Technical:** A database-backed queue avoids a separate broker (Redis, RabbitMQ, SQS) so we have one less dependency and can use the same DB for transactional consistency (e.g. create job + enqueue in one transaction if we extend the API). FOR UPDATE SKIP LOCKED gives safe concurrent processing without advisory locks. Idempotency keys prevent duplicate work when the same logical action triggers enqueue twice. Dead letter and lock recovery make the system resilient to handler failures and worker crashes. Alternatives—in-process only (no queue) would block the request; Redis/RabbitMQ would add infra and ops; we chose DB for simplicity and portability.

**Simple (like for a 10-year-old):** We use a queue so we don’t have to do slow work (calendar sync, AI) right when the user clicks—we say “do it later” and the worker does it. We use the database as the “list” so we don’t need another system (like Redis). We use locks so two workers don’t grab the same job. We use idempotency keys so we don’t add the same job twice. We use dead letter and lock recovery so when something fails or a worker dies we can retry or fix it. Using something else (like doing everything immediately or using a separate queue service) would either block users or add more complexity.

### 7. Best practices

**Technical:** We use a single queue service and type-safe QUEUE_NAMES so all enqueuers and the processor share the same contract. We register handlers in one place (queueProcessor) so behavior is consistent. We use idempotency keys where duplicate enqueue would be harmful (e.g. calendar_sync per jobId). We use FOR UPDATE SKIP LOCKED so multiple workers can run without double-processing. We recover expired locks so crashed workers don’t leave jobs stuck. We have dead letter and retryDeadLetterJob for manual inspection. Gaps: queueProcessor only registers 3 of 7 queue names—WEEKLY_REPORT, SUBSCRIPTION_JOB, NOTIFICATION, WEBHOOK_RETRY have no handler there (may be in other workers or unused); no metrics (e.g. queue depth, processing latency) in this module; cleanupOldJobs not on a visible schedule; no alerting on dead-letter count or lock recovery count.

**Simple (like for a 10-year-old):** We have one queue service and a fixed list of queue names so everyone adds and processes jobs the same way. We use idempotency so we don’t add the same job twice. We use locks so two workers don’t do the same job. We recover stuck jobs when a worker dies. We have a “dead letter” pile and a way to retry those. What we could do better: some queue names don’t have handlers in the main processor (they might be elsewhere); we don’t have dashboards for queue size or speed; we don’t run “delete old jobs” on a set schedule; we don’t alert when the dead-letter pile grows.

### 8. Other relevant info

**Technical:** The queue is critical for offloading calendar sync and AI work so API responses stay fast. Job payloads are JSONB—handlers must tolerate schema evolution. Queue processor runs in a single process; to scale we’d run multiple processor instances (FOR UPDATE SKIP LOCKED allows that). Document new queue names in QUEUE_NAMES and register a handler in queueProcessor (or the worker that owns that queue). See FOUNDER_IDEMPOTENCY.md for how idempotency keys work in the queue; lockRecovery and recover_expired_job_locks are in DB/migrations/038_worker_hardening.sql.

**Simple (like for a 10-year-old):** The queue matters because it keeps the app fast—we do slow stuff in the background. Job data is stored as JSON; if we change the shape we have to be careful. We can run more than one worker process; the lock makes sure they don’t take the same job. When we add a new kind of job we add its name to the list and plug in a handler. How idempotency and lock recovery work is described in other docs.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** The queue is supposed to: (1) defer work (calendar sync, AI checklist, AI dispute) so API handlers return quickly; (2) process that work asynchronously with retries (max_attempts, backoff) and dead letter when exhausted; (3) allow multiple workers to process safely (FOR UPDATE SKIP LOCKED); (4) avoid duplicate work via idempotency keys; (5) recover jobs left in “processing” when a worker crashes (recoverExpiredLocks). Success means jobs are enqueued, processed at most once per idempotency key, and either completed or moved to dead letter after max retries; stuck jobs are eventually recovered.

**Simple (like for a 10-year-old):** It’s supposed to do work “later” so the app doesn’t wait—we put a job on the list and answer the user right away, then a worker does the job. It’s supposed to retry if something fails and put jobs in a “dead” pile if they keep failing. It’s supposed to let several workers work at once without doing the same job twice. It’s supposed to put stuck jobs back on the list when a worker dies. Success means jobs get done (or end up in dead letter so we can look), and we don’t lose or duplicate work.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for enqueue: row in job_queue with status pending (or existing row id returned if idempotency key matched). Done for process: job status → completed, completed_at set, locked_by cleared; or status → pending (retry) / dead (dead letter), error_message set. Done for lock recovery: jobs in processing longer than lockTimeoutMinutes set back to pending, locked_by cleared, attempts incremented. Observable: getQueueStats shows pending/processing/completed/dead; dead letter jobs in getDeadLetterJobs; logs job_enqueued, job_completed, job_failed, expired_locks_recovered.

**Simple (like for a 10-year-old):** Success for “add job”: the job is in the table with status “pending” (or we return the id of the job we already had). Success for “process”: the job is marked “completed” and the lock is cleared, or it’s marked for retry or “dead.” Success for “recover locks”: stuck jobs are back to “pending” so another worker can try. We can see success by looking at queue stats and the dead-letter list and at logs like “job completed” or “locks recovered.”

### 11. What would happen if we didn't have it?

**Technical:** Without the queue we’d have to run calendar sync and AI checklist/dispute synchronously in the request—latency would spike and timeouts would increase. We couldn’t retry cleanly (we’d have to retry the whole HTTP request). We’d have no dead letter for manual inspection. We’d have no lock recovery so a crashed worker would leave jobs stuck forever. User experience and reliability would suffer.

**Simple (like for a 10-year-old):** Without it we’d have to do calendar sync and AI work right when the user clicks—the app would feel slow and might time out. We wouldn’t have a clean way to “try again” or a “failed jobs” pile to look at. If a worker died, those jobs would be stuck forever. So the app would be slower and less reliable.

### 12. What is it not responsible for?

**Technical:** The queue is not responsible for: validating payload schema (handlers assume a shape); business logic of the work (calendar sync, AI—those are in calendarService, aiService); rate limiting or prioritization beyond the priority column; scheduling “run at time X” beyond scheduled_at (no cron expression); exactly-once delivery (we have at-most-once per idempotency key; handler must be idempotent if we retry). It doesn’t send notifications or run payouts—those may use other workers or the same table with different queue names.

**Simple (like for a 10-year-old):** It doesn’t check that the job data is valid—the handler does the real work and assumes the data is right. It doesn’t do the actual calendar sync or AI—other services do that. It doesn’t do fancy “run every Tuesday” scheduling—just “run after this time.” It doesn’t guarantee “exactly once”—we try not to run the same job twice (idempotency key), but the handler should be safe if we do run it twice. It doesn’t send emails or pay people—that’s other code.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** For enqueue: queueName (QueueName), payload (T, JSON-serializable), options (priority, scheduledAt, maxAttempts, idempotencyKey). For processQueue: queueName, batchSize (default 10). For recoverExpiredLocks: lockTimeoutMinutes (default 30). DB: job_queue table, recover_expired_job_locks(integer). Env: none specific to queue.ts (uses app DB client). Handlers are registered with registerHandler(queueName, handler); handler receives payload.

**Simple (like for a 10-year-old):** To add a job we need the queue name, the job data (anything we can turn into JSON), and optionally priority, when to run, how many retries, and an idempotency key. To process we need the queue name and how many jobs to grab at once. To recover locks we need “how many minutes is too long.” We need the job_queue table and the recovery function in the DB. We don’t need any special env vars. Handlers are “registered” at startup with the queue name and a function that receives the job data.

### 14. What does it produce or change?

**Technical:** Enqueue produces: one row in job_queue (or returns existing id). processQueue changes: job rows (status pending→processing→completed or pending/dead; started_at, completed_at, attempts, error_message, locked_by, locked_at, dead_letter_*). recoverExpiredLocks changes: job rows (status processing→pending, locked_by cleared, attempts+1). getQueueStats/getDeadLetterJobs/retryDeadLetterJob/cleanupOldJobs produce reads or updates as documented. It does not produce user-facing output (no HTTP response); it produces side effects (calendar sync, AI results) via handlers.

**Simple (like for a 10-year-old):** Adding a job creates a row in the table (or gives back the id of an existing one). Processing updates those rows—status, timestamps, error message, lock—and runs the handler (which does the real work like calendar sync). Lock recovery updates stuck jobs back to “pending.” The queue itself doesn’t “produce” a page or email—the handlers do that.

### 15. Who or what consumes its output?

**Technical:** Consumers of “job completed”: the handler’s side effects (e.g. calendar event created, AI result stored or sent). No direct “consumer” of the queue table for business logic—admins or support might query job_queue or getDeadLetterJobs for debugging. The queueProcessor worker is the consumer of pending jobs (it runs handlers). Other workers (subscriptionJobs, webhookRetry, etc.) may consume their own queue names if they register handlers elsewhere or use the same table with different processing loops.

**Simple (like for a 10-year-old):** The “output” of a completed job is whatever the handler does—e.g. add a calendar event or save an AI result. Nobody else “reads” the queue table for normal operation; we might look at it for debugging. The queue processor is the thing that “consumes” pending jobs by running the handlers. Other workers might use the same list for their own job types.

### 16. What are the main steps or flow it performs?

**Technical:** **Enqueue:** (1) If idempotencyKey, SELECT id FROM job_queue WHERE queue_name AND idempotency_key; if row return id. (2) INSERT job_queue RETURNING id. (3) On 23505, SELECT existing id and return. **Process (per queue):** (1) Get handler for queueName; if none return. (2) workerId = worker-${pid}-${timestamp}. (3) UPDATE job_queue SET processing, started_at, attempts+1, locked_by, locked_at WHERE id IN (SELECT ... pending ... ORDER BY priority DESC, scheduled_at ASC LIMIT batchSize FOR UPDATE SKIP LOCKED) RETURNING *. (4) For each job: await handler(payload). (5) Success: UPDATE status=completed, completed_at, locked_by=NULL. (6) Failure: UPDATE status pending/dead, error_message, scheduled_at backoff or dead_letter_*, locked_by=NULL. **Recover:** recover_expired_job_locks(minutes): UPDATE job_queue SET pending, locked_by=NULL, attempts+1 WHERE status=processing AND locked_at < NOW()-interval AND attempts<max_attempts.

**Simple (like for a 10-year-old):** To enqueue: if we have an idempotency key we look for an existing job with that key and return its id; else we insert a new job and return the id (or if two processes insert the same key, we catch that and return the existing id). To process: we get the handler for that queue, claim up to 10 pending jobs with a lock, run the handler for each, then mark each completed or failed (and if failed, retry later or move to dead letter). To recover: we find jobs stuck “in progress” for too long and set them back to “pending.”

### 17. What rules or policies does it enforce?

**Technical:** We enforce: (1) unique (queue_name, idempotency_key) when idempotency_key is not null (unique index); (2) status in pending, processing, completed, failed, dead; (3) only pending jobs with scheduled_at<=NOW() and attempts<max_attempts are claimable; (4) FOR UPDATE SKIP LOCKED so one job is only claimed by one worker; (5) handler must be registered for processQueue to run jobs (otherwise we skip with no_handler_for_queue). We don’t enforce: payload schema; max queue depth; or who can enqueue (caller’s responsibility).

**Simple (like for a 10-year-old):** We enforce: the same idempotency key can’t be used twice for the same queue (one job per key). Only “pending” jobs that are due and haven’t exceeded retries can be picked up. The lock makes sure only one worker gets each job. We need a handler registered for each queue we process. We don’t check what’s inside the job data or how many jobs are in the queue.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Enqueue is triggered by: calendarService (when sync is requested), aiService (when AI checklist or dispute is requested), and any other caller that calls enqueue(queueName, payload, options). processQueue is triggered by the queueProcessor worker loop every 5 seconds (POLL_INTERVAL_MS = 5000). recoverExpiredLocks is triggered by running lockRecovery (e.g. from scheduler or cron). There is no HTTP endpoint that “triggers” the queue—enqueue is in-process from services; processing is the worker loop.

**Simple (like for a 10-year-old):** Jobs get added when the calendar or AI code asks for work to be done (and any other code that calls “enqueue”). The worker that processes the queue runs in a loop and checks every 5 seconds. The “recover stuck jobs” step runs when we run the lock recovery (e.g. on a schedule). Nothing on the website “triggers” the queue directly—it’s all backend code and the worker.

### 19. What could go wrong while doing its job?

**Technical:** (1) Handler throws—we catch, update job (retry or dead letter), log job_failed. (2) Worker crashes mid-handler—job stays processing until recoverExpiredLocks runs; then it’s re-queued (attempts incremented). (3) No handler registered—processQueue returns 0 processed, logs no_handler_for_queue (WEEKLY_REPORT, etc. if not registered). (4) DB down—enqueue or processQueue throws; caller or worker must retry. (5) Payload schema mismatch—handler may throw or behave wrongly; we don’t validate. (6) Dead letter pile grows—no auto-alert; admin should retry or fix. (7) job_queue table grows—cleanupOldJobs exists but may not be scheduled. (8) Two enqueuers same idempotency key—one gets existing id (OK); race on INSERT handled by unique violation and re-SELECT.

**Simple (like for a 10-year-old):** Things that can go wrong: the handler fails—we retry or put the job in dead letter and log it. The worker dies—the job stays “in progress” until we run lock recovery and put it back. If nobody registered a handler for a queue we don’t process it and log that. If the database is down, enqueue or process fails. If the job data is wrong the handler might fail. The dead-letter pile can get big and we might not notice. The table can get big if we don’t run cleanup. When two people add the same idempotency key we handle it and return the same job id.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** We observe: (1) logs—job_enqueued, job_completed, job_failed, job_already_enqueued, no_handler_for_queue, expired_locks_recovered, queue_batch_processed; (2) getQueueStats—pending, processing, completed, dead counts; (3) getDeadLetterJobs for manual inspection; (4) job_queue table—status distribution, age of pending jobs. We don’t have built-in metrics (e.g. processing latency, throughput) in this module. Tests: unit tests for enqueue (idempotency), processQueue (handler success/failure); integration with test DB if present.

**Simple (like for a 10-year-old):** We know it’s working when we see logs like “job enqueued,” “job completed,” “job failed,” “locks recovered.” We can look at queue stats (how many pending, completed, dead) and the dead-letter list. We don’t have a single “queue health” number. We have tests that check enqueue and process behavior.

### 21. What does it depend on to do its job?

**Technical:** The queue depends on: (1) DB (job_queue table, recover_expired_job_locks function)—query from db/client; (2) logger; (3) handlers registered at runtime (queueProcessor registers calendar_sync, ai_checklist, ai_dispute; handlers call calendarService.syncJobToCalendar, aiService.generateChecklist, aiService.generateDisputeSuggestion). It does not depend on env vars in queue.ts. queueProcessor depends on pool (db/client) for graceful shutdown.

**Simple (like for a 10-year-old):** It needs the database (the job_queue table and the “recover locks” function) and the logger. It needs the handlers to be registered—the queue processor registers the calendar and AI handlers, which in turn use the calendar and AI services. It doesn’t need any special config in the queue code itself.

### 22. What are the main config or env vars that control its behavior?

**Technical:** There are no env vars in src/lib/queue.ts. Behavior is controlled by: (1) QUEUE_NAMES (code constant); (2) default maxAttempts (3), priority (0), batchSize (10) in code; (3) POLL_INTERVAL_MS (5000) in queueProcessor; (4) LOCK_TIMEOUT_MINUTES (30) in lockRecovery; (5) cleanupOldJobs default 7 days. DB schema (job_queue, indexes, recover_expired_job_locks) is from migrations. To change poll interval or lock timeout we change code or pass options (recoverExpiredLocks(lockTimeoutMinutes)).

**Simple (like for a 10-year-old):** There’s no config or env for the queue lib. How it behaves is set in code: queue names, default retries (3), batch size (10), poll interval (5 seconds), lock timeout (30 minutes), cleanup age (7 days). The database schema is from migrations. To change “how often we look” or “how long before we consider a lock expired” we change the code or pass options.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit/integration tests: enqueue with and without idempotency key (duplicate key returns existing id); processQueue with mock handler (success marks completed, throw marks failed/dead); recoverExpiredLocks (stuck jobs reset to pending). We mock DB or use test DB. We don’t have an E2E “real calendar sync via queue” in CI unless we have that suite. Concurrency (two workers claiming same job) is ensured by FOR UPDATE SKIP LOCKED; we could add a test that runs two processQueue in parallel and asserts no double-completion.

**Simple (like for a 10-year-old):** We have tests that check: enqueue with the same idempotency key returns the same job id; process runs the handler and marks the job completed or failed; lock recovery puts stuck jobs back. We use a test database or mocks. We don’t run a full “real calendar sync through the queue” test unless we have one. The lock (FOR UPDATE SKIP LOCKED) is what stops two workers from taking the same job—we could test that with two processes.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If handler fails: we retry up to max_attempts (scheduled_at backoff), then move to dead; admin can retryDeadLetterJob(jobId) to re-queue. If worker crashes: run recoverExpiredLocks (scheduler or manual); jobs stuck in processing are set back to pending. If DB is down: enqueue/process throw; fix DB and retry (enqueue is best-effort by caller; worker loop will retry on next poll). If dead letter grows: investigate error_message and payload; fix cause (e.g. fix handler or data); retryDeadLetterJob or fix and re-enqueue. If queue depth grows: scale workers or fix slow handlers; consider rate limiting enqueue. We don’t have auto “retry all dead letter” or “alert on depth.”

**Simple (like for a 10-year-old):** If a job fails we retry it a few times then put it in dead letter; an admin can “retry” a dead-letter job. If the worker crashed we run lock recovery so stuck jobs go back to pending. If the database was down we fix it and the worker will try again on the next poll. If the dead-letter pile is big we look at the errors and fix the cause, then retry those jobs. If the queue is piling up we run more workers or fix slow handlers. We don’t have an automatic “retry everything” or “alert when queue is big.”

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders (who cares that it accomplishes its goal)?

**Technical:** Stakeholders: product and engineering (calendar sync and AI features depend on the queue); users (they expect sync and AI to complete); support (when “sync didn’t happen” or “AI didn’t run” we look at queue and dead letter); ops (run worker, lock recovery, cleanup). Admins care about dead letter and queue depth for debugging.

**Simple (like for a 10-year-old):** People who care: the team that built calendar and AI (the queue is how that work gets done), users who expect that work to finish, support when something didn’t run, and ops who run the worker and recovery. Admins care about the dead-letter pile and how full the queue is.

### 26. What are the security or privacy considerations for what it does?

**Technical:** Job payloads are stored in job_queue.payload (JSONB); they may contain PII (e.g. userId, jobId, event descriptions). Access to job_queue should be restricted (same as app DB). Only backend code enqueues—no client-provided queue name or payload without validation; enqueue is in-process from services. Handlers run with app privileges; if a handler calls an external API, secrets are from env. We don’t sign or encrypt payloads; treat job_queue as internal. Dead letter may hold sensitive error messages—restrict getDeadLetterJobs to admins.

**Simple (like for a 10-year-old):** Job data can include user ids and job info—we store it in the database so only people with DB access should see it. Only our backend adds jobs—users don’t put stuff in the queue directly. Handlers run as the app; any secrets they need come from config. We don’t encrypt the job data in the table. Dead-letter jobs might have sensitive errors—only admins should look at them.

### 27. What are the limits or scaling considerations for what it does?

**Technical:** job_queue is one table; under high enqueue rate it grows (cleanupOldJobs deletes completed/failed after 7 days by default). processQueue does one UPDATE...RETURNING per batch per queue; polling every 5s means at most ~2 batch runs per queue per 5s—throughput is bounded by batchSize and poll interval. Multiple processor instances can run (FOR UPDATE SKIP LOCKED); no single point of contention. Handlers are synchronous (await handler); slow handler blocks that worker for that batch. No max queue depth; we don’t backpressure enqueue. Payload size is JSONB—very large payloads could slow DB.

**Simple (like for a 10-year-old):** The table can get big if we enqueue a lot and don’t run cleanup. We only grab 10 jobs per queue every 5 seconds so there’s a limit to how fast we process. We can run more than one worker to go faster. If a handler is slow it holds that worker until it’s done. We don’t refuse to add jobs when the queue is full. Really big job data could slow the database.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** We’d add metrics (queue depth, processing latency, dead-letter count) and alerts (dead letter > N, pending > N). We’d schedule cleanupOldJobs (e.g. daily) and optionally recoverExpiredLocks from the same scheduler. We’d register handlers for all QUEUE_NAMES in use or remove unused names. We’d consider payload schema validation at enqueue or in the handler. We’d document which worker processes which queue (queueProcessor vs others). We’d consider a separate “queue dashboard” or admin endpoint for stats and retry dead letter.

**Simple (like for a 10-year-old):** We’d add numbers and alerts (how big is the queue, how many dead, how long do jobs take). We’d run “delete old jobs” and “recover locks” on a schedule. We’d make sure every queue name we use has a handler (or remove unused names). We’d validate job data when we add it. We’d write down which worker does which queue. We’d maybe add an admin page to see queue stats and retry dead-letter jobs.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Per job: (1) Created—enqueue INSERT, status=pending, scheduled_at=now (or options.scheduledAt). (2) Claimed—processQueue UPDATE status=processing, locked_by, locked_at, attempts+1. (3) Finished—handler success: status=completed, completed_at, locked_by=NULL; handler failure: status=pending (retry) or dead (dead_letter_*), locked_by=NULL. (4) Optional retry—pending job claimed again, attempts incremented. (5) Optional recovery—stuck processing job reset to pending by recoverExpiredLocks. (6) Optional cleanup—completed/failed rows deleted by cleanupOldJobs(days). No TTL on pending jobs—they stay until processed or manually removed.

**Simple (like for a 10-year-old):** For each job: we create it (pending, “run now” or “run at this time”). A worker claims it (processing, locked). When the handler finishes we mark it completed or failed (and retry later or dead letter). If the worker died we recover it back to pending. We can delete old completed/failed jobs after a while. Pending jobs don’t expire by themselves—they sit until a worker takes them or we delete them.

### 30. What state does it keep or track?

**Technical:** Persistent state: job_queue (id, queue_name, payload, status, priority, attempts, max_attempts, scheduled_at, started_at, completed_at, error_message, idempotency_key, locked_by, locked_at, dead_letter_reason, dead_letter_at, created_at). In-memory: queueService.handlers (Map of queueName → handler). No Redis or external state. Status values: pending, processing, completed, failed, dead. We don’t store “who enqueued” or “request id” unless the payload includes it.

**Simple (like for a 10-year-old):** We keep everything in the job_queue table: what queue, the job data, status, priority, retries, when to run, when it started/finished, error message, idempotency key, who’s working on it (locked_by), and dead-letter info. In memory we only keep the list of handlers per queue. We don’t use Redis or another store. We don’t store “who asked for this job” unless the job data says so.

### 31. What assumptions does it make to do its job?

**Technical:** We assume: (1) DB is available and job_queue schema is correct (migrations applied); (2) handlers are registered before processQueue runs (queueProcessor registers at startup); (3) handlers are idempotent or tolerate retries (we may run the same logical job twice if recovery or duplicate enqueue); (4) payload is JSON-serializable and handler expects the shape we pass; (5) clock is roughly correct (scheduled_at, locked_at, recoverExpiredLocks). We don’t assume: exactly-once delivery; or that handlers never throw (we catch and retry/dead letter).

**Simple (like for a 10-year-old):** We assume the database is there and the table has the right columns. We assume handlers are registered when the worker starts. We assume handlers can be run more than once (retries, recovery). We assume the job data is something we can store as JSON and the handler knows what to do with it. We assume the server clock is roughly right. We don’t assume jobs run exactly once or that handlers never fail.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use the queue for: work that must complete before the HTTP response (use synchronous call); or very high throughput that would overwhelm the DB (consider Redis or SQS). Use something else when: you need cron-style “run every day at 3am” (use scheduler + enqueue with scheduledAt or a scheduled worker); or you need cross-service messaging (queue is in-process enqueue, same DB). Don’t enqueue without idempotency key when duplicate enqueue would cause duplicate side effects (e.g. same calendar sync twice).

**Simple (like for a 10-year-old):** Don’t use the queue when the user has to wait for the result—do it right away. Don’t use it when you’d be adding millions of jobs and the database can’t handle it—use a different queue system. Use a “scheduler” when you want “run every day at 3am” and then add a job. Use the queue when you’re okay doing the work in the background. If doing the same job twice would be bad, pass an idempotency key.

### 33. How does it interact with other systems or features?

**Technical:** The queue is used by: calendarService (enqueue CALENDAR_SYNC), aiService (enqueue AI_CHECKLIST, AI_DISPUTE). The queueProcessor runs handlers that call syncJobToCalendar, generateChecklist, generateDisputeSuggestion—so the queue depends on those services. It uses db/client and logger. Lock recovery (lockRecovery.ts) calls queueService.recoverExpiredLocks and may be invoked by scheduler. Other workers (subscriptionJobs, webhookRetry, retryFailedNotifications) are separate processes; they may or may not use job_queue for their own queue names (WEEKLY_REPORT, SUBSCRIPTION_JOB, NOTIFICATION, WEBHOOK_RETRY). Idempotency in the queue (idempotency_key) is per-queue and prevents duplicate enqueue; see FOUNDER_IDEMPOTENCY.md for API idempotency.

**Simple (like for a 10-year-old):** The calendar and AI services add jobs to the queue. The queue processor runs handlers that call those same services to do the work. The queue uses the database and the logger. Lock recovery uses the queue service to fix stuck jobs and might be run by a scheduler. Other workers (subscriptions, webhooks, notifications) are separate; they might use the same table for their job types or their own. The queue’s “idempotency key” stops duplicate jobs in the queue; “idempotency” for API requests is a different thing (see the idempotency doc).

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure can mean: (1) enqueue failed—INSERT or SELECT threw; we throw to caller (no silent fail). (2) Handler threw—we catch, UPDATE job (failed/dead), log job_failed with error and willRetry/isDeadLetter; we don’t rethrow (processQueue continues with next job). (3) No handler—we log no_handler_for_queue and return { processed: 0, succeeded: 0, failed: 0 }. (4) recoverExpiredLocks failed—query throws; lockRecovery logs and rethrows. We don’t signal “queue failure” to end users—enqueue is backend; if the handler sends a notification or updates state, that’s the handler’s contract.

**Simple (like for a 10-year-old):** Failure means: we couldn’t add the job (we throw to the caller). Or the handler failed—we mark the job failed or dead, log it, and go to the next job (we don’t crash the worker). Or there was no handler for that queue—we log and process zero jobs. Or lock recovery failed—we log and throw. We don’t tell the user “queue failed”—the user might just not see the result (e.g. sync didn’t happen) and we’d debug with the queue and logs.

### 35. How do we know its outputs are correct or complete?

**Technical:** Correctness: we trust that the handler ran and did its work (we don’t verify calendar event was created or AI result stored). Completeness: we can check getQueueStats (pending should drain over time if workers run; dead letter should be small). We can audit job_queue for jobs stuck in pending (scheduled_at in past) or processing (locked_at old). We don’t have an automated “every enqueued job eventually completed or dead” check; we rely on monitoring and manual inspection.

**Simple (like for a 10-year-old):** We trust that when we mark a job “completed” the handler really did its work—we don’t double-check the calendar or the AI result. To see if we’re keeping up we look at queue stats (pending should go down when workers run; dead letter shouldn’t grow too much). We can look for jobs that are stuck (pending but way past their run time, or “in progress” for too long). We don’t have an automatic “every job finished one way or another” check.

### 36. Who owns or maintains it?

**Technical:** Ownership is not formally assigned. Typically the backend or platform team owns the queue lib and the queueProcessor worker. calendarService and aiService own their use of enqueue. Lock recovery and cleanup may be owned by ops or the same team. Changes to QUEUE_NAMES, schema (job_queue), or handler contract should be documented and coordinated (new queue name → register handler; schema change → migration).

**Simple (like for a 10-year-old):** The team that owns the backend (or platform) usually owns the queue code and the queue worker. The calendar and AI teams own how they use the queue. Ops or the same team might own “recover locks” and “cleanup old jobs.” When we add a new queue name or change the table we should write it down and make sure a handler is registered.

### 37. How might it need to change as the product or business grows?

**Technical:** We may need: (1) metrics and alerts (depth, latency, dead letter); (2) scheduled cleanup and lock recovery; (3) handlers for all used QUEUE_NAMES or deprecate unused; (4) payload schema validation or versioning; (5) priority or rate limiting (e.g. don’t process more than N per minute per queue); (6) separate queue broker (Redis/SQS) if DB becomes bottleneck; (7) admin UI for stats and retry dead letter; (8) document which worker processes which queue and how to add a new queue. As we add features that need background work we’d add queue names and handlers.

**Simple (like for a 10-year-old):** As we grow we might add dashboards and alerts, run cleanup and lock recovery on a schedule, and make sure every queue we use has a handler. We might validate job data or add rate limits. If the database can’t keep up we might use a different queue system. We might build an admin page for queue stats and retrying dead jobs. We’d write down how to add a new kind of job and which worker does it. New features that need “do it later” would get new queue names and handlers.

---

## Additional questions (A)

### A1. What does it cost to run?

**Technical:** Cost: DB storage and writes for job_queue (one row per job; growth depends on enqueue rate and cleanup). One INSERT per enqueue; one UPDATE (claim) + one UPDATE (complete/fail) per job processed. Lock recovery does one UPDATE per run. No separate queue broker; we use the app DB. Under high load the table and index size grow; cleanupOldJobs limits growth. CPU is in handlers (calendar sync, AI) not in queue.ts itself.

**Simple (like for a 10-year-old):** We pay for database space and for each “add job” and “mark job done” write. We use the same database as the app—we don’t pay for another queue service. If we add lots of jobs the table gets bigger; we have a cleanup that deletes old finished jobs. The real work (calendar, AI) uses CPU in those services, not in the queue code itself.

### A10. Can we run it twice safely (idempotency)? What happens if we replay or retry?

**Technical:** Enqueue with the same idempotency key is idempotent—we return the existing job id and don’t insert a second row. processQueue is safe to run repeatedly—FOR UPDATE SKIP LOCKED ensures each job is claimed by one worker; if we run processQueue again we get the next batch. Handlers should be idempotent (e.g. syncJobToCalendar “create or update” the same event) because we may run the same job twice after recovery or if we retry a dead-letter job. Replaying “recoverExpiredLocks” is idempotent (we only reset jobs that are still stuck).

**Simple (like for a 10-year-old):** Adding the same job twice with the same idempotency key is safe—we just return the same job id. Running the processor again is safe—we only take jobs that aren’t locked. Handlers should be written so running them twice (e.g. after recovery or retry) doesn’t break anything—e.g. “create or update” not “always create.” Running “recover locks” again is safe—we only fix jobs that are still stuck.

### A11. When a dependency (DB, API, queue) fails, what does this thing do?

**Technical:** If DB fails on enqueue: we throw; caller gets the error (they may retry). If DB fails on processQueue: query throws; worker loop catches in processAllQueues and logs queue_processing_error; next poll will retry. If DB fails on recoverExpiredLocks: lockRecovery throws and logs. Handlers that call external APIs (e.g. calendar provider, AI API) can throw; we catch, mark job failed/dead, and continue. We don’t retry DB in queue.ts; caller or worker loop retries. Pool shutdown (SIGTERM) in queueProcessor ends the process after current batch (we don’t drain in-flight jobs).

**Simple (like for a 10-year-old):** If the database is down when we add a job we throw and the caller sees the error. If the database is down when we’re processing we log the error and the worker will try again in 5 seconds. If the database is down during lock recovery we throw and log. If a handler calls an external API and it fails we mark the job failed or dead and go on. We don’t retry the database inside the queue code—whoever called us can retry. When we shut down the worker we don’t wait for in-flight jobs to finish—we just exit.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Only backend code can call enqueue (no public API that enqueues arbitrary jobs). processQueue is invoked by the queueProcessor worker (run by ops/scheduler). recoverExpiredLocks, getDeadLetterJobs, retryDeadLetterJob, cleanupOldJobs are backend/admin—no route exposes them unless we add an admin API. Configuration (QUEUE_NAMES, batchSize, POLL_INTERVAL_MS, LOCK_TIMEOUT_MINUTES) is in code; changing it requires deploy. DB schema is changed via migrations (ops/engineers). Handlers are registered in queueProcessor (engineers).

**Simple (like for a 10-year-old):** Only our backend can add jobs—there’s no website button that “adds a job” directly. The queue worker is run by ops or a scheduler. Recovering locks, looking at dead letter, retrying a job, and cleaning up old jobs are admin/backend actions—we might add an admin page for that. To change queue names, batch size, or poll interval we change the code and deploy. Only engineers and ops can change the database or the worker.

---

**Last updated:** 2026-01-31  
**See also:** `FOUNDER_REFERENCE_CANDIDATES.md`, `FOUNDER_IDEMPOTENCY.md`, `src/workers/WORKER_STATUS.md`, `DB/migrations/038_worker_hardening.sql`.
