# Founder Reference: Sentry (instrument + error handler)

**Candidate:** Sentry (instrument + error handler) (Module #30)  
**Where it lives:** `src/instrument.ts` (Sentry.init—only place), `src/index.ts` (require("./instrument") first; Sentry.setupExpressErrorHandler(app)); env SENTRY_DSN  
**Why document:** How errors and performance are sent to Sentry and why we init once in instrument.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Sentry in PureTask is the error and performance monitoring service we use so we see when the app crashes or misbehaves. **Initialization:** We call Sentry.init() exactly once, in `src/instrument.ts`, and we require that file first in index.ts (before any other imports). That lets Sentry instrument Node, Express, and HTTP so it can capture unhandled errors and performance traces. **Config:** We set dsn from env SENTRY_DSN, environment from NODE_ENV, integrations (nodeProfilingIntegration), tracesSampleRate (0.1 in prod, 1.0 in dev), profileSessionSampleRate (0.05 in prod, 1.0 in dev), sendDefaultPii: false so we don't send customer addresses or names to Sentry. **Error handler:** We call Sentry.setupExpressErrorHandler(app) after all routes so any error that reaches Express (e.g. from async route handlers) is captured and sent to Sentry; we don't call Sentry.captureException() again in our custom error handler to avoid double-capture. **Why instrument first:** If we init Sentry after other imports or multiple times, errors and traces can be missed or broken.

**Simple (like for a 10-year-old):** Sentry is our "error camera": when something goes wrong we send the error and some performance info to Sentry so we can fix it. We turn it on in one special file (instrument.ts) and we load that file first when the app starts—that way Sentry can see everything. We set it so we don't send personal data (names, addresses) to Sentry. We add an error handler at the end of the app so any error that bubbles up gets sent. If we turned Sentry on in the wrong place or twice, we might miss errors or break performance tracking.

### 2. Where it is used

**Technical:** `src/instrument.ts`: Sentry.init() when env.SENTRY_DSN is set; export Sentry. `src/index.ts`: first line require("./instrument"); then import * as Sentry from "@sentry/node" (for setupExpressErrorHandler only—do not call Sentry.init() here); after all routes Sentry.setupExpressErrorHandler(app); in custom error handler we don't call Sentry.captureException() again (Sentry already captured). No other file should call Sentry.init(). Other files can import Sentry and use Sentry.captureException(err) or Sentry.captureMessage() for manual capture if needed, but the main flow is automatic (unhandled errors and Express errors). Env: SENTRY_DSN in config/env.

**Simple (like for a 10-year-old):** We use it in two places: instrument.ts (where we turn Sentry on once) and index.ts (where we load instrument first and then add the error handler at the end). We get the Sentry address (DSN) from the environment. Nobody else should call "init" or we might break it. Other code can send extra errors or messages to Sentry if they want, but usually Sentry catches errors automatically.

### 3. When we use it

**Technical:** We use it at process start: require("./instrument") runs before any other app code so Sentry is ready. We use it on every unhandled error: Sentry's global handlers and Express error handler capture and send. We use it on a sample of requests for performance: tracesSampleRate 0.1 in prod (10%) so we get transaction traces; profileSessionSampleRate 0.05 in prod (5%) for profiling. Triggers: app startup (init); any thrown error or rejected promise that reaches Express (setupExpressErrorHandler); any uncaught exception or unhandled rejection (Sentry's process handlers if enabled by init).

**Simple (like for a 10-year-old):** We use it when the app starts (we load instrument first). We use it whenever something goes wrong and the error isn't caught—Sentry sends it. We also send a sample of "how long did this request take" (10% in prod) and a small sample of profiling (5%) so we don't overload Sentry. So: startup, errors, and a bit of performance data.

### 4. How it is used

**Technical:** **Init (instrument.ts):** if (env.SENTRY_DSN) { Sentry.init({ dsn, environment, integrations: [nodeProfilingIntegration()], enableLogs: true, tracesSampleRate, profileSessionSampleRate, profileLifecycle: "trace", sendDefaultPii: false }); } then export Sentry. **index.ts:** require("./instrument"); ... app setup and routes ... Sentry.setupExpressErrorHandler(app); then custom error middleware that returns JSON (and does not call Sentry.captureException again). **Automatic capture:** Sentry SDK hooks into Node and Express so unhandled errors and async rejections get captured; setupExpressErrorHandler catches errors passed to next(err). **Manual:** Sentry.captureException(error) or Sentry.captureMessage(msg) in try/catch if we want to report and rethrow or continue.

