# Founder Reference: Cleaner Onboarding

**Candidate:** Cleaner onboarding (Feature #13)  
**Where it lives:** `src/services/cleanerOnboardingService.ts`, `src/routes/cleanerOnboarding.ts`, `src/services/onboardingReminderService.ts`, `src/workers/onboardingReminderWorker.ts`, `src/routes/onboardingReminders.ts`, `src/routes/adminIdVerifications.ts`; Stripe Connect: `stripeConnectService` (createStripeOnboardingLink); DB: `cleaner_profiles` (onboarding_completed_at, onboarding_current_step, onboarding_started_at, onboarding_reminder_sent_at), `cleaner_agreements`, `id_verifications`, `background_checks`, `cleaner_service_areas`, `availability_blocks`; function `cleaner_onboarding_progress(cleaner_profile_id)`  
**Why document:** Steps, progress, reminders, ID verification; how onboarding is tracked and completed.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** Cleaner onboarding in PureTask is a 10-step flow that turns a newly registered cleaner (user with role "cleaner") into a job-ready contractor. Steps: (1) Agreements (terms of service, independent contractor); (2) Basic info (name, bio, headline); (3) Phone verification (send OTP, verify); (4) Face photo (profile photo upload); (5) ID verification (upload drivers_license/passport/state_id, status pending until admin approves); (6) Background check consent; (7) Service areas (zip codes, travel radius); (8) Availability (day/time blocks); (9) Rates (hourly_rate_credits, travel_radius_km); (10) Complete (validates ≥9 steps, sets onboarding_completed_at). Progress is computed by DB function `cleaner_onboarding_progress(cleaner_profile_id)` and stored/displayed via `onboarding_current_step`. Reminders: `onboardingReminderService` finds cleaners who started but didn’t complete (onboarding_started_at &lt; threshold, onboarding_reminder_sent_at NULL or stale), sends email via SendGrid, updates onboarding_reminder_sent_at. Admin ID verification: admins list/approve/reject ID documents via `adminIdVerifications` routes; status pending → approved/rejected. Stripe Connect onboarding (payouts) is separate: `stripeConnectService.createStripeOnboardingLink` creates account and onboarding link; cleaners complete that in Stripe.

**Simple (like for a 10-year-old):** It’s the checklist a new cleaner has to finish before they can get jobs: agree to rules, add name and bio, verify their phone with a code, add a photo, upload an ID (which an admin later approves), agree to a background check, say where they work and when they’re free, set their rate, then click “complete.” We remember which step they’re on and can send them an email reminder if they stop halfway. Admins look at the ID photos and say “approved” or “rejected.” Getting paid is a separate step (Stripe) that we also call “onboarding” but it’s different—that’s setting up their bank with Stripe.

### 2. Where it is used

**Technical:** `src/services/cleanerOnboardingService.ts` (saveAgreements, saveBasicInfo, uploadFacePhoto, uploadIDVerification, saveBackgroundCheckConsent, saveServiceAreas, saveAvailability, saveRates, completeOnboarding, getOnboardingProgress); `src/routes/cleanerOnboarding.ts` (PATCH /cleaner/onboarding/current-step, GET /cleaner/onboarding/progress, POST agreements, basic-info, phone/send-otp, phone/verify-otp, face-photo, id-verification, background-consent, service-areas, availability, rates, POST /complete); JWT + requireRole("cleaner","admin"). Reminders: `onboardingReminderService.ts` (getAbandonedOnboardingCleaners, sendOnboardingReminder, sendOnboardingReminders); `onboardingReminderWorker.ts` (runOnboardingReminderWorker → sendOnboardingReminders); `src/routes/onboardingReminders.ts` (POST /admin/onboarding-reminders/send, GET /admin/onboarding-reminders/abandoned); scheduler runs worker (e.g. daily). ID verification admin: `src/routes/adminIdVerifications.ts` (GET/POST /admin/id-verifications, GET/POST /admin/id-verifications/:id, approve/reject). Stripe Connect: `stripeConnectService.createStripeOnboardingLink`, used from cleaner routes (e.g. GET link for payouts). DB: cleaner_profiles, cleaner_agreements, id_verifications, phone_verifications, background_checks, cleaner_service_areas, availability_blocks; migration 034 (cleaner_onboarding_enhanced), 035 (onboarding_current_step, onboarding_reminder_sent_at, idx_cleaner_profiles_abandoned_onboarding).

**Simple (like for a 10-year-old):** The app uses it when a cleaner is on the “onboarding” screens: saving each step (agreements, name, phone, photo, ID, service area, availability, rates) and when they click “complete.” We also use it when we send reminder emails to people who started but didn’t finish (a daily job finds them and sends the email). Admins use it when they look at ID documents and approve or reject them. The “where” is the onboarding service, the onboarding routes (under /cleaner/onboarding), the reminder service and worker, and the admin ID verification routes. The database stores agreements, ID uploads, service areas, availability, and when they completed onboarding.

### 3. When we use it

**Technical:** We use it when a cleaner (or admin acting as cleaner) calls any onboarding route after registration—e.g. POST /cleaner/onboarding/agreements, basic-info, face-photo, id-verification, etc.—and when they GET progress or PATCH current-step. We use reminders when the onboardingReminders worker runs on schedule (e.g. daily): it calls getAbandonedOnboardingCleaners(hoursThreshold), then sendOnboardingReminders for each. We use admin ID verification when an admin opens the ID verification dashboard and approves/rejects a document (POST /admin/id-verifications/:id/approve or reject). Stripe Connect onboarding is used when a cleaner needs a payout link (e.g. from cleaner app “Set up payouts”). Triggers: user action (each step, complete), scheduler (reminders), admin action (ID approve/reject).

**Simple (like for a 10-year-old):** We use it whenever a cleaner does the next step (agree, fill name, add photo, upload ID, etc.) or when they click “complete.” We use reminders when the daily job runs—it finds people who started more than 24 hours ago and haven’t finished, and sends them an email. We use admin ID verification when an admin looks at the list of IDs and clicks “approve” or “reject.” We use Stripe onboarding when the cleaner wants to set up getting paid.

### 4. How it is used

**Technical:** Each step writes to DB: agreements → cleaner_agreements; basic info → cleaner_profiles (first_name, last_name, bio, professional_headline); phone → phone_verifications (OTP), then cleaner_profiles.phone_number, phone_verified; face photo → fileUploadService.uploadFile → profile_photo_url on cleaner_profiles; ID → upload file, INSERT id_verifications (status pending); background consent → cleaner_agreements + background_checks (status pending); service areas → cleaner_service_areas + travel_radius_km; availability → availability_blocks; rates → hourly_rate_credits, travel_radius_km. completeOnboarding calls cleaner_onboarding_progress(cleanerId), requires completed ≥ 9, then UPDATE cleaner_profiles SET onboarding_completed_at = NOW(). Progress: SELECT cleaner_onboarding_progress($1), onboarding_current_step FROM cleaner_profiles. Reminders: SELECT cleaners WHERE onboarding_completed_at IS NULL AND onboarding_started_at &lt; threshold AND (onboarding_reminder_sent_at IS NULL OR &lt; onboarding_started_at); for each, SendGrid email, UPDATE onboarding_reminder_sent_at. Admin ID: UPDATE id_verifications SET status = approved|rejected, reviewed_at, reviewed_by.

**Simple (like for a 10-year-old):** For each step we save what they entered: agreements in one table, name and bio on their profile, phone and OTP in another table, photo and ID as uploaded files (ID stays “pending” until an admin says yes or no). Service areas and availability go into their own tables. When they click “complete” we check that at least 9 steps are done and then set “onboarding completed” on their profile. Reminders: we find people who haven’t completed and haven’t had a reminder since they started, send an email, and mark that we sent it. Admins change the ID status from “pending” to “approved” or “rejected.”

### 5. How we use it (practical)

**Technical:** In day-to-day: cleaners hit /cleaner/onboarding/* with JWT (role cleaner or admin). Frontend can PATCH current-step to persist wizard position. Env: FRONTEND_URL for reminder link; SENDGRID_API_KEY, SENDGRID_FROM_EMAIL for reminders. Worker: run onboarding-reminders (scheduler or npm run worker:onboarding-reminders). Admin: use /admin/id-verifications to list pending IDs and approve/reject. Stripe Connect: frontend requests onboarding link from backend, redirects cleaner to Stripe. To debug: query cleaner_profiles (onboarding_completed_at, onboarding_current_step, onboarding_started_at, onboarding_reminder_sent_at); id_verifications (status); logs agreements_saved, basic_info_saved, onboarding_completed, onboarding_reminder_sent, id_verification_status_updated.

**Simple (like for a 10-year-old):** In practice the cleaner logs in and goes through the steps in the app; we save each step and can show “you’re on step 5 of 10.” We need the front-end URL and email settings for the reminder email. We run a daily job to send reminders. Admins use the admin panel to see pending IDs and approve or reject them. For payouts the app gets a link from us and sends the cleaner to Stripe. To see what’s going on we look at the database (completed date, current step, reminder sent) and the logs.

### 6. Why we use it vs other methods

**Technical:** A structured 10-step flow ensures we collect agreements, identity, service area, availability, and rates before the cleaner can receive jobs; the DB function gives a single source of truth for “how many steps done.” Storing onboarding_current_step lets the frontend resume where they left off. Reminders reduce abandonment (only send if they started and haven’t completed, and we haven’t already sent a reminder since they last progressed). Admin ID verification keeps compliance: we don’t auto-approve IDs; an admin reviews. Alternatives: single long form (poor UX, easy to abandon); no reminders (more drop-off); auto-approve ID (compliance risk). We chose: step-by-step, progress function, reminder worker, admin ID review.

**Simple (like for a 10-year-old):** We use it so we get everything we need (rules agreed, name, phone, photo, ID, where they work, when they’re free, rate) before they can get jobs. Doing it in steps is easier than one huge form. Reminders help people come back if they stopped. Having an admin approve IDs keeps us safe (we don’t just trust every upload). Doing it another way (one form, no reminders, or auto-approving IDs) would be worse for finishing or for safety.

### 7. Best practices

**Technical:** We validate per step (e.g. bio length, zip format, rate range, file type/size). Agreements and consents stored with ip_address/user_agent for audit. completeOnboarding requires ≥9 steps so we don’t mark complete too early. Reminder: only send when onboarding_reminder_sent_at is NULL or older than onboarding_started_at so we don’t spam. Admin ID: status transition pending → approved/rejected with reviewed_at, reviewed_by. File uploads use fileUploadService (types, size limits). Gaps: onboarding_started_at may need to be set when they first hit step 1 (otherwise “abandoned” logic uses created_at or first step timestamp); Stripe Connect onboarding is separate and may be after or during main onboarding; background_checks record is created but actual provider (e.g. Checkr) integration may be separate; there is also a gamification table cleaner_onboarding_progress (different from the DB function)—used for gamification, not the main 10-step progress.

**Simple (like for a 10-year-old):** We check that what they type or upload is valid (e.g. bio long enough, zip code format, photo size). We keep a record of when they agreed to things and from where (for audits). We only mark “complete” when almost all steps are done. We only send one reminder until they move forward again. Admins have to set “approved” or “rejected” on IDs with a timestamp. What we could do better: make sure we record “when they started” clearly; the Stripe payout setup is a different flow; the actual background check might be hooked up elsewhere; and there’s another “onboarding progress” used for gamification that’s not the same as this 10-step one.

### 8. Other relevant info

**Technical:** Cleaner registration creates user + cleaner_profiles row (authService.registerUser, role cleaner); onboarding then fills that profile and related tables. Once onboarding_completed_at is set, the cleaner can be matched to jobs (depending on job flow). ID verification status does not block completion of onboarding (cleaner can complete with ID pending); admin approval is for trust/compliance. Stripe Connect is required for payouts (FOUNDER_PAYOUT_FLOW). Reminders depend on SendGrid (FOUNDER_NOTIFICATIONS). Progress function is in 034_cleaner_onboarding_enhanced.sql (cleaner_onboarding_progress returns JSON with completed, total, percentage, step details). Phone OTP is sent via notification/SMS path if implemented. Document any change to steps or required fields in DECISIONS.md.

**Simple (like for a 10-year-old):** When they sign up we create their account and a blank “cleaner profile”; onboarding fills that in. They can finish onboarding even if their ID is still “pending”—an admin will approve it later. To get paid they still have to do Stripe’s setup. Reminders need our email provider. The “how many steps done” is calculated by a database function. If we change the steps or what’s required, we should write it down.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Cleaner onboarding is supposed to: (1) collect legal agreements and consents with audit trail; (2) collect identity and profile (name, bio, photo, phone verified); (3) collect ID document for admin verification; (4) collect background check consent and create pending background_checks record; (5) collect service areas and availability so we can match jobs; (6) collect rates; (7) mark the cleaner as onboarding-complete so they can receive jobs (subject to other checks); (8) nudge abandoners with reminders; (9) let admins approve/reject ID documents. Success means: complete profile, agreements and consents stored, ID either pending or approved, onboarding_completed_at set, and (optionally) reminder sent for incomplete users.

**Simple (like for a 10-year-old):** It’s supposed to get everything we need from a new cleaner (agreements, name, photo, phone, ID, where they work, when they’re free, rate) and mark them as “done” so they can get jobs. It’s also supposed to email people who started but didn’t finish, and let admins say “yes” or “no” to ID photos. Success is: we have their info, we know they’re done, and abandoners got a reminder.

### 10. What does "done" or "success" look like for it?

**Technical:** Done for a step: corresponding DB rows updated (agreements, profile, id_verifications, service_areas, availability_blocks, etc.). Done for onboarding: getOnboardingProgress shows completed ≥ 9, completeOnboarding runs, onboarding_completed_at set. Done for reminder: getAbandonedOnboardingCleaners returns user, sendOnboardingReminder sends email, onboarding_reminder_sent_at updated. Done for ID verification: admin sets id_verifications.status to approved or rejected, reviewed_at and reviewed_by set. Observable: cleaner_profiles.onboarding_completed_at, onboarding_current_step; id_verifications.status; onboarding_reminder_sent_at; logs onboarding_completed, onboarding_reminder_sent, id_verification_status_updated.

**Simple (like for a 10-year-old):** Done for a step: we saved what they entered. Done for onboarding: they’ve done at least 9 steps and we set “onboarding completed.” Done for a reminder: we found them, sent the email, and marked that we sent it. Done for ID: admin set “approved” or “rejected” and we saved who reviewed and when. We can see this in the database and in the logs.

### 11. What would happen if we didn't have it?

**Technical:** Without the 10-step flow we wouldn’t have a consistent way to collect agreements, ID, service area, availability, and rates; matching and compliance would be ad hoc. Without progress tracking we couldn’t resume or show “step X of 10.” Without reminders we’d have more abandoned signups. Without admin ID verification we’d either auto-approve (risk) or have no way to approve (block). Without onboarding_completed_at we couldn’t gate “job-ready” cleanly. Product and trust would suffer.

**Simple (like for a 10-year-old):** Without it we wouldn’t have a clear way to get all the info we need from new cleaners, or to know when they’re really “done.” We’d lose more people who start but don’t finish (no reminders). We wouldn’t have a safe way to approve IDs. So the product would be messier and less safe.

### 12. What is it not responsible for?

**Technical:** Onboarding is not responsible for: user registration (authService); Stripe Connect account creation and payout onboarding (stripeConnectService); running background checks (backgroundCheckService—we only create consent/pending record); job matching (that uses profile/availability/rates but is separate); sending job-related notifications (notification system). Admin ID verification only updates id_verifications; it doesn’t change onboarding_completed_at or job eligibility by itself. The gamification table cleaner_onboarding_progress is a different concept (gamification progress), not the 10-step completion.

**Simple (like for a 10-year-old):** It doesn’t create their account—that’s sign-up. It doesn’t set up their pay with Stripe—that’s a separate “Stripe onboarding.” It doesn’t run the actual background check—we just record that they agreed. It doesn’t assign them jobs—that’s matching. It doesn’t send job emails—that’s the notification system. Approving an ID doesn’t by itself mark onboarding complete. The “onboarding progress” used for badges/gamification is a different thing.

---

## Inputs, outputs, and flow

### 13. What are the main inputs it needs?

**Technical:** Per step: cleanerId (from JWT), step-specific body (agreements, basic info, file, document type, zip_codes/travel_radius_km, availability blocks, hourly_rate_credits). For progress: cleanerId. For completeOnboarding: cleanerId (and DB state from all steps). For reminders: hoursThreshold (default 24), DB: cleaner_profiles (onboarding_completed_at NULL, onboarding_started_at, onboarding_reminder_sent_at), SendGrid config. For admin ID: verification id, status (approved/rejected), optional notes; admin user from auth. Env: FRONTEND_URL, SENDGRID_API_KEY, SENDGRID_FROM_EMAIL. DB: cleaner_profiles, cleaner_agreements, id_verifications, phone_verifications, background_checks, cleaner_service_areas, availability_blocks.

**Simple (like for a 10-year-old):** For each step we need who the cleaner is (from their login) and what they entered (agreements, name, photo file, ID file, zips, schedule, rate). For “complete” we need their id and all that data already saved. For reminders we need the list of people who didn’t finish and haven’t had a reminder, and email settings. For admin ID we need which ID and “approve” or “reject.” We need the database and (for reminders) the front-end URL and email provider.

### 14. What does it produce or change?

**Technical:** Step APIs: INSERT/UPDATE cleaner_agreements, cleaner_profiles, id_verifications, background_checks, cleaner_service_areas, availability_blocks; file storage via fileUploadService; phone_verifications rows. completeOnboarding: UPDATE cleaner_profiles SET onboarding_completed_at. PATCH current-step: UPDATE onboarding_current_step. getOnboardingProgress: read-only (calls cleaner_onboarding_progress + current_step). Reminders: UPDATE cleaner_profiles SET onboarding_reminder_sent_at; SendGrid send. Admin ID: UPDATE id_verifications SET status, reviewed_at, reviewed_by, notes. So we produce/update: agreements, profile fields, verification records, service areas, availability, and timestamps (onboarding_completed_at, onboarding_reminder_sent_at, reviewed_at).

**Simple (like for a 10-year-old):** Each step adds or updates rows: agreements, profile (name, bio, photo, phone), ID upload (pending), background check consent, service areas, availability, rates. “Complete” sets the “onboarding completed” time. Reminders update “reminder sent” and send an email. Admin ID updates the ID’s status and who reviewed it and when.

### 15. Who or what consumes its output?

**Technical:** Consumers of onboarding state: frontend (progress, current step, “complete”); job matching / eligibility logic (may check onboarding_completed_at, profile, availability, rates); admin (list cleaners, see ID status). Consumers of id_verifications status: admin dashboard, compliance; optionally job eligibility. Reminder email: the cleaner (to return and complete). Stripe Connect link consumer: cleaner (redirect to Stripe). No external system consumes onboarding tables directly; our app and admin UI do.

**Simple (like for a 10-year-old):** The app uses it to show “step X of 10” and “you’re done.” The part that assigns jobs might use “is onboarding complete?” and their availability/rates. Admins use it to see cleaners and to approve/reject IDs. The reminder email is for the cleaner. The Stripe link is for the cleaner to set up payouts. Nothing outside our system reads this data.

### 16. What are the main steps or flow it performs?

**Technical:** Flow: (1) Cleaner registers (auth); (2) Cleaner does steps 1–9 via POSTs, optionally PATCH current-step; (3) GET progress shows completed/total/current_step; (4) POST complete → cleaner_onboarding_progress(), if completed ≥ 9 then SET onboarding_completed_at; (5) Reminder worker: getAbandonedOnboardingCleaners(24) → for each sendOnboardingReminder → email + UPDATE onboarding_reminder_sent_at; (6) Admin: list id_verifications (filter pending) → open one → POST approve/reject → UPDATE status, reviewed_at, reviewed_by. Stripe Connect: ensureCleanerStripeAccount, createStripeOnboardingLink → redirect cleaner to Stripe.

**Simple (like for a 10-year-old):** They sign up, then do the 10 steps (agree, name, phone, photo, ID, background consent, areas, availability, rates). They can see progress and then click “complete”; we only allow that when 9+ steps are done. The daily job finds people who didn’t finish and sends them an email, and we mark that we sent it. Admins look at pending IDs and approve or reject. For payouts we give them a link to Stripe so they can finish setting up there.

### 17. What rules or policies does it enforce?

**Technical:** Both agreements must be true to save agreements. Basic info: first_name, last_name required; bio length ≥ 20. Phone: OTP must match and not be expired. Face photo: allowed types and max size (e.g. 5MB) via fileUploadService. ID: allowed document types (drivers_license, passport, state_id), max size (e.g. 10MB). Service areas: at least one zip, 5-digit US format; travel_radius_km 5–50. Availability: at least one active block. Rates: hourly_rate_credits 200–1000 (e.g. $20–$100), travel_radius_km 5–50. completeOnboarding: completed ≥ 9. Reminders: only if onboarding_completed_at IS NULL and onboarding_started_at &lt; threshold and (onboarding_reminder_sent_at IS NULL or &lt; onboarding_started_at). Admin ID: only admin role can approve/reject.

**Simple (like for a 10-year-old):** They have to agree to both rules. Name and bio are required; bio has to be long enough. Phone has to be verified with the code we send. Photo and ID have to be the right type and size. They need at least one zip code and a travel distance in range. They need at least one day/time when they’re available. Rate has to be in the allowed range. We only let them click “complete” when 9 or more steps are done. We only send a reminder if they’re not done and we haven’t already sent one since they last moved. Only admins can approve or reject IDs.

---

## Triggers and behavior

### 18. What triggers it or kicks it off?

**Technical:** User actions: each POST to an onboarding step (agreements, basic-info, phone/send-otp, phone/verify-otp, face-photo, id-verification, background-consent, service-areas, availability, rates), PATCH current-step, GET progress, POST complete. Scheduler: onboardingReminders worker (e.g. daily) triggers getAbandonedOnboardingCleaners and sendOnboardingReminders. Admin actions: GET /admin/id-verifications, POST approve/reject. Request for Stripe Connect link triggers ensureCleanerStripeAccount and createStripeOnboardingLink.

**Simple (like for a 10-year-old):** The cleaner triggers it by doing each step and clicking “complete.” A daily job triggers the reminders. An admin triggers ID verification when they open the list and approve or reject. When the cleaner wants to set up payouts, that triggers the Stripe link.

### 19. What could go wrong while doing its job?

**Technical:** DB or file upload failure on any step → error response, no partial state or inconsistent state if not transactional. completeOnboarding can fail if &lt;9 steps (returns error). Reminder: SendGrid down or invalid → sendOnboardingReminder fails, we might not update onboarding_reminder_sent_at (so we could retry); if we update before send we could mark sent but not deliver. Admin ID: wrong id or already reviewed → 404 or no-op. File validation (type/size) rejects bad uploads. Race: two tabs completing at once—both might pass the ≥9 check; setting onboarding_completed_at is idempotent. onboarding_started_at not set → getAbandonedOnboardingCleaners might not include them (depends on schema default).

**Simple (like for a 10-year-old):** Saving a step could fail (database or file problem) and they’d see an error. If they click “complete” before 9 steps we say “please complete all steps.” Reminder email might fail if the email provider is down—we might try again next day. Admins might click the wrong ID or one that’s already done. If they upload the wrong file type we reject it. If they complete in two tabs at once we might set “completed” twice but that’s harmless.

---

## Dependencies, config, and operations

### 20. How do we know it's doing its job correctly?

**Technical:** Logs: agreements_saved, basic_info_saved, face_photo_uploaded, id_verification_uploaded, onboarding_completed, get_onboarding_progress_failed, onboarding_reminder_sent, send_onboarding_reminders_failed, id_verification_status_updated. DB: cleaner_profiles.onboarding_completed_at and onboarding_current_step; id_verifications.status; count of rows in cleaner_agreements, cleaner_service_areas, availability_blocks. Monitoring: reminder worker logs (onboarding_reminder_worker_started, completed, errors). No built-in metrics; could add counters for completion rate, reminder send count.

**Simple (like for a 10-year-old):** We look at logs (step saved, onboarding completed, reminder sent, ID approved/rejected) and at the database (completed date, current step, ID status). We don’t have fancy dashboards for it yet; we could add numbers like “how many completed this week” or “how many reminders sent.”

### 21. What does it depend on to do its job?

**Technical:** DB: cleaner_profiles, users, cleaner_agreements, id_verifications, phone_verifications, background_checks, cleaner_service_areas, availability_blocks; function cleaner_onboarding_progress. Auth: JWT, requireRole(cleaner|admin). File storage: fileUploadService (and underlying storage). Reminders: SendGrid (sgMail), env SENDGRID_API_KEY, SENDGRID_FROM_EMAIL, FRONTEND_URL. Admin ID: requireRole(admin). Stripe Connect: Stripe API, stripeConnectService. Queue/scheduler for worker: onboarding-reminders worker registered, scheduler runs it.

**Simple (like for a 10-year-old):** It needs the database (profiles, agreements, IDs, service areas, availability, etc.) and the function that calculates progress. It needs login (JWT) and that the user is a cleaner or admin. It needs file storage for photos and IDs. Reminders need the email provider and the front-end URL. Admin ID needs admin login. Stripe onboarding needs Stripe. The reminder job needs the worker and the scheduler.

### 22. What are the main config or env vars that control its behavior?

**Technical:** FRONTEND_URL: used in reminder email link (default https://app.puretask.com). SENDGRID_API_KEY, SENDGRID_FROM_EMAIL: for reminder emails. No feature flag in code for onboarding itself. File limits: PROFILE_PHOTO_TYPES, 5MB (face); ID_DOCUMENT_TYPES, 10MB (id_verification). Reminder threshold: hoursThreshold (default 24) in getAbandonedOnboardingCleaners/sendOnboardingReminders. Worker schedule: defined in scheduler (e.g. daily for onboarding-reminders).

**Simple (like for a 10-year-old):** We need the front-end URL for the “continue onboarding” link in the email, and the email provider’s key and “from” address. We don’t have an on/off switch for onboarding. Photo and ID have size and type limits in code. The “how many hours before we consider them abandoned” is 24 by default. When the reminder job runs is set in the scheduler.

### 23. How do we test that it accomplishes what it should?

**Technical:** Unit tests: cleanerOnboardingService (saveAgreements, saveBasicInfo, uploadFacePhoto, uploadIDVerification, saveBackgroundCheckConsent, saveServiceAreas, saveAvailability, saveRates, completeOnboarding, getOnboardingProgress), onboardingReminderService (getAbandonedOnboardingCleaners, sendOnboardingReminders). Route tests: cleanerOnboarding routes (current-step, agreements, progress, etc.) with mocks. Integration: onboardingFlow.test (full 10-step flow with mocks). Worker test: onboardingReminderWorker. Migrations: 035_onboarding_enhancements (onboarding_current_step, onboarding_reminder_sent_at, index). Manual: run through steps in app, trigger reminder worker, admin approve/reject ID.

**Simple (like for a 10-year-old):** We have tests that call the service and route functions (sometimes with fake DB) to check that each step saves correctly and that “complete” only works when enough steps are done. We have tests for the reminder service (who we find, that we send). We have an integration test that walks through the whole flow with mocks. We can also do it by hand in the app and run the reminder job and admin ID flow.

### 24. How do we recover if it fails to accomplish its job?

**Technical:** Step failure: user retries; no automatic retry. Reminder send failure: we don’t update onboarding_reminder_sent_at on send failure (in current code we do update after send)—if we update only on success, next run will retry; if SendGrid is down, fix provider or run worker again. Admin ID: if wrong status was set, admin can update again if we add an “edit” or we fix in DB. completeOnboarding: if they were short of 9 steps, they complete the missing steps and call complete again. DB/transaction: ensure critical updates are in transactions where needed; no cross-step transaction for full onboarding. No formal runbook; logs and DB state are the source of truth.

**Simple (like for a 10-year-old):** If a step fails they can try again. If the reminder email fails we might retry next time the job runs (depending on whether we marked “sent”). If an admin approves the wrong ID we’d have to fix it in the database or add a way to change it. If they click “complete” too early we tell them to finish the steps and try again. We don’t have a written runbook; we use logs and the database to figure out what went wrong.

---

## Stakeholders, security, and limits

### 25. Who are the main stakeholders?

**Technical:** Cleaners: need a clear, resumable flow and reminders so they can get to “job-ready.” Product/ops: care about completion rate and time-to-complete. Admins: need ID verification queue and approve/reject workflow. Compliance/legal: care about agreements and consent audit trail (ip_address, user_agent) and ID review. Support: may need to see progress or trigger reminder or help with Stripe Connect.

**Simple (like for a 10-year-old):** Cleaners want to finish and get jobs. The team cares how many people finish and how fast. Admins need to review IDs. Legal/compliance care that we have records of who agreed to what and who approved IDs. Support might need to see where someone is stuck or help with payouts.

### 26. What are the security or privacy considerations?

**Technical:** Onboarding routes require JWT and role cleaner or admin; cleaners can only update their own profile (cleanerId from token or session). ID documents and profile photos are PII; store in secure storage, control access (admin for id_verifications). Agreements store ip_address, user_agent for audit. Admin ID routes require admin role. Don’t log full ID document or photo contents. Phone numbers and OTPs are sensitive; expire OTPs, don’t expose in APIs. FRONTEND_URL and SendGrid are not secrets but must be correct. Consider rate limiting on send-otp and file upload to prevent abuse.

**Simple (like for a 10-year-old):** Only the cleaner (or an admin) can do their onboarding; they can’t change someone else’s. ID and photo are private—we store them safely and only admins see IDs. We keep who agreed to what and from where (for legal). Only admins can approve IDs. We don’t put ID or photo in logs. We should limit how often someone can request a code or upload files so people can’t abuse it.

### 27. What are the limits or scaling considerations?

**Technical:** Per-cleaner: one profile, N agreements, N id_verifications (e.g. re-upload), N service area rows, N availability blocks. Reminder worker: loops over all abandoned cleaners in one run; if thousands, consider batching or queue per user. SendGrid has rate limits. File upload size limits (5MB photo, 10MB ID) and type allowlists. No hard limit on concurrent onboarding sessions; DB and auth handle it. Progress function is a single SELECT; low cost. Admin ID list: pagination not clearly present in adminIdVerifications GET—add limit/offset if list grows.

**Simple (like for a 10-year-old):** Each cleaner has one profile and a bunch of rows for agreements, IDs, areas, and availability. The reminder job goes through everyone who’s abandoned; if there are tons we might need to do it in chunks. The email provider can only send so many emails per second. File size and type are limited. We don’t limit how many people can be onboarding at once. If the admin ID list gets huge we might need “next page.”

### 28. What would we change about how it accomplishes its goal if we could?

**Technical:** Set onboarding_started_at explicitly when they first complete step 1 (or first hit progress) so “abandoned” is well-defined. Add idempotency for completeOnboarding (e.g. idempotency key) so double-submit doesn’t cause confusion. Consider reminder throttle (e.g. max one per 7 days per user). Paginate admin ID list and add filters. Integrate background check provider so status moves from pending → passed/failed. Add feature flag for onboarding version or steps. Consider A/B test reminder copy or timing. Document that gamification cleaner_onboarding_progress table is separate from DB function.

**Simple (like for a 10-year-old):** We’d make “when they started” clearer. We’d make “complete” safe to click twice. We might limit how often we remind the same person. We’d add “next page” and filters for the admin ID list. We’d hook up the real background check so its status updates. We might add a switch to turn steps on/off or test different reminder messages. We’d write down that the “onboarding progress” for gamification is not the same as the 10-step progress.

---

## Lifecycle, state, and boundaries

### 29. How does it start and finish (lifecycle)?

**Technical:** Start: cleaner registers (auth) and gets a cleaner_profiles row; first onboarding API call (e.g. GET progress or POST agreements) begins the flow; onboarding_started_at should be set (currently may rely on profile created_at or first step). Lifecycle: they move through steps 1–9 (any order in practice, but complete checks ≥9); they can PATCH current-step anytime; POST complete sets onboarding_completed_at (finish). Reminder lifecycle: worker runs → find abandoned → send email → set onboarding_reminder_sent_at; if they resume, next run might find them again if threshold and reminder_sent logic allow. ID verification lifecycle: cleaner uploads → status pending; admin approves/rejects → status approved/rejected, reviewed_at set. Stripe Connect: separate lifecycle (link → redirect → Stripe → return).

**Simple (like for a 10-year-old):** It starts when they have an account and a cleaner profile and they start doing steps. They go through the steps (we remember where they are) until they click “complete”; then we set “onboarding completed” and they’re done. Reminders: we find them, send email, mark “reminder sent”; if they come back and don’t finish again we might send another reminder later depending on rules. ID: they upload → “pending”; admin says “approved” or “rejected.” Stripe payouts are a separate flow that starts when they want to set up pay.

### 30. What state does it keep or track?

**Technical:** cleaner_profiles: onboarding_completed_at, onboarding_current_step, onboarding_started_at, onboarding_reminder_sent_at; profile fields (first_name, last_name, bio, profile_photo_url, phone_number, phone_verified, travel_radius_km, hourly_rate_credits). cleaner_agreements: per agreement type (terms_of_service, independent_contractor, background_check_consent), ip_address, user_agent. id_verifications: document_type, document_url, status (pending/approved/rejected), reviewed_at, reviewed_by, notes. phone_verifications: otp, expires_at, verified_at. background_checks: status (pending/…). cleaner_service_areas: zip_code per row. availability_blocks: day_of_week, start_time, end_time, is_active. Progress is derived: cleaner_onboarding_progress(cleaner_profile_id) returns JSON (completed, total, percentage, step details).

**Simple (like for a 10-year-old):** We keep: whether and when they completed onboarding, which step they’re on, when they started, and when we last sent a reminder. We keep their name, bio, photo, phone, and whether it’s verified. We keep their ID upload and whether an admin approved or rejected it. We keep their agreements and when they agreed. We keep their service zips, travel distance, availability blocks, and rate. The “how many steps done” is calculated from all of that.

### 31. What assumptions does it make to do its job?

**Technical:** Assumes cleaner_profiles exists for the user (created at registration). Assumes cleaner_onboarding_progress() exists and returns { completed, total, … } with total 10 and completed derived from DB state. Assumes step order or at least that “complete” requires ≥9 steps; frontend may enforce order. Assumes fileUploadService stores files and returns URL. Assumes SendGrid is configured for reminders. Assumes admin role exists for ID verification. Assumes zip codes are 5-digit US for validation. Assumes availability blocks use same day_of_week convention (e.g. 0–6). Assumes id_verifications has unique constraint or we allow multiple uploads per cleaner (current: INSERT per upload).

**Simple (like for a 10-year-old):** We assume they already have an account and a cleaner profile. We assume the database has a function that can tell us how many steps are done. We assume we need at least 9 steps before “complete.” We assume we have file storage and email set up. We assume there are admins who can approve IDs. We assume zip codes are US 5-digit. We assume we know what “day of week” and “available” mean in the database.

### 32. When should we not use it (or use something else)?

**Technical:** Don’t use onboarding routes for clients (different role). Don’t use getAbandonedOnboardingCleaners for “all cleaners” reporting—it’s for reminder targeting. Don’t use admin ID verification to block onboarding completion—we allow complete with ID pending. Don’t use the gamification cleaner_onboarding_progress table as the source of truth for “10-step completed”—use cleaner_profiles.onboarding_completed_at and cleaner_onboarding_progress() function. For “can this cleaner get jobs?” use onboarding_completed_at and any other business rules (e.g. ID approved, background passed), not just progress percentage. Use Stripe Connect onboarding when they need payouts, not as part of the 10-step flow.

**Simple (like for a 10-year-old):** We don’t use this flow for clients—only cleaners. We don’t use the “abandoned” list for general reports. We don’t require ID to be approved before they can click “complete.” We don’t use the gamification “onboarding progress” table to decide if they finished the 10 steps—we use the “onboarding completed” time and the progress function. For “can they get jobs?” we use that plus any other rules (e.g. ID, background). Stripe onboarding is for payouts only.

### 33. How does it interact with other systems or features?

**Technical:** Auth: JWT and role for /cleaner/onboarding and /admin/id-verifications. fileUploadService: face photo and ID document upload and storage. Notification/SendGrid: reminder email (not the main notification service, but same provider). stripeConnectService: separate onboarding link for payouts. Events: no direct publish from onboarding steps (job flow does); admin ID update doesn’t publish event in current code. Job matching: may read onboarding_completed_at, profile, availability, rates. backgroundCheckService: we only create pending record; provider integration elsewhere. DB function cleaner_onboarding_progress is called by getOnboardingProgress and completeOnboarding. Gamification routes read/update cleaner_onboarding_progress table (different from this flow).

**Simple (like for a 10-year-old):** It uses login (JWT) so we know who the cleaner or admin is. It uses file storage for photo and ID. It uses the same email provider as other emails for reminders. Stripe Connect is a separate system for payouts. When we assign jobs we might look at “onboarding completed” and their profile and availability. We create a “background check” record but the real check might be done elsewhere. The “progress” we show comes from a database function. The gamification “onboarding progress” is a different table used for badges.

---

## Failure, correctness, and ownership

### 34. What does "failure" mean for it, and how do we signal it?

**Technical:** Step failure: validation error (e.g. “Bio must be at least 20 characters”) or DB/upload error → 400/500, { success: false, error: "…" }. completeOnboarding failure: &lt;9 steps → { success: false, error: "Please complete all steps. Currently X/10 steps completed." }. Reminder failure: sendOnboardingReminder returns { success: false, error }; we log send_onboarding_reminder_failed; may or may not update onboarding_reminder_sent_at. Admin ID: not found → 404; already reviewed → could return 409 or no-op. API errors use consistent shape { error: { code, message } }. Logs use structured fields (cleanerId, error, step).

**Simple (like for a 10-year-old):** If a step fails we return an error message (e.g. “bio too short” or “something went wrong”). If they click “complete” before 9 steps we say “please complete all steps” with how many they’ve done. If the reminder email fails we log it and might not mark “sent.” If an admin tries to approve an ID that doesn’t exist we return “not found.” We try to use the same error format everywhere and to log useful info.

### 35. How do we know its outputs are correct or complete?

**Technical:** completeOnboarding explicitly checks cleaner_onboarding_progress().completed ≥ 9 before setting onboarding_completed_at. Step validations (bio length, zip format, rate range, file type/size) enforce invariants. We don’t run a full “consistency check” after every step; the progress function is the source of truth for “how many steps done.” Reminder: we consider “correct” that we only email abandoned users and update onboarding_reminder_sent_at after send; no checksum. Admin ID: we trust admin action; optional notes for audit. Tests assert step outcomes and completeOnboarding behavior. Manual spot-check: run through flow, confirm DB state and progress.

**Simple (like for a 10-year-old):** We know “complete” is correct because we only set “onboarding completed” when the progress function says at least 9 steps are done. We validate each step (lengths, formats, sizes). We don’t double-check everything after every step—the progress function tells us. For reminders we trust that we found the right people and sent the email. For ID we trust the admin. We have tests and can also check by hand.

### 36. Who owns or maintains it?

**Technical:** Code lives in cleanerOnboardingService, cleanerOnboarding routes, onboardingReminderService, onboardingReminderWorker, onboardingReminders routes, adminIdVerifications routes; DB in migrations 034, 035. No explicit OWNER file; whoever owns “cleaner experience” or “trust & safety” typically owns onboarding and ID verification. Changes to steps or required fields should update the progress function and any frontend; document in DECISIONS.md.

**Simple (like for a 10-year-old):** The team that owns the cleaner app or “trust and safety” usually owns this. The code is in the onboarding service, routes, reminder service and worker, and admin ID routes. If we change what steps we need or what “done” means, we have to update the progress logic and the app and write it down.

### 37. How might it need to change as the product or business grows?

**Technical:** Add steps (e.g. tax form, insurance) or make some optional; update progress function and complete threshold. Support multiple regions (zip format, ID types). Scale reminders: queue per user, cap per run, or batch by cohort. Add role-based steps (e.g. different flow for different cleaner tiers). Integrate background check provider and surface status in onboarding. Add analytics (funnel, drop-off by step, time-to-complete). Admin: bulk approve/reject, reason codes, audit export. Consider moving reminder content to templates or CMS. Stripe Connect might be required before “complete” in some regions.

**Simple (like for a 10-year-old):** We might add or remove steps (e.g. tax form, insurance) and then we’d have to update “how many steps” and what “complete” means. We might support more countries (different zips, different ID types). If we have lots of abandoners we might need to send reminders in batches or limit how many we send. We might show “background check status” in the flow once it’s hooked up. We might add dashboards for “where do people drop off.” Admins might get “bulk approve” or better audit logs. Reminder text might come from a template system. In some places we might require Stripe setup before they can finish.

---

## Optional deeper questions (selected)

### A8. What do end users (clients, cleaners, admins) actually see or experience?

**Technical:** Cleaners see a multi-step wizard (terms, basic info, phone verify, face photo, ID upload, background consent, service areas, availability, rates, review/complete). They see progress (e.g. “step 5 of 10”) and can resume; they get an email if they abandon (reminder with link). Admins see ID verification queue (list of pending/rejected/approved), open a document, approve/reject with optional notes. Clients do not see onboarding; they see cleaners who are “job-ready” (onboarding complete, etc.).

**Simple (like for a 10-year-old):** Cleaners see the steps one by one, with a “you’re on step 5 of 10” and a “complete” button at the end. If they leave and don’t finish they get an email with a “continue” link. Admins see a list of ID photos to review and buttons to approve or reject. Clients don’t see any of this—they just see cleaners who are ready for jobs.

### A10. Can we run it twice safely (idempotency)?

**Technical:** Step APIs: saving agreements or basic info again overwrites/upserts; id_verification creates a new row per upload (multiple IDs possible); service areas and availability replace all rows for that cleaner (DELETE + INSERT). So “run twice” for a step is generally safe but may create duplicate id_verifications. completeOnboarding: setting onboarding_completed_at again is idempotent (same state). Reminder: we update onboarding_reminder_sent_at after send—if we retry sendOnboardingReminder we might send duplicate email unless we check “already sent after their last progress.” Admin ID: approve/reject again on same id is idempotent (status and reviewed_at). No idempotency key on POST complete; could add for double-submit safety.

**Simple (like for a 10-year-old):** Doing a step twice usually just overwrites or adds (e.g. we might have two ID uploads). Clicking “complete” twice is fine—we just set “completed” again. Sending a reminder twice might send two emails unless we’re careful. Approving or rejecting an ID twice is fine—we just update the status. We could add a “submit once” key for “complete” to be extra safe.

### A16. Who is allowed to invoke it or change its configuration?

**Technical:** Onboarding step and complete APIs: JWT with role cleaner or admin; in practice cleanerId should be the authenticated user (or admin acting for them). Reminder send: POST /admin/onboarding-reminders/send is admin-only (onboardingReminderRouter likely protected). GET abandoned: admin-only. Admin ID verification: all routes under adminIdVerifications require admin. Config (FRONTEND_URL, SENDGRID_*, worker schedule): ops/deploy; no in-app config UI.

**Simple (like for a 10-year-old):** Only the cleaner (or an admin on their behalf) can do the onboarding steps and complete. Only admins can trigger “send reminders” and see the list of abandoned people. Only admins can approve or reject IDs. Changing the front-end URL or email settings or when the job runs is done by the team that deploys, not in the app.

---

*End of Founder Reference: Cleaner Onboarding*
