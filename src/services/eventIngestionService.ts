/**
 * PureTask Gamification — Event Ingestion Service
 *
 * Writes events to pt_event_log for metrics computation.
 * See docs/active/EVENT_CONTRACT.md
 */

import { v4 as uuidv4 } from "uuid";
import { query } from "../db/client";

export type EventSource = "mobile" | "web" | "server" | "admin" | "system";

export interface EventRecord {
  event_type: string;
  occurred_at: Date;
  source: EventSource;
  cleaner_id?: string | null;
  client_id?: string | null;
  job_id?: string | null;
  job_request_id?: string | null;
  region_id?: string | null;
  payload?: Record<string, unknown>;
  idempotency_key?: string | null;
}

/**
 * Record a single event. When idempotency_key is provided, duplicates are ignored.
 */
export async function recordEvent(evt: EventRecord): Promise<void> {
  const eventId = uuidv4();
  const conflictClause = evt.idempotency_key
    ? " ON CONFLICT (event_type, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING"
    : "";
  const sql = `INSERT INTO pt_event_log (
    event_id, event_type, occurred_at, source,
    cleaner_id, client_id, job_id, job_request_id, region_id,
    payload, idempotency_key
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)${conflictClause}`;

  await query(sql, [
    eventId,
    evt.event_type,
    evt.occurred_at,
    evt.source,
    evt.cleaner_id ?? null,
    evt.client_id ?? null,
    evt.job_id ?? null,
    evt.job_request_id ?? null,
    evt.region_id ?? null,
    JSON.stringify(evt.payload ?? {}),
    evt.idempotency_key ?? null,
  ]);
}

/**
 * Record engagement session start (for meaningful-login metrics).
 */
export async function recordSessionStart(
  sessionId: string,
  cleanerId: string,
  source: "mobile" | "web",
  attrs?: { timezone?: string; device_platform?: string; app_version?: string }
): Promise<void> {
  await query(
    `INSERT INTO pt_engagement_sessions (session_id, cleaner_id, started_at, source, timezone, device_platform, app_version)
     VALUES ($1, $2, NOW(), $3, $4, $5, $6)
     ON CONFLICT (session_id) DO NOTHING`,
    [
      sessionId,
      cleanerId,
      source,
      attrs?.timezone ?? null,
      attrs?.device_platform ?? null,
      attrs?.app_version ?? null,
    ]
  );
}

/**
 * Record meaningful action within a session.
 */
export async function recordMeaningfulAction(
  actionId: string,
  sessionId: string,
  cleanerId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await query(
    `INSERT INTO pt_engagement_actions (action_id, session_id, cleaner_id, occurred_at, action, metadata)
     VALUES ($1, $2, $3, NOW(), $4, $5)
     ON CONFLICT (action_id) DO NOTHING`,
    [actionId, sessionId, cleanerId, action, JSON.stringify(metadata ?? {})]
  );
}