**Simple (like for a 10-year-old):** In instrument we check if we have a Sentry address (DSN); if yes we call Sentry.init with our settings (no PII, 10% traces in prod, 5% profiling). In index we load instrument first, then set up the app, then add Sentry's error handler. After that, any error that isn't caught gets sent to Sentry automatically. We can also send an error ourselves with Sentry.captureException if we catch it but still want to report it.

### 5. How we use it (practical)

**Technical:** Set SENTRY_DSN in env (e.g. .env or Railway); if not set Sentry is not initialized and we don't send anything. In prod use a real DSN from sentry.io; in dev we can use same or leave unset. Logs: index.ts logs "sentry_initialized" when SENTRY_DSN is set. To debug: check Sentry dashboard for errors and performance; add Sentry.captureMessage("debug") in code if needed (remove after). Never call Sentry.init() outside instrument.ts. If we add other entry points (e.g. worker), they should require instrument first or init Sentry once in their entry.

**Simple (like for a 10-year-old):** In practice we put the Sentry address (DSN) in our environment variables. If we don't set it, Sentry is off. In production we use a real Sentry project. We can look at the Sentry website to see errors and slow requests. We must never call "init" anywhere except instrument.ts. If we start another process (e.g. a worker) we should load instrument first there too.

### 6. Why we use it vs other methods

**Technical:** We need a place to see errors and performance in one dashboard; Sentry gives us that with minimal code (init once + error handler). Alternatives: only logs (hard to aggregate and alert); self-hosted (more ops); other SaaS (Datadog, Rollbar, etc.). We chose Sentry for errors and traces and profiling in one place, and we init in a single file so we never double-init or miss early errors. init first so SDK can patch Node/Express before any code runs.

**Simple (like for a 10-year-old):** We use it so we have one place to see "what broke" and "what's slow" instead of only reading log files. We could use something else (like Datadog) but Sentry does errors and performance together. We init in one file and load it first so we don't mess up and so we catch every error.

### 7. Best practices

**Technical:** Init exactly once, as early as possible (instrument.ts, required first). Don't call Sentry.init() in index.ts or anywhere else. sendDefaultPii: false in prod so we don't send user data. Use setupExpressErrorHandler after all routes so it catches everything. Don't call Sentry.captureException() in the same path that setupExpressErrorHandler already handles (double capture). For manual capture use Sentry.captureException(err) and optionally set context (Sentry.setUser, setTag). Sample rates: 10% traces and 5% profiling in prod keep volume and cost down. Gaps: no explicit "don't capture 4xx" filter—we could add beforeSend to ignore 404/400 if desired; no release/version in init unless we add it.

**Simple (like for a 10-year-old):** We init once and first. We never init again. We don't send personal data to Sentry. We add the error handler at the end so it catches everything. We don't send the same error twice. We only send 10% of traces and 5% of profiles in prod so we don't overload Sentry. We could add a filter to ignore "not found" type errors if we want.

### 8. Other relevant info

**Technical:** Sentry SDK: @sentry/node, @sentry/profiling-node (nodeProfilingIntegration). Errors and traces go to Sentry's servers; we don't store them in our DB. If SENTRY_DSN is unset we don't init and no data is sent. Document any change to sample rates or PII in DECISIONS.md. See FOUNDER_METRICS for our own metrics (logger-based); Sentry is separate (external service). Graceful shutdown (Sentry.flush()) could be added so we send pending events before exit.

**Simple (like for a 10-year-old):** We use the Sentry Node library. Data goes to Sentry's servers, not our database. If we don't set the DSN we don't send anything. If we change how much we send or what we send we should write it down. We have our own "metrics" in the app (logs); Sentry is a separate service. When we shut down we could tell Sentry "flush" so we don't lose the last few errors.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Capture unhandled and Express errors so we can fix them. Send performance traces (sample) so we see slow endpoints and DB calls. Send profiling (sample) for CPU insight. Give us one dashboard for errors and performance. Success means: when something throws we see it in Sentry with stack and context; we can set alerts; we see a sample of request performance; we don't send PII.

