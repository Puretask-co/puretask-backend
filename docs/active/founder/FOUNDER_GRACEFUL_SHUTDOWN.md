# Founder Reference: Graceful Shutdown

**Candidate:** Graceful shutdown (Module #29)  
**Where it lives:** `src/lib/gracefulShutdown.ts` (setupGracefulShutdown, isShuttingDown), called from index.ts with the HTTP server and DB pool  
**Why document:** How we drain connections and finish in-flight work on SIGTERM.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Graceful shutdown in PureTask is the way we stop the server when we get a stop signal (SIGTERM, SIGINT) or an uncaught exception: we stop accepting new connections, wait for in-flight requests to finish, close the database pool, then exit. Implemented in `src/lib/gracefulShutdown.ts`: `setupGracefulShutdown(server)` registers a shutdown function that (1) sets a flag so we don't run twice, (2) calls server.close() so we stop accepting new connections and wait for existing connections to finish, (3) in the close callback closes the DB pool (pool.end()), (4) then process.exit(0). We also set a 30-second timeout: if we don't finish in time we force exit(1). We listen for SIGTERM, SIGINT, and uncaughtException (and log uncaughtException then shutdown). We listen for unhandledRejection and log but don't shut down (so one bad promise doesn't kill the process). `isShuttingDown()` returns the flag so other code can avoid starting new work.

**Simple (like for a 10-year-old):** Graceful shutdown is "when someone tells the server to stop, we don't just kill it—we stop taking new requests, let the ones we're doing finish, close the database connection, then exit." We do that so we don't cut off people mid-request and we don't leave the database in a bad state. We give ourselves 30 seconds; if we're not done we force quit. We react to "stop" signals (SIGTERM, SIGINT) and to uncaught exceptions (we log and then shut down). We have a flag "are we shutting down?" so other code can check and not start new work.

### 2. Where it is used

**Technical:** `src/lib/gracefulShutdown.ts` defines setupGracefulShutdown(server) and isShuttingDown(). `src/index.ts` (or the main entry that creates the HTTP server) calls setupGracefulShutdown(server) after the server is created and listening. The server is the Node http.Server (e.g. from express). The pool is imported from ../db/client (PostgreSQL pool). No other file should call setupGracefulShutdown; only the main entry. Workers or other processes would need their own shutdown logic if they run separately.

**Simple (like for a 10-year-old):** The code lives in gracefulShutdown.ts. The main app (index.ts) calls setupGracefulShutdown and passes the HTTP server. We use the same database pool we use everywhere. Only the main app sets this up; if we have separate worker processes they'd need their own shutdown.

### 3. When we use it

**Technical:** We use it when the process receives SIGTERM (e.g. from Kubernetes or systemd), SIGINT (Ctrl+C), or uncaughtException. Trigger: OS or orchestrator sends SIGTERM/SIGINT; or code throws and nothing catches it (uncaughtException). We don't shut down on unhandledRejection (we only log) so a single unhandled promise rejection doesn't kill the process. Shutdown runs once (guarded by shuttingDown flag).

**Simple (like for a 10-year-old):** We use it when the system tells us to stop (SIGTERM or Ctrl+C) or when something throws and nobody catches it. We don't shut down just because one promise failed without a catch—we only log that—so one bad promise doesn't kill the whole app.

### 4. How it is used

**Technical:** shutdown(signal): if shuttingDown return; set shuttingDown = true; log shutdown_initiated; server.close(callback). In callback: if err log and exit(1); else log server_closed; await pool.end(); log shutdown_complete; process.exit(0). Catch in try/catch: log shutdown_error and exit(1). We also setTimeout(30e3): log shutdown_timeout and process.exit(1). We register: process.on("SIGTERM", () => shutdown("SIGTERM")); process.on("SIGINT", () => shutdown("SIGINT")); process.on("uncaughtException", (err) => { log; shutdown("uncaughtException"); }); process.on("unhandledRejection", (reason, promise) => { log; }). isShuttingDown() returns shuttingDown.

