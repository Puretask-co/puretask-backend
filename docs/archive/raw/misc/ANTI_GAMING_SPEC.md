# Anti-Gaming Rules Spec v1

> Prevents loopholes for login streaks, messages, and photo uploads.

## 1. Meaningful Login

**Rule:** A "login day" or "login streak day" counts only if the cleaner performs at least one **meaningful action** within 15 minutes of opening the app.

**Meaningful actions (any one counts):**
- View job request list AND open a specific job request detail
- Accept or decline a job request (with reason)
- Send a message to a client (meaningful message rules apply)
- Confirm "On my way" / "Arrived" / "Job complete" (quick template)
- Upload before/after photos
- Update availability calendar (at least 1 time block change)

**Does NOT count:**
- App open + close
- Background open / push notification tap without action

**Implementation:**
- Track `engagement.session_started` (app open)
- Track `engagement.meaningful_action_performed` (action type, timestamp)
- A streak day increments only if session has ≥1 meaningful action
- `cleaner_meaningful_actions` table records action_date + action_type
- When evaluating login_streak goals: require the date to have a meaningful action (or legacy: continue counting all login_days until we migrate)

---

## 2. Meaningful Messages (Anti-Spam)

**Rule:** A message counts toward messaging goals only if it's **meaningful**.

**A message qualifies if ANY of:**
- ≥ 25 characters, OR
- Sent via Quick Action template (`template_id` set), OR
- Customer replies within 24 hours (reply validation)

**Quick Action templates (all count as meaningful):**
- `tmpl_on_my_way` - "On my way"
- `tmpl_arrived` - "I've arrived"
- `tmpl_starting_now` - "Starting now"
- `tmpl_finished_photos_attached` - "Finished — here are your photos"
- `tmpl_any_focus_areas` - "Any areas you want me to focus on?"
- `tmpl_thank_you` - "Thanks for choosing PureTask! I just finished up..."
- `tmpl_reschedule_offer` - "Would you like to reschedule?"
- `tmpl_review_request` - "If you were happy with the cleaning, would you mind leaving a review?"
- `tmpl_tip_request` - "If you feel I did a great job, tips are always appreciated..."

**Implementation:**
- `messages` table: add `template_id` (nullable), `char_length` (optional)
- Goal evaluation: filter to `template_id IS NOT NULL OR char_length >= 25 OR has_client_reply_24h`
- Backfill: existing messages without template_id — use `LENGTH(content) >= 25` as fallback

---

## 3. Photo Verification (Simplified)

**Rule:** A photo submission counts for photo-related goals if:
- ≥ 1 BEFORE photo AND ≥ 1 AFTER photo
- Both photos have timestamps within the job's active window (after clock-in, before clock-out)
- Photos are attached to the job

**Does NOT require:**
- Minimum photo count per set (e.g. 3 before, 3 after) — removed
- Wide shot tags — removed
- Room-specific photos — removed

**Implementation:**
- `jobs.photos.valid.count`: jobs with ≥1 before + ≥1 after, timestamps in window
- Use `job_photos.created_at` as timestamp; compare to `actual_start_at`/`actual_end_at` or `scheduled_start_at`/`scheduled_end_at` if needed

---

## 4. Good Faith Declines (Acceptance Rate Fairness)

See Metrics Contract for full definitions. Key: declines with valid good-faith reason do not hurt acceptance rate. Limit: 6 per 7 days; beyond that they count.
