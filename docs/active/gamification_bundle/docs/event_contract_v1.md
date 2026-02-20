# Event Contract v1

This contract defines the minimum event stream required to compute every metric in `metrics_contract_v1` and evaluate goals/rewards/badges.

## Common required fields

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)

## Events

### `engagement.session_started` — Session started

Emitted when the cleaner opens the app (foreground). Used for meaningful login logic.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.device_platform`: ios|android|web
- `payload.app_version`: string
- `payload.timezone`: IANA tz

**Optional fields:**

- `payload.push_opened`: bool
- `payload.session_source`: enum: icon|push|deeplink

**Produces metrics:** `engagement.meaningful_login_days.count`, `engagement.login_streak_days`

**Example:**

```json
{
  "event_type": "engagement.session_started",
  "occurred_at": "2026-02-02T12:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "payload": {
    "device_platform": "ios",
    "app_version": "1.0.0",
    "timezone": "America/Los_Angeles"
  }
}
```

### `engagement.meaningful_action` — Meaningful action performed

Emitted when cleaner performs a meaningful action within a session. Used to qualify login days and streaks.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.session_id`: uuid
- `payload.action`: string (one of allowed actions)

**Optional fields:**

- `payload.metadata`: json

**Produces metrics:** `engagement.meaningful_login_days.count`, `engagement.login_streak_days`

**Example:**

```json
{
  "event_type": "engagement.meaningful_action",
  "occurred_at": "2026-02-02T12:03:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "payload": {
    "session_id": "s1",
    "action": "job_request.open_detail"
  }
}
```

### `job_request.decision` — Job request accepted/declined

Emitted when cleaner accepts or declines a job request. Includes good-faith decline classification inputs.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.decision`: accepted|declined
- `payload.decline_reason`: string (nullable)
- `payload.good_faith_reason`: enum (nullable)
- `payload.job_start_time`: timestamp
- `payload.cleaner_home_lat`: number
- `payload.cleaner_home_lng`: number
- `payload.job_lat`: number
- `payload.job_lng`: number
- `payload.cleaner_max_travel_miles`: number
- `payload.cleaner_availability_snapshot`: json

**Optional fields:**

- `payload.note`: string
- `payload.safety_photo_id`: uuid (nullable)
- `payload.safety_note`: string (nullable)

**Produces metrics:** `job_requests.accepted.count`, `job_requests.acceptance_rate_percent`

**Example:**

```json
{
  "event_type": "job_request.decision",
  "occurred_at": "2026-02-02T13:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "job_request_id": "jr1",
  "payload": {
    "decision": "declined",
    "good_faith_reason": "short_notice",
    "job_start_time": "2026-02-03T05:00:00Z",
    "cleaner_home_lat": 37.7,
    "cleaner_home_lng": -122.4,
    "job_lat": 37.8,
    "job_lng": -122.3,
    "cleaner_max_travel_miles": 10,
    "cleaner_availability_snapshot": {
      "mon": [
        [
          "09:00",
          "15:00"
        ]
      ]
    }
  }
}
```

### `message.sent` — Cleaner sent message

Emitted when cleaner sends a message to client. Used to compute meaningful messages.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.thread_id`: uuid
- `payload.message_id`: uuid
- `payload.template_id`: string (nullable)
- `payload.text_length`: integer
- `payload.contains_template`: bool

**Optional fields:**

- `payload.text_preview`: string (<=80 chars)
- `payload.attachments_count`: integer

**Produces metrics:** `messages.sent_to_clients.meaningful.count`

**Example:**

```json
{
  "event_type": "message.sent",
  "occurred_at": "2026-02-02T14:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "client_id": "u1",
  "job_id": "j1",
  "payload": {
    "thread_id": "t1",
    "message_id": "m1",
    "template_id": "tmpl_thank_you",
    "text_length": 0,
    "contains_template": true
  }
}
```

### `message.received` — Client replied message

