/**
 * Badge Service (Step 14)
 * Evaluates badge triggers against metric snapshots and awards badges idempotently.
 */

import type { PoolClient } from "pg";
import { query, withTransaction } from "../db/client";
import { computeMetric } from "../lib/metricsCalculator";

export type MetricSnapshot = Record<string, number | string | boolean | null>;

type Trigger =
  | { type: "metric"; metric: string; op: ">=" | "==" | ">" | "<=" | "<"; target: number }
  | {
      type: "window";
      window: { type: "days" | "last_jobs"; n: number };
      conditions: Array<{ metric: string; op: ">=" | "==" | ">" | "<=" | "<"; target: number }>;
    }
  | { type: "compound"; all: Trigger[] }
  | { type: "derived"; derivation: string; op: ">=" | "==" | ">" | "<=" | "<"; target: number };

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  category: string;
  icon_key: string | null;
  is_profile_visible: boolean;
  sort_order: number;
  trigger: unknown;
}

/** Extract metric keys from a trigger for snapshot building */
function extractMetricKeysFromTrigger(t: unknown): Set<string> {
  const keys = new Set<string>();
  if (!t || typeof t !== "object") return keys;
  const o = t as Record<string, unknown>;
  if (o.type === "metric" && typeof o.metric === "string") keys.add(o.metric);
  if (o.type === "derived" && typeof o.derivation === "string") keys.add(o.derivation);
  if (Array.isArray(o.conditions)) {
    for (const c of o.conditions) {
      const cond = c as { metric?: string };
      if (typeof cond.metric === "string") keys.add(cond.metric);
    }
  }
  if (Array.isArray(o.all)) {
    for (const x of o.all) extractMetricKeysFromTrigger(x).forEach((k) => keys.add(k));
  }
  return keys;
}

export class BadgeService {
  /**
   * Build a metric snapshot for badge evaluation by fetching values for all metric keys
   * referenced in enabled badge triggers.
   */
  async buildMetricSnapshot(cleanerId: string): Promise<MetricSnapshot> {
    const defs = await this.getEnabledBadgeDefinitions();
    const keys = new Set<string>();
    for (const d of defs) {
      extractMetricKeysFromTrigger(d.trigger).forEach((k) => keys.add(k));
    }
    const snapshot: MetricSnapshot = {};
    await Promise.all(
      Array.from(keys).map(async (key) => {
        try {
          const result = await computeMetric(cleanerId, key, {});
          const v = result?.value;
          snapshot[key] = typeof v === "number" ? v : typeof v === "boolean" ? v : Number(v) ?? 0;
        } catch {
          snapshot[key] = 0;
        }
      })
    );
    return snapshot;
  }

  async awardEligibleBadges(params: {
    cleaner_id: string;
    metric_snapshot: MetricSnapshot;
  }): Promise<{ newly_awarded: string[] }> {
    const { cleaner_id, metric_snapshot } = params;
    const defs = await this.getEnabledBadgeDefinitions();

    const newly: string[] = [];
    for (const d of defs) {
      const already = await this.hasBadge(cleaner_id, d.id);
      if (already) continue;

      const trig = d.trigger as Trigger;
      if (this.evaluateTrigger(trig, metric_snapshot)) {
        const ok = await this.awardBadge(cleaner_id, d.id, { trigger: trig });
        if (ok) newly.push(d.id);
      }
    }

    return { newly_awarded: newly };
  }

  evaluateTrigger(t: Trigger, m: MetricSnapshot): boolean {
    switch (t.type) {
      case "metric":
        return this.compare(Number(m[t.metric] ?? 0), t.op, t.target);
      case "window":
        return (t.conditions ?? []).every((c) =>
          this.compare(Number(m[c.metric] ?? 0), c.op, c.target)
        );
      case "compound":
        return (t.all ?? []).every((x) => this.evaluateTrigger(x as Trigger, m));
      case "derived":
        return this.compare(Number(m[t.derivation] ?? 0), t.op, t.target);
      default:
        return false;
    }
  }

  private compare(val: number, op: string, target: number): boolean {
    if (op === ">=") return val >= target;
    if (op === "==") return val === target;
    if (op === ">") return val > target;
    if (op === "<=") return val <= target;
    if (op === "<") return val < target;
    return false;
  }

