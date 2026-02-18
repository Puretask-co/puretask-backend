/**
 * PureTask Gamification — Metrics Calculator
 *
 * Deterministic calculators for every metric in the Metrics Contract.
 * See docs/active/METRICS_CONTRACT.md
 *
 * Used by goal evaluation, level progression, and badge award logic.
 * All computations are event-backed; no implicit data.
 */

import { query } from "../db/client";

export type MetricWindow =
  | { type: "days"; value: number }
  | { type: "last_jobs"; value: number }
  | null;
export type MetricFilters = {
  cleaning_type?: string | string[];
  time_slot?: string | string[];
  min_completed_jobs_per_client?: number;
  [key: string]: unknown;
};

/** Result of computing a metric value */
export interface MetricResult {
  value: number | Record<string, number> | boolean;
  unit?: string;
}

/**
 * Compute a metric value for a cleaner.
 * Returns the raw value (count, rate, etc.) for goal comparison.
 */
export async function computeMetric(
  cleanerId: string,
  metricKey: string,
  options?: { window?: MetricWindow | null; filters?: MetricFilters }
): Promise<MetricResult | null> {
  const window = options?.window ?? null;
  const filters = options?.filters ?? {};

  switch (metricKey) {
    // === Jobs & Volume ===
    case "jobs.completed.count":
      return computeJobsCompleted(cleanerId, window, filters);
    case "jobs.completed.split_counts":
      return computeJobsCompletedSplitCounts(cleanerId, window);
    case "jobs.addons.completed.count":
      return computeAddonsCompleted(cleanerId, window, filters);
    case "jobs.photos.valid.count":
      return computePhotosValid(cleanerId, window, filters);
    case "jobs.photos.approved.count":
      return computePhotosApproved(cleanerId, window, filters);
    case "jobs.clock_in_out.success.count":
    case "jobs.clockinout.success.count":
      return computeClockInOutSuccess(cleanerId, window, filters);
    case "jobs.on_time.count":
      return computeOnTimeCount(cleanerId, window, filters);
    case "jobs.on_time.rate_percent":
      return computeOnTimeRate(cleanerId, window, filters);
    case "jobs.on_time.streak":
      return computeOnTimeStreak(cleanerId);
    case "jobs.rescheduled.count":
      return computeRescheduledCount(cleanerId, window);
    case "jobs.cancelled.count":
    case "jobs.cancelled_by_cleaner.count":
      return computeCancelledCount(cleanerId, window);
    case "jobs.no_show.count":
      return computeNoShowCount(cleanerId);
    case "jobs.clock_in_out.missing.count":
      return computeClockInOutMissing(cleanerId, window);

    // === Ratings ===
    case "ratings.avg_stars":
    case "ratings.average_stars":
      return computeAvgStars(cleanerId, window, filters);
    case "ratings.average_percent":
      return computeAvgPercent(cleanerId, window);
    case "ratings.five_star.count":
      return computeFiveStarCount(cleanerId, window);

    // === Job Requests ===
    case "job_requests.accepted.count":
      return computeJobsAccepted(cleanerId, window);
    case "job_requests.acceptance_rate_percent":
      return computeAcceptanceRate(cleanerId, window);

    // === Messages ===
    case "messages.sent_to_clients.meaningful.count":
    case "messages.sent_to_clients.count":
      return computeMessagesSent(cleanerId, window);

    // === Engagement ===
    case "engagement.meaningful_login_days.count":
      return computeMeaningfulLoginDays(cleanerId, window);
    case "engagement.login_streak_days":
      return computeLoginStreak(cleanerId);
    case "engagement.logins.count":
      return computeLoginsCount(cleanerId, window);
    case "engagement.active_weeks.count":
      return computeActiveWeeks(cleanerId, window);

    // === Disputes ===
    case "disputes.open_or_lost.count":
      return computeDisputesOpenOrLost(cleanerId, window);
    case "disputes.lost.count":
      return computeDisputesLost(cleanerId, window);
    case "disputes.opened.count":
      return computeDisputesOpened(cleanerId, window);
    case "disputes.lost.rate_percent_lifetime":
      return computeDisputesLostRateLifetime(cleanerId);

    // === Clients ===
    case "clients.repeat_clients.count":
    case "clients.count_with_min_jobs":
      return computeRepeatClients(cleanerId, filters);
    case "clients.max_jobs_with_single_client":
      return computeMaxJobsSingleClient(cleanerId);

    // === Composite badges ===
    case "badges.composite.review_whisperer":
      return computeCompositeReviewWhisperer(cleanerId);
    case "badges.composite.tip_jar_energy":
      return computeCompositeTipJarEnergy(cleanerId);

    // === Tips ===
    case "tips.received.count":
      return computeTipsReceivedCount(cleanerId, window);

    // === Reliability (stub – requires reliability service) ===
    case "reliability.percentile":
    case "reliability.percentile_local":
      return computeReliabilityPercentile(cleanerId, window, filters);

    // === Compliance & Account (stubs for maintenance goals) ===
    case "compliance.violations.count":
      return computeComplianceViolations(cleanerId);
    case "compliance.warnings.count":
      return computeComplianceWarnings(cleanerId);
    case "account.verified.bool":
      return computeAccountVerified(cleanerId);

    // === Jobs (additional) ===
    case "jobs.late_over_10_min.count":
      return computeLateOver10Min(cleanerId, window);
    case "jobs.cancelled_last_minute.count":
      return computeCancelledLastMinute(cleanerId, window);

    // === Performance composites ===
    case "performance.perfect_streak_days":
      return computePerfectStreakDays(cleanerId);
    case "performance.issues.count":
      return computePerformanceIssues(cleanerId, window);

    // === Disputes (additional) ===
    case "disputes.unresolved.count":
      return computeDisputesUnresolved(cleanerId, window);

    default:
      return null;
  }
}