Emitted when client sends a message in a thread to the cleaner. Used for 'reply within 24h' meaningful message rule.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.thread_id`: uuid
- `payload.message_id`: uuid
- `payload.in_reply_to_message_id`: uuid (nullable)

**Optional fields:**

- `payload.text_length`: integer

**Produces metrics:** `messages.sent_to_clients.meaningful.count`

**Example:**

```json
{
  "event_type": "message.received",
  "occurred_at": "2026-02-02T16:00:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "client_id": "u1",
  "payload": {
    "thread_id": "t1",
    "message_id": "m2",
    "in_reply_to_message_id": "m1",
    "text_length": 42
  }
}
```

### `job.clock_in` — Clock-in

Emitted when cleaner clocks in. Includes GPS for on-time and compliance calculations.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.clock_in_at`: timestamp
- `payload.scheduled_start_at`: timestamp
- `payload.lat`: number
- `payload.lng`: number

**Optional fields:**

- `payload.gps_accuracy_m`: number
- `payload.method`: gps|manual

**Produces metrics:** `jobs.on_time.count`, `jobs.on_time.rate_percent`, `jobs.clock_in_out.success.count`

**Example:**

```json
{
  "event_type": "job.clock_in",
  "occurred_at": "2026-02-02T15:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "clock_in_at": "2026-02-02T15:00:00Z",
    "scheduled_start_at": "2026-02-02T15:05:00Z",
    "lat": 37.7,
    "lng": -122.4,
    "gps_accuracy_m": 20
  }
}
```

### `job.clock_out` — Clock-out

Emitted when cleaner clocks out. Includes GPS for compliance calculations.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.clock_out_at`: timestamp
- `payload.lat`: number
- `payload.lng`: number

**Optional fields:**

- `payload.gps_accuracy_m`: number
- `payload.method`: gps|manual

**Produces metrics:** `jobs.clock_in_out.success.count`, `jobs.clock_in_out.missing.count`

**Example:**

```json
{
  "event_type": "job.clock_out",
  "occurred_at": "2026-02-02T17:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "clock_out_at": "2026-02-02T17:00:00Z",
    "lat": 37.7,
    "lng": -122.4,
    "gps_accuracy_m": 25
  }
}
```

### `job.photo_uploaded` — Job photo uploaded

Emitted when a before/after photo is uploaded. Used for photo validity metrics.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.photo_id`: uuid
- `payload.phase`: before|after
- `payload.taken_at`: timestamp

**Optional fields:**

- `payload.file_hash`: string
- `payload.source`: camera|upload

**Produces metrics:** `jobs.photos.valid.count`

**Example:**

```json
{
  "event_type": "job.photo_uploaded",
  "occurred_at": "2026-02-02T15:02:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "photo_id": "p1",
    "phase": "before",
    "taken_at": "2026-02-02T15:02:00Z"
  }
}
```

### `job.completed` — Job completed

Emitted when job status is set to completed (server-authoritative).

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.completed_at`: timestamp
- `payload.cleaning_type`: basic|deep|movein|moveout
- `payload.time_slot`: weekday|weekend|early_morning|other

**Optional fields:**

- `payload.total_hours`: number
- `payload.has_addons`: bool

**Produces metrics:** `jobs.completed.count`, `jobs.completed.split_counts`

**Example:**

```json
{
  "event_type": "job.completed",
  "occurred_at": "2026-02-02T17:05:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "completed_at": "2026-02-02T17:05:00Z",
    "cleaning_type": "basic",
    "time_slot": "weekday",
    "total_hours": 2.0,
    "has_addons": false
  }
}
```

### `rating.received` — Rating received

Emitted when client submits a rating for a completed job.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.stars`: integer (1-5)
- `payload.review_text_present`: bool

**Optional fields:**

- `payload.review_length`: integer
- `payload.submitted_at`: timestamp

**Produces metrics:** `ratings.avg_stars`, `ratings.five_star.count`

**Example:**

```json
{
  "event_type": "rating.received",
  "occurred_at": "2026-02-03T00:00:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "stars": 5,
    "review_text_present": true,
    "review_length": 120
  }
}
```