**Simple (like for a 10-year-old):** It's supposed to catch errors and send them to Sentry so we can fix them, and to send a bit of "how long did this take" so we can fix slow stuff. Success is: we see every important error in Sentry, we can get alerts, and we don't send people's personal data.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for init: Sentry.init() ran once, no error. Done for an error: error reached Sentry (check dashboard); we see stack, message, and (if set) context. Done for trace: transaction sent (sampled); we see duration and spans. No double-capture (same error once). Observable: Sentry project dashboard; logs "sentry_initialized" at startup.

**Simple (like for a 10-year-old):** Success is: Sentry turned on at startup, and when something breaks we see it in Sentry with the stack trace. We see a sample of slow requests. We don't see the same error twice. We can check the Sentry website and our startup logs.

### 11. What would happen if we didn't have it?

**Technical:** We'd only have logs for errors—harder to aggregate, search, and alert. We wouldn't have a single place for stack traces and context. We wouldn't have performance traces or profiling in Sentry. Debugging production issues would be slower (grep logs, no grouping by error type). We could use something else (Datadog, Rollbar) or only logs, but we'd lose the current workflow.

**Simple (like for a 10-year-old):** Without it we'd only have log files to look at when something breaks—no single place to see errors and no nice grouping. We wouldn't have Sentry's performance view. Fixing production bugs would be slower. We could use another tool or just logs, but we'd lose what we have now.

### 12. What is it not responsible for?

**Technical:** Sentry is not responsible for: fixing the bug (we fix code); storing logs (we have logger); business metrics (we have metrics.ts / logger); rate limiting or auth. It only captures and sends errors and performance data to Sentry's servers. It doesn't prevent errors or retry requests. Our custom error response (JSON body) is our responsibility; Sentry only captures and reports.

**Simple (like for a 10-year-old):** Sentry doesn't fix bugs—we do. It doesn't store our app logs—we have a logger. It doesn't do rate limiting or login. It only sends errors and performance info to Sentry. It doesn't prevent errors or retry. The message we show to the user when something breaks is our code; Sentry just reports it.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Env: SENTRY_DSN (required for init). NODE_ENV (for environment and sample rates). Init config: dsn, environment, integrations, tracesSampleRate, profileSessionSampleRate, sendDefaultPii. No DB or Redis. The app (Express, routes) produces errors and requests that Sentry instruments.

**Simple (like for a 10-year-old):** We need the Sentry address (DSN) in the environment and the "are we prod or dev" (NODE_ENV). We don't need the database or Redis. The app just runs and when something goes wrong or a request finishes Sentry gets the data.

### 14. What does it produce or change?

**Technical:** Produces: events sent to Sentry (errors, transactions, profiles). No change to our DB or response body (our error middleware still returns JSON). Sentry.setupExpressErrorHandler may call next(err) or end the response after capturing; our custom handler runs after and returns JSON. We don't change request/response except that errors are captured and sent.

**Simple (like for a 10-year-old):** It sends data to Sentry (errors and performance). It doesn't change our database or the JSON we send to the user. Our error handler still runs and returns a nice error message; Sentry just gets a copy of the error.

### 15. Who or what consumes its output?

**Technical:** Consumers: engineers and ops via Sentry dashboard (errors, performance, alerts). Sentry's servers store and display. No other system in our app consumes Sentry output; it's for humans. Alerts (if configured in Sentry) notify via email/Slack etc.

**Simple (like for a 10-year-old):** The people who fix bugs and run the app look at Sentry (the website). Sentry stores the data. Nothing else in our app reads Sentry. We can set up Sentry to send us an email or Slack when something breaks.

### 16. What are the main steps or flow it performs?

**Technical:** **Startup:** require("./instrument") → Sentry.init() if DSN set. **Request:** Sentry SDK creates transaction (if sampled), runs request, finishes transaction (duration, spans). **Error:** Error thrown or passed to next(err) → setupExpressErrorHandler catches → Sentry.captureException → send to Sentry → our handler returns JSON. **Uncaught:** process handlers (if enabled by init) capture uncaughtException / unhandledRejection and send. **Manual:** Sentry.captureException(err) or captureMessage(msg) in code.

