# Founder Reference: AI Assistant

**Candidate:** AI assistant (Feature #12)  
**Where it lives:** `aiService`, `aiCommunication`, `aiScheduling`, routes `ai`, `cleaner-ai-settings`, `cleaner-ai-advanced`  
**Why document:** What the AI does (communication, scheduling, checklist, dispute?), how it’s configured, and where it’s used.

---

## The 8 main questions

### 1. What it is

**Technical:** The AI assistant in PureTask is a set of services and routes that use OpenAI (or fallbacks) to help cleaners and admins: (1) **Checklists** — generate cleaning checklists from job details (bedrooms, bathrooms, cleaning type, etc.) via `aiService.generateChecklist`; (2) **Dispute suggestions** — suggest refund/reclean actions for admins from job and message context via `aiService.getDisputeSuggestion`; (3) **Scheduling** — suggest optimal booking times from availability via `aiScheduling`; (4) **Communication** — AI-driven message templates and personality via `aiCommunication` and cleaner AI settings. Config: `OPENAI_API_KEY`, `OPENAI_MODEL` (e.g. gpt-4o-mini); settings stored on `cleaner_profiles` (communication_settings, ai_onboarding_completed, ai_features_active_count). Routes: `/ai/*`, `/cleaner/ai/*`, `cleaner-ai-settings`, `cleaner-ai-advanced`.

**Simple (like for a 10-year-old):** The AI assistant helps in four ways: it suggests a cleaning checklist for a job, it suggests what to do in a dispute (refund or not), it suggests good times to book, and it helps cleaners talk to clients with templates and a “personality.” We use OpenAI if we have a key; otherwise we can fall back to non-AI answers. Cleaners can turn on and customize some of this.

### 2. Where it is used

**Technical:** `src/services/aiService.ts` (invokeModel, generateChecklist, getDisputeSuggestion, rankCleanersByJob if present); `src/services/aiScheduling.ts` (OpenAI for scheduling suggestions); `src/services/aiCommunication.ts` (communication automation); `src/routes/ai.ts` (settings, checklist, dispute suggestion, scheduling); `src/routes/cleaner-ai-settings.ts` (cleaner AI preferences); `src/routes/cleaner-ai-advanced.ts` (advanced AI endpoints). DB: `cleaner_profiles` for AI settings; job and dispute data passed in at request time.

**Simple (like for a 10-year-old):** The code lives in aiService, aiScheduling, aiCommunication, and the ai and cleaner-ai routes. We store the cleaner’s AI preferences on their profile; we don’t store full conversation history in the AI service—we send context when we call.

### 3. When we use it

**Technical:** When a user requests a checklist (pre-job or job detail screen); when an admin views a dispute and requests a suggestion; when a client or cleaner is choosing times (scheduling suggestion); when a cleaner sends a message and AI personality/templates are applied (if enabled). Triggered by API calls; no background cron that calls OpenAI on its own.

**Simple (like for a 10-year-old):** We use it when someone asks for a checklist, when an admin asks for a dispute suggestion, when someone is picking a time to book, and when a cleaner uses AI-assisted messages. It only runs when we call it—there’s no robot running in the background.

### 4. How it is used

**Technical:** Checklist: POST with job params (bedrooms, bathrooms, cleaning type, etc.) → aiService invokes OpenAI with CHECKLIST_SYSTEM_PROMPT → returns steps, tips, supplies, estimated hours. Dispute: POST with job_id, client/cleaner messages, job metadata → invokeModel with dispute prompt → returns recommended_action, refund_percentage, confidence, summary, notes_for_admin. Scheduling: availability + preferences → aiScheduling calls OpenAI → suggested times. Communication: cleaner settings (personality, templates) drive how messages are composed or suggested. All OpenAI calls use env OPENAI_API_KEY and OPENAI_MODEL; missing key can trigger fallback (e.g. static checklist or “no suggestion”).

**Simple (like for a 10-year-old):** You send the job details or dispute details or your calendar, and we send that to OpenAI and get back a checklist or a suggestion or times. For messages, the cleaner’s AI settings control how we help. If we don’t have an API key, we might give a simple non-AI answer instead.

### 5. How we use it (practical)

**Technical:** Set OPENAI_API_KEY and optionally OPENAI_MODEL in env. Frontend calls /ai/settings, /ai/checklist, /ai/dispute-suggestion, /ai/scheduling (or cleaner-ai routes) with auth. Cleaners configure AI in cleaner-ai-settings. Logs: get_ai_settings_failed, checklist/dispute/scheduling errors. No built-in usage dashboard; monitor logs and OpenAI usage for cost.

**Simple (like for a 10-year-old):** We put the OpenAI key (and maybe model name) in env. The app calls the AI endpoints when the user asks for a checklist or suggestion or times, and cleaners set their AI preferences in their settings. We watch logs and our OpenAI bill to see how much we use it.

### 6. Why we use it vs other methods

**Technical:** AI gives flexible, context-aware checklists and dispute suggestions without hard-coding every scenario; scheduling suggestions can account for travel and preferences. Alternatives (static templates, rules only) would be less adaptive. Using one provider (OpenAI) and optional fallbacks keeps complexity bounded while allowing gradual rollout (e.g. checklist first, then dispute).

**Simple (like for a 10-year-old):** The AI can adapt to each job and each dispute instead of us writing a fixed rule for everything. We could use only fixed templates, but then we wouldn’t get “smart” suggestions. Using one AI provider and sometimes falling back to simple answers keeps things manageable.

### 7. Best practices

**Technical:** System prompts are defined in code (CHECKLIST_SYSTEM_PROMPT, etc.); input is validated (Zod) before calling OpenAI; no raw user content sent without bounds (truncate if needed). Fallback when key missing. Gaps: no strict output schema enforcement for all endpoints; no per-user or per-tenant rate limit on AI calls; cost visibility is via OpenAI dashboard not in-app.

**Simple (like for a 10-year-old):** We use fixed “instructions” for the AI and check the input before sending. We don’t send huge unchecked text. If there’s no key, we fall back. We could do better: lock down the exact shape of AI answers, limit how often each user can call the AI, and show AI cost in our own app.

### 8. Other relevant info

**Technical:** Migration 026_ai_assistant_schema.sql sets up AI-related tables. aiService may enqueue follow-up work (QUEUE_NAMES) for async steps if needed. PII: job and message content may be sent to OpenAI; ensure privacy policy and data processing agreement cover it. Redaction: OPENAI_API_KEY is in log redaction list. Tests: v2Features.test.ts has “generate checklist (with fallback if no OpenAI key)”; cleaner-ai-api.test.ts for AI endpoints.

**Simple (like for a 10-year-old):** The database was set up with a migration for AI. Sometimes we might queue extra work after an AI call. Job and message text can go to OpenAI, so our privacy policy needs to say that. We hide the API key in logs and we have tests that work with or without the key.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Improve cleaner effectiveness (checklists, communication) and client experience (scheduling); give admins a consistent, reasoned dispute suggestion to speed resolution while keeping human decision.

**Simple (like for a 10-year-old):** Help cleaners do a better job with checklists and messaging, help clients pick good times, and help admins decide disputes faster with a suggestion—but humans still decide.

### 10. What does "done" or "success" look like?

**Technical:** Caller gets a valid checklist, dispute suggestion, or scheduling suggestions within response time; if key missing, fallback returned without 500. Success = 200 + expected JSON; failure = 4xx/5xx or logged error.

**Simple (like for a 10-year-old):** Success means the app gets back a useful checklist or suggestion or times and shows it. If we don’t have an API key, we still return something sensible and don’t crash.

### 11. What would happen if we didn't have it?

**Technical:** No AI-generated checklists or dispute suggestions; scheduling would be manual or rule-only; no AI-assisted communication. Product would rely entirely on static templates and manual decisions.

**Simple (like for a 10-year-old):** We’d have no “smart” checklists or dispute suggestions or scheduling help; cleaners would only have fixed templates and admins would decide everything by hand.

### 12. What is it not responsible for?

**Technical:** Not responsible for: final dispute resolution (admin decides); sending notifications; job state changes; payment or payouts; storing long-term conversation history (that’s message history feature). It only suggests and generates content; callers apply it.

**Simple (like for a 10-year-old):** It doesn’t decide disputes—it only suggests. It doesn’t send emails or change the job or pay anyone. It doesn’t store chat history—that’s elsewhere. It just returns suggestions and text; the rest of the app uses them.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** Checklist: bedrooms, bathrooms, square_feet, has_pets, has_kids, cleaning_type, special_notes. Dispute: job_id, client_message, cleaner_message, photos, job_metadata (cleaning_type, hours, rating, credit_amount, reliability, client history). Scheduling: availability slots, preferences. Communication: cleaner communication_settings, message context. Env: OPENAI_API_KEY, OPENAI_MODEL.

**Simple (like for a 10-year-old):** For checklist we need job details (rooms, type, pets, etc.). For dispute we need the job, both sides’ messages, and job info. For scheduling we need when the cleaner is free and preferences. For communication we need the cleaner’s AI settings. We also need the OpenAI key in env.

### 14. What it produces or changes

**Technical:** Produces: checklist (steps, tips, supplies, estimated_hours); dispute suggestion (recommended_action, refund_percentage, confidence, summary, notes_for_admin, factors_considered); scheduling suggestions (times); communication suggestions or applied template. Does not directly change job or user DB; callers may persist results (e.g. save checklist to job).

**Simple (like for a 10-year-old):** It returns a checklist, a dispute suggestion, suggested times, or message text. It doesn’t change the job or user in the database by itself—the rest of the app might save what it returns.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: frontend (checklist, scheduling), admin (dispute suggestion), cleaner app (communication, settings). Flow: validate input → build prompt → call OpenAI (or fallback) → parse and return. Rules: cleaner-scoped settings; dispute suggestion is advisory; no PII in logs when possible.

**Simple (like for a 10-year-old):** The website and admin and cleaner app use the answers. We check the input, ask OpenAI, and send back the answer. Cleaners only change their own AI settings; the dispute suggestion is only advice.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** Authenticated API requests to /ai/* or cleaner-ai routes (checklist, dispute suggestion, scheduling, settings). No cron or event-driven OpenAI calls from this feature.

**Simple (like for a 10-year-old):** Only when someone (or the app on their behalf) calls the AI endpoints. Nothing automatic.

### 19. What could go wrong

**Technical:** OPENAI_API_KEY missing or invalid → fallback or error. OpenAI timeout or rate limit → 5xx or retry. Malformed or huge input → validation error or truncation. Cost overrun if many calls. PII in prompts → ensure policy and agreements cover third-party processing.

**Simple (like for a 10-year-old):** If the key is wrong or OpenAI is down, we might return a simple answer or an error. Bad or huge input can break or get cut off. Too many calls could get expensive. We might send personal or job info to OpenAI, so we need to say that in our policy.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for errors and (optionally) request/response shape; no in-app AI metrics. Depends on OpenAI API, env, DB for cleaner settings. Config: OPENAI_API_KEY, OPENAI_MODEL; prompts in code.

**Simple (like for a 10-year-old):** We watch logs; we don’t have a special AI dashboard. We need OpenAI and the cleaner’s settings in the DB. The key and model name are in env; the “instructions” for the AI are in code.

### 26. Security or privacy

**Technical:** Job and message content may be sent to OpenAI; treat as PII/processing. Redact API key in logs. Auth required for all AI routes; dispute suggestion typically admin-only. Comply with privacy policy and data processing terms for third-party AI.

**Simple (like for a 10-year-old):** What we send to OpenAI can include job and message details, so we have to say that in our privacy policy and keep the API key secret in logs. Only logged-in users (and admins for disputes) can call these.

### 33. How it interacts with other systems

**Technical:** Reads cleaner_profiles for AI settings; receives job and dispute data from callers; may enqueue jobs (queue). Does not publish events or update ledger; callers may save checklist or apply suggestion. Message history and notifications are separate.

**Simple (like for a 10-year-old):** It reads the cleaner’s AI settings and gets job/dispute info from whoever called it. It might add a task to the queue. It doesn’t write to the event or credit system—the code that called it might save the result.

---

**See also:** FOUNDER_EVENTS.md, FOUNDER_NOTIFICATIONS.md (separate from AI); message history for stored messages.
