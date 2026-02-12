# Founder Reference: Request Context

**Candidate:** Request context (Module #28)  
**Where it lives:** `src/middleware/requestContext.ts` (requestContextMiddleware, enrichRequestContext, getCurrentRequestId, getCurrentCorrelationId); `src/lib/logger.ts` (withRequestContext, getRequestContext, enrichContext, generateRequestId, AsyncLocalStorage requestContext)  
**Why document:** How we attach request ID and context to logs and errors for tracing.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Request context in PureTask is the way we attach a request id and optional correlation id (and later user/job ids) to every log line and make them available for the whole request without passing them through every function. **Logger (logger.ts):** We use Node AsyncLocalStorage to store a RequestContext (requestId, correlationId, userId?, jobId?, cleanerId?, clientId?, stripeEventId?, workerName?). withRequestContext(context, fn) runs fn inside that storage; getRequestContext() returns the current store; enrichContext(fields) merges fields into the store; generateRequestId() returns a unique id (req_{timestamp36}_{random}). The logger's log() reads requestContext.getStore() and adds requestId, correlationId, userId, jobId, etc. to every LogEntry so every log line has tracing fields. **Middleware (requestContext.ts):** requestContextMiddleware generates or reads x-request-id and x-correlation-id from headers, attaches them to req, sets them on the response, and runs the rest of the request inside withRequestContext({ requestId, correlationId }, next). enrichRequestContext(req) adds req.user.id to the context (call after auth) so logs include userId. getCurrentRequestId() and getCurrentCorrelationId() return the current ids for passing to external services or error reports.

**Simple (like for a 10-year-old):** Request context is "we give every request a unique id and remember it for the whole request" so that when we log something we automatically include that id (and later the user id, job id, etc.). That way we can search logs by "all lines for this request" or "all lines for this user." The middleware creates or reads the request id from the headers, puts it on the request and response, and runs the rest of the request inside a "context" so the logger can see it. After login we add the user id to the context so logs show who did what. We can also get the request id and correlation id to send to other systems (e.g. Sentry) for tracing.

### 2. Where it is used

**Technical:** `src/lib/logger.ts`: AsyncLocalStorage requestContext, withRequestContext, getRequestContext, enrichContext, generateRequestId; log() uses requestContext.getStore() and spreads ctx into LogEntry. `src/middleware/requestContext.ts`: requestContextMiddleware, enrichRequestContext, getCurrentRequestId, getCurrentCorrelationId. `src/index.ts`: app.use(requestContextMiddleware) early; after auth middleware we call enrichRequestContext(req) so userId is in context. Any code that logs (logger.info, etc.) gets requestId and correlationId (and userId if enrichRequestContext was called) automatically. Code that needs to pass request id to Sentry or another service can call getCurrentRequestId() or getCurrentCorrelationId().

**Simple (like for a 10-year-old):** The code lives in the logger (where we store and read the context) and in the request context middleware (where we set the ids and run the request inside the context). The main app uses the middleware early and calls enrichRequestContext after auth. Everywhere we log we get the request id and correlation id (and user id if we're logged in) without doing anything. If we need to send the request id to Sentry or another service we call getCurrentRequestId() or getCurrentCorrelationId().

### 3. When we use it

**Technical:** We use it on every HTTP request: requestContextMiddleware runs first (or early in the stack), so every request gets a request id and correlation id and runs inside withRequestContext. After auth runs we call enrichRequestContext(req) so the context has userId. Every log call (logger.info, logger.error, etc.) then includes requestId, correlationId, userId (and any jobId/cleanerId/clientId if we enrich them). We use getCurrentRequestId/getCurrentCorrelationId when we need to pass ids to an external system (e.g. Sentry.setTag("request_id", getCurrentRequestId())). Workers or non-request code can call withRequestContext({ requestId: generateRequestId(), workerName: "payout" }, fn) so their logs also have a request-like id and worker name.

**Simple (like for a 10-year-old):** We use it on every request: the middleware runs and gives the request an id and runs everything inside the "context." After we know who's logged in we add their user id to the context. So every log line for that request has the request id and user id. We use getCurrentRequestId when we need to send that id somewhere else (e.g. Sentry). For background jobs we can create a context with a generated id and worker name so their logs are traceable too.

### 4. How it is used

**Technical:** **Middleware:** Read x-request-id and x-correlation-id from headers (or generate requestId, use it as correlationId). Set req.requestId, req.correlationId. Set response headers x-request-id, x-correlation-id. Call withRequestContext({ requestId, correlationId }, () => { res.on("finish", ...); next(); }). **enrichRequestContext:** get req.user; if user, enrichContext({ userId: user.id }). **Logger:** log(level, msg, meta) does ctx = requestContext.getStore(); entry = { ...meta, requestId: ctx?.requestId, correlationId: ctx?.correlationId, userId: ctx?.userId, ... }; so every log line gets those fields. **getCurrentRequestId / getCurrentCorrelationId:** return getRequestContext()?.requestId and getRequestContext()?.correlationId. **Worker:** withRequestContext({ requestId: generateRequestId(), workerName: "payout" }, () => { ... }).

**Simple (like for a 10-year-old):** The middleware reads or creates the request id and correlation id, puts them on the request and response, and runs the rest of the request inside a "context." When we enrich we add the user id to that context. When we log, the logger looks at the context and adds the request id, correlation id, and user id to every log line. We can read the current request id or correlation id with getCurrentRequestId() and getCurrentCorrelationId(). For workers we create a context with a new id and worker name so their logs are tagged.

### 5. How we use it (practical)

**Technical:** Ensure requestContextMiddleware is registered early (before routes that log). Call enrichRequestContext(req) after auth middleware so userId is in context. Use logger as usual—no need to pass requestId manually. To add jobId/cleanerId/clientId to context in a route, call enrichContext({ jobId, cleanerId, clientId }) so subsequent logs for that request include them. To pass request id to Sentry: Sentry.setTag("request_id", getCurrentRequestId()). For workers: wrap the worker loop or job handler in withRequestContext({ requestId: generateRequestId(), workerName: "payout" }, () => { ... }). No env vars required for request context itself.

**Simple (like for a 10-year-old):** We register the middleware early and call enrichRequestContext after auth. We log normally and the request id and user id show up automatically. If we want to tag logs with job id or cleaner id we call enrichContext with those. If we want to send the request id to Sentry we call getCurrentRequestId(). For background workers we wrap their code in withRequestContext with a new id and worker name. We don't need any env vars for this.

### 6. Why we use it vs other methods

**Technical:** Without request context we'd have to pass requestId (and userId, jobId) to every function that logs, or thread them through many layers. AsyncLocalStorage lets us set the context once (in middleware) and read it anywhere in the same async call stack without passing parameters. So the logger and any code that calls getRequestContext() see the same requestId and correlationId for the whole request. Alternatives: pass requestId in every log call (error-prone and verbose); use a global (doesn't work with concurrent requests). We chose AsyncLocalStorage so context is per-request and automatic. Correlation id lets us trace across services if we pass it in headers to other services.

**Simple (like for a 10-year-old):** We use it so we don't have to pass "request id" and "user id" to every function that logs. We set them once in the middleware and then the logger (and any code that asks) can see them for the whole request. If we didn't have this we'd have to pass the id through lots of functions or use a global variable (which breaks when many requests run at once). We use Node's AsyncLocalStorage so each request has its own context. The correlation id is for tracing across multiple services if we call them and pass it along.

### 7. Best practices

**Technical:** Register requestContextMiddleware before any middleware or route that logs. Call enrichRequestContext(req) after auth so userId is in context. Use getCurrentRequestId() when sending errors to Sentry so we can correlate. Don't mutate context from multiple async branches without care (AsyncLocalStorage is per "run"); within one request the context is stable. For workers always use withRequestContext so logs have a trace id and worker name. Gaps: we don't automatically set jobId/cleanerId/clientId in context—routes that have them can call enrichContext; we don't propagate correlation id to outbound HTTP calls (we could add a header in our HTTP client). x-request-id and x-correlation-id are set on response so clients can log them for support.

**Simple (like for a 10-year-old):** We put the middleware early and enrich after auth. We use getCurrentRequestId() when we send errors to Sentry. We don't change the context from multiple async paths in a weird way. For workers we always wrap in withRequestContext. We don't automatically add job id or cleaner id—the route can do that if it wants. We don't yet pass the correlation id to other services we call (we could add it as a header). We send the request id and correlation id back to the client in response headers so they can tell support "this request id."

### 8. Other relevant info

**Technical:** AsyncLocalStorage is Node built-in (async_hooks); it runs a function in a "store" that is visible to all synchronous and asynchronous code that runs from that function. So when we withRequestContext(..., next), everything that runs inside next() (including async route handlers and their awaits) sees the same store until the request finishes. The logger reads the store in log(); no need to pass context to logger explicitly. Sentry can use request_id tag for grouping; set it in error handler with getCurrentRequestId(). See FOUNDER_SENTRY for error reporting; see FOUNDER_LOGGER if we have a dedicated logger doc.

**Simple (like for a 10-year-old):** Node's AsyncLocalStorage lets us "run this request in a box" so that everything that runs as part of that request (including async code) sees the same request id and user id. The logger reads that box on every log. We can give Sentry the request id so errors are grouped. See the Sentry doc for how we report errors; the logger is what actually writes the log lines with the context.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: attach request id and correlation id (and optionally userId, jobId, etc.) to every log line and make them available without threading through every function. Success: every log has requestId and correlationId; userId in logs after auth; getCurrentRequestId/correlationId work. Without it we'd have no request-scoped tracing in logs. Not responsible for: generating the log message or level; auth (we only read req.user after auth); distributed tracing across services (we don't inject headers into outbound calls yet).

**Simple (like for a 10-year-old):** It's there so every log line has a request id (and user id, etc.) and we don't have to pass them everywhere. Success is we see request id and correlation id (and user id after login) in the logs and we can get them with getCurrentRequestId(). Without it we couldn't trace "all logs for this request." It doesn't write the log message or do auth—it just adds the ids to the logger and gives them to whoever asks.

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: HTTP request (headers x-request-id, x-correlation-id); after auth req.user. Outputs: requestId and correlationId on req and res headers; context in AsyncLocalStorage; every log entry includes context fields. Flow: middleware reads or generates ids → withRequestContext({ requestId, correlationId }, next) → next() runs → logger.log reads getStore() and adds to entry. enrichRequestContext adds userId; enrichContext adds any fields. Rules: middleware must run early; enrich after auth for userId.

**Simple (like for a 10-year-old):** We need the request (and optionally the user after auth). We put request id and correlation id on the request and response and in the "context" so the logger can see them. Every log line then gets those fields. We can add user id after auth and add other fields with enrichContext. The middleware has to run early and we have to call enrich after auth.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by every request (middleware) and by explicit enrichContext/getCurrentRequestId. No cron. Failure: if middleware not registered or runs after some code that logs, those logs won't have context. Depends on AsyncLocalStorage (Node), logger. No env for context. Test: mock request, run middleware, assert req.requestId and res headers; run withRequestContext and assert getRequestContext(). Stakeholders: engineers (debugging), support (request id from client). Lifecycle: per request (or per withRequestContext run). State: in AsyncLocalStorage. Assumptions: single-threaded Node; no context loss across await. When not to use: N/A—we want it on all requests. Interacts with logger (logger reads context), Sentry (we can set tag). Owner: platform. Evolution: propagate correlation id to outbound HTTP; add jobId/cleanerId/clientId in common middleware where available.

**Simple (like for a 10-year-old):** It runs on every request and when we call enrich or getCurrentRequestId. If we forget the middleware or put it too late, some logs won't have the id. We depend on Node's AsyncLocalStorage and the logger. We test by running the middleware and checking the request and response and getRequestContext(). Engineers and support care. The context lives for one request. We assume we're in Node and that the context doesn't get lost across async. We want it on all requests. The logger and Sentry use it. The platform team owns it. Later we might pass the correlation id to other services and add job/cleaner/client ids where we have them.

---

*End of Founder Reference: Request Context*
