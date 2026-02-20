# Metrics Contract v1

This document defines every metric key used by goals, badges, rewards, and progression. All computations must be deterministic and test-covered.

## Global config knobs referenced

- `gps_radius_meters` → rules.on_time.gps_radius_meters (250)
- `on_time_before_minutes` → rules.on_time.window_minutes_before (15)
- `on_time_after_minutes` → rules.on_time.window_minutes_after (15)
- `meaningful_action_window_minutes` → rules.meaningful_login.meaningful_action_window_minutes (15)
- `meaningful_message_min_chars` → rules.meaningful_message.min_chars (25)
- `meaningful_message_reply_hours` → rules.meaningful_message.reply_within_hours (24)
- `good_faith_limit_per_7_days` → good_faith_declines.limit_per_7_days (6)
- `short_notice_hours` → good_faith_declines.reasons.short_notice.hours_to_start_lt (18)
- `distance_threshold_miles` → good_faith_declines.reasons.distance_too_far.job_distance_miles_gte (11.0) given default travel radius 10

## Metrics

### `jobs.completed.count` — Completed jobs count

- **Unit:** count
- **Sources:** jobs (status=completed)
- **Calculation:** Count of jobs where status='completed'. Optionally filter by cleaning_type and/or time_slot.
- **Supported windows:** lifetime, days, last_jobs
- **Edge cases:** Exclude test jobs. If job is voided/refunded and marked invalid, exclude via jobs.is_valid=false.

### `jobs.completed.split_counts` — Completed jobs split counts

- **Unit:** object
- **Sources:** jobs (status=completed)
- **Calculation:** Return object with counts by cleaning_type for the window. Example: {basic:10, deep:10}. Goal evaluator compares each required key.
- **Supported windows:** lifetime, days, last_jobs
- **Edge cases:** If cleaning_type missing, bucket as 'unknown' and do not count toward specific type requirements.

### `jobs.on_time.count` — On-time jobs count

- **Unit:** count
- **Sources:** jobs, job_clock_events, job_schedule, geo
- **Calculation:** Count completed jobs where clock_in_time is between (scheduled_start - before_minutes) and (scheduled_start + after_minutes) AND distance(clock_in_gps, job_location) <= gps_radius_meters.
- **Supported windows:** lifetime, days, last_jobs
- **Depends on:** jobs.clock_in_out.success.count
- **Config params:** rules.on_time.gps_radius_meters (250), rules.on_time.window_minutes_before (15), rules.on_time.window_minutes_after (15)
- **Edge cases:** If scheduled_start missing, on_time=false. If clock_in missing, on_time=false. GPS distance uses haversine on lat/lng.

### `jobs.on_time.rate_percent` — On-time rate percent

- **Unit:** percent
- **Sources:** jobs, job_clock_events, job_schedule, geo
- **Calculation:** Compute 100 * (on_time_completed_jobs / eligible_completed_jobs) over the window. Eligible=jobs with required schedule and clock_in data.
- **Supported windows:** days, last_jobs
- **Depends on:** jobs.on_time.count, jobs.completed.count
- **Edge cases:** If eligible_completed_jobs=0 return null and mark goal as not evaluable.

### `jobs.on_time.streak` — On-time streak

- **Unit:** count
- **Sources:** jobs, job_clock_events, job_schedule, geo
- **Calculation:** Max consecutive on-time completed jobs, ordered by completed_at descending, until first non-on-time job breaks streak.
- **Supported windows:** lifetime
- **Depends on:** jobs.on_time.count
- **Edge cases:** Ignore incomplete jobs. If no completed jobs, streak=0.

### `jobs.clock_in_out.success.count` — Clock-in/out success count

- **Unit:** count
- **Sources:** job_clock_events, jobs, geo
- **Calculation:** Count jobs where both clock_in and clock_out exist AND both GPS points are within gps_radius_meters of job_location.
- **Supported windows:** lifetime, days, last_jobs
- **Config params:** rules.on_time.gps_radius_meters (250)
- **Edge cases:** If either clock event missing or GPS invalid => not success. Use the same gps_radius_meters as on-time.

### `jobs.clock_in_out.missing.count` — Clock-in/out missing count

- **Unit:** count
- **Sources:** job_clock_events, jobs
- **Calculation:** Count completed jobs missing either clock_in or clock_out event.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** If job is cancelled before start, exclude from this metric by jobs.status!='completed'.

### `jobs.photos.valid.count` — Jobs with valid photo verification

