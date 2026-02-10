# Founder Reference: Holidays

**Candidate:** Holidays (Feature #22)  
**Where it lives:** `holidayService`, `holidays` routes  
**Why document:** How holidays affect pricing, availability, or scheduling.

---

## The 8 main questions

### 1. What it is

**Technical:** The holiday feature is the source of truth for federal (and optionally other) holidays and per-cleaner holiday settings. Implemented in `src/services/holidayService.ts` and `src/routes/holidays.ts`. **Holidays table:** holiday_date, name, is_federal, bank_holiday, support_limited — used to know “is this date a holiday?” and for display. **Cleaner holiday settings:** cleaner_holiday_settings (available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier) — whether the cleaner works on federal holidays and whether they get a holiday rate multiplier (e.g. 1.15). **Cleaner holiday overrides:** cleaner_holiday_overrides (cleaner_id, holiday_date, available, start_time_local, end_time_local, use_holiday_rate, min_job_hours, notes) — per-date overrides so a cleaner can say “I’m available on Christmas from 9–2 at holiday rate.” **APIs:** listHolidays({ from, to, limit }), getHolidayByDate(date), getCleanerHolidaySettings(cleanerId), updateCleanerHolidaySettings(cleanerId, updates), listCleanerHolidayOverrides({ cleanerId, from, to }), upsertCleanerHolidayOverride(params). Holidays route is public (GET /holidays) for listing; cleaner settings/overrides are authenticated (cleaner or admin).

**Simple (like for a 10-year-old):** Holidays are the list of “special days” (like federal holidays) and the rules for each cleaner: do they work on those days, and do they get paid more (holiday rate)? Cleaners can also set “on this specific holiday I’m available these hours at holiday rate.” The app and pricing use this to know when to offer holiday slots and when to apply the extra rate.

### 2. Where it is used

**Technical:** `src/services/holidayService.ts` — getHolidayByDate, listHolidays, getCleanerHolidaySettings, updateCleanerHolidaySettings, listCleanerHolidayOverrides, upsertCleanerHolidayOverride; `src/routes/holidays.ts` — GET / (list); `src/routes/cleaner.ts` (or similar) may expose cleaner holiday settings/overrides. DB: holidays, cleaner_holiday_settings, cleaner_holiday_overrides. Pricing and availability logic may call getHolidayByDate and getCleanerHolidaySettings / overrides to decide “is this a holiday?” and “does this cleaner work and at what rate?”

**Simple (like for a 10-year-old):** The code lives in holidayService and holidays routes. When we need to know “is this day a holiday?” or “does this cleaner work on holidays and at what rate?” we call this. The database has the list of holidays and each cleaner’s settings and overrides.

### 3. When we use it

**Technical:** When a client or cleaner is choosing a date (availability or booking) — we check if it’s a holiday and if the cleaner is available and at what rate; when pricing a job on a holiday date — we apply holiday_rate_multiplier if use_holiday_rate; when displaying “upcoming holidays” (GET /holidays). Triggered by booking flow, pricing flow, and frontend requests for holiday list or cleaner settings.

**Simple (like for a 10-year-old):** We use it when someone is picking a date (so we know if it’s a holiday and if the cleaner works then and at what rate), when we calculate the price (so we add the holiday rate if it applies), and when we show the list of holidays.

### 4. How it is used

**Technical:** listHolidays: if from+to, SELECT between dates; else SELECT upcoming limit N; filter is_federal = true. getHolidayByDate(date): single row or null. getCleanerHolidaySettings: INSERT ON CONFLICT DO NOTHING to ensure row exists, then SELECT. updateCleanerHolidaySettings: upsert cleaner_holiday_settings. listCleanerHolidayOverrides: JOIN holidays, filter cleaner_id and date range. upsertCleanerHolidayOverride: getHolidayByDate first (must be recognized holiday), then INSERT ... ON CONFLICT DO UPDATE. Pricing/availability: pass job date → getHolidayByDate; if holiday, get cleaner settings and override for that date → if available and use_holiday_rate, apply multiplier to rate.

**Simple (like for a 10-year-old):** We list holidays by date range or “next N.” We look up one date to see if it’s a holiday. We get or update each cleaner’s “work on holidays?” and “holiday rate?” and their per-holiday overrides. When we price or check availability we ask “is this a holiday?” and “does this cleaner work then and at holiday rate?” and use the multiplier if yes.

### 5. How we use it (practical)

**Technical:** Frontend: GET /holidays for public list; GET/PATCH cleaner holiday settings and overrides (authenticated). Backend: when building availability or pricing for a date, call holidayService. Env: no required holiday-specific env; holiday list may be seeded in migration or admin. Default multiplier (e.g. 1.15) in cleaner_holiday_settings or code.

**Simple (like for a 10-year-old):** The app loads the holiday list and lets cleaners set “work on holidays” and “holiday rate” and per-holiday overrides. When we’re building slots or prices we call the holiday service. The list of holidays might be in a migration or admin; the default “holiday rate” (e.g. 15% more) is in code or config.

### 6. Why we use it vs other methods

**Technical:** A single holidays table and cleaner settings give one place for “is this a holiday?” and “does this cleaner work at holiday rate?” so pricing and availability stay consistent. Overrides allow “I’m off most holidays but I’ll work Thanksgiving morning.” Alternatives (hardcode dates, no overrides) would be brittle or inflexible.

**Simple (like for a 10-year-old):** We use it so we have one list of holidays and one place for each cleaner’s rules. That way pricing and “is the cleaner free?” always use the same logic. Letting them set per-holiday overrides means they can say “I’ll work this one holiday but not others.”

### 7. Best practices

**Technical:** Seed holidays table with federal (and optionally regional) dates; use is_federal for filtering where “federal only” is required. Validate holiday_date in upsertCleanerHolidayOverride (must exist in holidays). Default multiplier (e.g. 1.15) documented; ensure pricing flow actually uses it when job date is holiday and use_holiday_rate true. Gaps: ensure availability logic excludes holidays when cleaner not available; document support_limited meaning (e.g. reduced support hours).

**Simple (like for a 10-year-old):** We keep the holiday list up to date and only allow overrides for dates that are in that list. We document what the “holiday rate” multiplier is and make sure the price really uses it. We could be clearer about when we hide holiday slots if the cleaner isn’t available and what “support limited” means.

### 8. Other relevant info

**Technical:** Cleaner routes may include available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier in profile PATCH. Pricing service (FOUNDER_PRICING.md) may accept job date and call holidayService to apply multiplier. Calendar/availability (FOUNDER_CALENDAR_AVAILABILITY.md) may exclude holiday dates when cleaner not available. Holidays table is small; no retention policy for past holidays (keep for history).

**Simple (like for a 10-year-old):** The cleaner’s profile might include “work on holidays” and “holiday rate.” The pricing doc explains how we use the multiplier. The calendar/availability might hide holiday slots when they’re not available. We keep past holidays in the table for history.

---

## Purpose and outcome

### 9. What is it supposed to accomplish?

**Technical:** Provide a single source of truth for holiday dates and per-cleaner holiday availability and holiday rate so pricing and scheduling can apply the right rules.

**Simple (like for a 10-year-old):** Tell the app “which days are holidays” and “does this cleaner work then and at what extra rate?” so we can show the right slots and charge the right price.

### 10. What does "done" or "success" look like?

**Technical:** listHolidays and getHolidayByDate return correct rows; get/update cleaner settings and overrides succeed; pricing and availability use holiday and multiplier when applicable. Invalid holiday date in override → 400. Success = 200 + expected JSON.

**Simple (like for a 10-year-old):** Success means we return the right holidays and the right cleaner settings, and when we price or show availability we use “holiday or not” and “holiday rate” correctly. If someone tries to set an override for a non-holiday we return an error.

### 11. What would happen if we didn't have it?

**Technical:** No structured holiday list or cleaner holiday preferences; pricing wouldn’t apply holiday rate; availability might show holiday slots when cleaner isn’t available (or hide when they are). Inconsistent or manual handling.

**Simple (like for a 10-year-old):** We wouldn’t have a clear list of holidays or a way for cleaners to say “I work holidays at extra rate.” We’d either not charge extra or not show the right slots.

### 12. What is it not responsible for?

**Technical:** Not responsible for: computing base price (pricingService); building availability slots (calendarService/availabilityService); sending notifications. It only provides holiday data and cleaner settings; callers use them in pricing and availability.

**Simple (like for a 10-year-old):** It doesn’t do the actual price math or build the calendar—it just says “this is a holiday” and “this cleaner works at holiday rate.” The pricing and calendar code use that.

---

## Inputs, outputs, dependencies

### 13. Main inputs

**Technical:** listHolidays: from, to, limit. getHolidayByDate: date. get/update cleaner settings: cleanerId, updates (available_on_federal_holidays, holiday_rate_enabled, holiday_rate_multiplier). Overrides: cleanerId, holidayDate, available, start/end time, use_holiday_rate, min_job_hours, notes.

**Simple (like for a 10-year-old):** We need date range or limit for listing, a single date for “is it a holiday?”, and the cleaner’s id and their settings or override details.

### 14. What it produces or changes

**Technical:** Returns: list of holidays, one holiday or null, cleaner settings, list of overrides, or one override after upsert. Writes: cleaner_holiday_settings (insert/update), cleaner_holiday_overrides (upsert). No delete of holidays table; overrides may be updated to “not available.”

**Simple (like for a 10-year-old):** It returns holiday lists and cleaner settings/overrides. It writes the cleaner’s settings and overrides. It doesn’t delete the holiday list.

### 15–17. Consumers, flow, rules

**Technical:** Consumers: pricing (multiplier), availability/calendar (available or not), frontend (list holidays, manage settings). Flow: read holidays → read cleaner settings + override for date → return or use in pricing/availability. Rules: override holiday_date must exist in holidays; cleaner_id scoped.

**Simple (like for a 10-year-old):** Pricing and calendar and the app use this. We read the holiday list and the cleaner’s settings and override for that day, then return or use them. We only allow overrides for real holidays and we only touch that cleaner’s data.

---

## Triggers, dependencies, security

### 18. What triggers it

**Technical:** User request (list holidays, get/update cleaner settings and overrides); pricing or availability flow (read holiday and settings for a date). No cron.

**Simple (like for a 10-year-old):** When someone asks for the holiday list or their settings, or when we’re building price or availability for a date.

### 19. What could go wrong

**Technical:** Holiday missing from table (date not recognized); override for non-holiday if validation skipped; pricing doesn’t call holidayService (multiplier not applied). Ensure holidays table is seeded and pricing/availability call holidayService.

**Simple (like for a 10-year-old):** We might have a holiday not in the list, or allow an override for a non-holiday, or forget to use the holiday rate when we price. We need to keep the list complete and always use it when we price or show availability.

### 20–22. Monitoring, dependencies, config

**Technical:** Logs for errors; no dedicated metric. Depends on DB. Config: default multiplier in code or cleaner_holiday_settings default.

**Simple (like for a 10-year-old):** We watch logs. We need the DB. The default holiday rate is in code or in the default row.

### 26. Security or privacy

**Technical:** Holiday list is public (no PII). Cleaner settings and overrides are PII (when they work); only that cleaner or admin can read/update. Same auth as rest of app.

**Simple (like for a 10-year-old):** The holiday list is public. The cleaner’s “work on holidays” and overrides are private—only they and admins can see or change them.

### 33. How it interacts with other systems

**Technical:** Read by pricingService (multiplier), calendarService/availabilityService (available or not). Does not publish events or call Stripe. Cleaner profile may expose available_on_federal_holidays for display.

**Simple (like for a 10-year-old):** Pricing and calendar read from here. We don’t send events or call Stripe. The cleaner’s profile might show “works on holidays” for display.

---

**See also:** FOUNDER_PRICING.md, FOUNDER_CALENDAR_AVAILABILITY.md.
