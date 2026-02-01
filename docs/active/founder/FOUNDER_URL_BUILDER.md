# Founder Reference: URL Builder

**Candidate:** URL builder (Module #26)  
**Where it lives:** `src/lib/urlBuilder.ts` (buildClientJobUrl, buildCleanerJobUrl, buildJobUrl, buildCheckInUrl, buildPaymentUrl, buildSubscriptionUrl, buildSupportUrl, buildPasswordResetUrl, buildRoleCorrectJobUrl)  
**Why document:** How we build links in emails/notifications so users land on the right job.

---

For each question below, every answer has two parts: **Technical** (for engineers and product/tech decisions) and **Simple** (like for a 10-year-old). Each part is at least two sentences.

---

## The 8 main questions

### 1. What it is

**Technical:** The URL builder in PureTask is a small lib that builds absolute URLs for the frontend so we can put correct links in emails, SMS, and notifications. All URLs use APP_URL (env.APP_URL or http://localhost:3000). **Functions:** buildClientJobUrl(jobId) → `${APP_URL}/client/jobs/${jobId}`; buildCleanerJobUrl(jobId) → `${APP_URL}/cleaner/jobs/${jobId}`; buildJobUrl(jobId) → `${APP_URL}/jobs/${jobId}` (role-agnostic); buildCheckInUrl(jobId) → `${APP_URL}/cleaner/jobs/${jobId}/check-in`; buildPaymentUrl(returnTo?) → `${APP_URL}/client/billing` with optional ?returnTo=; buildSubscriptionUrl() → `${APP_URL}/client/subscription`; buildSupportUrl() → `${APP_URL}/support`; buildPasswordResetUrl(token) → `${APP_URL}/auth/reset-password?token=...`; buildRoleCorrectJobUrl(jobId, userRole) → client/cleaner/admin (admin defaults to client view). Comments note that returnTo is handled by frontend middleware, not included in notification links. No query params on job URLs from this lib; frontend handles auth and redirects.

**Simple (like for a 10-year-old):** The URL builder is how we make the links we put in emails and texts so when someone clicks they go to the right page (e.g. "your job" or "check in" or "billing"). We have one base address (APP_URL) and we add the path: client job page, cleaner job page, check-in page, billing, subscription, support, or password reset. We can also pick the right job link for client vs cleaner vs admin. We don't add "where to go after" in the link—the website does that.

### 2. Where it is used

**Technical:** `src/lib/urlBuilder.ts` defines all functions. **Callers:** jobNotifications.ts imports buildClientJobUrl, buildCleanerJobUrl, buildCheckInUrl, buildPaymentUrl, buildSupportUrl and passes jobUrl (or checkInUrl, paymentUrl, supportUrl) into notification payloads so email/SMS templates can render the link. onboardingReminderService uses a hardcoded FRONTEND_URL for the onboarding link (not urlBuilder)—could be unified. passwordResetService likely uses buildPasswordResetUrl (or similar) for reset emails. Any code that needs to send a link to the app (emails, push, SMS) should use urlBuilder so the base URL and paths stay consistent. Env: APP_URL in config/env.

**Simple (like for a 10-year-old):** The code lives in urlBuilder.ts. The notification code (job emails, etc.) uses it to get the client job link, cleaner job link, check-in link, billing link, and support link so we can put them in the email. Password reset probably uses it for the reset link. Anything that sends a link to the app should use this so we use the same base address and paths everywhere. We need APP_URL in the environment.

### 3. When we use it

**Technical:** We use it when we build a notification payload (email, SMS) that includes a link—e.g. "View your job", "Check in here", "Update payment method", "Contact support". We use buildRoleCorrectJobUrl when we know the recipient's role and want a single link. We use buildPasswordResetUrl when sending the reset-password email. Triggers: notification send (jobNotifications, etc.), password reset flow. No cron; purely when we're about to send a message with a link.

**Simple (like for a 10-year-old):** We use it whenever we're about to send an email or text that has a link—"view your job," "check in," "update payment," "support," or "reset password." We use the "role-correct" job URL when we know if they're a client or cleaner. Nothing runs on a schedule—only when we send a message with a link.

### 4. How it is used

**Technical:** Each function returns a string URL. buildClientJobUrl(jobId): `${APP_URL}/client/jobs/${jobId}`. buildPaymentUrl(returnTo): base + (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ""). buildPasswordResetUrl(token): `${APP_URL}/auth/reset-password?token=${encodeURIComponent(token)}`. buildRoleCorrectJobUrl(jobId, role): switch on role → buildClientJobUrl, buildCleanerJobUrl, or buildClientJobUrl for admin; default buildJobUrl. Callers pass the returned string into template data (e.g. jobUrl, checkInUrl) so the template can render `<a href="{{jobUrl}}">View job</a>`.

**Simple (like for a 10-year-old):** Each function just returns one full URL string. For payment we can add "?returnTo=..." if we want. For password reset we add the token in the query. For "role-correct" job we pick client or cleaner link based on role. The code that sends the email puts that string into the template so the link shows up in the email.

### 5–8. Practical use, why, best practices, other info (condensed)

**Technical:** Set APP_URL in env (e.g. https://app.puretask.com). Use buildClientJobUrl / buildCleanerJobUrl in job notifications so client gets /client/jobs/:id and cleaner gets /cleaner/jobs/:id. Use buildCheckInUrl for "check in when you arrive" links. Use buildPasswordResetUrl with the token from the reset flow. Don't hardcode the app domain elsewhere—use urlBuilder so we can change APP_URL in one place. Gaps: onboarding reminder uses FRONTEND_URL not APP_URL/urlBuilder; we could add buildOnboardingUrl() and use it everywhere. See FOUNDER_NOTIFICATIONS for where jobUrl is used.

**Simple (like for a 10-year-old):** We set the app address (APP_URL) in the environment. We use the URL builder for job links, check-in, billing, support, and password reset so we don't type the domain in lots of places. We shouldn't put the app address in other files—use this lib so we can change it once. The onboarding reminder uses a different variable right now; we could add an "onboarding URL" function here and use it everywhere.

---

## Purpose and outcome (condensed)

### 9–12. Purpose, success, without it, not responsible for

**Technical:** Purpose: centralize app URLs so notifications and emails have correct, role-appropriate links. Success: every link in emails uses APP_URL and the right path; changing APP_URL changes all links. Without it we'd scatter base URLs and paths and risk wrong or broken links. Not responsible for: generating the token (password reset); deciding when to send the notification; or frontend routing (we only build the URL).

**Simple (like for a 10-year-old):** It's there so every link we send in emails goes to the right page and uses the right app address. Success is we have one place to set the app URL and all links stay correct. Without it we'd copy the address everywhere and might get wrong or broken links. It doesn't create the password token or decide when to send the email—only builds the URL.

---

## Inputs, outputs, flow, rules (condensed)

### 13–17. Inputs, outputs, flow, rules

**Technical:** Inputs: jobId (string), userRole (client|cleaner|admin), returnTo (optional string), token (string for reset). Output: string URL. No side effects. Rules: APP_URL from env; encode returnTo and token in query params. No DB or external calls.

**Simple (like for a 10-year-old):** We give it a job id, or a role, or a return path, or a token. We get back one URL string. We don't call the database or anything else—we just build the string. We use the app URL from the environment and we encode special characters in query params.

---

## Triggers through ownership (condensed)

### 18–37. Triggers, dependencies, config, testing, stakeholders, lifecycle, state, assumptions, interaction, failure, correctness, owner, evolution

**Technical:** Triggered by callers building notification payloads or reset emails. Depends on env APP_URL. No other deps. Test: unit test with mock APP_URL, assert path and domain. Stakeholders: product (correct links), support (users click and land on right page). Stateless. Assumption: frontend has routes that match these paths. When not to use: for API base URL use a different config. Owner: platform. Evolution: add buildOnboardingUrl; unify with FRONTEND_URL usage; add buildManagerJobUrl if manager view exists.

**Simple (like for a 10-year-old):** Something that's building an email or notification calls it. We need APP_URL in the environment. We can test by setting a fake APP_URL and checking the URL string. Product and support care that links work. The lib doesn't remember anything. We assume the website has pages at these paths. The platform team owns it. Later we might add an onboarding URL and use the same app URL everywhere.

---

*End of Founder Reference: URL Builder*
