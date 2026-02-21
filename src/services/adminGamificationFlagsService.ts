/**
 * Admin gamification flags in frontend spec shape (GAMIFICATION_FRONTEND_BACKEND_SPEC.md).
 * GET/PATCH /admin/gamification/flags — five booleans + region_overrides.
 * Persists via admin_feature_flags (key + region_id).
 */

import { query } from "../db/client";
import * as adminFlags from "./adminFeatureFlagService";

const GLOBAL_KEYS = [
  "gamification_enabled",
  "rewards_enabled",
  "cash_rewards_enabled",
  "seasonal_enabled",
  "governor_enabled",
] as const;

const DEFAULTS: Record<(typeof GLOBAL_KEYS)[number], boolean> = {
  gamification_enabled: true,
  rewards_enabled: true,
  cash_rewards_enabled: false,
  seasonal_enabled: true,
  governor_enabled: true,
};

export type GamificationFlagsResponse = {
  gamification_enabled: boolean;
  rewards_enabled: boolean;
  cash_rewards_enabled: boolean;
  seasonal_enabled: boolean;
  governor_enabled: boolean;
  region_overrides?: Record<string, Partial<Record<(typeof GLOBAL_KEYS)[number], boolean>>>;
};

export async function getGamificationFlags(): Promise<GamificationFlagsResponse> {
  const r = await query(
    `SELECT DISTINCT ON (key, COALESCE(region_id, ''))
            key, region_id, enabled
     FROM admin_feature_flags
     WHERE key = ANY($1::text[])
     ORDER BY key, COALESCE(region_id, ''), created_at DESC`,
    [GLOBAL_KEYS as unknown as string[]]
  );

  const byKeyRegion = new Map<string, boolean>();
  const regionIds = new Set<string>();
  for (const row of r.rows as Array<{ key: string; region_id: string | null; enabled: boolean }>) {
    const k = row.region_id ? `region:${row.region_id}:${row.key}` : row.key;
    byKeyRegion.set(k, row.enabled);
    if (row.region_id) regionIds.add(row.region_id);
  }

  const out: GamificationFlagsResponse = {
    gamification_enabled: byKeyRegion.get("gamification_enabled") ?? DEFAULTS.gamification_enabled,
    rewards_enabled: byKeyRegion.get("rewards_enabled") ?? DEFAULTS.rewards_enabled,
    cash_rewards_enabled: byKeyRegion.get("cash_rewards_enabled") ?? DEFAULTS.cash_rewards_enabled,
    seasonal_enabled: byKeyRegion.get("seasonal_enabled") ?? DEFAULTS.seasonal_enabled,
    governor_enabled: byKeyRegion.get("governor_enabled") ?? DEFAULTS.governor_enabled,
  };

  if (regionIds.size > 0) {
    out.region_overrides = {};
    for (const rid of regionIds) {
      const overrides: Partial<Record<(typeof GLOBAL_KEYS)[number], boolean>> = {};
      for (const key of GLOBAL_KEYS) {
        const v = byKeyRegion.get(`region:${rid}:${key}`);
        if (v !== undefined) overrides[key] = v;
      }
      if (Object.keys(overrides).length) out.region_overrides[rid] = overrides;
    }
  }

  return out;
}

export async function patchGamificationFlags(
  body: Partial<GamificationFlagsResponse>,
  actorId: string
): Promise<GamificationFlagsResponse> {
  if (body.gamification_enabled !== undefined) {
    await adminFlags.setFeatureFlag({
      actorId,
      key: "gamification_enabled",
      regionId: null,
      enabled: Boolean(body.gamification_enabled),
    });
  }
  if (body.rewards_enabled !== undefined) {
    await adminFlags.setFeatureFlag({
      actorId,
      key: "rewards_enabled",
      regionId: null,
      enabled: Boolean(body.rewards_enabled),
    });
  }
  if (body.cash_rewards_enabled !== undefined) {
    await adminFlags.setFeatureFlag({
      actorId,
      key: "cash_rewards_enabled",
      regionId: null,
      enabled: Boolean(body.cash_rewards_enabled),
    });
  }
  if (body.seasonal_enabled !== undefined) {
    await adminFlags.setFeatureFlag({
      actorId,
      key: "seasonal_enabled",
      regionId: null,
      enabled: Boolean(body.seasonal_enabled),
    });
  }
  if (body.governor_enabled !== undefined) {
    await adminFlags.setFeatureFlag({
      actorId,
      key: "governor_enabled",
      regionId: null,
      enabled: Boolean(body.governor_enabled),
    });
  }
  if (body.region_overrides && typeof body.region_overrides === "object") {
    for (const [region, overrides] of Object.entries(body.region_overrides)) {
      if (!overrides || typeof overrides !== "object") continue;
      for (const key of GLOBAL_KEYS) {
        if ((overrides as Record<string, unknown>)[key] !== undefined) {
          await adminFlags.setFeatureFlag({
            actorId,
            key,
            regionId: region,
            enabled: Boolean((overrides as Record<string, unknown>)[key]),
          });
        }
      }
    }
  }
  return getGamificationFlags();
}
