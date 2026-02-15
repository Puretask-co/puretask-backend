/**
 * Season Service (Step 15)
 * Time-bounded multipliers for progress counting.
 */

import { query } from "../db/client";

export interface SeasonRule {
  id: string;
  name: string;
  description: string;
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
  regions: string[] | null;
  rule: {
    multipliers?: Array<{ metric_key: string; multiplier: number }>;
    ui?: { banner_copy?: string };
  };
}

export class SeasonService {
  async getActiveSeasons(params: { region_id?: string | null; at?: Date }): Promise<SeasonRule[]> {
    const regionId = params.region_id ?? null;
    const at = params.at ?? new Date();

    try {
      const r = await query<{
        id: string;
        name: string;
        description: string;
        starts_at: Date;
        ends_at: Date;
        is_enabled: boolean;
        regions: string[] | null;
        rule: unknown;
      }>(
        `SELECT id, name, description, starts_at, ends_at, is_enabled, regions, rule
         FROM season_rules
         WHERE is_enabled = true
           AND starts_at <= $1::timestamptz
           AND ends_at >= $1::timestamptz
           AND (
             regions IS NULL OR array_length(regions, 1) IS NULL OR $2::text IS NULL OR $2 = ANY(regions)
           )
         ORDER BY starts_at ASC`,
        [at.toISOString(), regionId]
      );
      return (r.rows ?? []).map((row) => ({
        ...row,
        starts_at: new Date(row.starts_at).toISOString(),
        ends_at: new Date(row.ends_at).toISOString(),
        rule: (row.rule as SeasonRule["rule"]) ?? {},
      }));
    } catch {
      return [];
    }
  }

  /**
   * Apply seasonal multipliers to a metric snapshot.
   * Does not mutate stored truth; only affects progress counting.
   */
  applyMultipliers(params: { metric_snapshot: Record<string, unknown>; seasons: SeasonRule[] }): {
    snapshot: Record<string, unknown>;
    applied: Array<{ season_id: string; metric_key: string; multiplier: number }>;
  } {
    const original = params.metric_snapshot ?? {};
    const snapshot: Record<string, unknown> = { ...original };
    const applied: Array<{ season_id: string; metric_key: string; multiplier: number }> = [];

    for (const s of params.seasons ?? []) {
      const mults = s.rule?.multipliers ?? [];
      for (const m of mults) {
        const key = String(m.metric_key ?? "");
        const factor = Number(m.multiplier ?? 1.0);
        if (!key || !Number.isFinite(factor) || factor === 1.0) continue;

        const base = Number(snapshot[key] ?? 0);
        if (!Number.isFinite(base)) continue;

        snapshot[key] = base * factor;
        applied.push({ season_id: s.id, metric_key: key, multiplier: factor });
      }
    }
    return { snapshot, applied };
  }
}
