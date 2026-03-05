# Event Contract v1

> Minimum event stream required to compute every metric in `METRICS_CONTRACT.md` and evaluate goals/rewards/badges.
> See `DB/migrations/047_gamification_event_ingestion.sql` for tables.

## Common Required Fields

| Field | Type |
|-------|------|
| `event_id` | UUID |
| `event_type` | string |
| `occurred_at` | timestamp (UTC) |
| `source` | mobile \| web \| server \| admin \| system |
| `cleaner_id` | TEXT (nullable) |
| `client_id` | TEXT (nullable) |
| `job_id` | UUID (nullable) |
| `job_request_id` | UUID (nullable) |
| `idempotency_key` | string (recommended) |

## Event Types → Metrics Mapping

| Event Type | Produces Metrics |
|------------|------------------|
| `engagement.session_started` | meaningful_login_days, login_streak |
| `engagement.meaningful_action` | meaningful_login_days, login_streak |
| `job_request.decision` | acceptance_rate, accepted.count |
| `message.sent` | messages.sent_to_clients.meaningful.count |
| `job.clock_in` | on_time.count, clock_in_out.success.count |
| `job.clock_out` | clock_in_out.success.count |
| `job.photo_uploaded` | photos.valid.count |
| `job.completed` | jobs.completed.count |
| `rating.received` | ratings.avg_stars, five_star.count |
| `dispute.opened` | disputes.opened.count |
| `dispute.resolved` | disputes.lost.count, lost.rate |
| `job.addon_completed` | addons.completed.count |
| `availability.updated` | meaningful_login_days |
| `safety.reported` | (good-faith classification) |

## Tables (Migration 047)

- **pt_event_log** — Append-only generic event store
- **pt_engagement_sessions** — Session start for meaningful-login logic
- **pt_engagement_actions** — Meaningful actions tied to sessions

## Ingestion

Write events via `eventIngestionService.recordEvent()`. Mobile/web clients POST to `/events` (or internal service calls). Server-authoritative events (job.completed, rating.received, dispute.opened/resolved) emitted from domain services.