**Simple (like for a 10-year-old):** When we get the signal we set "we're shutting down," tell the server to stop accepting new connections and wait for current ones to finish, then in the callback we close the database pool and exit. If something goes wrong we log and exit with an error. We also start a 30-second timer; if we're still not done we force exit. We listen for SIGTERM, SIGINT, and uncaughtException (and for unhandledRejection we only log). Other code can call isShuttingDown() to see if we're in the middle of shutting down.

### 5. How we use it (practical)

**Technical:** Call setupGracefulShutdown(server) once after server.listen() in index.ts. No env vars. To test: send SIGTERM to the process and assert server stops and pool closes; or mock pool.end and assert it's called. Workers (queue, subscription, etc.) may have their own shutdown: they should listen for SIGTERM/SIGINT and stop consuming jobs, then exit. Document that the main app drains HTTP and closes DB; it doesn't wait for queue jobs to finish unless we add that.

**Simple (like for a 10-year-old):** In practice we call setupGracefulShutdown once when we start the server. We don't have env vars for it. To test we send "stop" to the process and check the server and database close. If we have background workers they need their own "stop" logic; the main app only drains HTTP and closes the DB—it doesn't wait for every queue job to finish unless we add that.

### 6. Why we use it vs other methods

**Technical:** Without graceful shutdown we'd exit immediately on SIGTERM: in-flight requests would be cut off, DB connections might be left open, and the orchestrator might think we're unhealthy. With server.close() we stop accepting new connections and Node waits for existing connections to close (or their handlers to finish). With pool.end() we close DB connections cleanly. Alternatives: exit immediately (bad UX and possible DB issues); wait forever (orchestrator would kill us anyway)—we use 30s timeout. We don't drain the queue in this module; that would be in the worker's shutdown.

**Simple (like for a 10-year-old):** We use it so we don't just die when someone says "stop"—we finish what we're doing and close the database nicely. If we didn't, people's requests could be cut off and the database might be left in a mess. We give ourselves 30 seconds so we don't hang forever (the system would kill us anyway). We don't wait for every background job here; that would be in the worker code.

### 7. Best practices

**Technical:** Call server.close() so we stop accepting and drain. Close DB pool so connections are released. Use a timeout so we don't hang (30s). Guard shutdown with a flag so we don't run twice. Log at each step (shutdown_initiated, server_closed, database_pool_closed, shutdown_complete, shutdown_timeout, shutdown_error). For uncaughtException we log then shutdown (process in bad state). For unhandledRejection we only log (could add shutdown if policy is "any unhandled rejection = exit"). Gaps: we don't close Redis (if we use it) in this module—add closeRedis() or similar if needed; we don't flush Sentry (Sentry.flush()) before exit so we might lose last errors; we don't wait for queue workers to finish.

**Simple (like for a 10-year-old):** We stop the server, close the database, and use a 30-second limit. We only run shutdown once (flag). We log each step. When something throws and nobody catches it we log and shut down. When a promise fails and nobody catches it we only log. What we could do better: we might need to close Redis too; we might want to tell Sentry "send what you have" before we exit; we don't wait for background jobs to finish.

### 8. Other relevant info

**Technical:** pool is from db/client; pool.end() returns a Promise and we await it. server is Node's http.Server (from express or http.createServer). Kubernetes sends SIGTERM before SIGKILL; we have a terminationGracePeriodSeconds (e.g. 30) so we should finish within that or the app will be killed. Document any new resource to close (Redis, queue connections) in this doc. See FOUNDER_SENTRY for adding Sentry.flush() before exit.

**Simple (like for a 10-year-old):** We use the same database pool we use everywhere; closing it releases connections. The server is the HTTP server. When Kubernetes stops us it sends SIGTERM first and gives us some time (e.g. 30 seconds); if we're not done by then it kills us. If we add more things to close (Redis, queue) we should write it down. We could add "flush Sentry" before we exit (see the Sentry doc).

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Stop the server cleanly: no new connections, in-flight requests can finish, DB pool closed, then exit. Avoid cutting off requests mid-stream and avoid leaving DB connections open. Success: server.close() runs, pool.end() runs, process exits with 0 (or 1 on error/timeout); no double shutdown.

