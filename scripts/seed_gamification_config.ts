/**
 * Seed gamification config: goals, rewards, levels, badges, seasons.
 * Safe to run multiple times (upserts).
 * Use --dry-run to log without writing.
 */

import path from "path";
import fs from "fs";
import { query } from "../src/db/client";

const DRY_RUN = process.argv.includes("--dry-run");

function loadJson<T>(filename: string): T {
  const filepath = path.join(__dirname, "../src/config/cleanerLevels", filename);
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

async function log(msg: string): Promise<void> {
  console.log(`[seed] ${msg}`);
}

async function seedGoals(): Promise<void> {
  const goals = loadJson<unknown[]>("goals.json");
  if (DRY_RUN) {
    await log(`goals: would upsert ${goals.length} via admin_config_versions`);
    return;
  }
  const existing = await query(
    `SELECT 1 FROM admin_config_versions WHERE config_type = 'goals' AND version = 1 AND region_id IS NULL`
  );
  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO admin_config_versions (config_type, version, region_id, status, effective_at, payload, change_summary, created_by)
       VALUES ('goals', 1, NULL, 'active', now(), $1::jsonb, 'seed from goals.json', 'seed_script')`,
      [JSON.stringify(goals)]
    );
    await log("goals: seeded");
  } else {
    await log("goals: already exists");
  }
}

async function seedRewards(): Promise<void> {
  const rewards = loadJson<unknown[]>("rewards.json");
  if (DRY_RUN) {
    await log(`rewards: would upsert ${rewards.length} via admin_config_versions`);
    return;
  }
  const existing = await query(
    `SELECT 1 FROM admin_config_versions WHERE config_type = 'rewards' AND version = 1 AND region_id IS NULL`
  );
  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO admin_config_versions (config_type, version, region_id, status, effective_at, payload, change_summary, created_by)
       VALUES ('rewards', 1, NULL, 'active', now(), $1::jsonb, 'seed from rewards.json', 'seed_script')`,
      [JSON.stringify(rewards)]
    );
    await log("rewards: seeded");
  } else {
    await log("rewards: already exists");
  }
}

async function seedLevels(): Promise<void> {
  const levels = loadJson<unknown[]>("levels.json");
  if (DRY_RUN) {
    await log(`levels: would upsert ${levels.length} via admin_config_versions`);
    return;
  }
  const existing = await query(
    `SELECT 1 FROM admin_config_versions WHERE config_type = 'levels' AND version = 1 AND region_id IS NULL`
  );
  if (existing.rows.length === 0) {
    await query(
      `INSERT INTO admin_config_versions (config_type, version, region_id, status, effective_at, payload, change_summary, created_by)
       VALUES ('levels', 1, NULL, 'active', now(), $1::jsonb, 'seed from levels.json', 'seed_script')`,
      [JSON.stringify(levels)]
    );
    await log("levels: seeded");
  } else {
    await log("levels: already exists");
  }
}

async function seedBadges(): Promise<void> {
  const badgesConfig = loadJson<{ core?: unknown[]; fun?: unknown[] }>("badges.json");
  const badges = [...(badgesConfig.core ?? []), ...(badgesConfig.fun ?? [])] as Array<{
    id: string;
    name: string;
    description: string;
    category?: string;
    icon_key?: string;
    show_on_profile?: boolean;
    metric?: string;
    operator?: string;
    target?: number;
    window?: unknown;
    filters?: unknown;
  }>;
  if (DRY_RUN) {
    await log(`badges: would upsert ${badges.length} badge_definitions`);
    return;
  }
  for (const b of badges) {
    const trigger = {
      metric: b.metric,
      operator: b.operator,
      target: b.target,
      window: b.window,
      filters: b.filters ?? {},
    };
    await query(
      `INSERT INTO badge_definitions (id, name, description, category, icon_key, is_profile_visible, is_enabled, sort_order, trigger, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, 0, $7::jsonb, now())
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
         icon_key = EXCLUDED.icon_key, is_profile_visible = EXCLUDED.is_profile_visible, trigger = EXCLUDED.trigger, updated_at = now()`,
      [
        b.id,
        b.name,
        b.description,
        b.category ?? "fun",
        b.icon_key ?? null,
        Boolean(b.show_on_profile ?? false),
        JSON.stringify(trigger),
      ]
    );
  }
  await log(`badges: ${badges.length} upserted`);
}

async function seedSeasons(): Promise<void> {
  const seasonRules = loadJson<{ rules?: Array<Record<string, unknown>> }>("season_rules_v1.json");
  const rules = (seasonRules as { rules?: Array<Record<string, unknown>> }).rules ?? seasonRules as unknown as Array<Record<string, unknown>>;
  const arr = Array.isArray(rules) ? rules : [seasonRules as unknown as Record<string, unknown>];
  if (DRY_RUN) {
    await log(`seasons: would upsert ${arr.length} season_rules`);
    return;
  }
  for (const r of arr) {
    const id = String(r.id ?? "default");
    await query(
      `INSERT INTO season_rules (id, name, description, starts_at, ends_at, is_enabled, regions, rule, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8::jsonb, now())
       ON CONFLICT (id)
       DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at, is_enabled = EXCLUDED.is_enabled, regions = EXCLUDED.regions,
         rule = EXCLUDED.rule, updated_at = now()`,
      [
        id,
        String(r.name ?? "Default"),
        String(r.description ?? ""),
        String(r.starts_at ?? "2026-01-01T00:00:00Z"),
        String(r.ends_at ?? "2026-12-31T23:59:59Z"),
        Boolean(r.is_enabled ?? true),
        r.regions ?? null,
        JSON.stringify(r.rule ?? {}),
      ]
    );
  }
  await log(`seasons: ${arr.length} upserted`);
}

async function seedFeatureFlags(): Promise<void> {
  const flags = [
    { key: "gamification_enabled", enabled: true },
    { key: "gamification_cash_enabled", enabled: false },
    { key: "gamification_seasons_enabled", enabled: true },
    { key: "gamification_badges_enabled", enabled: true },
    { key: "gamification_next_best_action_enabled", enabled: true },
    { key: "governor_enabled", enabled: false },
  ];
  if (DRY_RUN) {
    await log(`feature flags: would upsert ${flags.length} admin_feature_flags`);
    return;
  }
  for (const f of flags) {
    const exists = await query(
      `SELECT 1 FROM admin_feature_flags WHERE key = $1 AND region_id IS NULL`,
      [f.key]
    );
    if (exists.rows.length === 0) {
      await query(
        `INSERT INTO admin_feature_flags (key, region_id, enabled, variant, config, effective_at, created_by)
         VALUES ($1, NULL, $2, NULL, '{}'::jsonb, now(), 'seed_script')`,
        [f.key, f.enabled]
      );
    }
  }
  await log(`feature flags: ${flags.length} checked/inserted`);
}

async function main(): Promise<void> {
  if (DRY_RUN) await log("DRY RUN - no writes");

  await seedGoals();
  await seedRewards();
  await seedLevels();
  await seedBadges();
  await seedSeasons();
  await seedFeatureFlags();

  await log("done");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