// --- Helpers for window/filter application ---

function jobWindowClause(window: MetricWindow | null): string {
  if (!window) return "";
  if (window.type === "days") {
    return ` AND COALESCE(j.actual_end_at, j.updated_at, j.created_at) >= NOW() - INTERVAL '${window.value} days'`;
  }
  if (window.type === "last_jobs") {
    return ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      ORDER BY COALESCE(actual_end_at, updated_at, created_at) DESC NULLS LAST LIMIT ${window.value}
    )`;
  }
  return "";
}

function cleaningTypeFilter(filters: MetricFilters): string {
  const ct = filters.cleaning_type;
  if (!ct) return "";
  const arr = Array.isArray(ct) ? ct : [ct];
  const quoted = arr.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(",");
  return ` AND j.cleaning_type IN (${quoted})`;
}

/** Derive time_slot from scheduled_start_at: weekend = Sat/Sun, early_morning = before 10am */
function timeSlotFilter(filters: MetricFilters): string {
  const ts = filters.time_slot;
  if (!ts) return "";
  const arr = Array.isArray(ts) ? ts : [ts];
  const conditions: string[] = [];
  for (const t of arr) {
    if (t === "weekend") {
      conditions.push(`(EXTRACT(DOW FROM j.scheduled_start_at) IN (0, 6))`);
    } else if (t === "early_morning") {
      conditions.push(`(EXTRACT(HOUR FROM j.scheduled_start_at) < 10)`);
    } else if (t === "evening") {
      conditions.push(`(EXTRACT(HOUR FROM j.scheduled_start_at) >= 18)`);
    }
  }
  if (conditions.length === 0) return "";
  return ` AND (${conditions.join(" OR ")})`;
}

// --- Implementations ---

async function computeJobsCompleted(
  cleanerId: string,
  window: MetricWindow | null,
  filters: MetricFilters
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed'`;
  sql += jobWindowClause(window);
  sql += cleaningTypeFilter(filters);
  sql += timeSlotFilter(filters);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeAddonsCompleted(
  cleanerId: string,
  window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed' AND (j.has_addons = true OR j.addons_count > 0)`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computePhotosValid(
  cleanerId: string,
  window: MetricWindow | null,
  filters: MetricFilters
): Promise<MetricResult> {
  let sql = `
    SELECT COUNT(*)::int as v FROM (
      SELECT j.id FROM jobs j
      WHERE j.cleaner_id = $1 AND j.status = 'completed'
        AND (j.actual_start_at IS NOT NULL AND j.actual_end_at IS NOT NULL)
        AND EXISTS (
          SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'before'
          AND p.created_at >= COALESCE(j.actual_start_at, j.scheduled_start_at)
          AND p.created_at <= COALESCE(j.actual_end_at, j.scheduled_end_at, j.scheduled_start_at + INTERVAL '4 hours')
        )
        AND EXISTS (
          SELECT 1 FROM job_photos p WHERE p.job_id = j.id AND p.type = 'after'
          AND p.created_at >= COALESCE(j.actual_start_at, j.scheduled_start_at)
          AND p.created_at <= COALESCE(j.actual_end_at, j.scheduled_end_at, j.scheduled_start_at + INTERVAL '4 hours')
        )
  `;
  sql += jobWindowClause(window);
  sql += cleaningTypeFilter(filters);
  sql += timeSlotFilter(filters);
  sql += ` ) x`;
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computePhotosApproved(
  cleanerId: string,
  window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  // Fallback: jobs with required before+after (no explicit approval table)
  let sql = `SELECT COUNT(DISTINCT j.id)::int as v FROM jobs j
    JOIN job_photos jp ON jp.job_id = j.id
    WHERE j.cleaner_id = $1 AND j.status = 'completed'`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeClockInOutSuccess(
  cleanerId: string,
  window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
      AND EXISTS (SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true)
      AND EXISTS (SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_out' AND c.is_within_radius = true)`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeClockInOutMissing(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
      AND (j.actual_start_at IS NOT NULL OR j.actual_end_at IS NOT NULL)
      AND NOT (EXISTS (SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_in' AND c.is_within_radius = true)
        AND EXISTS (SELECT 1 FROM job_checkins c WHERE c.job_id = j.id AND c.type = 'check_out' AND c.is_within_radius = true))`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeOnTimeCount(
  cleanerId: string,
  window: MetricWindow | null,
  filters: MetricFilters
): Promise<MetricResult> {
  // On-time: clock-in within ±15 min of scheduled_start, within 250m
  let sql = `
    SELECT COUNT(*)::int as v FROM jobs j
    JOIN job_checkins ci ON ci.job_id = j.id AND ci.type = 'check_in' AND ci.is_within_radius = true
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
      AND j.scheduled_start_at IS NOT NULL
      AND ci.created_at >= j.scheduled_start_at - INTERVAL '15 minutes'
      AND ci.created_at <= j.scheduled_start_at + INTERVAL '15 minutes'
  `;
  sql += jobWindowClause(window);
  sql += cleaningTypeFilter(filters);
  sql += timeSlotFilter(filters);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeOnTimeRate(
  cleanerId: string,
  window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  const totalSql = `SELECT COUNT(*)::int as t FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
    ${jobWindowClause(window)}`;
  const onTimeSql = `
    SELECT COUNT(*)::int as v FROM jobs j
    JOIN job_checkins ci ON ci.job_id = j.id AND ci.type = 'check_in' AND ci.is_within_radius = true
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
      AND j.scheduled_start_at IS NOT NULL
      AND ci.created_at >= j.scheduled_start_at - INTERVAL '15 minutes'
      AND ci.created_at <= j.scheduled_start_at + INTERVAL '15 minutes'
    ${jobWindowClause(window)}`;
  const [totalR, onTimeR] = await Promise.all([
    query<{ t: number }>(totalSql, [cleanerId]),
    query<{ v: number }>(onTimeSql, [cleanerId]),
  ]);
  const total = totalR.rows[0]?.t ?? 0;
  const onTime = onTimeR.rows[0]?.v ?? 0;
  const rate = total > 0 ? Math.round((onTime / total) * 100) : 0;
  return { value: rate, unit: "percent" };
}

async function computeOnTimeStreak(cleanerId: string): Promise<MetricResult> {
  const r = await query<{ streak: number }>(
    `WITH ordered AS (
       SELECT j.id, j.scheduled_start_at,
         EXISTS (
           SELECT 1 FROM job_checkins ci
           WHERE ci.job_id = j.id AND ci.type = 'check_in' AND ci.is_within_radius = true
           AND ci.created_at >= j.scheduled_start_at - INTERVAL '15 minutes'
           AND ci.created_at <= j.scheduled_start_at + INTERVAL '15 minutes'
         ) as on_time
       FROM jobs j
       WHERE j.cleaner_id = $1 AND j.status = 'completed'
       ORDER BY j.completed_at ASC NULLS LAST, j.scheduled_start_at ASC
     ),
     grouped AS (
       SELECT *, SUM(CASE WHEN NOT on_time THEN 1 ELSE 0 END) OVER (ORDER BY scheduled_start_at) as grp
       FROM ordered
     )
     SELECT COALESCE(MAX(rn), 0)::int as streak FROM (
       SELECT ROW_NUMBER() OVER (PARTITION BY grp ORDER BY scheduled_start_at) as rn
       FROM grouped WHERE on_time
     ) x`,
    [cleanerId]
  );
  return { value: r.rows[0]?.streak ?? 0, unit: "jobs" };
}

async function computeRescheduledCount(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM job_events je
    JOIN jobs j ON j.id = je.job_id
    WHERE j.cleaner_id = $1 AND je.event_type::text ILIKE '%reschedule%'`;
  if (window?.type === "last_jobs") {
    sql += ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST, created_at DESC LIMIT ${window.value}
    )`;
  } else if (window?.type === "days") {
    sql += ` AND je.created_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  sql += ` AND j.status = 'completed'`;
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeCancelledCount(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'cancelled'`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeNoShowCount(cleanerId: string): Promise<MetricResult> {
  const r = await query<{ v: number }>(
    `SELECT COUNT(*)::int as v FROM job_events je
     JOIN jobs j ON j.id = je.job_id
     WHERE j.cleaner_id = $1 AND je.event_type::text ILIKE '%no_show%'`,
    [cleanerId]
  );
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeAvgStars(
  cleanerId: string,
  window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  let sql = `SELECT COALESCE(AVG(j.rating)::numeric(5,2), 0) as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed' AND j.rating IS NOT NULL`;
  sql += jobWindowClause(window);
  const r = await query<{ v: string }>(sql, [cleanerId]);
  return { value: parseFloat(r.rows[0]?.v ?? "0"), unit: "stars" };
}

async function computeAvgPercent(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  const stars = await computeAvgStars(cleanerId, window, {});
  const numVal = typeof stars.value === "number" ? stars.value : 0;
  return { value: Math.round((numVal / 5) * 100), unit: "percent" };
}

async function computeFiveStarCount(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed' AND j.rating = 5`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "ratings" };
}

async function computeJobsAccepted(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status IN ('accepted','on_my_way','in_progress','awaiting_approval','completed')`;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeAcceptanceRate(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  // accepted / (accepted + declined). Good-faith declines excluded in goodFaithDeclines service.
  let sql = `SELECT
    COUNT(*) FILTER (WHERE status = 'accepted')::int as accepted,
    COUNT(*) FILTER (WHERE status IN ('declined','declined_by_system'))::int as declined
  FROM job_offers WHERE cleaner_id = $1`;
  if (window?.type === "days") {
    sql += ` AND created_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ accepted: number; declined: number }>(sql, [cleanerId]);
  const row = r.rows[0];
  const accepted = row?.accepted ?? 0;
  const declined = row?.declined ?? 0;
  const total = accepted + declined;
  const rate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return { value: rate, unit: "percent" };
}

async function computeMessagesSent(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM messages m
    WHERE m.sender_id = $1 AND m.sender_type = 'cleaner'`;
  if (window?.type === "days") {
    sql += ` AND m.created_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "messages" };
}

async function computeMeaningfulLoginDays(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(DISTINCT login_date)::int as v FROM cleaner_login_days WHERE cleaner_id = $1`;
  if (window?.type === "days") {
    sql += ` AND login_date >= CURRENT_DATE - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "days" };
}

async function computeLoginStreak(cleanerId: string): Promise<MetricResult> {
  const r = await query<{ streak: number }>(
    `WITH dates AS (
       SELECT login_date, login_date - ROW_NUMBER() OVER (ORDER BY login_date)::int as grp
       FROM (SELECT DISTINCT login_date FROM cleaner_login_days WHERE cleaner_id = $1) d
     )
     SELECT COALESCE(MAX(cnt), 0)::int as streak FROM (
       SELECT COUNT(*) as cnt FROM dates
       GROUP BY grp
     ) x`,
    [cleanerId]
  );
  return { value: r.rows[0]?.streak ?? 0, unit: "days" };
}

async function computeLoginsCount(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM cleaner_login_days WHERE cleaner_id = $1`;
  if (window?.type === "days") {
    sql += ` AND login_date >= CURRENT_DATE - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "logins" };
}

async function computeActiveWeeks(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(DISTINCT date_trunc('week', login_date))::int as v
    FROM cleaner_login_days WHERE cleaner_id = $1`;
  if (window?.type === "days") {
    sql += ` AND login_date >= CURRENT_DATE - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "weeks" };
}

async function computeDisputesOpenOrLost(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM disputes d
    JOIN jobs j ON j.id = d.job_id
    WHERE j.cleaner_id = $1 AND d.status IN ('open', 'resolved_refund')`;
  if (window?.type === "last_jobs") {
    sql += ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST LIMIT ${window.value}
    )`;
  } else if (window?.type === "days") {
    sql += ` AND d.created_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "disputes" };
}

async function computeDisputesLost(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM disputes d
    JOIN jobs j ON j.id = d.job_id
    WHERE j.cleaner_id = $1 AND d.status = 'resolved_refund'`;
  if (window?.type === "last_jobs") {
    sql += ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST LIMIT ${window.value}
    )`;
  } else if (window?.type === "days") {
    sql += ` AND d.updated_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "disputes" };
}

