# Founder Reference: Manager Dashboard

**Candidate:** Manager dashboard (Feature #15)  
**Where it lives:** `managerDashboardService`, `manager` routes  
**Why document:** What managers see and do vs admins and cleaners.

---

## The 8 main questions

### 1. What it is

**Technical:** The manager dashboard is a read-oriented API that gives managers (role between admin and cleaner) a view of business and operational metrics without full admin powers. Implemented in `src/services/managerDashboardService.ts` and `src/routes/manager.ts` (mounted at `/manager`). It provides: **Dashboard overview** — GMV (today, week, month, MoM growth), credits (purchased, spent, refunded, supply, velocity), jobs (counts, completion rate, avg rating, avg job value), users (clients/cleaners totals and active/new), and rates (refund, dispute, cancellation, payout error, workflow error); **Supply/demand heatmap** (hour × day of week: demand, supply, ratio, fill rate); **Tier distribution** (tier counts, avg reliability, avg jobs, total earnings); **Retention cohorts** (signups and month-1/2/3 activity); **Background check stats**; and other KPIs. Managers typically cannot repair jobs, override payouts, or access full admin routes.

**Simple (like for a 10-year-old):** The manager dashboard is a set of screens (APIs) for “managers”—people who need to see how the business is doing but don’t need to fix every little thing like an admin. They see money (GMV, credits), jobs, users, and rates (refunds, disputes, cancellations, errors), plus supply vs demand, cleaner tiers, retention, and background check numbers. They look, they don’t click “override” on payouts or jobs.

### 2. Where it is used

**Technical:** `src/services/managerDashboardService.ts` (getDashboardOverview, getGMVMetrics, getCreditMetrics, getJobMetrics, getUserMetrics, getRateMetrics, supply/demand heatmap, tier distribution, retention cohorts, getBackgroundCheckStats); `src/routes/manager.ts` exposes GET endpoints for overview, heatmap, tiers, retention, background checks. Mounted in `src/index.ts` as `app.use("/manager", managerRouter)`. Auth: manager role or equivalent; routes use auth middleware that allows manager (and often admin).

**Simple (like for a 10-year-old):** The code lives in managerDashboardService and the manager routes under `/manager`. The main app mounts these routes and only people with the manager (or admin) role can call them.

### 3. When we use it

**Technical:** When a manager (or admin) opens the manager dashboard in the frontend; the frontend calls GET /manager/overview, /manager/supply-demand, /manager/tiers, /manager/retention, /manager/background-checks (or similar). No scheduled backend job that “runs” the dashboard—it’s on-demand read of current DB state.

**Simple (like for a 10-year-old):** We use it when a manager (or admin) opens the dashboard and the app loads the numbers. There’s no timer that updates the dashboard by itself—each time they open or refresh, we read the latest data.

### 4. How it is used

**Technical:** Frontend sends authenticated GET requests to /manager/*. Backend runs SQL aggregations over jobs, users, credit_ledger, payouts, job_events, cleaner_profiles, background_checks, etc., and returns JSON (GMV, credits, jobs, users, rates, heatmap, tier distribution, retention, background check stats). No write endpoints in the manager dashboard; it’s read-only. Role middleware ensures only manager (or admin) can access.

**Simple (like for a 10-year-old):** The app sends “get overview” or “get heatmap” and the server runs queries on the database and sends back the numbers. Managers can’t change anything through this dashboard—only look.

### 5. How we use it (practical)

**Technical:** Ensure manager role exists and is assigned to the right users; frontend points at /manager/* with JWT. No special env for the dashboard; it uses the same DB and auth as the rest of the app. For debugging, call the same endpoints with an admin or manager token (e.g. Postman).

**Simple (like for a 10-year-old):** We give some users the “manager” role and the app uses their login to load the dashboard. Same database and login as the rest of the app. To test, we use a manager or admin token and call the same URLs.

### 6. Why we use it vs other methods

**Technical:** Separating “manager” from “admin” limits blast radius: managers see KPIs and trends but don’t get repair/override/finance tools. One service and one route namespace keep manager logic in one place and make it easy to add or hide metrics without touching admin routes.

**Simple (like for a 10-year-old):** We use it so managers can see how we’re doing without giving them the same power as admins. Having a separate “manager” area keeps what they can do clear and in one place.

### 7. Best practices

**Technical:** Read-only; no mutating actions in manager routes. Use same DB client and connection pool; avoid N+1 (batch or single aggregation queries). Cache optional for heavy aggregations if needed. Document which role can access; keep manager vs admin permission matrix clear.

**Simple (like for a 10-year-old):** The dashboard only reads data; it doesn’t change anything. We run efficient queries so we don’t hammer the database. We could cache the big numbers if the page gets slow. We should write down who (manager vs admin) can see what.

### 8. Other relevant info

**Technical:** Admin dashboard (FOUNDER_ADMIN_DASHBOARD.md) has full repair, overrides, payouts, risk, etc. Manager dashboard is a subset of “view” capabilities. Background check stats come from backgroundCheckService or direct queries. GMV/credits/jobs align with operational metrics and reporting; reconciliation and payout flags are admin-only in implementation.

**Simple (like for a 10-year-old):** The admin dashboard can do a lot more (fix jobs, override payouts, etc.). The manager one is just for viewing. The background check numbers are pulled from the same place as the rest of the app. The money and job numbers should match what we use elsewhere for reporting.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Give managers a single place to see business and operational health: GMV, credits, jobs, users, rates, supply/demand, tier mix, retention, and background check status—without granting admin write/repair/override capabilities.

**Simple (like for a 10-year-old):** Let managers see how much we’re making, how many jobs and users we have, how healthy things are (refunds, disputes, errors), and how supply and demand and retention look—without letting them change anything.

### 10. What does "done" or "success" look like?

**Technical:** Manager (or admin) gets 200 with correct JSON for overview, heatmap, tiers, retention, background checks. Numbers are consistent with source tables (jobs, ledger, payouts, users). No write operations; 403 for non-manager/non-admin.

**Simple (like for a 10-year-old):** Success means they get the numbers and they’re right. Only managers (or admins) can see them; everyone else gets “forbidden.”

### 11. What would happen if we didn't have it?

**Technical:** Managers would either have no dedicated view or would need admin access to see KPIs, increasing risk from accidental or malicious admin actions. Product and ops would lack a clear “manager-only” surface.

**Simple (like for a 10-year-old):** Without it, managers would have no special dashboard, or we’d have to give them full admin access to see numbers, which would be riskier.

### 12. What is it not responsible for?

**Technical:** Not responsible for: repairing jobs, resolving disputes, overriding payouts, changing user roles, editing system config, or running workers. That stays in admin dashboard and backend services. Manager dashboard only aggregates and returns read-only data.

**Simple (like for a 10-year-old):** It doesn’t fix jobs, resolve disputes, or change payouts or settings. That’s the admin’s job. The manager dashboard only shows numbers.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** Authenticated request (JWT with manager or admin role). Optional query params for date range or limit where supported. No body for GET endpoints. DB: jobs, users, client_profiles, cleaner_profiles, credit_ledger, payouts, job_events, background_checks, etc.

**Simple (like for a 10-year-old):** We need a logged-in manager (or admin). Sometimes we might take a date range. We read from the same database as the rest of the app.

### 14. What it produces or changes

**Technical:** Returns JSON: overview (gmv, credits, jobs, users, rates), supply-demand heatmap, tier distribution, retention cohorts, background check stats. Does not insert/update/delete any data.

**Simple (like for a 10-year-old):** It only returns numbers and lists. It doesn’t change anything in the database.

### 15–17. Consumers, flow, rules

**Technical:** Consumer: frontend manager dashboard (and optionally internal tools with manager token). Flow: GET /manager/* → auth middleware → managerDashboardService functions → SQL → JSON response. Rules: role must be manager or admin; read-only.

**Simple (like for a 10-year-old):** The manager app (or an internal tool) calls these URLs. We check they’re a manager or admin, run the queries, and send back the JSON. We never write.

---

## Triggers, dependencies, stakeholders

### 18. What triggers it

**Technical:** User opening or refreshing the manager dashboard (frontend GET requests). No cron or event that “runs” the dashboard.

**Simple (like for a 10-year-old):** When a manager opens or refreshes the dashboard. Nothing automatic.

### 19. What could go wrong

**Technical:** Slow queries if aggregations are heavy (many jobs/users); missing indexes. Wrong role → 403. DB down → 500. Stale data if caching added and TTL too long.

**Simple (like for a 10-year-old):** The page could be slow if the queries are big. If the user isn’t a manager or admin they get forbidden. If the database is down we return an error. If we cache and cache is old, numbers could be stale.

### 20–22. Monitoring, dependencies, config

**Technical:** Standard app logs and response codes; no dedicated manager-dashboard metric. Depends on DB and auth. No manager-specific env; same as main app.

**Simple (like for a 10-year-old):** We watch normal logs and status codes. We depend on the database and login. We don’t have special config for the manager dashboard.

### 25. Main stakeholders

**Technical:** Managers and ops (daily view of business); product (KPIs); sometimes support (high-level view without admin access).

**Simple (like for a 10-year-old):** Managers and ops care most; product and support might use it to see how we’re doing.

### 26. Security or privacy

**Technical:** Aggregated metrics only; no per-user PII in dashboard response (e.g. counts, not emails). Access restricted by role (manager/admin). Same security as rest of app (HTTPS, JWT).

**Simple (like for a 10-year-old):** We only show totals and rates, not who did what. Only managers and admins can see it. We use the same secure login as the rest of the app.

### 33. How it interacts with other systems

**Technical:** Reads from same DB as admin, jobs, credits, payouts, background checks. Uses same auth middleware (with manager role). Does not call other services (events, notifications, Stripe); pure read from DB.

**Simple (like for a 10-year-old):** It reads the same database as everything else and uses the same login. It doesn’t call Stripe or send notifications—it just reads and returns numbers.

---

**See also:** FOUNDER_ADMIN_DASHBOARD.md, FOUNDER_BACKGROUND_CHECK.md, operational metrics.