### `dispute.opened` — Dispute opened

Emitted when a dispute is opened for a job involving the cleaner.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.dispute_id`: uuid
- `payload.reason`: string

**Optional fields:**

- `payload.opened_at`: timestamp

**Produces metrics:** `disputes.opened.count`, `disputes.open_or_lost.count`

**Example:**

```json
{
  "event_type": "dispute.opened",
  "occurred_at": "2026-02-03T02:00:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "dispute_id": "d1",
    "reason": "quality"
  }
}
```

### `dispute.resolved` — Dispute resolved

Emitted when a dispute is resolved. Outcome is needed for lost disputes and rates.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.dispute_id`: uuid
- `payload.outcome`: won|lost|dismissed

**Optional fields:**

- `payload.resolved_at`: timestamp

**Produces metrics:** `disputes.lost.count`, `disputes.open_or_lost.count`, `disputes.lost.rate_percent_lifetime`

**Example:**

```json
{
  "event_type": "dispute.resolved",
  "occurred_at": "2026-02-05T02:00:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "dispute_id": "d1",
    "outcome": "won"
  }
}
```

### `job.addon_completed` — Add-on completed

Emitted per add-on line item when completion is verified.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.addon_id`: string
- `payload.addon_line_id`: uuid
- `payload.completed`: bool

**Optional fields:**

- `payload.price`: number

**Produces metrics:** `jobs.addons.completed.count`

**Example:**

```json
{
  "event_type": "job.addon_completed",
  "occurred_at": "2026-02-02T17:02:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "addon_id": "oven",
    "addon_line_id": "al1",
    "completed": true,
    "price": 25.0
  }
}
```

### `availability.updated` — Availability updated

Emitted when cleaner changes availability blocks. Counts as meaningful action and powers scheduling metrics if needed.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.change_type`: add|remove|edit
- `payload.blocks_changed`: integer

**Optional fields:**

- `payload.blocks`: json

**Produces metrics:** `engagement.meaningful_login_days.count`

**Example:**

```json
{
  "event_type": "availability.updated",
  "occurred_at": "2026-02-02T10:00:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "payload": {
    "change_type": "add",
    "blocks_changed": 1
  }
}
```

### `safety.reported` — Safety concern reported

Emitted when cleaner reports unsafe condition (often tied to good-faith decline).

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid (nullable)
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.report_id`: uuid
- `payload.note`: string (min 20 if no photo)
- `payload.photo_id`: uuid (nullable)

**Optional fields:**

- `payload.related_job_request_id`: uuid

**Example:**

```json
{
  "event_type": "safety.reported",
  "occurred_at": "2026-02-02T13:05:00Z",
  "source": "mobile",
  "cleaner_id": "c1",
  "payload": {
    "report_id": "sr1",
    "note": "Aggressive dog loose in yard; no safe access.",
    "photo_id": null,
    "related_job_request_id": "jr1"
  }
}
```

### `tip.received` — Tip received

Emitted when a tip is paid to the cleaner.

**Required fields:**

- `event_id`: uuid
- `event_type`: string
- `occurred_at`: timestamp (UTC)
- `source`: enum: mobile|web|server|admin|system
- `cleaner_id`: uuid (nullable for client-only events; but we prefer set where possible)
- `client_id`: uuid (nullable)
- `job_id`: uuid
- `job_request_id`: uuid (nullable)
- `region_id`: uuid/string (nullable; derived if not provided)
- `idempotency_key`: string (recommended)
- `payload.tip_id`: uuid
- `payload.amount_usd`: number

**Optional fields:**

- `payload.paid_at`: timestamp

**Produces metrics:** `tips.received.count`

**Example:**

```json
{
  "event_type": "tip.received",
  "occurred_at": "2026-02-03T01:00:00Z",
  "source": "server",
  "cleaner_id": "c1",
  "job_id": "j1",
  "payload": {
    "tip_id": "t1",
    "amount_usd": 10.0
  }
}
```