- **Unit:** count
- **Sources:** job_photos, job_clock_events, jobs
- **Calculation:** Count jobs where there is >=1 before photo and >=1 after photo AND each photo timestamp is between clock_in_time and clock_out_time.
- **Supported windows:** lifetime, days, last_jobs
- **Edge cases:** If clock_in/out missing, photo_valid=false. If timestamps missing, photo_valid=false. Photos may be customer-approved separately but validation here is timestamp + presence only.

### `jobs.rescheduled.count` — Rescheduled jobs count

- **Unit:** count
- **Sources:** jobs, job_schedule_changes
- **Calculation:** Count jobs with at least one schedule change initiated after acceptance (reschedule event).
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** Exclude platform-initiated reschedules due to system outages if flagged job_schedule_changes.system_initiated=true.

### `jobs.cancelled_by_cleaner.count` — Cleaner-initiated cancellations count

- **Unit:** count
- **Sources:** jobs, job_cancellations
- **Calculation:** Count jobs where cancellation_initiator='cleaner'. Includes cancellations after acceptance.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** Exclude cancellations due to platform error if flagged. Include no-shows if modeled as cleaner cancellation.

### `jobs.addons.completed.count` — Completed add-ons count

- **Unit:** count
- **Sources:** job_addons, jobs
- **Calculation:** Count add-on line items where selected_by_customer=true AND completion_status='completed'. (Each add-on item counts as 1.)
- **Supported windows:** lifetime, days, last_jobs
- **Edge cases:** If your product defines add-on completion at job-level, then count each add-on attached to the job when job_completed and addon_verified=true.

### `messages.sent_to_clients.meaningful.count` — Meaningful messages sent to clients

- **Unit:** count
- **Sources:** messages
- **Calculation:** Count outbound cleaner->client messages that satisfy meaningful criteria: template_id not null OR length>=min_chars OR client replies within reply_within_hours.
- **Supported windows:** days, last_jobs, lifetime
- **Config params:** rules.meaningful_message.min_chars (25), rules.meaningful_message.reply_within_hours (24)
- **Edge cases:** If message deleted, still counts if delivered. Reply detection: any client message thread within reply window.

### `engagement.meaningful_login_days.count` — Meaningful login days

- **Unit:** count
- **Sources:** engagement_sessions, engagement_events
- **Calculation:** Count distinct calendar days (cleaner local time) where session_start occurred AND within meaningful_action_window_minutes there is >=1 meaningful_action event (as defined in config).
- **Supported windows:** days, lifetime
- **Config params:** rules.meaningful_login.meaningful_action_window_minutes (15)
- **Edge cases:** If multiple sessions per day, count once. Use cleaner timezone; fallback to region timezone.

### `engagement.login_streak_days` — Meaningful login streak (days)

- **Unit:** count
- **Sources:** engagement_sessions, engagement_events
- **Calculation:** Compute consecutive meaningful login days up to today (or up to last meaningful day) by checking contiguous dates with meaningful_login=true.
- **Supported windows:** lifetime
- **Depends on:** engagement.meaningful_login_days.count
- **Config params:** rules.meaningful_login.meaningful_action_window_minutes (15)
- **Edge cases:** Streak breaks on missing day. Use cleaner local time.

### `job_requests.accepted.count` — Job requests accepted count

- **Unit:** count
- **Sources:** job_requests
- **Calculation:** Count job requests where decision='accepted' within window.
- **Supported windows:** days, lifetime, last_jobs
- **Edge cases:** If request expires without decision, exclude. If accepted then later cancelled, still counts as accept unless explicitly reversed.

### `job_requests.acceptance_rate_percent` — Acceptance rate percent

- **Unit:** percent
- **Sources:** job_requests, good_faith_declines, cleaner_settings, jobs, availability
- **Calculation:** Compute 100 * accepts / (accepts + declines_non_good_faith). A decline is non-good-faith if not classified as good-faith OR classified good-faith but cleaner exceeded good_faith_limit_per_7_days at time of decline.
- **Supported windows:** days
- **Config params:** good_faith_declines.limit_per_7_days (6), good_faith_declines.reasons.short_notice.hours_to_start_lt (18), good_faith_declines.reasons.distance_too_far.job_distance_miles_gte (11.0) given default travel radius 10
- **Edge cases:** If denominator=0, return null. Good-faith classifier uses distance>=11mi, outside availability, job mismatch, safety concern (optional photo but note required), access/logistics mismatch, short notice <18h.

