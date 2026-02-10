/**
 * Progress Debug Service (Step 17)
 * Best-effort "why didn't it count?" diagnostics for support/admin.
 */

import { query } from "../db/client";

type AnyJson = Record<string, unknown>;

export class ProgressDebugService {
  async getCleanerDebug(params: {
    cleaner_id: string;
    job_id?: string;
    limit?: number;
  }): Promise<{
    cleaner_id: string;
    status: unknown;
    recent_goals: unknown[];
    recent_rewards: unknown[];
    recent_achievements: unknown[];
    recent_events: unknown[];
    diagnostics: AnyJson;
  }> {
    const { cleaner_id, job_id } = params;
    const limit = Math.min(Number(params.limit ?? 200), 500);

    const [status, recentGoals, recentRewards, recentFeed, recentEvents] = await Promise.all([
      this.getLevelStatus(cleaner_id),
      this.getRecentGoals(cleaner_id),
      this.getRecentRewards(cleaner_id),
      this.getRecentFeed(cleaner_id),
      this.getRecentEvents(cleaner_id, job_id, limit),
    ]);

    const diagnostics = this.buildDiagnostics(recentEvents as Array<{ event_type: string; occurred_at: string; payload: AnyJson }>, job_id);

    return {
      cleaner_id,
      status,
      recent_goals: recentGoals,
      recent_rewards: recentRewards,
      recent_achievements: recentFeed,
      recent_events: recentEvents,
      diagnostics,
    };
  }

  private async getLevelStatus(cleaner_id: string): Promise<unknown> {
    try {
      const r = await query(
        `SELECT cleaner_id, current_level, maintenance_paused, maintenance_paused_reason, updated_at
         FROM cleaner_level_progress
         WHERE cleaner_id = $1`,
        [cleaner_id]
      );
      return r.rows[0] ?? null;
    } catch {
      return null;
    }
  }

