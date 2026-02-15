/**
 * Runtime Config Loader (Step 11)
 * Loads versioned configs from admin_config_versions with region override and caching.
 * Falls back to static config when DB has no active version.
 */

import { query } from "../db/client";
import { getGoals, getRewards, getLevels } from "../config/cleanerLevels";

export type ConfigType = "goals" | "rewards" | "levels" | "governor" | "full_bundle";

type CacheEntry = { version: number; payload: unknown; loaded_at: number };

let _loader: RuntimeConfigLoader | null = null;

export function getRuntimeConfigLoader(): RuntimeConfigLoader {
  if (!_loader) {
    _loader = new RuntimeConfigLoader({ poll_ms: 120_000 });
    _loader.start();
  }
  return _loader;
}

export class RuntimeConfigLoader {
  private cache = new Map<string, CacheEntry>();
  private pollMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts?: { poll_ms?: number }) {
    this.pollMs = opts?.poll_ms ?? 120_000;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.refreshAll(), this.pollMs);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private key(type: ConfigType, regionId: string | null): string {
    return `${type}:${regionId ?? "__global__"}`;
  }

  async getActive(
    type: ConfigType,
    regionId?: string | null
  ): Promise<{ version: number; payload: unknown }> {
    const keyRegion = this.key(type, regionId ?? null);
    const keyGlobal = this.key(type, null);

    const cached = this.cache.get(keyRegion) ?? this.cache.get(keyGlobal);
    if (cached) return { version: cached.version, payload: cached.payload };

    const region = await this.fetchFromDb(type, regionId ?? null);
    if (region) {
      this.cache.set(keyRegion, {
        version: region.version,
        payload: region.payload,
        loaded_at: Date.now(),
      });
      return region;
    }

    const global = await this.fetchFromDb(type, null);
    if (global) {
      this.cache.set(keyGlobal, {
        version: global.version,
        payload: global.payload,
        loaded_at: Date.now(),
      });
      return global;
    }

    return this.getStaticFallback(type);
  }

  private async fetchFromDb(
    type: ConfigType,
    regionId: string | null
  ): Promise<{ version: number; payload: unknown } | null> {
    try {
      const r = regionId
        ? await query(
            `SELECT version, payload FROM admin_config_versions
             WHERE config_type = $1 AND region_id = $2
               AND status = 'active' AND effective_at <= now()
             ORDER BY effective_at DESC, version DESC LIMIT 1`,
            [type, regionId]
          )
        : await query(
            `SELECT version, payload FROM admin_config_versions
             WHERE config_type = $1 AND region_id IS NULL
               AND status = 'active' AND effective_at <= now()
             ORDER BY effective_at DESC, version DESC LIMIT 1`,
            [type]
          );

      const row = r.rows[0];
      if (!row) return null;
      return { version: row.version as number, payload: row.payload };
    } catch {
      return null;
    }
  }

  private getStaticFallback(type: ConfigType): { version: number; payload: unknown } {
    switch (type) {
      case "goals":
        return { version: 0, payload: getGoals() };
      case "rewards":
        return { version: 0, payload: getRewards() };
      case "levels":
        return { version: 0, payload: getLevels() };
      case "governor":
        return { version: 0, payload: {} };
      default:
        return { version: 0, payload: {} };
    }
  }

  async getBundle(regionId?: string | null): Promise<{
    region_id: string | null;
    versions: { goals: number; rewards: number; levels: number; governor: number };
    goals: unknown;
    rewards: unknown;
    levels: unknown;
    governor: unknown;
  }> {
    const [goals, rewards, levels, governor] = await Promise.all([
      this.getActive("goals", regionId),
      this.getActive("rewards", regionId),
      this.getActive("levels", regionId),
      this.getActive("governor", regionId),
    ]);

    const goalsArr = Array.isArray(goals.payload)
      ? goals.payload
      : ((goals.payload as { goals?: unknown[] })?.goals ?? getGoals());
    const rewardsArr = Array.isArray(rewards.payload)
      ? rewards.payload
      : ((rewards.payload as { rewards?: unknown[] })?.rewards ?? getRewards());
    const levelsArr = Array.isArray(levels.payload)
      ? levels.payload
      : ((levels.payload as { levels?: unknown[] })?.levels ?? getLevels());

    return {
      region_id: regionId ?? null,
      versions: {
        goals: goals.version,
        rewards: rewards.version,
        levels: levels.version,
        governor: governor.version,
      },
      goals: goalsArr,
      rewards: rewardsArr,
      levels: levelsArr,
      governor: governor.payload,
    };
  }

  async refreshAll(): Promise<void> {
    const keys = Array.from(this.cache.keys());
    if (!keys.length) return;

    for (const k of keys) {
      const [type, regionPart] = k.split(":");
      const regionId = regionPart === "__global__" ? null : regionPart;
      try {
        const latest = await this.fetchFromDb(type as ConfigType, regionId);
        if (!latest) continue;

        const current = this.cache.get(k);
        if (!current || latest.version > current.version) {
          this.cache.set(k, {
            version: latest.version,
            payload: latest.payload,
            loaded_at: Date.now(),
          });
        }
      } catch {
        // keep last-known-good
      }
    }
  }
}