**Simple (like for a 10-year-old):** It's supposed to let us stop the server without killing people's requests and without leaving the database in a bad state. Success is: we stop accepting new work, we finish what we're doing, we close the database, and we exit. We don't run shutdown twice.

### 10. What does "done" or "success" look like for it?

**Technical:** Done: server_closed log, database_pool_closed log, shutdown_complete log, process.exit(0). Observable: logs; process exits. If we hit the 30s timeout we log shutdown_timeout and exit(1). If pool.end() or server.close fails we log and exit(1).

**Simple (like for a 10-year-old):** Success looks like: we see "server closed," "database pool closed," "shutdown complete" in the logs and the process exits with 0. If we time out or something fails we see "shutdown timeout" or "shutdown error" and exit with 1.

### 11. What would happen if we didn't have it?

**Technical:** On SIGTERM the process would exit immediately (default Node behavior or from orchestrator): in-flight HTTP requests would be aborted, DB connections might not be closed cleanly (pool connections left open), and we might leave the system in a bad state. Orchestrators expect graceful shutdown so they can do rolling deploys without dropping traffic.

**Simple (like for a 10-year-old):** Without it when we're told to stop we'd just die. People's requests would be cut off and the database might have connections left open. When we do a new deploy the system expects us to "finish and then stop," not "die right now."

### 12. What is it not responsible for?

**Technical:** Graceful shutdown is not responsible for: closing Redis (that would be in redis.ts or here if we add it); flushing Sentry (Sentry.flush()); draining the queue (workers have their own shutdown); closing other resources (e.g. n8n client, Stripe—usually no explicit close). It only closes the HTTP server and the DB pool. It doesn't decide when to shut down (OS/orchestrator does); it only reacts.

**Simple (like for a 10-year-old):** It doesn't close Redis (we'd have to add that). It doesn't tell Sentry "send what you have." It doesn't wait for background jobs to finish—that's the worker's job. It only stops the HTTP server and closes the database. It doesn't decide "time to stop"—something else (the system or Ctrl+C) does; we just react.

---

## Inputs, outputs, and flow (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: server (Node http.Server). Imports: pool from db/client, logger. Outputs: process.exit(0) or (1); logs. Flow: signal → shutdown() → server.close() → callback → pool.end() → exit(0); or timeout → exit(1); or error → exit(1). Rules: only one shutdown (flag); 30s max.

**Simple (like for a 10-year-old):** We need the HTTP server. We use the database pool and the logger. We exit with 0 or 1 and write logs. We run shutdown once, then either finish and exit 0 or hit the 30-second limit or an error and exit 1.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, failure modes, dependencies, config, testing, recovery, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by SIGTERM, SIGINT, uncaughtException. Could go wrong: server.close never calls callback (e.g. a connection hangs)—we have 30s timeout; pool.end() fails—we catch and exit(1). Depends on server, pool, logger. No env vars. Test: start server, send SIGTERM, assert pool.end called and exit; or mock pool.end. Recovery: N/A (we're exiting). Stakeholders: ops and orchestrator (Kubernetes, systemd). Security: N/A. Limits: 30s may be too short if we have long requests—tune or document. Lifecycle: runs once per process. State: shuttingDown flag. Assumptions: server is Node http.Server; pool has end(). When not to use: N/A (we always want graceful shutdown in main app). Interacts with server, pool, logger, process. Failure: timeout or error → exit(1). Correctness: we trust server.close and pool.end do the right thing. Owner: platform. Evolution: add Redis close, Sentry.flush(), queue drain, or configurable timeout.

**Simple (like for a 10-year-old):** We run when we get SIGTERM, SIGINT, or an uncaught exception. If server.close never finishes (e.g. a stuck connection) we have a 30-second limit. If closing the pool fails we log and exit with an error. We depend on the server, the pool, and the logger. We don't have env vars. We can test by sending SIGTERM and checking we close the pool and exit. Ops and the deploy system care. We might need more than 30 seconds if we have very long requests. We run once per process and keep a "we're shutting down" flag. We assume the server and pool can be closed. We only close the server and pool here. If we time out or hit an error we exit with 1. The platform team owns this. Later we might close Redis, flush Sentry, or wait for the queue.

---

*End of Founder Reference: Graceful Shutdown*
