# Founder Reference: GDPR / Data Privacy

**Candidate:** GDPR / data privacy (Feature #21)  
**Where it lives:** `gdprService`, data export, deletion, consent  
**Why document:** How we export or delete user data and how consent is recorded.

---

## The 8 main questions

### 1. What it is

**Technical:** GDPR/data privacy in PureTask is the set of features that support the rights to access and erasure and consent management. Implemented in `src/services/gdprService.ts` and `src/routes/userData.ts` (mounted at `/user`). **Data export (right to access):** exportUserData(userId) gathers profile (users), client_profile, cleaner_profile, jobs (as client or cleaner), payments, credit_transactions, messages, consent_history into a structured UserDataExport JSON; returned to the user (or support) so they can download their data. **Data deletion (right to be forgotten):** deleteUserData(userId) (or equivalent) anonymizes or deletes user and related rows (jobs, ledger, consents, etc.) per policy—may soft-delete or cascade; must not leave PII. **Consent management:** recordConsent(userId, type, accepted, version) writes to user_consents; getUserConsent(userId, type) returns current consent. Consent types: e.g. privacy_policy, terms_of_service, marketing, background_check_consent. Tables: user_consents (user_id, type, accepted, version, accepted_at). Routes: POST /user/data/export, POST /user/data/delete (or similar), POST /user/consent, GET /user/consent/:type.

**Simple (like for a 10-year-old):** GDPR is the “my data” rules. We let users (1) download a copy of their data (export), (2) ask us to delete their data (deletion), and (3) record and check what they agreed to (consent). We store when they said “yes” or “no” to things like privacy policy or marketing.

### 2. Where it is used

**Technical:** `src/services/gdprService.ts` — exportUserData, deleteUserData (or anonymizeUser), recordConsent, getUserConsent; `src/routes/userData.ts` — POST export, POST delete, POST consent, GET consent/:type. Mounted at `/user`. Other services may call recordConsent (e.g. cleaner onboarding for background_check_consent). DB: users, client_profiles, cleaner_profiles, jobs, payments, credit_ledger, messages, user_consents; deletion may touch many tables and must respect referential integrity (anonymize or cascade per policy).

**Simple (like for a 10-year-old):** The code lives in gdprService and userData routes under /user. When we need to record consent (e.g. at onboarding), we call recordConsent. Export and delete read or change many tables so we have to be careful not to break links.

### 3. When we use it

**Technical:** When a user (or support on their behalf) requests “export my data” (POST export); when a user requests “delete my account/data” (POST delete); when we need to record consent (POST consent) — e.g. at signup, onboarding, or when they accept terms; when we need to check consent (GET consent/:type) — e.g. before sending marketing. Triggered by user actions or internal flows that record consent.

**Simple (like for a 10-year-old):** We use it when someone asks for their data, when they ask to delete their data, when they say “I agree” to something (we record it), and when we need to check “did they agree?” before doing something (e.g. marketing).

### 4. How it is used

**Technical:** Export: query users, client_profiles, cleaner_profiles, jobs, payments, credit_transactions, messages, user_consents for that user_id; build UserDataExport object; return JSON (or trigger download). Deletion: per policy—delete or anonymize user row and related rows (jobs may be anonymized client_id/cleaner_id; ledger may be kept for legal/financial with user_id nulled; consents deleted). Consent: INSERT or UPDATE user_consents (user_id, type, accepted, version); GET returns latest row for user+type. All scoped by userId from JWT (user can only export/delete/consent for self unless admin).

**Simple (like for a 10-year-old):** For export we collect everything we have about that user and give them a file. For deletion we remove or anonymize their data so we can’t identify them anymore. For consent we write “user X agreed to Y at Z” and we can look it up later. Users can only do this for themselves unless they’re an admin.

### 5. How we use it (practical)

**Technical:** Frontend: “Download my data” (POST /user/data/export), “Delete my account” (POST /user/data/delete), “I agree” (POST /user/consent), “Did I agree?” (GET /user/consent/:type). JWT identifies user. Export may be async (e.g. queue job) if large; deletion may require confirmation or cooling-off. Env: no required GDPR-specific env; policy (what to anonymize vs delete) in code or config.

**Simple (like for a 10-year-old):** The app has “download my data” and “delete my account” and “I agree” and “check consent.” We use their login to know who they are. Big exports might be done in the background; deletion might need a second “are you sure?”

### 6. Why we use it vs other methods

**Technical:** GDPR (and similar laws) require access and erasure and lawful basis (consent where needed). Centralizing in gdprService and userData routes gives one place for policy and audit. Alternatives (ad-hoc export, no deletion, no consent records) would be non-compliant and risky.

**Simple (like for a 10-year-old):** The law says people can get their data and ask us to delete it, and we have to know what they agreed to. Having one place for this makes it easier to do it right and to prove we did it.

### 7. Best practices

**Technical:** Export only the requesting user’s data; deletion must be irreversible for PII (anonymize or delete); consent stored with version and timestamp. Document what is exported/deleted/anonymized; consider retention for legal/financial (e.g. ledger entries with user_id nulled). Don’t log full export or deletion payload in plaintext. Gaps: ensure all PII sources included in export and deletion; consent versioning and “withdraw consent” flow; data processing agreement for subprocessors (e.g. OpenAI, Stripe).

**Simple (like for a 10-year-old):** We only give or delete that user’s data. We record consent with a version and time. We write down what we export and delete. We don’t put full data dumps in logs. We could do better: make sure we don’t miss any place we store their data, and support “I take back my consent.”

### 8. Other relevant info

**Technical:** cleanerOnboardingService saves background_check_consent via recordConsent or direct INSERT user_consents. Message history, job photos, and other features may need to be included in export/deletion (gdprService should aggregate or call into them). Stripe and other third parties may retain data per their policies; document in privacy policy. Audit: log export and deletion requests (who, when) without logging the payload.

**Simple (like for a 10-year-old):** Onboarding uses the same consent table for background check. When we export or delete we have to include messages and photos and everything else we have. Stripe and others keep their own copies—we say that in our privacy policy. We log “who asked for export/delete and when” but not the actual data.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Fulfill data subject rights: access (export), erasure (deletion), and lawful basis (consent recording and retrieval); support compliance and audit.

**Simple (like for a 10-year-old):** Let users get a copy of their data, ask us to delete it, and have a clear record of what they agreed to—so we follow the law and can show we did.

### 10. What does "done" or "success" look like?

**Technical:** Export returns complete, accurate JSON (or file) for that user. Deletion removes or anonymizes PII so user is no longer identifiable. Consent POST stores type/accepted/version; GET returns current consent. Invalid user or type → 400/404. Audit log for export/delete requests.

**Simple (like for a 10-year-old):** Success means they get their data, their data is gone (or anonymized), and we have a clear “yes/no” for each consent type. Wrong user or type gets an error. We keep a record that they asked for export or delete.

### 11. What would happen if we didn't have it?

**Technical:** No way to fulfill access or erasure requests; no consent trail; non-compliance with GDPR and similar laws; regulatory and reputational risk.

**Simple (like for a 10-year-old):** We wouldn’t be able to give people their data or delete it when they ask, and we wouldn’t have a record of what they agreed to. That would break the law and hurt trust.

### 12. What is it not responsible for?

**Technical:** Not responsible for: sending marketing (that uses consent); storing data in the first place (other services); third-party data (Stripe, etc.). It only exports/deletes our records and records/returns consent; callers decide what to do with consent (e.g. don’t email if marketing not accepted).

**Simple (like for a 10-year-old):** It doesn’t send emails—it just records “did they say yes to marketing?” It doesn’t decide what we store elsewhere; it only exports or deletes what we have. What Stripe keeps is their business.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** userId (from JWT for export/delete/consent); for consent: type, accepted, version. Deletion may require confirmation token or password. Export may accept format (JSON).

**Simple (like for a 10-year-old):** We need to know who’s asking (their login). For consent we need the type (e.g. privacy_policy), yes/no, and a version. Deletion might need an extra “are you sure?” step.

### 14. What it produces or changes

**Technical:** Export: returns UserDataExport JSON (no DB write). Deletion: updates/deletes user and related rows (anonymize or cascade). Consent: INSERT/UPDATE user_consents; GET returns consent row. Logs: gdpr_data_export_requested/completed, gdpr_data_deletion_requested, gdpr_consent_recorded.

**Simple (like for a 10-year-old):** Export just returns a big JSON; it doesn’t change the DB. Deletion changes or removes rows. Consent adds or updates a row and GET returns it. We log when someone exports, deletes, or records consent.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: user (self-service), support (export on behalf), onboarding (record consent). Flow: export → query all sources → build JSON → return; delete → anonymize/delete in order (respect FK); consent → upsert user_consents. Rules: only own data (or admin); consent type allowlisted; deletion irreversible for PII.

**Simple (like for a 10-year-old):** Users and sometimes support use this. We run the export, run the deletion in the right order, or update consent. We only let you touch your own data (or we’re admin). We only allow certain consent types. Once we delete, we can’t get that PII back.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User or support request (export, delete); signup/onboarding or “I agree” (consent). No cron; all on-demand.

**Simple (like for a 10-year-old):** When someone asks for export or delete, or when they say “I agree” (or we check consent). Nothing automatic.

### 19. What could go wrong

**Technical:** Export misses a table (incomplete); deletion leaves PII (e.g. logs, backups); consent type typo or missing; FK violation on deletion if order wrong. Ensure full list of PII sources; deletion order; backup retention policy.

**Simple (like for a 10-year-old):** We might forget to include something in the export, or leave their data somewhere when we “delete.” We might record consent under the wrong type. We have to delete in the right order so we don’t break the database.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for export/delete/consent; optional audit table. Depends on DB and all tables that hold PII. Config: what to anonymize vs delete; retention for financial/legal rows.

**Simple (like for a 10-year-old):** We log and maybe write to an audit table. We depend on every place we store their data. We have to decide what we anonymize vs delete and what we keep for legal/financial reasons.

### 26. Security or privacy

**Technical:** Export and deletion are highly sensitive; only the user (or admin) can request. Don’t return export or confirmation in logs. Consent is PII (what they agreed to); restrict to user and admin. Comply with privacy policy and data processing agreements.

**Simple (like for a 10-year-old):** Only the user (or an admin) can export or delete. We never put the actual exported data or deletion confirmation in logs. Consent is private; only they and admins should see it. We follow our privacy policy.

### 33. How it interacts with other systems

**Technical:** Reads (and for deletion, writes) users, client_profiles, cleaner_profiles, jobs, payments, credit_ledger, messages, user_consents; may need to call into message history, job photos, etc. for full export/deletion. Does not call Stripe or n8n for deletion (document that third parties retain per their policy). Consent is read by notification/marketing logic.

**Simple (like for a 10-year-old):** We read and sometimes delete from lots of tables; we might need to include message history and photos. We don’t delete from Stripe—we say in our policy that they keep their own data. Other parts of the app read consent to decide whether to send marketing.

---

**See also:** FOUNDER_AUTH.md (who can request), message history and photo proof (in scope for export/deletion).
