# Founder Reference: Message History / Saved Messages

**Candidate:** Message history / saved messages (Feature #19)  
**Where it lives:** `message-history` routes, `messagesService`  
**Why document:** How messages are stored and retrieved for clients/cleaners and how "saved" works.

---

## The 8 main questions

### 1. What it is

**Technical:** Message history and saved messages are two related features for cleaners: (1) **Message history** — logs of sent messages (e.g. to clients) in `cleaner_message_history` (cleaner_id, job_id, channel, recipient, content or template key, sent_at, etc.) for audit and “what did I send?”; (2) **Saved messages** — reusable drafts or favorite snippets in `cleaner_saved_messages` (cleaner_id, title, content, category, use_count, etc.) so cleaners can quickly reuse common texts. Implemented in `src/routes/message-history.ts` (mounted under `/cleaner`); some logic may live in route handlers or `src/services/messagesService.ts`. Endpoints: log message, get history (by cleaner, job, or recent), get saved messages, create/update/delete saved message, mark saved message as used (increment use_count).

**Simple (like for a 10-year-old):** Message history is a log of what the cleaner sent (so they can see “what did I say?”). Saved messages are like a personal library of short texts they can reuse (e.g. “Running 5 min late”) so they don’t type the same thing every time. Both are for cleaners and live under their account.

### 2. Where it is used

**Technical:** `src/routes/message-history.ts` — INSERT into cleaner_message_history (log), SELECT from cleaner_message_history (list by cleaner/job, count), SELECT/INSERT/UPDATE/DELETE cleaner_saved_messages, UPDATE use_count on “mark as used.” `src/services/messagesService.ts` may provide send/log helpers used by notification or in-app messaging. Migration `031_message_history_system.sql` creates tables. Mounted at `/cleaner` (e.g. /cleaner/message-history, /cleaner/saved-messages).

**Simple (like for a 10-year-old):** The code lives in the message-history routes and maybe messagesService. The database tables were added in a migration. The APIs are under the cleaner section of the app.

### 3. When we use it

**Technical:** When a cleaner sends a message (in-app or via a flow that logs to history)—call log endpoint or messagesService; when a cleaner views their message history (GET by job or recent); when a cleaner views/creates/updates/deletes saved messages (CRUD); when they use a saved message (mark as used, optionally copy into send flow). Triggered by user actions (API calls).

**Simple (like for a 10-year-old):** We use it when the cleaner sends something (we log it), when they look at what they’ve sent, when they add or edit or delete a saved message, and when they “use” one (we count that).

### 4. How it is used

**Technical:** Log: POST with cleaner_id (from JWT), job_id, channel, recipient, content/template_key, sent_at → INSERT cleaner_message_history. Get history: GET with optional job_id, limit → SELECT ordered by sent_at. Saved: GET list → SELECT cleaner_saved_messages WHERE cleaner_id; POST create (title, content, category); PATCH update (id, cleaner_id); DELETE (id, cleaner_id); POST mark-used (id) → UPDATE use_count. All scoped by cleaner_id from auth. No outbound send in this feature—only log and store; actual send is notification or messaging layer.

**Simple (like for a 10-year-old):** We log each send with job, channel, who got it, and what was sent. We list history by job or “recent.” For saved messages we list, add, edit, delete, and “mark as used.” Everything is tied to the logged-in cleaner. We don’t send the message from here—we just log and store; something else does the actual sending.

### 5. How we use it (practical)

**Technical:** Frontend calls POST to log after sending (or backend does it when sending); GET history for “my messages” or per-job view; GET/POST/PATCH/DELETE saved messages; POST mark-used when user picks a saved message. JWT identifies cleaner. Setup: run migration 031 if not already. No special env for message history/saved; same DB and auth.

**Simple (like for a 10-year-old):** The app calls “log” when the cleaner sends something, and “get history” when they want to see past messages. They manage saved messages from the UI and we call “mark used” when they use one. We use the same database and login as the rest of the app.

### 6. Why we use it vs other methods

**Technical:** Message history gives cleaners (and support) a record of what was sent without relying on third-party logs; saved messages reduce repetition and improve consistency. Alternatives (no log, no saved) would hurt support and UX. Centralizing in one route and tables keeps scope clear.

**Simple (like for a 10-year-old):** We use it so cleaners can see what they sent and so they can reuse common phrases. Without it we’d have no record and they’d type the same thing over and over.

### 7. Best practices

**Technical:** Scope all queries by cleaner_id; validate job_id belongs to cleaner where relevant. Don’t log full PII in plaintext if avoidable; truncate or hash if needed for audit. Saved message CRUD: ensure id + cleaner_id so users can’t touch others’ saved messages. Gaps: retention policy for message history (how long to keep); rate limit on create saved message if abuse possible.

**Simple (like for a 10-year-old):** We always filter by the logged-in cleaner. We try not to store super sensitive stuff in plaintext in the log. We make sure users can only edit/delete their own saved messages. We could decide how long to keep history and limit how many saved messages someone can add.

### 8. Other relevant info

**Technical:** messagesService may be used by notification or in-app messaging to actually send; message-history is the logging and saved-message store. GDPR: message history and saved messages may be part of data export/deletion (gdprService). Migration 031_message_history_system.sql; setup script setup-message-history.js.

**Simple (like for a 10-year-old):** The part that actually sends messages might use messagesService; this feature is the “log” and “saved library.” If we export or delete someone’s data, we might include or remove their message history and saved messages. The tables were created by a migration and a setup script.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Give cleaners an audit trail of sent messages and a reusable library of saved messages to speed communication and support consistency.

**Simple (like for a 10-year-old):** Let cleaners see what they’ve sent and reuse common texts so they’re faster and consistent.

### 10. What does "done" or "success" look like?

**Technical:** Log succeeds after send; history GET returns correct rows for cleaner/job; saved message CRUD and mark-used succeed; no cross-cleaner data leakage. Success = 200 + expected JSON; 403/404 for wrong resource.

**Simple (like for a 10-year-old):** Success means we log each send, they see the right history, and they can add/edit/delete and “use” saved messages without seeing someone else’s data.

### 11. What would happen if we didn't have it?

**Technical:** No record of what cleaners sent; no saved snippets; harder support and no “what did I send?” for cleaners; more repetitive typing.

**Simple (like for a 10-year-old):** We wouldn’t know what they sent, they couldn’t save favorite messages, and support would be harder. Cleaners would type the same things again and again.

### 12. What is it not responsible for?

**Technical:** Not responsible for: sending the message (notification/messaging layer); job or client state; dispute resolution. It only logs and stores; callers send. AI assistant (templates/personality) is separate.

**Simple (like for a 10-year-old):** It doesn’t send the message—something else does. It doesn’t change the job or resolve disputes. It just logs and stores. The AI that suggests messages is a different feature.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** Log: cleaner_id (JWT), job_id, channel, recipient, content or template_key, sent_at. History GET: cleaner_id, optional job_id, limit. Saved: cleaner_id, title, content, category (create/update); id + cleaner_id (update/delete/mark-used).

**Simple (like for a 10-year-old):** To log we need who sent, which job, how (channel), to whom, and what. To get history we need the cleaner and maybe the job and how many. For saved messages we need title, content, category to create; id to update/delete/use.

### 14. What it produces or changes

**Technical:** Inserts into cleaner_message_history; CRUD and use_count update on cleaner_saved_messages. Returns: list of history rows, list of saved messages, or single saved message after create/update.

**Simple (like for a 10-year-old):** It adds rows to the history table and creates/updates/deletes saved messages and bumps “use count.” It returns the list or the one record.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: cleaner app (history view, saved library); support (history for context). Flow: log after send; GET history/saved; CRUD saved; mark-used. Rules: cleaner_id from JWT; job must be accessible to cleaner for history; id + cleaner_id for saved mutations.

**Simple (like for a 10-year-old):** The cleaner app (and maybe support) uses this. We log after send, then they can read history and manage saved messages. We always check the cleaner and that the job is theirs before showing history, and that the saved message is theirs before changing it.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** API calls: log (after send), get history, get saved, create/update/delete saved, mark-used. No cron or event-driven write in this feature.

**Simple (like for a 10-year-old):** Only when the app calls the APIs—when they send (log), when they look at history or saved messages, or when they add/edit/delete/use a saved message.

### 19. What could go wrong

**Technical:** Logging PII in full; cross-cleaner leak if cleaner_id not enforced; no retention so table grows unbounded; abuse (huge number of saved messages). Enforce scope and optional limits/retention.

**Simple (like for a 10-year-old):** We might log something we shouldn’t, or show one cleaner’s data to another if we miss a check. The history table could grow forever if we never delete. Someone could create tons of saved messages. We need to enforce “only your data” and maybe limits.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for errors; no dedicated metric. Depends on DB and auth. Optional config: history retention days, max saved messages per cleaner.

**Simple (like for a 10-year-old):** We watch logs. We need the DB and login. We could add “how long to keep history” and “max saved messages.”

### 26. Security or privacy

**Technical:** All data scoped to cleaner_id; don’t return other cleaners’ history or saved messages. Message content may be PII; include in GDPR export/deletion. Don’t log full content in app logs if sensitive.

**Simple (like for a 10-year-old):** We only show the logged-in cleaner their own history and saved messages. The text might be personal, so we include it in “export my data” and “delete my data” and we don’t put it in logs.

### 33. How it interacts with other systems

**Technical:** Called after send by notification or messaging layer (or frontend); messagesService may do actual send. GDPR export/deletion may read or delete cleaner_message_history and cleaner_saved_messages. No events published; no Stripe/ledger.

**Simple (like for a 10-year-old):** Whatever actually sends the message calls us to log it. When we export or delete user data we might read or remove their history and saved messages. We don’t publish events or touch payments.

---

**See also:** FOUNDER_NOTIFICATIONS.md (sending), FOUNDER_GDPR.md (export/deletion), messagesService.