async function computeDisputesOpened(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COUNT(*)::int as v FROM disputes d
    JOIN jobs j ON j.id = d.job_id
    WHERE j.cleaner_id = $1`;
  if (window?.type === "last_jobs") {
    sql += ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC NULLS LAST LIMIT ${window.value}
    )`;
  } else if (window?.type === "days") {
    sql += ` AND d.created_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "disputes" };
}

async function computeDisputesLostRateLifetime(cleanerId: string): Promise<MetricResult> {
  const [lostR, totalR] = await Promise.all([
    query<{ v: number }>(
      `SELECT COUNT(*)::int as v FROM disputes d JOIN jobs j ON j.id = d.job_id
       WHERE j.cleaner_id = $1 AND d.status = 'resolved_refund'`,
      [cleanerId]
    ),
    query<{ v: number }>(
      `SELECT COUNT(*)::int as v FROM jobs WHERE cleaner_id = $1 AND status = 'completed'`,
      [cleanerId]
    ),
  ]);
  const lost = lostR.rows[0]?.v ?? 0;
  const total = totalR.rows[0]?.v ?? 0;
  const rate = total > 0 ? (lost / total) * 100 : 0;
  return { value: Math.round(rate * 100) / 100, unit: "percent" };
}

async function computeJobsCompletedSplitCounts(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `SELECT COALESCE(j.cleaning_type, 'basic') AS ct, COUNT(*)::int AS c
    FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'completed'`;
  sql += jobWindowClause(window);
  sql += ` GROUP BY COALESCE(j.cleaning_type, 'basic')`;
  const r = await query<{ ct: string; c: number }>(sql, [cleanerId]);
  const out: Record<string, number> = {};
  for (const row of r.rows) {
    out[row.ct] = row.c;
  }
  return { value: out, unit: "split" };
}

async function computeMaxJobsSingleClient(cleanerId: string): Promise<MetricResult> {
  const r = await query<{ m: number }>(
    `SELECT COALESCE(MAX(cnt), 0)::int AS m FROM (
      SELECT client_id, COUNT(*)::int AS cnt
      FROM jobs WHERE cleaner_id = $1 AND status = 'completed'
      GROUP BY client_id
    ) x`,
    [cleanerId]
  );
  return { value: r.rows[0]?.m ?? 0, unit: "jobs" };
}

async function computeCompositeReviewWhisperer(cleanerId: string): Promise<MetricResult> {
  try {
    const r = await query<{ tmpl_c: number; rev_c: number }>(
      `WITH tmpl AS (
        SELECT COUNT(*)::int AS c FROM messages
        WHERE sender_id = $1 AND sender_type = 'cleaner'
          AND template_id = 'tmpl_review_request'
          AND created_at >= NOW() - INTERVAL '60 days'
       ),
       rev AS (
        SELECT COUNT(*)::int AS c FROM jobs
        WHERE cleaner_id = $1 AND status = 'completed' AND rating IS NOT NULL
          AND COALESCE(actual_end_at, updated_at, created_at) >= NOW() - INTERVAL '60 days'
       )
       SELECT (SELECT c FROM tmpl) AS tmpl_c, (SELECT c FROM rev) AS rev_c`,
      [cleanerId]
    );
    const row = r.rows[0];
    const ok = (row?.tmpl_c ?? 0) >= 15 && (row?.rev_c ?? 0) >= 5;
    return { value: ok ? 1 : 0, unit: "bool" };
  } catch {
    return { value: 0, unit: "bool" };
  }
}

async function computeCompositeTipJarEnergy(cleanerId: string): Promise<MetricResult> {
  try {
    const r = await query<{ tmpl_c: number; tip_c: number }>(
      `WITH tmpl AS (
        SELECT COUNT(*)::int AS c FROM messages
        WHERE sender_id = $1 AND sender_type = 'cleaner'
          AND template_id = 'tmpl_tip_request'
          AND created_at >= NOW() - INTERVAL '90 days'
       ),
       tips AS (
        SELECT COUNT(*)::int AS c FROM pt_event_log
        WHERE cleaner_id = $1 AND event_type = 'tip.received'
          AND occurred_at >= NOW() - INTERVAL '90 days'
       )
       SELECT (SELECT c FROM tmpl) AS tmpl_c, COALESCE((SELECT c FROM tips), 0) AS tip_c`,
      [cleanerId]
    );
    const row = r.rows[0];
    const ok = (row?.tmpl_c ?? 0) >= 10 && (row?.tip_c ?? 0) >= 3;
    return { value: ok ? 1 : 0, unit: "bool" };
  } catch {
    return { value: 0, unit: "bool" };
  }
}

async function computeTipsReceivedCount(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  try {
    let sql = `SELECT COUNT(*)::int AS v FROM pt_event_log
      WHERE cleaner_id = $1 AND event_type = 'tip.received'`;
    if (window?.type === "days") {
      sql += ` AND occurred_at >= NOW() - INTERVAL '${window.value} days'`;
    }
    const r = await query<{ v: number }>(sql, [cleanerId]);
    return { value: r.rows[0]?.v ?? 0, unit: "tips" };
  } catch {
    return { value: 0, unit: "tips" };
  }
}

async function computeRepeatClients(
  cleanerId: string,
  filters: MetricFilters
): Promise<MetricResult> {
  const minJobs = (filters.min_completed_jobs_per_client as number) ?? 2;
  const r = await query<{ v: number }>(
    `SELECT COUNT(*)::int as v FROM (
      SELECT j.client_id FROM jobs j
      WHERE j.cleaner_id = $1 AND j.status = 'completed'
      GROUP BY j.client_id HAVING COUNT(*) >= $2
    ) x`,
    [cleanerId, minJobs]
  );
  return { value: r.rows[0]?.v ?? 0, unit: "clients" };
}

async function computeReliabilityPercentile(
  _cleanerId: string,
  _window: MetricWindow | null,
  _filters: MetricFilters
): Promise<MetricResult> {
  // Stub: requires reliabilityService / percentile calculation
  return { value: 50, unit: "percentile" };
}

async function computeComplianceViolations(_cleanerId: string): Promise<MetricResult> {
  // Stub: no policy_violations table; assume 0 for maintenance pass
  return { value: 0, unit: "count" };
}

async function computeComplianceWarnings(_cleanerId: string): Promise<MetricResult> {
  // Stub: no policy_warnings table; assume 0 for maintenance pass
  return { value: 0, unit: "count" };
}

async function computeAccountVerified(cleanerId: string): Promise<MetricResult> {
  // Stub: assume verified if user exists and has cleaner role
  const r = await query<{ verified: boolean }>(
    `SELECT (u.id IS NOT NULL AND cp.user_id IS NOT NULL) as verified
     FROM users u
     LEFT JOIN cleaner_profiles cp ON cp.user_id = u.id
     WHERE u.id = $1`,
    [cleanerId]
  );
  return { value: r.rows[0]?.verified ? 1 : 0, unit: "bool" };
}

async function computeLateOver10Min(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  let sql = `
    SELECT COUNT(*)::int as v FROM jobs j
    JOIN job_checkins ci ON ci.job_id = j.id AND ci.type = 'check_in' AND ci.is_within_radius = true
    WHERE j.cleaner_id = $1 AND j.status = 'completed'
      AND j.scheduled_start_at IS NOT NULL
      AND ci.created_at > j.scheduled_start_at + INTERVAL '10 minutes'
  `;
  sql += jobWindowClause(window);
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computeCancelledLastMinute(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  // Last-minute = cancelled within 2h of scheduled start
  let sql = `
    SELECT COUNT(*)::int as v FROM jobs j
    WHERE j.cleaner_id = $1 AND j.status = 'cancelled'
      AND j.scheduled_start_at IS NOT NULL
      AND j.updated_at >= j.scheduled_start_at - INTERVAL '2 hours'
      AND j.updated_at <= j.scheduled_start_at + INTERVAL '1 hour'
  `;
  if (window?.type === "days") {
    sql += ` AND j.updated_at >= NOW() - INTERVAL '${window.value} days'`;
  }
  if (window?.type === "last_jobs") {
    sql += ` AND j.id IN (
      SELECT id FROM jobs WHERE cleaner_id = $1 AND status = 'cancelled'
      ORDER BY updated_at DESC NULLS LAST LIMIT ${window.value}
    )`;
  }
  const r = await query<{ v: number }>(sql, [cleanerId]);
  return { value: r.rows[0]?.v ?? 0, unit: "jobs" };
}

async function computePerfectStreakDays(_cleanerId: string): Promise<MetricResult> {
  // Stub: would require complex day-by-day analysis of lateness/cancellations/disputes
  return { value: 0, unit: "days" };
}

async function computePerformanceIssues(
  cleanerId: string,
  window: MetricWindow | null
): Promise<MetricResult> {
  // Issues = lateness + cancellations + disputes in last N jobs (stub: return 0)
  const jobsLimit = window?.type === "last_jobs" ? window.value : 50;
  const r = await query<{ v: string }>(
    `WITH last_jobs AS (
       SELECT id FROM jobs WHERE cleaner_id = $1 AND status IN ('completed','cancelled')
       ORDER BY COALESCE(actual_end_at, updated_at, created_at) DESC NULLS LAST LIMIT $2
     ),
     late AS (
       SELECT COUNT(*)::int as c FROM last_jobs lj
       JOIN jobs j ON j.id = lj.id
       JOIN job_checkins ci ON ci.job_id = j.id AND ci.type = 'check_in'
       WHERE j.scheduled_start_at IS NOT NULL
         AND ci.created_at > j.scheduled_start_at + INTERVAL '15 minutes'
     ),
     cancelled AS (
       SELECT COUNT(*)::int as c FROM last_jobs lj
       JOIN jobs j ON j.id = lj.id WHERE j.status = 'cancelled'
     ),
     disputed AS (
       SELECT COUNT(*)::int as c FROM last_jobs lj
       JOIN disputes d ON d.job_id = lj.id
       WHERE d.status IN ('open','resolved_refund')
     )
     SELECT (COALESCE((SELECT c FROM late), 0) + COALESCE((SELECT c FROM cancelled), 0) + COALESCE((SELECT c FROM disputed), 0))::int as v`,
    [cleanerId, jobsLimit]
  );
  return { value: parseInt(r.rows[0]?.v ?? "0", 10), unit: "count" };
}

async function computeDisputesUnresolved(
  cleanerId: string,
  _window: MetricWindow | null
): Promise<MetricResult> {
  const r = await query<{ v: number }>(
    `SELECT COUNT(*)::int as v FROM disputes d
     JOIN jobs j ON j.id = d.job_id
     WHERE j.cleaner_id = $1 AND d.status = 'open'`,
    [cleanerId]
  );
  return { value: r.rows[0]?.v ?? 0, unit: "disputes" };
}