### `clients.repeat_clients.count` — Repeat clients count

- **Unit:** count
- **Sources:** jobs, clients
- **Calculation:** Count unique clients with >=min_completed_jobs_per_client completed jobs with the cleaner within the window (default min=2 unless overridden by goal filter).
- **Supported windows:** lifetime, days
- **Edge cases:** Client identity is stable via client_id. Exclude refunded/invalid jobs.

### `clients.count_with_min_jobs` — Clients meeting minimum completed jobs

- **Unit:** count
- **Sources:** jobs, clients
- **Calculation:** Count unique clients where completed_jobs_with_cleaner >= filters.min_completed_jobs_per_client.
- **Supported windows:** lifetime, days
- **Edge cases:** Used for higher-level loyalty goals.

### `clients.max_jobs_with_single_client` — Max jobs with a single client

- **Unit:** count
- **Sources:** jobs, clients
- **Calculation:** Compute the maximum number of completed jobs among all clients for this cleaner (lifetime).
- **Supported windows:** lifetime
- **Edge cases:** If no clients, value=0.

### `ratings.avg_stars` — Average star rating

- **Unit:** stars
- **Sources:** ratings
- **Calculation:** Average of star ratings (1–5) over window for completed jobs. Cleaner UI uses stars; internal normalized percent = (avg/5)*100.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** Exclude null/removed ratings. If no ratings in window, return null.

### `ratings.five_star.count` — Five-star ratings count

- **Unit:** count
- **Sources:** ratings
- **Calculation:** Count ratings where stars=5 over window.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** Only include ratings tied to completed jobs.

### `disputes.opened.count` — Disputes opened count

- **Unit:** count
- **Sources:** disputes
- **Calculation:** Count disputes opened for the cleaner's jobs over window.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** Include disputes regardless of outcome. Exclude disputes that are later marked invalid by admin.

### `disputes.lost.count` — Lost disputes count

- **Unit:** count
- **Sources:** disputes
- **Calculation:** Count disputes with outcome='lost' for the cleaner over window.
- **Supported windows:** days, last_jobs, lifetime
- **Edge cases:** If dispute pending, not counted as lost. If dispute reopened, outcome determined by final resolution.

### `disputes.open_or_lost.count` — Open or lost disputes count

- **Unit:** count
- **Sources:** disputes
- **Calculation:** Count disputes where status in ('open','lost') over window. Used for stricter maintenance rules.
- **Supported windows:** days, last_jobs
- **Edge cases:** Treat 'won' and 'dismissed' as not counted.

### `disputes.lost.rate_percent_lifetime` — Lifetime lost dispute rate percent

- **Unit:** percent
- **Sources:** disputes, jobs
- **Calculation:** Compute 100 * lifetime_lost_disputes / lifetime_completed_jobs. (Completed jobs excludes invalid/refunded.)
- **Supported windows:** lifetime
- **Edge cases:** If lifetime_completed_jobs=0 return null. This is stricter than dispute-free windows.

### `reliability.percentile` — Reliability percentile (lower is better)

- **Unit:** percentile
- **Sources:** reliability_scores
- **Calculation:** Compute percentile rank of cleaner's reliability_score within active cleaner population for region (or platform-wide). 1 means top 1%.
- **Supported windows:** days
- **Edge cases:** Define population: cleaners active in last 30 days. If insufficient population in region, use platform-wide.

### `badges.composite.review_whisperer` — Composite: Review Whisperer

- **Unit:** bool
- **Sources:** messages, ratings
- **Calculation:** True if (template 'request_review' used >=15) AND (reviews_received_count >=5) within last 60 days.
- **Supported windows:** days
- **Edge cases:** Template IDs come from quick_templates. If messaging not available, badge disabled.

### `badges.composite.tip_jar_energy` — Composite: Tip Jar Energy

- **Unit:** bool
- **Sources:** messages, tips
- **Calculation:** True if (template 'request_tip' used >=10) AND (tips_received_count >=3) within last 90 days.
- **Supported windows:** days
- **Edge cases:** If tips data not tracked, replace with proxy: customer 'tip acknowledged' events.

### `tips.received.count` — Tips received count

- **Unit:** count
- **Sources:** tips
- **Calculation:** Count tips received by cleaner over window.
- **Supported windows:** days, lifetime
- **Edge cases:** If tipping not implemented yet, stub metric returns 0 and composite badge stays false.
