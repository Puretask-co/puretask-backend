# Frontend Status & What the Backend Expects

**Purpose:** Clarify what happened to the old frontend and what routes/data the backend expects the frontend to provide.

---

## 1. What happened to the old frontend?

**What we know from the frontend repo** (`C:\Users\onlyw\Documents\GitHub\puretask-frontend`):

- **In git (committed):** Only `README.md` and `package.json` were in the repo. There was **no `package.json` in git history** until we added one for `dev:all`; the only committed file that existed before was `README.md` (and later the added `package.json`).
- **Untracked / not in git:** Everything else is untracked: `.env.local`, `.next/`, `app/`, `coverage/`, `legacy/`, `next-env.d.ts`, `node_modules/`, `package-lock.json`, `tsconfig.json`. So the **actual app source (pages, components, routes) was never committed** to this repo—or it lived elsewhere.
- **`legacy/`:** There is a `legacy/reactSetup/` folder with many files (thousands of `.js`, `.map`, `.ts`). That may be an **old React app or build output** that was never migrated into the root Next.js app or never committed as the “main” frontend.
- **Root app:** The repo root had **no `app/` or `pages/`** directory with page components, so Next.js had nothing to serve at `/` and returned 404. We added a minimal `app/layout.tsx` and `app/page.tsx` so the dev server serves a root page.

**Summary:** The “old” frontend in the sense of a full, committed Next.js app with client/cleaner routes **exists in this repo on other branches** (e.g. `production-ready-backup`, `backup-20260129-063516`); on **`main`** it does not exist (main has only README + package.json). The full app on those branches includes client/cleaner/admin pages, components, hooks, services. To get it back, see §4.

---

## 2. What data or information in the backend “should be on the frontend”?

The backend **does not store “frontend data”** as such. It stores **business data** (users, jobs, bookings, payments, etc.) and exposes it via **APIs**. The frontend is supposed to:

- Call those APIs (e.g. `/client/jobs/:id`, `/cleaner/onboarding`, `/auth/...`) and render the data.
- Expose **routes** that the backend links to in emails, SMS, and notifications.

So “data that should be on the frontend” = **API responses** the frontend should display, and **routes** the backend expects to exist so links work.

---

## 3. Frontend routes the backend expects (links in emails, notifications, redirects)

These URLs are built by the backend (see `src/lib/urlBuilder.ts` and related code). The frontend should implement these routes so links in emails/notifications work.

**Base URL:** Backend uses `APP_URL` (env, default `http://localhost:3000`) for urlBuilder links, and `FRONTEND_URL` (env, default `http://localhost:3001`) for CORS and some links (e.g. share link). In production you’d typically set both to the same app URL (e.g. `https://app.puretask.com`).

| Backend builds / expects | Purpose |
|--------------------------|--------|
| `/client/jobs/:jobId` | Client view of a job (buildClientJobUrl). |
| `/cleaner/jobs/:jobId` | Cleaner view of a job (buildCleanerJobUrl). |
| `/jobs/:jobId` | Role-agnostic job (buildJobUrl). |
| `/cleaner/jobs/:jobId/check-in` | Cleaner check-in (buildCheckInUrl). |
| `/client/billing` | Payment method / billing (buildPaymentUrl). |
| `/client/subscription` | Subscription management (buildSubscriptionUrl). |
| `/support` | Support/help (buildSupportUrl). |
| `/auth/reset-password?token=...` | Password reset (buildPasswordResetUrl). |
| `/bookings/:id/share` | Share booking link (FRONTEND_URL, clientEnhanced). |
| `/cleaner/onboarding` | Cleaner onboarding (onboardingReminderService, FRONTEND_URL). |
| `/verify-email?token=...` | Email verification (emailVerificationService, APP_URL). |
| `/reset-password?token=...` | Password reset (passwordResetService, APP_URL). |

**API surface:** The backend exposes many routes under `/client/`, `/cleaner/`, `/auth/`, `/jobs/`, etc. The frontend should call these (with auth where required) and render the responses. See API docs or `src/routes/` for the full list.

---

## 4. What you can do next

1. **Get the full app from another branch (recommended):** The full frontend is on **`production-ready-backup`** (and backup branches). In the frontend repo run:
   - `git checkout production-ready-backup` — to work on that branch, or
   - `git checkout main && git merge production-ready-backup` — to bring the full app onto `main`.
   Then run `npm install` and `npm run dev` (or use `dev:all` from the backend repo).
2. **Restore or locate elsewhere:** If you need an older version or the real frontend was in another repo or machine, restore it into this repo and fix build/runtime.
3. **Inspect `legacy/reactSetup/`:** On the backup branches, `legacy/reactSetup/` is committed; decide whether to keep it or migrate into the root Next.js app.
4. **Reimplement from backend contract:** If you prefer to rebuild, use this doc and the API/urlBuilder as the contract: implement the routes above and call the backend APIs.
5. **Unify APP_URL and FRONTEND_URL:** In production, set both to the same frontend base URL so all links and CORS point to one app.

---

## 5. References

- **URL builder (backend):** `src/lib/urlBuilder.ts` — builds links for notifications/emails.
- **Env:** `src/config/env.ts` — `FRONTEND_URL` (default 3001), `APP_URL` (default 3000).
- **Share link:** `src/routes/clientEnhanced.ts` — `FRONTEND_URL/bookings/:id/share`.
- **Onboarding link:** `src/services/onboardingReminderService.ts` — `FRONTEND_URL/cleaner/onboarding`.
- **Founder doc (URL builder):** `docs/active/founder/FOUNDER_URL_BUILDER.md`.

**Last updated:** 2026-01-31