  async getEnabledBadgeDefinitions(): Promise<BadgeDef[]> {
    try {
      const r = await query<BadgeDef>(
        `SELECT id, name, description, category, icon_key, is_profile_visible, sort_order, trigger
         FROM badge_definitions
         WHERE is_enabled = true
         ORDER BY category ASC, sort_order ASC`
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  async getBadgeCatalog(): Promise<BadgeDef[]> {
    try {
      const r = await query<BadgeDef>(
        `SELECT id, name, description, category, icon_key, is_profile_visible, sort_order
         FROM badge_definitions
         WHERE is_enabled = true
         ORDER BY category ASC, sort_order ASC`
      );
      return r.rows ?? [];
    } catch {
      return [];
    }
  }

  async getCleanerBadges(cleanerId: string): Promise<
    Array<{
      badge_id: string;
      earned_at: string;
      name: string;
      description: string;
      category: string;
      icon_key: string | null;
      is_profile_visible: boolean;
    }>
  > {
    try {
      const r = await query(
        `SELECT cb.badge_id, cb.earned_at, bd.name, bd.description, bd.category, bd.icon_key, bd.is_profile_visible
         FROM cleaner_badges cb
         JOIN badge_definitions bd ON bd.id = cb.badge_id
         WHERE cb.cleaner_id = $1
         ORDER BY cb.earned_at DESC`,
        [cleanerId]
      );
      return (r.rows ?? []).map((row: Record<string, unknown>) => ({
        badge_id: row.badge_id,
        earned_at: (row.earned_at as Date)?.toISOString?.() ?? String(row.earned_at),
        name: row.name,
        description: row.description,
        category: row.category,
        icon_key: row.icon_key,
        is_profile_visible: row.is_profile_visible,
      }));
    } catch {
      return [];
    }
  }

  async getAchievementFeed(
    cleanerId: string,
    limit = 50
  ): Promise<
    Array<{
      type: string;
      ref_id: string | null;
      title: string;
      subtitle: string | null;
      meta: Record<string, unknown>;
      created_at: string;
    }>
  > {
    const cappedLimit = Math.min(limit, 200);
    try {
      const r = await query(
        `SELECT type, ref_id, title, subtitle, meta, created_at
         FROM cleaner_achievement_feed
         WHERE cleaner_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [cleanerId, cappedLimit]
      );
      return (r.rows ?? []).map((row: Record<string, unknown>) => ({
        type: row.type,
        ref_id: row.ref_id,
        title: row.title,
        subtitle: row.subtitle,
        meta: (row.meta as Record<string, unknown>) ?? {},
        created_at: (row.created_at as Date)?.toISOString?.() ?? String(row.created_at),
      }));
    } catch {
      return [];
    }
  }

  async appendToFeed(params: {
    cleaner_id: string;
    type: "badge" | "level_up" | "goal_complete" | "reward_granted";
    ref_id?: string | null;
    title: string;
    subtitle?: string | null;
    meta?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await query(
        `INSERT INTO cleaner_achievement_feed (cleaner_id, type, ref_id, title, subtitle, meta)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          params.cleaner_id,
          params.type,
          params.ref_id ?? null,
          params.title,
          params.subtitle ?? null,
          JSON.stringify(params.meta ?? {}),
        ]
      );
    } catch {
      // Non-critical
    }
  }

  async appendToFeedWithClient(
    client: PoolClient,
    params: {
      cleaner_id: string;
      type: "badge" | "level_up" | "goal_complete" | "reward_granted";
      ref_id?: string | null;
      title: string;
      subtitle?: string | null;
      meta?: Record<string, unknown>;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO cleaner_achievement_feed (cleaner_id, type, ref_id, title, subtitle, meta)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        params.cleaner_id,
        params.type,
        params.ref_id ?? null,
        params.title,
        params.subtitle ?? null,
        JSON.stringify(params.meta ?? {}),
      ]
    );
  }

  private async hasBadge(cleanerId: string, badgeId: string): Promise<boolean> {
    try {
      const r = await query(
        `SELECT 1 FROM cleaner_badges WHERE cleaner_id = $1 AND badge_id = $2 LIMIT 1`,
        [cleanerId, badgeId]
      );
      return (r.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  private async awardBadge(
    cleanerId: string,
    badgeId: string,
    meta: Record<string, unknown>
  ): Promise<boolean> {
    try {
      return await withTransaction(async (client) => {
        const ins = await client.query(
          `INSERT INTO cleaner_badges (cleaner_id, badge_id, meta)
           VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (cleaner_id, badge_id) DO NOTHING
           RETURNING id`,
          [cleanerId, badgeId, JSON.stringify(meta ?? {})]
        );
        if ((ins.rowCount ?? 0) === 0) return false;

        const def = await client.query(
          `SELECT name, description FROM badge_definitions WHERE id = $1`,
          [badgeId]
        );
        const title = (def.rows?.[0] as { name?: string })?.name ?? "Badge earned";
        const subtitle = (def.rows?.[0] as { description?: string })?.description ?? null;

        await this.appendToFeedWithClient(client, {
          cleaner_id: cleanerId,
          type: "badge",
          ref_id: badgeId,
          title,
          subtitle,
          meta: { badge_id: badgeId },
        });

        return true;
      });
    } catch {
      return false;
    }
  }
}
