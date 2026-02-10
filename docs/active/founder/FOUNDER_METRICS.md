# Founder Reference: Metrics

**Candidate:** Metrics (Module #27)  
**Where it lives:** `src/lib/metrics.ts` (recordMetric, incrementCounter, recordTiming, metrics helpers)  
**Why document:** What we measure, where we send it (Sentry, etc.), and how to add new metrics.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Metrics in PureTask are numeric measurements we record (counts, durations, values) so we can monitor the app. Implemented in `src/lib/metrics.ts`: `recordMetric(name, value, tags)` writes a metric with name, value, and optional tags; `incrementCounter(name, tags)` is recordMetric(name, 1, tags); `recordTiming(name, durationMs, tags)` is recordMetric with unit "ms". **Current backend:** We log metrics via logger.info("metric", { name, value, tags, timestamp })—we don't send to a metrics service (Datadog, Prometheus) yet; the comment says "In production, this would send to a metrics service." **Helpers:** metrics.apiRequest(method, path, statusCode, durationMs), metrics.dbQuery(operation, durationMs, success), metrics.jobCreated(jobId), metrics.jobCompleted(jobId, durationHours), metrics.paymentProcessed(amountCents, success), metrics.payoutProcessed(amountCents, success), metrics.errorOccurred(errorCode, path). So we have a single API (recordMetric, incrementCounter, recordTiming) and convenience helpers; today the output is logs, and we can later plug in a real metrics backend.

**Simple (like for a 10-year-old):** Metrics are numbers we track—how many requests, how long something took, how many jobs we created, etc. We have a small library that lets us "record a number" or "add one to a counter" or "record how long something took." Right now we just write those numbers into our logs; later we could send them to a dashboard (like Datadog or Prometheus). We have shortcuts for "API request," "database query," "job created," "payment processed," and "error" so we don't have to type the same thing every time.

### 2. Where it is used

**Technical:** `src/lib/metrics.ts` defines recordMetric, incrementCounter, recordTiming, and the metrics object. Callers: any code that imports metrics or recordMetric/incrementCounter/recordTiming and calls them—e.g. middleware for apiRequest, DB layer for dbQuery, job service for jobCreated/jobCompleted, payment/payout code for paymentProcessed/payoutProcessed, error handler for errorOccurred. Grep for "metrics\." or "recordMetric\|incrementCounter\|recordTiming" to find usage; not every flow may be instrumented yet. No Sentry or external backend in metrics.ts; logger only.

**Simple (like for a 10-year-old):** The code lives in metrics.ts. Any part of the app that wants to record a number can import it and call recordMetric, incrementCounter, or recordTiming, or use the helpers (apiRequest, dbQuery, jobCreated, etc.). We'd have to search the codebase to see where we actually call it. Right now we only send to the logger, not to a separate metrics service.

### 3. When we use it

**Technical:** We use it whenever we want to record a count, duration, or value—e.g. after an API request (middleware), after a DB query, when a job is created or completed, when a payment or payout is processed, when an error occurs. Triggers: request completion (apiRequest), query completion (dbQuery), business events (job created, job completed, payment, payout, error). No cron; purely event-driven (we record when the thing happens).

**Simple (like for a 10-year-old):** We use it when something happens that we want to count or time—after a request finishes, after a database call, when a job is created or done, when we process a payment or payout, or when an error happens. We don't run metrics on a schedule—we record when the event happens.

### 4. How it is used

**Technical:** recordMetric(name, value, tags): logger.info("metric", { name, value, tags, timestamp: ISO }). incrementCounter(name, tags): recordMetric(name, 1, tags). recordTiming(name, durationMs, tags): recordMetric(name, durationMs, { ...tags, unit: "ms" }). Helpers: apiRequest → recordTiming("api.request.duration", durationMs, { method, path, status, statusClass }) and incrementCounter("api.request.count", { method, path, status }); dbQuery → recordTiming and incrementCounter for db.query.duration and db.query.count; jobCreated → incrementCounter("job.created", { jobId }); jobCompleted → incrementCounter and recordMetric for job.completed and job.duration; paymentProcessed/payoutProcessed → incrementCounter and recordMetric; errorOccurred → incrementCounter("error.count", { code, path }). Tags are optional key-value (string | number | boolean).

**Simple (like for a 10-year-old):** To record a number we call recordMetric with a name, value, and optional tags. To add one to a counter we call incrementCounter. To record how long something took we call recordTiming. The helpers do the same but with fixed names and tags (e.g. apiRequest records "api.request.duration" and "api.request.count" with method, path, status). Everything goes to the logger as a "metric" log line with a timestamp.

### 5. How we use it (practical)

**Technical:** Import metrics from "./lib/metrics" (or recordMetric, incrementCounter, recordTiming). Call metrics.apiRequest in request middleware (method, path, statusCode, durationMs); call metrics.dbQuery in DB layer if we wrap queries; call metrics.jobCreated/jobCompleted in job flow; call metrics.paymentProcessed/payoutProcessed in payment/payout flow; call metrics.errorOccurred in error handler. Logs appear as logger.info("metric", ...); we can grep or ship logs to a log aggregator and query. To add a metrics backend: change recordMetric to also send to Datadog/Prometheus/etc. (or add a second call). No env vars in metrics.ts.

**Simple (like for a 10-year-old):** In practice we import the metrics module and call the helpers where things happen (after a request, after a DB call, when a job is created, etc.). The numbers show up in our logs. We can search the logs or send them to a log tool to graph. To send to a real metrics dashboard we'd add code in recordMetric to also send to that service. We don't have any env vars for metrics yet.

### 6. Why we use it vs other methods

**Technical:** We want one place to record "how many" and "how long" so we can add a real metrics backend later without changing every caller. Alternatives: only logs with no structure (hard to aggregate); inline Sentry or Datadog calls everywhere (coupling). We chose: a thin metrics API that logs today and can be extended to send to a backend; helpers so common cases are one-liners. Logs are structured (name, value, tags) so we can parse and aggregate if we ship logs.

**Simple (like for a 10-year-old):** We use it so we have one way to say "record this number" and "record this duration." Right now we only log, but later we can add "and also send to Datadog" in one place instead of changing every file. We have helpers so the usual things (API request, DB query, job, payment, error) are easy. The logs are in a fixed shape so we can turn them into graphs if we want.

### 7. Best practices

**Technical:** Use consistent names (e.g. api.request.duration, not api_duration). Use tags for dimensions (method, path, status) so we can filter and group. Don't put high-cardinality values (e.g. full jobId) in every metric if we send to a backend later—or use sampling. Call recordTiming with duration in ms. Helpers already use sensible names and tags. Gaps: we don't actually send to a metrics service yet; we don't have a middleware that auto-calls apiRequest on every request (caller must add); not every flow may call metrics; no rate limiting on metric volume (if we log every request we might log a lot).

**Simple (like for a 10-year-old):** We use the same kind of names (e.g. api.request.duration) and add tags like method and path so we can slice later. We don't want to put something that changes every time (like every job id) in a way that would create millions of series. We record time in milliseconds. What we could do better: we're not sending to a dashboard yet; we might not be calling apiRequest on every request automatically; and we might be logging a lot if we log every request.

### 8. Other relevant info

**Technical:** Sentry (FOUNDER_SENTRY) does error and performance capture separately; metrics.ts is for our own counters and timings. We could send metrics to Sentry as custom metrics or use a dedicated backend. Logger is from ./logger. Document any new metric names or tags in a short doc or DECISIONS.md so we don't duplicate or confuse. If we add a backend (Datadog, Prometheus), we'd add it in recordMetric and possibly batch or sample to control cost.

**Simple (like for a 10-year-old):** Sentry does errors and performance; metrics.ts is for our own numbers (counts, durations). We could send these to Sentry too or to another dashboard. We use our normal logger. If we add new metric names we should write them down. When we add a real metrics service we'd plug it into recordMetric and maybe batch or sample so we don't send too much.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Give us a single API to record counts, durations, and values so we can monitor the app (request volume, latency, job creation, payments, errors). Today: structured logs we can grep or ship. Later: feed a metrics backend for dashboards and alerts. Success means: callers use recordMetric/incrementCounter/recordTiming or helpers; we have consistent names and tags; we can add a backend without changing every caller.

**Simple (like for a 10-year-old):** It's supposed to let us record "how many" and "how long" in one place so we can see how the app is doing. Right now that means logs we can search; later we could send to a dashboard. Success is: we use it where we care (requests, DB, jobs, payments, errors), we use the same names and tags, and we can plug in a real metrics service later without rewriting everything.

### 10. What does "done" or "success" look like for it?

**Technical:** Done per call: recordMetric/incrementCounter/recordTiming ran and logger.info("metric", ...) was called. Observable: log lines with name, value, tags, timestamp. Success: we see metric log lines in our logs; if we add a backend we'd see series in that backend. No built-in dashboard in the app.

**Simple (like for a 10-year-old):** Success is we called the metrics function and a log line was written (or later, sent to a dashboard). We can see success by looking at the logs (or the dashboard when we have one).

### 11. What would happen if we didn't have it?

**Technical:** We'd have no structured "metric" events—only ad-hoc logs. Adding a metrics backend would require finding every place we care about and adding calls to that backend. We'd have no single convention for names and tags. Dashboards and alerts would be harder to build.

**Simple (like for a 10-year-old):** Without it we'd only have random logs and no single way to say "record this number." When we want a dashboard we'd have to add "send to Datadog" (or whatever) in lots of places. We wouldn't have a consistent way to name and tag metrics.

### 12. What is it not responsible for?

**Technical:** Metrics is not responsible for: error capture (Sentry); app logs (logger for non-metric logs); tracing (request id, spans)—that's request context and Sentry; business logic. It only records numbers we pass it. It doesn't decide what to measure; callers do. It doesn't store metrics long-term (logger or external backend does).

**Simple (like for a 10-year-old):** It doesn't catch errors (Sentry does). It doesn't do general logging. It doesn't do tracing. It doesn't decide what to measure—the code that calls it does. It just records the numbers we give it. It doesn't store them forever—the logger or a dashboard does.

---

## Inputs, outputs, and flow (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: name (string), value (number), optional tags (MetricTags). Helpers take method, path, statusCode, durationMs, operation, success, jobId, amountCents, errorCode. Output: logger.info("metric", { name, value, tags, timestamp }). No DB or external send today. Flow: caller calls recordMetric/incrementCounter/recordTiming or helper → logger.info. Rules: none enforced in code; convention is name + tags for dimensions.

**Simple (like for a 10-year-old):** We give it a name, a value, and optional tags. The helpers take things like method, path, status, duration. We get a log line. We don't write to the database or send anywhere else yet. The "rules" are just our convention (same names, sensible tags).

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, security, limits, lifecycle, state, assumptions, when not to use, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by caller (request done, query done, job created, payment done, error). Could go wrong: caller forgets to call; high volume = lots of log lines; no backend yet so no dashboards. Depends on logger. No env vars. Test: unit test recordMetric/incrementCounter/recordTiming and helpers (mock logger, assert log shape). Recovery: N/A (no state). Stakeholders: engineers and ops for monitoring. Security: don't put PII in tags (e.g. no email in tags). Limits: log volume if we metric every request. Lifecycle: no state; stateless recording. Assumptions: logger is available; names/tags are consistent. When not to use: for tracing use request context/Sentry; for errors use Sentry. Interacts with logger; Sentry is separate. Failure: if logger fails we might not record. Correctness: we trust caller passes correct value/tags. Owner: platform or observability. Evolution: add backend in recordMetric; add middleware for apiRequest; add sampling; document metric names.

**Simple (like for a 10-year-old):** Something in the app calls metrics when an event happens. If we forget to call we don't get the number. If we call on every request we might log a lot. We depend on the logger. We don't have env vars. We can test by mocking the logger and checking we log the right thing. We don't store state. Engineers and ops care. We shouldn't put personal data in tags. If we metric everything we might have too many logs. Metrics don't remember anything. We assume the logger works and we use the same names. For tracing and errors we use other tools. Metrics only talk to the logger. If the logger fails we might lose the metric. The team that owns observability owns this. Later we'd add a real backend and maybe auto-record every request.

---

*End of Founder Reference: Metrics*
