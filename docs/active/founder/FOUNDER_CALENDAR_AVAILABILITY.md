# Founder Reference: Calendar / Availability

**Candidate:** Calendar / availability (Module #35)  
**Where it lives:** `calendarService`, `availabilityService`, slots, conflicts  
**Why document:** How we determine "cleaner is free at this time" and how we avoid double-booking.

---

## The 8 main questions

### 1. What it is

**Technical:** Calendar and availability in PureTask is the set of services that determine when a cleaner is free and avoid double-booking. **availabilityService:** weekly availability (day_of_week, start_time, end_time, is_available), time-off (start_date, end_date, all_day, start_time, end_time), service areas (zip, city, state, radius, lat/lng), cleaner preferences (max_jobs_per_day, min/max job duration, accepts_pets, deep_clean, move_out, supplies, vehicle). **calendarService:** Google Calendar integration (OAuth, getGoogleConnectUrl, handleGoogleCallback), sync calendar events to detect busy times, and optionally block or conflict-check. **Slots:** availabilityService (or calendarService) can return AvailabilitySlot[] (dayOfWeek, startTime, endTime, isAvailable) and/or free/busy windows for a date range. **Conflicts:** when booking or matching, we check existing jobs and time-off (and optionally external calendar events) so we don’t assign the same cleaner to overlapping jobs. Implemented in `src/services/availabilityService.ts` and `src/services/calendarService.ts`; routes under cleaner or calendar (e.g. GET/PATCH availability, GET time-off, connect Google, sync). DB: weekly_availability (or equivalent), time_off, service_areas, cleaner_preferences, calendar_connections (tokens), possibly calendar_events cache.

**Simple (like for a 10-year-old):** Calendar and availability is “when is the cleaner free?” We store their weekly schedule (e.g. Mon 9–5), their time-off (vacation, sick), where they’ll go (service areas), and their preferences (how many jobs per day, how long, pets, etc.). We can also connect their Google Calendar so we know when they’re busy. When we book or match we check they’re not already booked or off—so we don’t double-book.

### 2. Where it is used

**Technical:** `src/services/availabilityService.ts` — getWeeklyAvailability, updateWeeklyAvailability, getTimeOff, createTimeOff, deleteTimeOff, getServiceAreas, getCleanerPreferences, getAvailabilitySlots (or similar); `src/services/calendarService.ts` — getGoogleConnectUrl, handleGoogleCallback, sync events, getBusyTimes (or equivalent). Routes: cleaner availability, time-off, preferences, calendar connect/sync. Matching and booking flows call availabilityService (and optionally calendarService) to get free slots and to check conflicts (existing jobs + time-off + external events). holidayService may exclude holiday dates when cleaner not available (FOUNDER_HOLIDAYS.md).

**Simple (like for a 10-year-old):** The code lives in availabilityService and calendarService. The app lets cleaners set their schedule, time-off, and preferences and connect Google. When we’re matching or booking we ask “when is this cleaner free?” and “does this time conflict with another job or time-off?” Holidays might hide days when they’re not available.

### 3. When we use it

**Technical:** When a cleaner sets or updates weekly availability, time-off, or preferences (API); when a client or system is choosing a time (booking or matching) — we need free slots and conflict check; when we sync Google Calendar (OAuth callback, periodic or on-demand sync); when we display “available times” for a cleaner or “next available” for a job. Triggered by user (set availability, add time-off, connect calendar) and by booking/matching flow (get slots, check conflict).

**Simple (like for a 10-year-old):** We use it when the cleaner sets their schedule or time-off or connects Google, and when we’re choosing a time for a job—we need to know when they’re free and that we’re not double-booking.

### 4. How it is used

**Technical:** **Weekly availability:** CRUD on weekly_availability (cleaner_id, day_of_week, start_time, end_time, is_available). **Time-off:** CRUD on time_off (cleaner_id, start_date, end_date, all_day, start_time, end_time, reason). **Service areas:** get/update by cleaner (zip, city, state, radius, lat/lng). **Preferences:** get/update max_jobs_per_day, min/max duration, accepts_pets, etc. **Slots:** for a date range, combine weekly availability + time-off + existing jobs (and optionally Google events) → return free windows or slot list. **Conflict check:** given cleaner_id and (start, end), check jobs (status not cancelled) and time_off and optionally calendar events overlap; return conflict or allow. **Calendar:** OAuth flow (getGoogleConnectUrl, handleGoogleCallback), store tokens in calendar_connections; sync fetches events and may store in calendar_events or return busy times; getBusyTimes(dateRange) used in slot calculation. holidayService: when building slots for a date that is a holiday, exclude or mark if cleaner not available on holidays (available_on_federal_holidays, overrides).

**Simple (like for a 10-year-old):** We save their weekly schedule and time-off and preferences. To get “free slots” we combine their schedule, subtract time-off and existing jobs (and maybe Google busy times), and return the free windows. To check conflict we see if the new job overlaps any job or time-off or Google event. For Google we do the “connect your calendar” flow and then we read their events to know when they’re busy. On holidays we use their holiday settings so we don’t offer times they’re not available.

### 5. How we use it (practical)

**Technical:** Frontend: GET/PATCH availability, time-off, preferences; “Connect Google Calendar” (redirect to getGoogleConnectUrl), callback (handleGoogleCallback); GET available slots for date range. Backend: matching and booking call getAvailabilitySlots or equivalent and checkConflict(cleanerId, start, end). Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI for calendar. DB tables for availability, time_off, service_areas, preferences, calendar_connections, (calendar_events).

**Simple (like for a 10-year-old):** The app lets them set availability and time-off and connect Google, and it shows “available times.” When we match or book we call the same logic to get slots and check for conflicts. We need Google app credentials for calendar. The database has tables for schedule, time-off, areas, preferences, and calendar connection.

### 6. Why we use it vs other methods

**Technical:** A single availability service and conflict check ensure we never double-book and that “available” is consistent across booking and matching. Calendar integration gives real-time busy times without the cleaner manually blocking. Alternatives (no time-off, no calendar, or per-feature conflict logic) would risk double-booking or stale availability.

**Simple (like for a 10-year-old):** We use one place for “when are they free?” and “is this time taken?” so we never book them twice. Connecting Google means we know when they’re busy without them having to block every meeting. If we didn’t have this we’d risk double-booking or wrong “available” times.

### 7. Best practices

**Technical:** Always check conflict before confirming assignment (jobs + time_off + optional calendar). Use same timezone (or store in UTC and convert for display). Slot generation should respect min_lead_time and max_jobs_per_day. Calendar: refresh tokens before sync; don’t store raw event content if PII. Gaps: document timezone handling; ensure slot API and conflict check use same data (e.g. both include time_off and jobs); rate limit Google API if needed.

**Simple (like for a 10-year-old):** We always check for conflict before we confirm a booking. We use one timezone (or store UTC). We respect “earliest bookable time” and “max jobs per day.” For Google we refresh the token and we don’t store private event text. We could document timezones clearly and make sure “slots” and “conflict” use the same sources.

### 8. Other relevant info

**Technical:** calendarService uses OAuth2 (prompt: consent) for offline access (refresh_token). calendar_connections stores access_token, refresh_token, token_expires_at. Sync may enqueue job (QUEUE_NAMES) for async fetch. holidayService (FOUNDER_HOLIDAYS.md) integrates when date is holiday (available_on_federal_holidays, overrides). Matching (jobMatchingService) uses availability and conflict check when selecting cleaner for a job slot.

**Simple (like for a 10-year-old):** We ask for “offline” access to Google so we can refresh and sync. We store the tokens safely. We might run the sync in the background. Holidays are handled so we don’t offer holiday slots when they’re not available. Matching uses the same availability and conflict logic when we pick a cleaner for a time slot.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Provide a single source of “when is this cleaner free?” (weekly availability, time-off, preferences, optional calendar) and “is this time conflicting?” (jobs, time-off, calendar) so booking and matching never double-book and slots are consistent.

**Simple (like for a 10-year-old):** Tell the app “when can this cleaner work?” and “is this time already taken?” so we never book them twice and the times we show are right.

### 10. What does "done" or "success" look like?

**Technical:** Slots returned for a date range match weekly availability minus time-off and existing jobs (and calendar busy); conflict check returns true/false correctly; no double-book (assignment only when conflict false). Calendar connect and sync succeed; tokens refreshed. Success = correct slots and no overlapping assignments.

**Simple (like for a 10-year-old):** Success means the “free times” we show are really free (we’ve taken out time-off and jobs and calendar), and when we book we never assign the same cleaner to two jobs at the same time. Google connect and sync work and we keep the token fresh.

### 11. What would happen if we didn't have it?

**Technical:** No structured availability or conflict check; double-booking risk; inconsistent “available” between booking and matching; no calendar integration (cleaners would have to manually block). Matching and booking would be unreliable.

**Simple (like for a 10-year-old):** We wouldn’t know when they’re free or we’d book them twice. The times we show might be wrong. We wouldn’t know about their Google Calendar, so they’d have to block times by hand. Booking and matching would be messy.

### 12. What is it not responsible for?

**Technical:** Not responsible for: creating the job (jobsService); assigning the cleaner (jobMatchingService); pricing (pricingService); holiday list (holidayService). It only provides availability and conflict; callers use it to build slots and to decide “can we assign this cleaner to this time?”

**Simple (like for a 10-year-old):** It doesn’t create the job or assign the cleaner or set the price—it just says “when are they free?” and “is this time taken?” The rest of the app uses that to book and match.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** cleanerId; for slots: date range, optional duration; for conflict: cleanerId, start, end. Weekly availability: day_of_week, start_time, end_time, is_available. Time-off: start_date, end_date, all_day, start_time, end_time, reason. Calendar: OAuth code (callback), userId. Env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.

**Simple (like for a 10-year-old):** We need the cleaner and, for slots, the date range and maybe job length. For conflict we need the cleaner and the start and end time. For availability we need day and time range; for time-off we need dates and maybe time and reason. For Google we need the OAuth code and our Google app credentials.

### 14. What it produces or changes

**Technical:** Reads/writes weekly_availability, time_off, service_areas, cleaner_preferences, calendar_connections, (calendar_events). Returns: AvailabilitySlot[], free/busy windows, conflict boolean, calendar connect URL or tokens. Does not create jobs or assignments.

**Simple (like for a 10-year-old):** It reads and writes schedule, time-off, areas, preferences, and calendar connection. It returns a list of slots, free/busy times, and “yes/no” for conflict. It doesn’t create jobs or assign cleaners.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: booking flow (slots, conflict), matching (slots, conflict), frontend (CRUD availability, time-off, preferences, calendar connect). Flow: get slots → combine availability, time-off, jobs, (calendar) → return free windows; conflict → check overlap with jobs, time-off, (calendar). Rules: same cleaner_id scope; time-off and jobs in same timezone or UTC; conflict = any overlap.

**Simple (like for a 10-year-old):** Booking and matching and the app use this. We build slots from their schedule minus time-off and jobs (and calendar), and we say “conflict” if the new time overlaps any of those. We only touch that cleaner’s data and we use the same time rules everywhere.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User request (set availability, time-off, preferences, connect calendar, get slots); booking/matching flow (get slots, check conflict). Calendar sync may be periodic or on-demand. No cron inside availabilityService for slot generation (on-demand).

**Simple (like for a 10-year-old):** When they set their schedule or time-off or connect Google, or when we need slots or a conflict check for booking/matching. We might sync Google on a schedule or when they ask.

### 19. What could go wrong

**Technical:** Timezone mismatch (slots vs DB vs display); conflict check missing jobs or time_off (double-book); calendar token expired (sync fail); slot generation ignores min_lead_time or max_jobs_per_day. Ensure single timezone or explicit conversion; conflict uses all sources; token refresh before sync; slot logic respects preferences.

**Simple (like for a 10-year-old):** We might mix up timezones, forget to check jobs or time-off and double-book, or have an expired Google token so sync fails. We need to use one time rule, include everything in conflict check, and refresh the token before syncing.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for calendar connect/sync errors; optional metric for conflict rate. Depends on DB, Google OAuth and Calendar API. Config: GOOGLE_* env; min_lead_time, max_jobs_per_day in preferences or env.

**Simple (like for a 10-year-old):** We log when calendar connect or sync fails. We depend on the DB and Google. We need Google credentials in env and we might have “earliest bookable” and “max jobs per day” in config.

### 26. Security or privacy

**Technical:** Availability and time-off are PII (when they work); only that cleaner and admin. Calendar tokens and event data are sensitive; store encrypted or secure; don’t log event content. OAuth state must be validated (userId in state).

**Simple (like for a 10-year-old):** Their schedule and time-off are private—only they and admins. Their Google token and calendar events are sensitive; we store them safely and don’t put event text in logs. We check the “state” when they come back from Google so we know it’s really them.

### 33. How it interacts with other systems

**Technical:** jobMatchingService and booking flow call for slots and conflict; holidayService may exclude holiday dates when building slots or checking availability. calendarService calls Google Calendar API. Does not publish events or call Stripe; only provides availability and conflict to callers.

**Simple (like for a 10-year-old):** Matching and booking call us for slots and conflict. Holidays might hide days when they’re not available. We call Google for calendar. We don’t send events or call Stripe—we just give “free or not” and “conflict or not.”

---

**See also:** FOUNDER_HOLIDAYS.md, FOUNDER_TRACKING.md (job times), jobMatchingService.
