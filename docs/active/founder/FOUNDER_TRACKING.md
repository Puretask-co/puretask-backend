# Founder Reference: Tracking (GPS / Job Status)

**Candidate:** Tracking (Feature #18)  
**Where it lives:** `jobTrackingService`, `tracking` routes, check-in, status updates  
**Why document:** How cleaner location/check-in and job status are recorded and exposed.

---

## The 8 main questions

### 1. What it is

**Technical:** Tracking is the subsystem that records and exposes job status and (optionally) cleaner location for live job tracking. Implemented in `src/services/jobTrackingService.ts` and `src/routes/tracking.ts`. It provides: **Job tracking state** — job details, timeline (job_events), current location (if reported), ETA, before/after photos, cleaner info, scheduled/actual start/end and en_route/arrived times; **Check-in** — cleaner checks in (e.g. GPS within radius or manual) with optional location; **Status updates** — en_route, arrived, started, completed (with optional before/after photo uploads); **Photo upload** — before photos (accepted/en_route/in_progress), after photos (in_progress/awaiting_client), with minimum 3 total enforced. Status transitions publish events (cleaner_on_my_way, job_started, job_completed, etc.). Location may be validated against job address (GPS_CHECKIN_RADIUS_METERS). Timeline is read from job_events.

**Simple (like for a 10-year-old):** Tracking is the “where is my cleaner?” and “what’s the job status?” feature. We record when the cleaner says “on my way,” “arrived,” “started,” “done,” and optionally where they are (GPS). We also handle before/after photo uploads and require at least 3 photos. All of that shows up on a timeline for the client and drives emails/notifications.

### 2. Where it is used

**Technical:** `src/services/jobTrackingService.ts` (getJobTrackingState, checkIn, updateStatus, uploadBeforePhotos, uploadAfterPhotos, enforce min 3 photos); `src/routes/tracking.ts` (GET state, POST check-in, POST status, POST photos). Mounted at /tracking or under client/cleaner. Uses job_events, jobs, job_photos, cleaner_profiles; publishEvent for each status change. Env: GPS_CHECKIN_RADIUS_METERS for geo check-in.

**Simple (like for a 10-year-old):** The code lives in jobTrackingService and the tracking routes. We read and write job_events, jobs, and job_photos, and we send events so the rest of the app (and n8n) can react. We have a setting for how close the cleaner has to be to “check in” with GPS.

### 3. When we use it

**Technical:** When a client or cleaner opens the job tracking view (GET state); when a cleaner checks in (POST check-in with optional lat/lng); when a cleaner updates status (en_route, arrived, started, completed) (POST); when a cleaner uploads before/after photos (POST). Each status change triggers publishEvent so notifications and n8n can run.

**Simple (like for a 10-year-old):** We use it when someone opens the “track job” screen, when the cleaner says “I’m here” or “on my way” or “started” or “done,” and when they upload photos. Each of those steps can trigger emails or automations.

### 4. How it is used

**Technical:** getJobTrackingState(jobId): load job, timeline (job_events), photos (job_photos), cleaner info, optional current location/ETA; return JSON. checkIn(jobId, cleanerId, location?): validate assignment and status, optionally validate GPS within radius, update job (en_route_at/arrived_at), publishEvent. updateStatus(jobId, status): validate transition (e.g. accepted→en_route→arrived→in_progress→awaiting_client→completed), update job times, publishEvent (cleaner_on_my_way, job_started, job_completed, etc.). Photo upload: validate type and status, insert job_photos, enforce min 3 total in completion path. All mutations require cleaner to be assigned to job.

**Simple (like for a 10-year-old):** We load the job, its timeline, photos, and cleaner and send that to the app. When the cleaner checks in or changes status we check they’re allowed (right job, right order), update the job and times, and publish an event. For photos we check type and status and require at least 3 total before we consider the job “photo complete.”

### 5. How we use it (practical)

**Technical:** Frontend calls GET /tracking/:jobId (or similar) for state; POST check-in and status updates with JWT (cleaner). Optional query/body for lat/lng. Env: GPS_CHECKIN_RADIUS_METERS. Events drive notifications (see FOUNDER_JOB_EVENTS_FLOW.md). Ensure job state machine allows only valid transitions.

**Simple (like for a 10-year-old):** The app calls “get tracking” and “check-in” or “status update” with the cleaner logged in. We can send location for check-in. The rest of the app uses the events we publish to send emails and update the UI.

### 6. Why we use it vs other methods

**Technical:** A single tracking service and event-driven status give one source of truth for “where is the job?” and a clear audit trail (job_events). Client and cleaner see the same timeline; n8n and notifications react to the same events. Alternatives (per-client polling of raw DB, or no events) would duplicate logic and make it hard to keep UI and emails in sync.

**Simple (like for a 10-year-old):** We use one place for “job status and timeline” so the client and cleaner see the same thing and our emails/automations always know what happened. If we didn’t, we’d have to repeat the same logic in lots of places.

### 7. Best practices

**Technical:** Validate status transitions (e.g. no “completed” before “started”); validate assignment on every mutation; publish event after DB update so consumers see consistent state. Enforce min photos at completion; optional GPS validation with configurable radius. Gaps: document exact state machine and who can transition; ensure idempotency if client retries status update.

**Simple (like for a 10-year-old):** We only allow sensible order (e.g. can’t mark done before started). We always check the cleaner is on the job. We publish the event after we save so everyone sees the same thing. We could write down the exact allowed transitions and what happens if the app sends the same update twice.

### 8. Other relevant info

**Technical:** job_events is the timeline source; job_photos and min count are shared with FOUNDER_PHOTO_PROOF.md. Reliability and no-show detection may use en_route_at/actual_start_at/actual_end_at. FOUNDER_JOB_EVENTS_FLOW.md for event→notification flow. Tracking routes may be under /client and /cleaner with different visibility.

**Simple (like for a 10-year-old):** The timeline comes from the same events we use for notifications. Photos and “min 3” are the same as Photo Proof. Reliability and “no-show” use the times we record. Who can see what might differ for client vs cleaner.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Give clients and cleaners a live view of job status and timeline; record check-in and status transitions with optional GPS; enforce before/after photo policy; and publish events so notifications and n8n can react.

**Simple (like for a 10-year-old):** Let everyone see “where is the job?” and “what happened when,” record the cleaner’s check-in and status, require enough photos, and tell the rest of the app when something changes.

### 10. What does "done" or "success" look like?

**Technical:** GET state returns correct job, timeline, photos, times; check-in and status updates succeed when valid and publish events; min photos enforced; client and n8n receive events and can send notifications. Invalid transition or wrong user → 4xx.

**Simple (like for a 10-year-old):** Success means the tracking screen shows the right info, the cleaner can check in and update status in the right order, we require 3 photos, and emails/automations get the events. Wrong order or wrong user gets an error.

### 11. What would happen if we didn't have it?

**Technical:** No live status or timeline; no structured check-in or status events; notifications and n8n would not have a clear trigger for “on my way,” “started,” “completed”; photo and reliability logic would be scattered.

**Simple (like for a 10-year-old):** We wouldn’t have “live” tracking or a clear record of what happened when. Emails and automations wouldn’t know when the cleaner is on the way or when the job is done. Photo and reliability rules would be messy.

### 12. What is it not responsible for?

**Technical:** Not responsible for: sending notifications (eventBasedNotificationService, n8n); computing reliability (reliabilityService); storing file bytes (fileUploadService); job assignment or pricing. It records status and location and publishes events; others consume.

**Simple (like for a 10-year-old):** It doesn’t send the emails—it just says “this happened.” It doesn’t compute reliability or store the actual photo file. It only records status and location and tells the rest of the app.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** jobId, cleanerId (from JWT or body), status (en_route, arrived, in_progress, awaiting_client, completed), optional location (lat, lng), optional photo URLs and type (before/after). For GET: jobId. Env: GPS_CHECKIN_RADIUS_METERS.

**Simple (like for a 10-year-old):** We need the job and who’s updating, the new status, and maybe location and photos. For “get state” we just need the job id. We have a config for how close the cleaner must be to check in with GPS.

### 14. What it produces or changes

**Technical:** Updates jobs (status, en_route_at, arrived_at, actual_start_at, actual_end_at); inserts job_events (via publishEvent); inserts job_photos (before/after). Returns: full tracking state (job, timeline, photos, cleaner, times, optional location/ETA).

**Simple (like for a 10-year-old):** It updates the job’s status and times, adds events to the timeline, and adds photo rows. It returns the full “tracking state” so the app can show it.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: client/cleaner app (UI), eventBasedNotificationService and n8n (events), reliabilityService (times, photo compliance). Flow: GET → query job + events + photos → return; POST check-in/status → validate → update job → publishEvent → (photos) insert. Rules: valid transition; assigned cleaner; optional GPS radius; min 3 photos at completion.

**Simple (like for a 10-year-old):** The app and notifications use this. We load and return state, or we validate the update, save, publish an event, and maybe save photos. We enforce order, assignment, optional GPS, and 3 photos.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User requests: GET tracking state, POST check-in, POST status, POST photo upload. No cron inside tracking; workers (e.g. no-show) may read tracking state.

**Simple (like for a 10-year-old):** When someone opens tracking or the cleaner checks in or updates status or uploads a photo. Nothing runs on a timer inside tracking.

### 19. What could go wrong

**Technical:** Invalid status transition; wrong cleaner or job; GPS validation fail; duplicate event if retry; min photos not enforced; event published before DB commit (race). Ensure transition table and idempotency where needed.

**Simple (like for a 10-year-old):** We might allow a bad order of statuses, or the wrong person could try to update, or we could publish the event before we’ve saved, so someone could see the wrong state. We need to enforce order and maybe “only once” for updates.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for check-in and status updates; optional metrics for completion rate. Depends on DB, events, job_photos, fileUploadService for photo URLs. Config: GPS_CHECKIN_RADIUS_METERS, min photo counts.

**Simple (like for a 10-year-old):** We log check-ins and status changes. We need the DB, events, and photo storage. We set GPS radius and photo minimums in config.

### 26. Security or privacy

**Technical:** Only assigned cleaner can update status/check-in for that job; client can only view their job. Location is sensitive; don’t log raw lat/lng in plaintext. Job address and timeline may be PII; restrict to job participants and admin.

**Simple (like for a 10-year-old):** Only the cleaner on the job can update status; only the client (and cleaner and admin) should see the job. We don’t log exact location. The address and timeline are private.

### 33. How it interacts with other systems

**Technical:** Publishes to events (publishEvent); job_photos and min count shared with photo proof; reliability uses times and compliance; notifications and n8n consume events. File upload for photo URL. No direct Stripe or ledger writes.

**Simple (like for a 10-year-old):** It writes events so notifications and n8n can run. It shares photo logic with Photo Proof and gives times/compliance to reliability. It doesn’t talk to Stripe or the credit ledger directly.

---

**See also:** FOUNDER_EVENTS.md, FOUNDER_JOB_EVENTS_FLOW.md, FOUNDER_PHOTO_PROOF.md, FOUNDER_FILE_UPLOAD.md.
