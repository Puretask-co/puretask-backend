// src/services/calendarService.ts
// Google Calendar integration with OAuth2

import { query } from "../db/client";
import { logger } from "../lib/logger";
import { enqueue, QUEUE_NAMES } from "../lib/queue";

// ============================================
// Configuration
// ============================================

const GOOGLE_CONFIG = {
  CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/calendar/google/callback",
  SCOPES: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
};

// ============================================
// Types
// ============================================

export interface CalendarConnection {
  id: number;
  user_id: string;
  provider: string;
  external_id: string;
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  location?: string;
}

// ============================================
// OAuth Flow
// ============================================

/**
 * Generate Google OAuth URL for authorization
 */
export function getGoogleConnectUrl(userId: string): string {
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64");

  const params = new URLSearchParams({
    client_id: GOOGLE_CONFIG.CLIENT_ID,
    redirect_uri: GOOGLE_CONFIG.REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_CONFIG.SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function handleGoogleCallback(
  code: string,
  state: string
): Promise<CalendarConnection> {
  // Decode state to get userId
  const { userId } = JSON.parse(Buffer.from(state, "base64").toString());

  // Exchange code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CONFIG.CLIENT_ID,
      client_secret: GOOGLE_CONFIG.CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: GOOGLE_CONFIG.REDIRECT_URI,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    logger.error("google_token_exchange_failed", { error });
    throw Object.assign(new Error("Failed to connect Google Calendar"), { statusCode: 400 });
  }

  const tokens = await tokenResponse.json();

  // Get user's email from Google
  const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  const userInfo = await userInfoResponse.json();

  // Get primary calendar ID
  const calendarResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList/primary",
    {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    }
  );

  const calendarInfo = await calendarResponse.json();
  const calendarId = calendarInfo.id || "primary";

  // Calculate token expiry
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  // Save connection (upsert)
  const result = await query<CalendarConnection>(
    `
      INSERT INTO calendar_connections (
        user_id, provider, external_id, email, access_token, refresh_token, token_expires_at
      )
      VALUES ($1, 'google', $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, provider) DO UPDATE
      SET external_id = EXCLUDED.external_id,
          email = EXCLUDED.email,
          access_token = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, calendar_connections.refresh_token),
          token_expires_at = EXCLUDED.token_expires_at,
          sync_enabled = true,
          updated_at = NOW()
      RETURNING *
    `,
    [
      userId,
      calendarId,
      userInfo.email,
      tokens.access_token,
      tokens.refresh_token || null,
      expiresAt?.toISOString() || null,
    ]
  );

  logger.info("google_calendar_connected", {
    userId,
    email: userInfo.email,
    calendarId,
  });

  return result.rows[0];
}

/**
 * Refresh access token if expired
 */
async function refreshAccessToken(connection: CalendarConnection): Promise<string> {
  if (!connection.refresh_token) {
    throw new Error("No refresh token available");
  }

  // Check if token is still valid
  if (connection.token_expires_at) {
    const expiresAt = new Date(connection.token_expires_at);
    if (expiresAt > new Date(Date.now() + 5 * 60 * 1000)) {
      // Token valid for more than 5 minutes
      return connection.access_token;
    }
  }

  // Refresh the token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CONFIG.CLIENT_ID,
      client_secret: GOOGLE_CONFIG.CLIENT_SECRET,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const tokens = await response.json();

  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;

  // Update stored token
  await query(
    `
      UPDATE calendar_connections
      SET access_token = $2, token_expires_at = $3, updated_at = NOW()
      WHERE id = $1
    `,
    [connection.id, tokens.access_token, expiresAt?.toISOString() || null]
  );

  logger.debug("google_token_refreshed", { connectionId: connection.id });

  return tokens.access_token;
}

// ============================================
// Connection Management
// ============================================

/**
 * Get user's calendar connection
 */
export async function getUserCalendarConnection(
  userId: string,
  provider: string = "google"
): Promise<CalendarConnection | null> {
  const result = await query<CalendarConnection>(
    `SELECT * FROM calendar_connections WHERE user_id = $1 AND provider = $2`,
    [userId, provider]
  );
  return result.rows[0] ?? null;
}

/**
 * Disconnect calendar
 */
export async function disconnectCalendar(
  userId: string,
  provider: string = "google"
): Promise<void> {
  await query(`DELETE FROM calendar_connections WHERE user_id = $1 AND provider = $2`, [
    userId,
    provider,
  ]);

  // Also delete synced events
  await query(
    `
      DELETE FROM calendar_events
      WHERE connection_id IN (
        SELECT id FROM calendar_connections WHERE user_id = $1 AND provider = $2
      )
    `,
    [userId, provider]
  );

  logger.info("calendar_disconnected", { userId, provider });
}

/**
 * Toggle sync enabled
 */
export async function toggleCalendarSync(userId: string, enabled: boolean): Promise<void> {
  await query(
    `UPDATE calendar_connections SET sync_enabled = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, enabled]
  );

  logger.info("calendar_sync_toggled", { userId, enabled });
}

// ============================================
// Calendar Event Sync
// ============================================

/**
 * Create or update a Google Calendar event for a job
 */
export async function syncJobToCalendar(
  userId: string,
  jobId: string,
  eventData: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    location?: string;
  }
): Promise<string | null> {
  const connection = await getUserCalendarConnection(userId);
  if (!connection || !connection.sync_enabled) {
    logger.debug("calendar_sync_skipped", { userId, reason: "no_connection_or_disabled" });
    return null;
  }

  try {
    const accessToken = await refreshAccessToken(connection);

    // Check if event already exists
    const existingEvent = await query<{ external_event_id: string }>(
      `SELECT external_event_id FROM calendar_events WHERE connection_id = $1 AND job_id = $2`,
      [connection.id, jobId]
    );

    const event: CalendarEvent = {
      id: existingEvent.rows[0]?.external_event_id || "",
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: eventData.start.toISOString(),
        timeZone: "America/Los_Angeles",
      },
      end: {
        dateTime: eventData.end.toISOString(),
        timeZone: "America/Los_Angeles",
      },
      location: eventData.location,
    };

    let response: Response;
    let externalEventId: string;

    if (existingEvent.rows.length > 0) {
      // Update existing event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.external_id}/events/${existingEvent.rows[0].external_event_id}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );
      externalEventId = existingEvent.rows[0].external_event_id;
    } else {
      // Create new event
      response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${connection.external_id}/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        }
      );

      if (response.ok) {
        const created = await response.json();
        externalEventId = created.id;

        // Store mapping
        await query(
          `
            INSERT INTO calendar_events (connection_id, job_id, external_event_id, event_type)
            VALUES ($1, $2, $3, 'job')
          `,
          [connection.id, jobId, externalEventId]
        );
      } else {
        throw new Error(`Failed to create calendar event: ${response.status}`);
      }
    }

    // Update last synced
    await query(`UPDATE calendar_connections SET last_synced_at = NOW() WHERE id = $1`, [
      connection.id,
    ]);

    logger.info("job_synced_to_calendar", { userId, jobId, externalEventId });

    return externalEventId;
  } catch (err) {
    logger.error("calendar_sync_failed", {
      userId,
      jobId,
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Delete a calendar event for a job
 */
export async function deleteJobFromCalendar(userId: string, jobId: string): Promise<void> {
  const connection = await getUserCalendarConnection(userId);
  if (!connection) return;

  const eventResult = await query<{ external_event_id: string }>(
    `SELECT external_event_id FROM calendar_events WHERE connection_id = $1 AND job_id = $2`,
    [connection.id, jobId]
  );

  if (eventResult.rows.length === 0) return;

  try {
    const accessToken = await refreshAccessToken(connection);

    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${connection.external_id}/events/${eventResult.rows[0].external_event_id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    await query(`DELETE FROM calendar_events WHERE connection_id = $1 AND job_id = $2`, [
      connection.id,
      jobId,
    ]);

    logger.info("job_deleted_from_calendar", { userId, jobId });
  } catch (err) {
    logger.error("calendar_delete_failed", {
      userId,
      jobId,
      error: (err as Error).message,
    });
  }
}

/**
 * Queue a calendar sync (non-blocking)
 */
export async function queueCalendarSync(
  userId: string,
  jobId: string,
  eventData: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    location?: string;
  }
): Promise<void> {
  await enqueue(QUEUE_NAMES.CALENDAR_SYNC, {
    userId,
    jobId,
    eventData: {
      ...eventData,
      start: eventData.start.toISOString(),
      end: eventData.end.toISOString(),
    },
  });

  logger.debug("calendar_sync_queued", { userId, jobId });
}

// ============================================
// ICS Export (Apple Calendar)
// ============================================

/**
 * Generate ICS feed URL for a user
 */
export function generateICSFeedUrl(userId: string): string {
  // This would typically be a signed URL or use a token
  const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/api/calendar/ics/${userId}.ics`;
}

/**
 * Generate ICS content for user's jobs
 */
export async function generateICSContent(userId: string): Promise<string> {
  const jobs = await query<{
    id: string;
    scheduled_start_at: string;
    scheduled_end_at: string;
    address: string;
    status: string;
  }>(
    `
      SELECT id, scheduled_start_at, scheduled_end_at, address, status
      FROM jobs
      WHERE (client_id = $1 OR cleaner_id = $1)
        AND status NOT IN ('cancelled')
        AND scheduled_start_at > NOW() - INTERVAL '30 days'
      ORDER BY scheduled_start_at ASC
    `,
    [userId]
  );

  const events = jobs.rows.map((job) => {
    const start = new Date(job.scheduled_start_at);
    const end = new Date(job.scheduled_end_at);

    return `BEGIN:VEVENT
UID:job-${job.id}@puretask.com
DTSTAMP:${formatICSDate(new Date())}
DTSTART:${formatICSDate(start)}
DTEND:${formatICSDate(end)}
SUMMARY:PureTask Cleaning
DESCRIPTION:Status: ${job.status}
LOCATION:${job.address.replace(/\n/g, "\\n")}
END:VEVENT`;
  });

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PureTask//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${events.join("\n")}
END:VCALENDAR`;
}

function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}
