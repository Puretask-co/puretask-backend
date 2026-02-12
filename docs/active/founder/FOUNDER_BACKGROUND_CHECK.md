# Founder Reference: Background Check

**Candidate:** Background check (Module #37)  
**Where it lives:** `backgroundCheckService`  
**Why document:** How background checks are triggered and how results are used (onboarding, risk).

---

## The 8 main questions

### 1. What it is

**Technical:** The background check feature integrates with an external provider (e.g. Checkr) to run background checks on cleaners and uses the result for onboarding and risk. Implemented in `src/services/backgroundCheckService.ts`. **Flow:** (1) Cleaner gives consent (onboarding step; saveBackgroundCheckConsent in cleanerOnboardingService writes to user_consents and creates a row in background_checks with status 'pending'); (2) initiateBackgroundCheck(cleanerId, candidateInfo) — create candidate and report with provider (CHECKR_API_KEY, CHECKR_API_URL), store provider_id and status 'pending' in background_checks, set cleaner_profiles.background_check_status = 'pending'; (3) Provider runs check and sends webhook or we poll; handle webhook/callback: update background_checks (status: 'clear' | 'consider' | 'suspended'), set cleaner_profiles.background_check_status, set completed_at, expires_at; (4) If 'clear', cleaner can proceed; if 'consider' or adverse, may suspend or require admin review; admin can override (overrideBackgroundCheckStatus). **Statuses:** not_started, pending, processing, clear, consider, suspended. **Tables:** background_checks (cleaner_id, provider, provider_id, status, report_url, completed_at, expires_at, metadata); cleaner_profiles.background_check_status. **Config:** CHECKR_API_KEY, CHECKR_API_URL, CHECKR_WEBHOOK_SECRET. Mock mode: if no API key, we may create a local record without calling provider (for dev).

**Simple (like for a 10-year-old):** Background check is the “we check the cleaner’s history” step. They say “yes, you can check” (consent), then we send their info to a company that does the check. When the result comes back we mark them “clear,” “needs review,” or “suspended.” If they’re clear they can keep going; if not, an admin might have to look or we might suspend them. We store when it was done and when it expires so we can ask for a new one later.

### 2. Where it is used

**Technical:** `src/services/backgroundCheckService.ts` — initiateBackgroundCheck, getBackgroundCheckStatus, handleCheckrWebhook (or equivalent), overrideBackgroundCheckStatus, getCleanersNeedingBackgroundCheck (for reminders or admin); `src/services/cleanerOnboardingService.ts` — saveBackgroundCheckConsent (step 6), creates background_checks row; `src/routes/cleanerOnboarding.ts` — POST background-consent; admin routes may expose override and list; manager dashboard (getBackgroundCheckStats). DB: background_checks, cleaner_profiles.background_check_status, user_consents. Worker or cron may call getCleanersNeedingBackgroundCheck (expiring soon or not_started) for reminders.

**Simple (like for a 10-year-old):** The code lives in backgroundCheckService and cleanerOnboardingService. Onboarding has a “background consent” step that saves consent and starts the check. Admins can override the status and see who needs a check. The manager dashboard shows background check stats. We might have a job that finds people whose check is expiring or not started and reminds them.

### 3. When we use it

**Technical:** When a cleaner completes the background-consent onboarding step (saveBackgroundCheckConsent, then initiateBackgroundCheck if we have API key); when the provider sends a webhook (handleCheckrWebhook) with result; when admin overrides status (overrideBackgroundCheckStatus); when we need to list cleaners needing a check (getCleanersNeedingBackgroundCheck) for reminders or admin; when matching or risk logic reads background_check_status (e.g. only assign if clear or not required). Triggered by onboarding, webhook, admin action, and read by matching/risk/dashboard.

**Simple (like for a 10-year-old):** We use it when they finish the consent step (we start the check), when the check company tells us the result (webhook), when an admin overrides, when we list “who needs a check” for reminders, and when we decide “can this cleaner get jobs?” (we might require “clear”).

### 4. How it is used

**Technical:** **Initiate:** Check no existing pending/valid check; create candidate and report via provider API (or mock); INSERT background_checks (cleaner_id, provider, provider_id, status 'pending'), UPDATE cleaner_profiles.background_check_status = 'pending'. **Webhook:** Verify signature (CHECKR_WEBHOOK_SECRET), parse payload, find background_checks by provider_id, UPDATE status (clear/consider/suspended), completed_at, expires_at, report_url; UPDATE cleaner_profiles.background_check_status; if suspended, may restrict jobs or notify; publish action for audit. **Override:** Admin sets status (e.g. clear) and note; UPDATE background_checks and cleaner_profiles; createAuditLog. **Needing check:** SELECT cleaners where background_check_required and (not_started or (clear and expires_at < now + 30 days)). **Matching/risk:** Read cleaner_profiles.background_check_status; only offer jobs to cleaners with clear (or not_required) per policy.

**Simple (like for a 10-year-old):** To start we make sure they don’t already have one in progress, call the check company (or mock), and save “pending.” When the company sends the result we check the secret, find the right record, update status and dates, and update the cleaner’s profile. If they’re suspended we might block jobs. Admin can override and add a note. We can list “who needs a check” (not started or expiring soon). When we match jobs we might only use cleaners who are “clear.”

### 5. How we use it (practical)

**Technical:** Set CHECKR_API_KEY, CHECKR_API_URL, CHECKR_WEBHOOK_SECRET in env. Onboarding: cleaner completes background-consent step → we call saveBackgroundCheckConsent and initiateBackgroundCheck. Provider dashboard: configure webhook URL to point at our route (e.g. POST /webhooks/checkr). Admin: override and list “needing check” from admin or manager routes. Matching/risk: filter by background_check_status where policy requires clear. Mock: if no API key, initiate may create record without calling provider (dev only).

**Simple (like for a 10-year-old):** We put the Checkr key and webhook secret in env. When they finish the consent step we start the check. We tell Checkr where to send the result (webhook). Admins can override and see who needs a check. When we match we might only show “clear” cleaners. In dev we can skip the real API and just create a record.

### 6. Why we use it vs other methods

**Technical:** Background checks are required for trust and compliance in many markets. Using a dedicated provider (Checkr) gives standardized, legally compliant checks and reduces liability. Centralizing in backgroundCheckService keeps initiation, webhook handling, override, and “needing check” logic in one place. Alternatives (no check, manual only) would be risky or not scalable.

**Simple (like for a 10-year-old):** We use it because clients and the law expect us to check cleaners. Using a real check company keeps it consistent and legal. Having one place for “start check,” “receive result,” and “override” keeps it simple and safe.

### 7. Best practices

**Technical:** Verify webhook signature; idempotent webhook handling (same report_id don’t double-update). Store provider_id and report_url for audit; set expires_at and run “needing check” for renewals. Don’t log SSN or full report in plaintext. Override requires admin and audit log. Gaps: document exact policy (who must have clear, when we block jobs); ensure matching and risk consistently read background_check_status; retention for report_url and metadata per provider terms.

**Simple (like for a 10-year-old):** We check the webhook secret so only the provider can send results. We don’t apply the same result twice. We store when the check expires and remind them to renew. We don’t put SSN or the full report in logs. Only admins can override and we log it. We could write down exactly when we block jobs and how long we keep report links.

### 8. Other relevant info

**Technical:** cleanerOnboardingService.saveBackgroundCheckConsent writes user_consents (fcra_consent, accuracy_consent) and creates background_checks row; backgroundCheckService.initiateBackgroundCheck is called after consent (or in a separate step). CHECKR_* env; if no key, mock mode may be used. FOUNDER_CLEANER_ONBOARDING.md for step flow; FOUNDER_GDPR.md for consent recording. Manager dashboard (getBackgroundCheckStats) and admin routes consume this.

**Simple (like for a 10-year-old):** Onboarding saves consent and creates the check row; we might start the actual check right after or in another step. We need the Checkr env vars; without them we can run in mock mode. The onboarding and GDPR docs cover consent; the manager dashboard shows background check numbers.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Run background checks on cleaners via a provider, store result and expiry, and use status (clear/consider/suspended) for onboarding completion and for matching/risk (only assign or allow jobs when policy permits). Support admin override and renewal reminders.

**Simple (like for a 10-year-old):** Run the check, save the result and when it expires, and use “clear” or “suspended” to decide if they can get jobs. Let admins override when needed and remind people to renew.

### 10. What does "done" or "success" look like?

**Technical:** Consent saved; initiate returns background_check record with pending; webhook updates status and dates; cleaner_profiles.background_check_status in sync; override and “needing check” list correct; matching/risk filter by status. Invalid webhook or missing provider_id → 400/404; idempotent so duplicate webhook doesn’t corrupt. Success = correct status in DB and no double-apply.

**Simple (like for a 10-year-old):** Success means we saved consent, started the check, got the result and updated status and dates, and the “can they work?” logic uses that status. Override and “who needs a check” work. Bad webhook or duplicate doesn’t break anything.

### 11. What would happen if we didn't have it?

**Technical:** No structured background check; no provider integration; no status for matching/risk; compliance and trust risk. Onboarding would lack the check step; we couldn’t restrict jobs by check result.

**Simple (like for a 10-year-old):** We wouldn’t have a real check or a clear “clear/suspended” flag. We’d be less compliant and less trusted. We couldn’t block jobs for people who shouldn’t pass.

### 12. What is it not responsible for?

**Technical:** Not responsible for: consent storage (cleanerOnboardingService, user_consents); onboarding step flow (cleanerOnboardingService); matching or risk logic (jobMatchingService, riskService)—they read status. It only initiates check, receives result, stores status, and supports override and “needing check” list; callers decide how to use status.

**Simple (like for a 10-year-old):** It doesn’t store consent or run the rest of onboarding—it just starts the check and saves the result. Matching and risk read the status and decide; we don’t decide “block this job” here.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** initiateBackgroundCheck: cleanerId, candidateInfo (firstName, lastName, email, dateOfBirth, ssn, driverLicenseNumber?, driverLicenseState?). Webhook: raw body, signature header, provider_id in payload. Override: payoutId/cleanerId, new status, note, adminId. getCleanersNeedingBackgroundCheck: optional filter. Env: CHECKR_API_KEY, CHECKR_API_URL, CHECKR_WEBHOOK_SECRET.

**Simple (like for a 10-year-old):** To start we need the cleaner and their name, email, DOB, SSN, and maybe license. The webhook needs the body and the secret signature and the report id. Override needs who and the new status and a note. We need the Checkr keys in env.

### 14. What it produces or changes

**Technical:** Inserts/updates background_checks (provider_id, status, completed_at, expires_at, report_url, metadata); updates cleaner_profiles.background_check_status; createAuditLog on override. Returns: BackgroundCheck, getBackgroundCheckStatus, getCleanersNeedingBackgroundCheck list, getBackgroundCheckStats for dashboard.

**Simple (like for a 10-year-old):** It writes and updates the background_checks table and the cleaner’s status. It writes an audit log when someone overrides. It returns the check record, the status, the list of who needs a check, and stats for the dashboard.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: onboarding (initiate), provider (webhook), admin (override, list), manager dashboard (stats), matching/risk (read status). Flow: consent → initiate → provider runs → webhook → update status; override → update + audit. Rules: webhook signature required; one active check per cleaner (or per policy); override admin-only; status values from provider or override allowlist.

**Simple (like for a 10-year-old):** Onboarding starts the check, the provider sends the result, we update and maybe block jobs, admins can override and see who needs a check, and matching/risk read the status. We require the webhook secret, we don’t start a second check while one is pending, and only admins can override.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** Onboarding step (initiate); provider webhook (result); admin action (override); cron or worker (getCleanersNeedingBackgroundCheck for reminders); dashboard (stats). Read by matching/risk on every relevant flow.

**Simple (like for a 10-year-old):** When they finish consent we start it; when the provider sends the result we update; when an admin overrides we update; we might run a job to find who needs a check; the dashboard loads stats. Matching and risk read the status when they need it.

### 19. What could go wrong

**Technical:** Webhook signature wrong or replay; provider down (initiate fails); duplicate webhook (double update); expires_at not set (no renewal reminder); matching doesn’t filter (assign suspended cleaner). Ensure signature verification, idempotent webhook, set expires_at, and consistent status check in matching/risk.

**Simple (like for a 10-year-old):** The webhook could be fake or sent twice, the provider could be down, we might not set “expires at” so we don’t remind, or matching might ignore status and assign someone suspended. We need to verify the webhook, handle duplicates, set expiry, and always check status when matching.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for initiate, webhook, override; optional metric for clear/suspended counts. Depends on DB, provider API, webhook route. Config: CHECKR_* env; policy for who must have clear and when we block.

**Simple (like for a 10-year-old):** We log when we start, when we get a result, and when someone overrides. We depend on the DB and the check company. We need the Checkr env and a clear policy for when we block jobs.

### 26. Security or privacy

**Technical:** Candidate info (SSN, DOB) is highly sensitive; send only to provider over HTTPS; don’t store SSN in our DB; don’t log. Webhook secret prevents forged results. Report URL may be PII; restrict to admin. Comply with FCRA and provider terms.

**Simple (like for a 10-year-old):** SSN and DOB are very private—we only send them to the check company and we don’t store or log them. The webhook secret stops fake results. Only admins should see the report link. We follow the law and the provider’s rules.

### 33. How it interacts with other systems

**Technical:** cleanerOnboardingService calls saveBackgroundCheckConsent and may call initiateBackgroundCheck; provider sends webhook to our route; admin and manager routes call override and stats; jobMatchingService and riskService read background_check_status. createAuditLog (creditEconomyService or shared) for override. Does not publish job events or call Stripe.

**Simple (like for a 10-year-old):** Onboarding saves consent and starts the check; the provider sends the result to us; admins and manager dashboard use override and stats; matching and risk read the status. We write an audit log for overrides. We don’t send job events or call Stripe.

---

**See also:** FOUNDER_CLEANER_ONBOARDING.md, FOUNDER_GDPR.md (consent), manager dashboard.
