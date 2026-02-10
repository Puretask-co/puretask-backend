# Founder Reference: Photo Proof

**Candidate:** Photo proof (Feature #17)  
**Where it lives:** `jobPhotosService`, `photosService`, `photos` routes, `photoRetentionCleanup` worker  
**Why document:** How before/after photos are stored, shown, and deleted (retention, policy).

---

## The 8 main questions

### 1. What it is

**Technical:** Photo proof is the feature that stores and manages before/after job photos for cleaning jobs. Implemented in `src/services/jobPhotosService.ts` and `src/services/photosService.ts`; routes under photos/job endpoints; `job_photos` table (job_id, cleaner_id or uploaded_by, photo_url, type: 'before'|'after', created_at). Cleaners upload before photos (job accepted/en_route/in_progress) and after photos (in_progress/awaiting_client). **Policy:** Minimum 3 photos total (before + after combined); minimum before and after counts enforced in jobTrackingService and reliability (photo compliance bonus +10 points). **Retention:** `photoRetentionCleanup` worker deletes photos older than retention (e.g. 90 days per Photo Proof policy); retention config (e.g. PHOTO_RETENTION_DAYS) in env or config. Photos are stored via file upload service (URL stored in job_photos); display is by URL.

**Simple (like for a 10-year-old):** Photo proof is the “before and after” pictures for each cleaning job. The cleaner uploads “before” and “after” photos; we require at least 3 photos total and use that for “photo compliance” (and a small reliability bonus). We keep photos for a set time (e.g. 90 days) and then a nightly job deletes old ones to save space and follow policy.

### 2. Where it is used

**Technical:** `src/services/jobPhotosService.ts` (addJobPhoto, getJobPhotos, getJobPhotosByType, deleteJobPhoto, checkPhotoCompliance); `src/services/photosService.ts` (similar CRUD, list by job); `src/services/jobTrackingService.ts` (upload before/after, enforce min 3 total, min before count); `src/workers/v2-operations/photoRetentionCleanup.ts` (delete photos past retention); reliabilityService and creditEconomyService (photo compliance bonus). Routes: photos or tracking routes for upload/list/delete. DB: `job_photos`. File storage: fileUploadService (FOUNDER_FILE_UPLOAD.md).

**Simple (like for a 10-year-old):** The code lives in jobPhotosService, photosService, and jobTrackingService; the cleanup job is in photoRetentionCleanup. Upload and list are in the API; reliability and credit economy use “photo compliance” for a small bonus. Photos are stored using the same file upload system as the rest of the app.

### 3. When we use it

**Technical:** When a cleaner uploads a before or after photo (API call during job lifecycle); when client or admin views job photos (GET); when reliability or credit economy calculates photo compliance (nightly or on-demand); when photoRetentionCleanup worker runs (scheduled) to delete photos older than retention.

**Simple (like for a 10-year-old):** We use it when the cleaner adds a photo, when someone views the photos, when we figure out “photo compliance” for reliability, and when the nightly job deletes old photos.

### 4. How it is used

**Technical:** Upload: caller provides jobId, cleanerId, photoUrl, type; jobPhotosService verifies cleaner is assigned and status allows that type (before: accepted/en_route/in_progress; after: in_progress/awaiting_client), then INSERT into job_photos. List: getJobPhotos(jobId) or by type; returned to client/admin. Delete: by photo id with ownership check (cleaner or admin). Compliance: count before/after per job; minimum 3 total (and min before) enforced in jobTrackingService; reliabilityService gives +10 for compliance. Retention: photoRetentionCleanup selects job_photos where job completed_at + retention < now, deletes rows and optionally file storage.

**Simple (like for a 10-year-old):** To upload we check the cleaner is on the job and the job is in the right status, then we save the URL. To list we just return the photos for the job. To delete we check who’s asking and remove the row (and maybe the file). We count “before” and “after” and require at least 3 total; if they meet that we give a small reliability bonus. The cleanup job finds photos older than the retention period and deletes them.

### 5. How we use it (practical)

**Technical:** Frontend calls upload endpoint with file (or file URL from upload service), jobId, type; GET job photos for display. Env: PHOTO_RETENTION_DAYS (e.g. 90), MIN_PHOTOS_TOTAL, MIN_BEFORE_PHOTOS, MIN_AFTER_PHOTOS if used. Worker: ensure photoRetentionCleanup is scheduled (e.g. daily). Storage: fileUploadService stores file and returns URL; that URL is what we put in job_photos.

**Simple (like for a 10-year-old):** The app sends the photo (or a link to it) and says “before” or “after”; we save it. To show photos we just load them by job. We set how many days we keep photos and make sure the cleanup job runs every day. The actual file is stored by our file upload service.

### 6. Why we use it vs other methods

**Technical:** Before/after photos give clients proof of work and support disputes; compliance (min 3) and retention (90 days) balance evidence needs with storage and privacy. Centralizing in jobPhotosService and one worker keeps policy in one place. Alternatives (no photos, indefinite retention) would hurt trust or compliance/storage.

**Simple (like for a 10-year-old):** Photos help clients see the job was done and help us with disputes. Requiring a minimum and deleting after 90 days keeps enough proof without keeping everything forever.

### 7. Best practices

**Technical:** Validate type and job status on upload; enforce min counts at completion or in reliability; run retention cleanup on schedule; delete DB row and optionally file when purging. Ownership check on delete (cleaner or admin). Gaps: ensure file storage delete is called when purging if we want to free disk; document exact min before/after in policy.

**Simple (like for a 10-year-old):** We check job status and type when uploading, require minimum photos where we need them, and run the cleanup job regularly. When we delete we check who’s allowed. We could do better: actually delete the file from storage when we purge, and write down exactly how many before/after we need.

### 8. Other relevant info

**Technical:** job_photos schema may use cleaner_id or uploaded_by; jobTrackingService uses type 'before'|'after' and INSERT with job_id, uploaded_by, type, url. reliabilityService and core reliability (reliabilityScoreV2Service, reliabilityDb) use photo count for compliance. FOUNDER_FILE_UPLOAD.md for storage; FOUNDER_TRACKING.md for check-in and status (which gate photo upload states).

**Simple (like for a 10-year-old):** The table stores who uploaded and the URL. Reliability and scoring use “how many photos” for the bonus. File storage is documented in File Upload; when the cleaner can upload is tied to job status (Tracking).

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Provide before/after evidence for jobs, enforce minimum photo compliance for quality/reliability, and purge photos after retention to meet policy and limit storage.

**Simple (like for a 10-year-old):** Show clients proof of work, reward cleaners who upload enough photos, and delete old photos after we don’t need them anymore.

### 10. What does "done" or "success" look like?

**Technical:** Upload succeeds when job status and assignment allow; list returns correct photos; compliance is true when min 3 total (and min before) met; retention cleanup deletes rows (and optionally files) older than retention; reliability bonus applied when compliant.

**Simple (like for a 10-year-old):** Success means photos save when they’re allowed, we show the right photos, we count compliance correctly, old photos get deleted on time, and the small bonus is applied when they’re compliant.

### 11. What would happen if we didn't have it?

**Technical:** No before/after evidence for clients or disputes; no photo compliance metric or bonus; unbounded storage growth and possible policy/compliance issues.

**Simple (like for a 10-year-old):** We wouldn’t have proof photos, we wouldn’t reward “enough photos,” and we’d keep everything forever, which is bad for storage and rules.

### 12. What is it not responsible for?

**Technical:** Not responsible for: file storage (fileUploadService); job status transitions (jobTrackingService, events); reliability score overall (reliabilityService); dispute resolution. It only stores and deletes photo records (and triggers file delete if implemented); others consume compliance.

**Simple (like for a 10-year-old):** It doesn’t store the actual file—that’s the file upload service. It doesn’t change job status or decide disputes. It just stores and deletes photo records and says “compliant or not”; others use that.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** jobId, cleanerId (or uploaded_by), photoUrl, type ('before'|'after'); job status and assignment from jobs table. For cleanup: retention days (config), job completed_at from jobs.

**Simple (like for a 10-year-old):** We need the job, who’s uploading, the photo URL, and whether it’s before or after. For cleanup we need how many days we keep and when the job was completed.

### 14. What it produces or changes

**Technical:** Inserts/updates/deletes in job_photos; optional file delete in storage. Outputs: list of photos per job; compliance boolean or count for reliability. Retention worker deletes rows (and optionally files).

**Simple (like for a 10-year-old):** It adds or removes rows in the photo table and maybe deletes the file. It returns the list of photos and whether the job is “photo compliant.”

### 15–17. Consumers, flow, rules

**Technical:** Consumers: client/cleaner app (display), admin (view/delete), reliabilityService (compliance bonus), jobTrackingService (enforce min on completion). Flow: upload → validate → insert; list → query; cleanup → query old → delete. Rules: type and status allow upload; min 3 total; retention days; ownership on delete.

**Simple (like for a 10-year-old):** The app and admin look at photos; reliability uses compliance. We validate before saving, require at least 3 photos, delete after retention, and only let the right people delete.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User upload (API); list (API); reliability/compliance calculation (scheduled or on completion); photoRetentionCleanup (scheduled worker).

**Simple (like for a 10-year-old):** When someone uploads or asks for the list, when we calculate compliance, and when the cleanup job runs.

### 19. What could go wrong

**Technical:** Upload in wrong status; min not enforced; retention job not scheduled or failing; file not deleted on purge (storage leak); wrong ownership on delete (security).

**Simple (like for a 10-year-old):** We might allow upload at the wrong time, forget to enforce the minimum, or not run cleanup. We might leave files on disk when we delete the record, or let the wrong person delete.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for upload/delete; optional metric for compliance rate. Depends on DB, fileUploadService, jobs table. Config: PHOTO_RETENTION_DAYS, MIN_PHOTOS_TOTAL, MIN_BEFORE_PHOTOS, MIN_AFTER_PHOTOS.

**Simple (like for a 10-year-old):** We log uploads and deletes. We need the DB and file storage. We set retention and minimums in config.

### 26. Security or privacy

**Technical:** Only assigned cleaner (or admin) can upload/delete for a job. Photos may show home interior; treat as sensitive. Retention limits exposure; purge on user deletion if required by policy.

**Simple (like for a 10-year-old):** Only the cleaner on the job (or an admin) can add or remove photos. Photos can show inside someone’s home, so we treat them as private. Deleting after 90 days limits how long we keep them.

### 33. How it interacts with other systems

**Technical:** jobTrackingService enforces status and min counts; reliabilityService and creditEconomyService use compliance; fileUploadService stores file; photoRetentionCleanup worker in queue. Events: job_completed may trigger compliance evaluation.

**Simple (like for a 10-year-old):** Tracking decides when photos can be uploaded and that we have enough; reliability and credits use “compliant or not”; file upload stores the file; the queue runs the cleanup job.

---

**See also:** FOUNDER_FILE_UPLOAD.md, FOUNDER_TRACKING.md, FOUNDER_QUEUE.md (photoRetentionCleanup), reliabilityService (photo compliance bonus).
