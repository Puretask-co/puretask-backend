/**
 * Admin gamification governor in frontend spec shape (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET/PATCH /admin/gamification/governor — regions array + recommended_changes.
 * Uses region_governor_config (with optional columns from migration 058) and region_governor_state.
 */

import { query } from "../db/client";

export interface GovernorRegionDoc {
  region: string;
  supply_score: number;
  demand_score: number;
  fill_time_hours: number;
  early_exposure_min: number;
  cap_multiplier: number;
  locked: boolean;
  updated_at: string;
}

export interface GovernorDocResponse {
  regions: GovernorRegionDoc[];
  recommended_changes: unknown[];
}

export async function getGovernorDoc(): Promise<GovernorDocResponse> {
  const r = await query(
    `SELECT region_id,
            COALESCE(supply_score, 0) AS supply_score,
            COALESCE(demand_score, 0) AS demand_score,
            COALESCE(fill_time_hours, 0) AS fill_time_hours,
            COALESCE(early_exposure_min, 0) AS early_exposure_min,
            COALESCE(cap_multiplier, 1.0) AS cap_multiplier,
            COALESCE(locked, false) AS locked,
            updated_at
     FROM region_governor_config
     ORDER BY region_id`
  );
  const regions: GovernorRegionDoc[] = (r.rows as Record<string, unknown>[]).map((row) => ({
    region: String(row.region_id ?? row.region ?? ""),
    supply_score: Number(row.supply_score ?? 0),
    demand_score: Number(row.demand_score ?? 0),
    fill_time_hours: Number(row.fill_time_hours ?? 0),
    early_exposure_min: Number(row.early_exposure_min ?? 0),
    cap_multiplier: Number(row.cap_multiplier ?? 1),
    locked: Boolean(row.locked ?? false),
    updated_at: new Date(row.updated_at as string).toISOString(),
  }));

  if (regions.length === 0) {
    const seed = await query(
      `SELECT region_id FROM region_governor_state ORDER BY region_id LIMIT 10`
    );
    const ids = (seed.rows as { region_id: string }[]).map((x) => x.region_id);
    for (const region of ids) {
      regions.push({
        region,
        supply_score: 0,
        demand_score: 0,
        fill_time_hours: 0,
        early_exposure_min: 0,
        cap_multiplier: 1,
        locked: false,
        updated_at: new Date().toISOString(),
      });
    }
  }

  return { regions, recommended_changes: [] };
}

export async function patchGovernorDoc(
  body: { overrides?: Array<Partial<GovernorRegionDoc> & { region: string }>; apply_recommended?: boolean },
  actorId: string
): Promise<GovernorDocResponse> {
  if (body.apply_recommended) {
    return getGovernorDoc();
  }
  if (body.overrides && Array.isArray(body.overrides)) {
    for (const o of body.overrides) {
      const region = String(o.region ?? "");
      if (!region) continue;
      await query(
        `INSERT INTO region_governor_config
          (region_id, supply_score, demand_score, fill_time_hours, early_exposure_min, cap_multiplier, locked, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (region_id)
         DO UPDATE SET
           supply_score = COALESCE(EXCLUDED.supply_score, region_governor_config.supply_score),
           demand_score = COALESCE(EXCLUDED.demand_score, region_governor_config.demand_score),
           fill_time_hours = COALESCE(EXCLUDED.fill_time_hours, region_governor_config.fill_time_hours),
           early_exposure_min = COALESCE(EXCLUDED.early_exposure_min, region_governor_config.early_exposure_min),
           cap_multiplier = COALESCE(EXCLUDED.cap_multiplier, region_governor_config.cap_multiplier),
           locked = COALESCE(EXCLUDED.locked, region_governor_config.locked),
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [
          region,
          o.supply_score ?? null,
          o.demand_score ?? null,
          o.fill_time_hours ?? null,
          o.early_exposure_min ?? null,
          o.cap_multiplier ?? null,
          o.locked ?? null,
          actorId,
        ]
      );
    }
  }
  return getGovernorDoc();
}
