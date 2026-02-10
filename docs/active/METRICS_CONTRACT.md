# Metrics Contract v1

> Single source of truth for every metric key used in cleaner levels, goals, and badges.
> Engineering, support, and ops must align on these definitions.
>
> **Implementation:** `src/lib/metricsCalculator.ts` — `computeMetric(cleanerId, metricKey, { window, filters })`

## On-Time & Clock-In/Out

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `jobs.on_time.count` | Jobs where clock-in was within the allowed window | Clock-in occurs between **15 min before** and **15 min after** scheduled start. Must be within **250m GPS** of job location. | No clock-in record = not on-time. Use `job_checkins` or `job_events` (job.checked_in) with `created_at`. |
| `jobs.on_time.rate_percent` | % of jobs that were on-time | `(on_time_count / total_completed_with_checkin) * 100` | Jobs without check-in excluded from denominator. |
| `jobs.clockinout.success.count` | Jobs with valid clock-in AND clock-out | Both clock-in and clock-out recorded. Both must be within **250m GPS** of job location. | No duration minimum. |

**Config (env):**
- `ON_TIME_EARLY_MINUTES`: 15
- `ON_TIME_LATE_MINUTES`: 15
- `GPS_CHECKIN_RADIUS_METERS`: 250

---

## Photo Verification (Simplified)

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `jobs.photos.before.count` | Before photos for a job | Count of `job_photos` with `type='before'` for the job | - |
| `jobs.photos.after.count` | After photos for a job | Count of `job_photos` with `type='after'` for the job | - |
| `jobs.photos.valid.count` | Jobs with valid photo submission | ≥1 before AND ≥1 after. Timestamps must fall within job active window (after clock-in, before clock-out). | If no clock-in/out, use `actual_start_at`/`actual_end_at` or `scheduled_start_at`/`scheduled_end_at` as fallback. |
| `jobs.photos.approved.count` | Jobs where photos were approved by client | Client explicitly approved (if we track this). Otherwise: jobs with required before+after. | - |

---

## Ratings

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `ratings.average_stars` | Average star rating | `AVG(rating)` from jobs where `status='completed'` and rating is set | Cleaner-facing UX: always show as "4.8 / 5". |
| `ratings.average_percent` | Normalized 0-100 score (internal) | `(avg_stars / 5) * 100` | Admin-only. Do not show to cleaners. |
| `ratings.five_star.count` | Count of 5-star ratings | `COUNT(*)` where `rating = 5` | - |

---

## Disputes

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `disputes.open_or_lost.count` | Open or lost disputes | Disputes where `status IN ('open', 'resolved_refund')` (cleaner at fault) | - |
| `disputes.lost.count` | Lost disputes (cleaner at fault) | `status = 'resolved_refund'` | - |
| `disputes.unresolved.count` | Open disputes | `status = 'open'` | - |
| `disputes.lost.rate_percent_lifetime` | Lifetime % of jobs with lost dispute | `(lost_disputes / total_completed_jobs) * 100` | - |

---

## Good Faith Declines

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `job_requests.declined.good_faith.count` | Declines with valid good-faith reason | Declines where `decline_reason` in good-faith enum and conditions met | See Good Faith reasons below. |
| `job_requests.declined.count_total` | All declines | Total declines by cleaner | - |
| `job_requests.acceptance_rate_percent` | Fair acceptance rate | `accepted / (accepted + declined_non_good_faith) * 100` | Good-faith declines excluded from denominator. |

**Good Faith Decline Reasons (explicit):**
- **Distance too far**: Job distance ≥ (cleaner's max_travel_miles + 1). Default max_travel = 10 miles → good-faith if job ≥ 11 miles.
- **Time conflict**: Job scheduled start is outside cleaner's availability windows.
- **Job mismatch**: Job requires service cleaner explicitly doesn't offer (e.g. move-out, pets, stairs).
- **Safety concern**: Platform-flagged address, threatening client messages, or cleaner reports unsafe. Optional: upload 1 photo. If no photo: short note required (min 20 chars).
- **Access/logistics mismatch**: Building access conflicts with cleaner constraints.
- **Too short notice**: Time from request sent to job scheduled start < 18 hours.

**Limits:** 6 good-faith declines per 7 days. Beyond that, good-faith still allowed but counts toward acceptance rate.

---

## Login & Engagement

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `engagement.login_days.count` | Days with at least one login | Distinct dates in `cleaner_login_days` | - |
| `engagement.login_streak_days` | Longest consecutive streak | Consecutive days with meaningful login | Uses meaningful-login rule. |
| `engagement.meaningful_sessions.count` | Sessions with ≥1 meaningful action | Session counts only if action within 15 min of app open | See Anti-Gaming Spec. |
| `engagement.logins.count` | Total login records | Count in `cleaner_login_days` | - |
| `engagement.active_weeks.count` | Weeks with activity | Weeks where cleaner had ≥1 meaningful action | - |

---

## Messages (Meaningful)

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `messages.sent_to_clients.meaningful.count` | Messages that count toward goals | Message qualifies if: ≥25 chars OR sent via template OR client replied within 24h | See Anti-Gaming Spec. |

---

## Add-Ons

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `jobs.addons.completed.count` | Add-ons completed | Jobs where client selected add-on at booking and job completed | Add-on selected during booking, after hours estimate. |

---

## Jobs & Volume

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `jobs.completed.count` | Completed jobs | `status = 'completed'` | - |
| `jobs.cancelled.count` | Cancelled jobs | `status = 'cancelled'` | - |
| `jobs.no_show.count` | No-shows | Jobs with `job_no_show_warning` event | - |
| `job_requests.accepted.count` | Accepted job requests | Jobs where cleaner accepted | - |

---

## Repeat Clients

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `clients.repeat_clients.count` | Clients with ≥N jobs | `COUNT(DISTINCT client_id)` where client has ≥N completed jobs with this cleaner | Filter `min_completed_jobs_per_client` in goal. |

---

## Reliability (Percentile)

| Metric Key | Definition | Calculation | Edge Cases |
|------------|------------|-------------|------------|
| `reliability.percentile_local` | Percentile among nearby cleaners | Cleaner's reliability score rank (1 = top 1%, 10 = top 10%) | Use `home_region` filter. |