  private async getRecentGoals(cleaner_id: string): Promise<unknown[]> {
    try {
      const r = await query(
        `SELECT goal_id, current_value, progress_ratio, completed, updated_at
         FROM cleaner_goal_progress
         WHERE cleaner_id = $1
         ORDER BY updated_at DESC
         LIMIT 50`,
        [cleaner_id]
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  private async getRecentRewards(cleaner_id: string): Promise<unknown[]> {
    try {
      const r = await query(
        `SELECT reward_id, granted_at, ends_at, uses_remaining, source_type, source_id, status
         FROM gamification_reward_grants
         WHERE cleaner_id = $1
         ORDER BY granted_at DESC
         LIMIT 50`,
        [cleaner_id]
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  private async getRecentFeed(cleaner_id: string): Promise<unknown[]> {
    try {
      const r = await query(
        `SELECT type, ref_id, title, subtitle, created_at
         FROM cleaner_achievement_feed
         WHERE cleaner_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [cleaner_id]
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  private async getRecentEvents(
    cleaner_id: string,
    job_id?: string,
    limit = 200
  ): Promise<unknown[]> {
    try {
      if (job_id) {
        const r = await query(
          `SELECT event_type, occurred_at, payload
           FROM pt_event_log
           WHERE cleaner_id = $1 AND (payload->>'job_id')::text = $2
           ORDER BY occurred_at DESC
           LIMIT $3`,
          [cleaner_id, job_id, limit]
        );
        return r.rows ?? [];
      }
      const r = await query(
        `SELECT event_type, occurred_at, payload
         FROM pt_event_log
         WHERE cleaner_id = $1
         ORDER BY occurred_at DESC
         LIMIT $2`,
        [cleaner_id, limit]
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  private buildDiagnostics(
    events: Array<{ event_type: string; occurred_at: string; payload: AnyJson }>,
    job_id?: string
  ): AnyJson {
    const diags: AnyJson = {};

    // Meaningful login: session + action within 15m
    const sessions = events.filter((e) => e.event_type === "session_started" || e.event_type === "session_start");
    const actions = events.filter((e) => e.event_type === "meaningful_action");
    if (sessions.length > 0) {
      const s = sessions[0];
      const sTime = new Date(s.occurred_at).getTime();
      const hasAction = actions.some((a) => {
        const aTime = new Date(a.occurred_at).getTime();
        return aTime >= sTime && aTime <= sTime + 15 * 60 * 1000;
      });
      diags.meaningful_login = {
        last_session_started_at: s.occurred_at,
        has_meaningful_action_within_15m: hasAction,
        note: hasAction
          ? "Counts as a login day if within the same calendar day."
          : "No meaningful action detected within 15 minutes.",
      };
    }

    // Meaningful message
    const msgs = events.filter(
      (e) => e.event_type === "message_sent" || e.event_type === "message_sent_to_client"
    );
    if (msgs.length > 0) {
      const m = msgs[0];
      const body = String((m.payload?.body ?? m.payload?.content ?? "") || "");
      const templateId = m.payload?.template_id ?? m.payload?.template_key ?? null;
      const chars = body.length;
      const replied = Boolean(m.payload?.customer_replied_within_24h ?? false);
      const meaningful = Boolean(templateId) || chars >= 25 || replied;
      diags.meaningful_message = {
        last_message_at: m.occurred_at,
        template_id: templateId,
        chars,
        customer_replied_within_24h: replied,
        counted_as_meaningful: meaningful,
        note: meaningful
          ? "Counts toward messaging goals."
          : "Too short and not a template; does not count.",
      };
    }

    // Photos: clock window
    const clockIn = events.find((e) => e.event_type === "clock_in" || e.event_type === "clockin");
    const clockOut = events.find((e) => e.event_type === "clock_out" || e.event_type === "clockout");
    const photos = events.filter(
      (e) => e.event_type === "photo_uploaded" || e.event_type === "photo_upload"
    );
    if (clockIn && clockOut && photos.length > 0) {
      const start = new Date(clockIn.occurred_at).getTime();
      const end = new Date(clockOut.occurred_at).getTime();
      const before = photos.find(
        (p) => (p.payload?.kind ?? p.payload?.phase) === "before"
      );
      const after = photos.find((p) => (p.payload?.kind ?? p.payload?.phase) === "after");
      const beforeOk = before
        ? new Date(before.occurred_at).getTime() >= start &&
          new Date(before.occurred_at).getTime() <= end
        : false;
      const afterOk = after
        ? new Date(after.occurred_at).getTime() >= start &&
          new Date(after.occurred_at).getTime() <= end
        : false;
      diags.photo_rules = {
        clock_in_at: clockIn.occurred_at,
        clock_out_at: clockOut.occurred_at,
        has_before: Boolean(before),
        has_after: Boolean(after),
        before_in_window: beforeOk,
        after_in_window: afterOk,
        counted: Boolean(beforeOk && afterOk),
        note:
          beforeOk && afterOk
            ? "Meets photo rule (1 before + 1 after within clock window)."
            : "Photos must be taken between clock-in and clock-out.",
      };
    }

    // On-time + GPS
    if (clockIn) {
      const scheduled = clockIn.payload?.scheduled_start_at
        ? new Date(clockIn.payload.scheduled_start_at as string).getTime()
        : null;
      const actual = new Date(clockIn.occurred_at).getTime();
      const minsDiff = scheduled != null ? Math.round((actual - scheduled) / 60000) : null;
      const gpsOk =
        clockIn.payload?.gps_distance_meters != null
          ? Number(clockIn.payload.gps_distance_meters) <= 250
          : null;
      const onTime =
        minsDiff != null
          ? minsDiff >= -15 && minsDiff <= 15 && (gpsOk === null || gpsOk === true)
          : null;

      diags.on_time = {
        scheduled_start_at: clockIn.payload?.scheduled_start_at ?? null,
        clock_in_at: clockIn.occurred_at,
        minutes_from_start: minsDiff,
        gps_distance_meters: clockIn.payload?.gps_distance_meters ?? null,
        gps_within_250m: gpsOk,
        counted_as_on_time: onTime,
        note:
          onTime === null
            ? "Scheduled start time not available in event payload."
            : onTime
              ? "On-time by ±15 min rule and GPS radius."
              : "Late/early beyond ±15 min or GPS outside 250m.",
      };
    }

    // Last decline
    const declines = events.filter(
      (e) => e.event_type === "job_request_declined" || e.event_type === "job_declined"
    );
    if (declines.length > 0) {
      const d = declines[0];
      diags.last_decline = {
        declined_at: d.occurred_at,
        reason: d.payload?.reason ?? null,
        good_faith: Boolean(d.payload?.good_faith ?? false),
        note: (d.payload?.good_faith ?? false)
          ? "Good-faith decline (does not affect acceptance rate)."
          : "Non-good-faith decline (affects acceptance rate).",
      };
    }

    return diags;
  }
}