**Simple (like for a 10-year-old):** At startup we load instrument and init Sentry. On each request Sentry may record how long it took (if we're in the sample). When an error happens Sentry catches it, sends it to their servers, and then our code returns an error message to the user. If something throws and nobody catches it Sentry can still send it. We can also send an error ourselves with captureException.

### 17. What rules or policies does it enforce?

**Technical:** We enforce "init once" and "init first" by convention (instrument.ts, require first). We enforce sendDefaultPii: false so we don't send PII. Sample rates (0.1, 0.05) limit volume. Sentry itself may have rate limits and quotas; we don't enforce those in code. No business rules; only observability.

**Simple (like for a 10-year-old):** We make sure we only init once and first. We make sure we don't send personal data. We only send 10% of traces and 5% of profiles so we don't send too much. Sentry might have their own limits; we don't enforce those in our code.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** Init: app startup (require instrument). Capture: any error that reaches Express error handler or any uncaught exception/rejection that Sentry hooks. Performance: every request is considered for sampling (tracesSampleRate); sampled requests get a transaction. Profiling: profileSessionSampleRate decides which traces get profiling. No cron or external trigger.

**Simple (like for a 10-year-old):** Sentry turns on when the app starts. It sends an error when something goes wrong and reaches the error handler (or when something throws and nobody catches it). It sends performance data for a random sample of requests. Nothing runs on a schedule—only when the app runs and when errors happen.

### 19. What could go wrong while doing its job?

**Technical:** Init twice: could break instrumentation or double-send. Init too late: early errors (e.g. in import) might not be captured. SENTRY_DSN wrong: events might fail to send or go to wrong project. Sentry down: we buffer and retry (SDK behavior) but might lose events if process exits. Too high sample rate: quota and cost. sendDefaultPii true: PII in Sentry (compliance risk). Our error handler calling Sentry.captureException after setupExpressErrorHandler: double capture, noisy dashboard. Network/firewall: Sentry might be blocked; events fail.

**Simple (like for a 10-year-old):** If we init twice or too late we might miss errors or break things. If the DSN is wrong we might send to the wrong place or nowhere. If Sentry is down we might lose some events. If we send too much we might hit limits or cost. If we send personal data we could have a compliance problem. If we capture the same error twice the dashboard gets noisy. If the network blocks Sentry we won't get events.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** Check Sentry dashboard: errors appear after we throw in a route; transactions appear for sampled requests. Log "sentry_initialized" at startup. Trigger a test error in staging and confirm it shows in Sentry. No built-in health check for "Sentry is receiving"; we rely on dashboard and occasional test.

**Simple (like for a 10-year-old):** We look at the Sentry website and see if errors and traces show up. We log "sentry initialized" when we start. We can throw a test error in staging and see if it appears in Sentry.

### 21. What does it depend on to do its job?

**Technical:** Env: SENTRY_DSN, NODE_ENV. Packages: @sentry/node, @sentry/profiling-node. Express app (for setupExpressErrorHandler). Network: outbound HTTPS to Sentry. No DB or Redis. config/env for env vars.

**Simple (like for a 10-year-old):** It needs the Sentry address and "prod or dev" in the environment. It needs the Sentry npm packages. It needs the Express app so it can add the error handler. It needs the network to send data to Sentry. It doesn't need our database or Redis.

### 22. What are the main config or env vars that control its behavior?

**Technical:** SENTRY_DSN: required for init; if unset Sentry is off. NODE_ENV: used for environment tag and for tracesSampleRate (production 0.1, else 1.0) and profileSessionSampleRate (production 0.05, else 1.0). No other env vars in instrument.ts. Sample rates and sendDefaultPii are in code.

**Simple (like for a 10-year-old):** We need SENTRY_DSN to turn Sentry on; if it's not set Sentry doesn't run. We use NODE_ENV to decide "prod or dev" and how much to sample (less in prod). Everything else (like "don't send PII") is in code.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit: mock Sentry, call init once, assert no double init. Integration: in test env with SENTRY_DSN set (or mock), throw in a route, assert Sentry.captureException was called (or check Sentry test project). E2E: trigger error in staging, check Sentry dashboard. Manual: throw error in dev, see event in Sentry.

**Simple (like for a 10-year-old):** We can mock Sentry and check we only init once. We can throw an error in a test and check Sentry got it. We can throw in staging and look at Sentry. We can throw in dev and see it show up.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** If Sentry is down or DSN wrong: we still run the app; errors just don't get to Sentry. Fix: set correct DSN, check network/firewall. If we double-init: remove extra init, restart. If we miss early errors: ensure require("./instrument") is first in entry. If quota exceeded: lower sample rates or upgrade Sentry plan. No automatic recovery; fix config and deploy.

**Simple (like for a 10-year-old):** If Sentry is down or the address is wrong the app still runs; we just don't get errors in Sentry. We fix it by setting the right DSN and checking the network. If we init twice we remove the extra init and restart. If we miss errors we make sure we load instrument first. If we hit Sentry's limits we send less (lower sample) or pay for more. There's no automatic fix—we change config and deploy.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders?

**Technical:** Engineers: fix bugs using Sentry errors and traces. Ops: monitor and alert. Product: care that we know when things break. Security/compliance: care that we don't send PII (sendDefaultPii: false).

**Simple (like for a 10-year-old):** Engineers use Sentry to fix bugs. Ops use it to watch the app and get alerts. Product wants to know when something breaks. Security wants to make sure we don't send people's personal data to Sentry.

### 26. What are the security or privacy considerations?

**Technical:** sendDefaultPii: false so we don't send user names, emails, addresses to Sentry. We may still send request path, method, and error message—ensure no secrets in paths or messages. Don't log or capture passwords or tokens. Sentry data is stored on Sentry's servers; check their privacy/DPA if needed. Rate limits and quotas: Sentry may drop or throttle; we sample to reduce volume.

**Simple (like for a 10-year-old):** We don't send personal data (names, addresses) to Sentry. We should not send passwords or tokens. The error message and path might be sent—we make sure there are no secrets in them. Sentry stores data on their servers; we might need to check their privacy policy. We don't send too much so we don't hit their limits.

### 27. What are the limits or scaling considerations?

**Technical:** Sentry has quotas (events per month); sample rates keep us under. High RPS: 10% traces = 0.1 * RPS transactions; profiling 5% of those. If we grow we may need to lower sample rates or upgrade. Init and error handler add minimal latency. No in-app limit on "how many events we send" except sample rates.

**Simple (like for a 10-year-old):** Sentry has a limit on how many events we can send per month. We only send 10% of traces and 5% of profiles so we stay under. If we get huge traffic we might send less or pay for more. Sentry doesn't slow down the app much.

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** Add release/version to init so we see which deploy an error came from. Add beforeSend to filter 4xx or known errors we don't care about. Call Sentry.flush() in graceful shutdown so we don't lose last events. Add Sentry.captureException in key paths (e.g. payment failure) with context (jobId, userId) for faster debugging. Document "what we send" and "what we don't" in a short doc.

**Simple (like for a 10-year-old):** We'd add "which version of the app" to each error so we know which deploy broke. We'd maybe ignore "not found" type errors so we don't clutter Sentry. We'd flush when we shut down so we don't lose the last errors. We'd send extra context (like job id) for important errors. We'd write down what we send and what we don't.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Starts: require("./instrument") at process start; Sentry.init() runs once. No "finish" for Sentry itself; it runs for process lifetime. On each request: transaction may start (sampled), request runs, transaction finishes. On error: capture, send, done. On process exit: we could call Sentry.close() or flush() to send pending events (not in current code).

**Simple (like for a 10-year-old):** Sentry starts when the app starts (we load instrument first). It doesn't "stop" until the process exits. For each request it might record a transaction; when an error happens it captures and sends. When we shut down we could tell Sentry "send whatever you have left."

### 30. What state does it keep or track?

**Technical:** Sentry SDK keeps in-memory state: breadcrumbs, current transaction, user context (if set). We don't persist Sentry state in our DB. Events are sent to Sentry's servers. No local queue of "pending events" that we manage; SDK handles buffering.

**Simple (like for a 10-year-old):** Sentry keeps some stuff in memory (like "what happened before this error") and the current request's trace. We don't store any of that in our database. Sentry sends it to their servers. The SDK might buffer a bit before sending.

### 31. What assumptions does it make to do its job?

**Technical:** Assumes SENTRY_DSN is correct and Sentry's servers are reachable. Assumes we don't init elsewhere. Assumes Express error handler order (setupExpressErrorHandler before our custom handler that returns JSON). Assumes no secrets in error messages or paths we send. Assumes Node/Express are patchable by Sentry SDK.

**Simple (like for a 10-year-old):** We assume the Sentry address is right and Sentry is up. We assume we only init once. We assume the error handler is in the right order. We assume we don't put secrets in error messages. We assume Sentry can hook into Node and Express.

### 32. When should we not use it (or use something else)?

**Technical:** Don't init in tests unless we mock or use a test DSN (otherwise we send test errors to Sentry). Don't capture expected errors (e.g. validation 400) as exceptions if we don't want noise—or use captureMessage with level. Don't send PII; use sendDefaultPii: false. For high-volume 4xx we might filter in beforeSend. If we move to another provider (Datadog, etc.) we'd replace Sentry init and handler.

**Simple (like for a 10-year-old):** We shouldn't send test errors to Sentry (mock or use a test project). We might not want to send "bad request" type errors so we don't fill Sentry with noise. We never send personal data. If we switch to another monitoring tool we'd replace Sentry with that.

### 33. How does it interact with other systems or features?

**Technical:** Loaded first so it can instrument everything. Logger: we use logger for our logs; Sentry is separate (errors and traces). Metrics: we have metrics.ts (logger-based); Sentry is for errors and performance. Express: setupExpressErrorHandler is the last error handler. Graceful shutdown: we could add Sentry.flush() before exit. No interaction with DB, queue, or auth except that we capture errors that occur in those layers.

**Simple (like for a 10-year-old):** We load it first so it can see everything. Our app logs go to the logger; Sentry gets errors and performance. We have our own metrics (logs); Sentry is for errors and traces. Sentry's error handler runs at the end of the app. When we shut down we could tell Sentry to flush. It doesn't talk to the database or the queue—it just gets errors when they happen there.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Failure: Sentry didn't get an error we wanted to capture (e.g. init too late, double init, network down). We don't throw from Sentry code; we just don't send. SDK may log to console on send failure. We don't have a "Sentry health" endpoint; we infer from dashboard. If init fails (e.g. bad DSN) Sentry might throw; we could wrap in try/catch and log.

**Simple (like for a 10-year-old):** Failure means Sentry didn't get the error (we init wrong, or Sentry is down, or network). We don't throw—we just don't send. The SDK might log something. We don't have a "is Sentry working?" check; we just look at the dashboard. If init fails we might get an exception; we could catch and log it.

### 35. How do we know its outputs are correct or complete?

**Technical:** We don't verify every event; we trust the SDK and check the dashboard. Trigger test error, see it in Sentry with stack and context. Sample rates mean we don't send every trace; "complete" is "we send what we configured." No automated assertion that "every error reached Sentry."

**Simple (like for a 10-year-old):** We don't check every single event. We throw a test error and see if it shows up in Sentry. We send a sample of traces so "complete" just means we're sending what we said we would.

### 36. Who owns or maintains it?

**Technical:** Code: instrument.ts, index.ts (require and setupExpressErrorHandler). No explicit OWNER; typically platform or observability. Changes to init config or sample rates should be documented. When adding new entry points (workers) ensure they load instrument or init once there.

**Simple (like for a 10-year-old):** The team that owns "platform" or "observability" usually owns this. The code is in instrument and index. When we change Sentry config we should write it down. If we add new processes (like a worker) we need to load instrument there too.

### 37. How might it need to change as the product or business grows?

**Technical:** Lower sample rates if we hit quota or cost. Add release/version and deploy tracking. Add beforeSend to scrub or filter. Add Sentry.flush() in graceful shutdown. Add context (user id, job id) in key flows. Consider separate Sentry project for workers. Document PII and retention policy for Sentry data.

**Simple (like for a 10-year-old):** We might send less (lower sample) if we get too big or hit limits. We might add "which version" and "which deploy" to errors. We might filter out some errors. We might flush on shutdown. We might add more context (user, job) for important errors. We might have a separate Sentry project for workers. We'd write down what we send and how long Sentry keeps it.

---

*End of Founder Reference: Sentry*
