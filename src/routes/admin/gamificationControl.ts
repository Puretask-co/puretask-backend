/**
 * Admin Gamification Control Plane (Step 10)
 * Config versions, budget, governor, feature flags, audit log.
 */

import { Router, Response } from "express";
import { requireAuth, requireAdmin, AuthedRequest, authedHandler } from "../../middleware/authCanonical";
import { query } from "../../db/client";
import * as adminConfig from "../../services/adminConfigService";
import { ProgressDebugService } from "../../services/progressDebugService";
import * as adminBudget from "../../services/adminBudgetService";
import * as adminGovernor from "../../services/adminGovernorService";
import { MarketplaceGovernorService } from "../../services/marketplaceGovernorService";
import * as adminFlags from "../../services/adminFeatureFlagService";
import { getRuntimeConfigLoader } from "../../services/runtimeConfigLoader";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

function getActorId(req: AuthedRequest): string {
  return req.user!.id;
}

// ---- Audit ----
router.get(
  "/audit",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const limit = Math.min(Number(req.query.limit ?? 100), 500);
    const r = await query(
      `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ ok: true, rows: r.rows });
  })
);

// ---- Config versions ----
router.get(
  "/config/:type/active",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const type = req.params.type as adminConfig.ConfigType;
    const regionId = (req.query.region_id as string) || undefined;
    const active = await adminConfig.getActiveConfig(type, regionId || null);
    res.json({ ok: true, active });
  })
);

router.get(
  "/config/:type/versions",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const type = req.params.type as adminConfig.ConfigType;
    const regionId = (req.query.region_id as string) || undefined;
    const versions = await adminConfig.listConfigVersions(type, regionId || null);
    res.json({ ok: true, versions });
  })
);

router.post(
  "/config/:type",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const type = req.params.type as adminConfig.ConfigType;
    const body = req.body ?? {};
    const created = await adminConfig.createConfigVersion({
      actorId: getActorId(req),
      configType: type,
      regionId: body.region_id ?? null,
      effectiveAt: body.effective_at ?? null,
      payload: body.payload,
      changeSummary: String(body.change_summary ?? ""),
      status: body.status ?? "active",
    });
    res.json({ ok: true, created });
  })
);

router.post(
  "/config/:type/rollback",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const type = req.params.type as adminConfig.ConfigType;
    const body = req.body ?? {};
    const created = await adminConfig.rollbackToVersion({
      actorId: getActorId(req),
      configType: type,
      regionId: body.region_id ?? null,
      version: Number(body.version),
      changeSummary: body.change_summary,
    });
    res.json({ ok: true, created });
  })
);

// ---- Budget ----
router.get(
  "/budget",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const scope = (req.query.scope as "global" | "region") ?? "global";
    const regionId = (req.query.region_id as string) || undefined;
    const budget = await adminBudget.getRewardBudget(scope, regionId || null);
    res.json({ ok: true, budget });
  })
);

router.post(
  "/budget",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const body = req.body ?? {};
    const updated = await adminBudget.upsertRewardBudget({
      actorId: getActorId(req),
      scope: body.scope ?? "global",
      regionId: body.region_id ?? null,
      cash_cap_daily_cents: Number(body.cash_cap_daily_cents ?? 0),
      cash_cap_monthly_cents: Number(body.cash_cap_monthly_cents ?? 0),
      cash_rewards_enabled: Boolean(body.cash_rewards_enabled ?? true),
      emergency_disable_all_rewards: Boolean(body.emergency_disable_all_rewards ?? false),
    });
    res.json({ ok: true, updated });
  })
);

// ---- Governor (Step 10 config + Step 18 marketplace health) ----
// Static paths must be defined before /governor/:regionId
const marketplaceGovernor = new MarketplaceGovernorService();

// Step 18: config + state + latest metrics (support view)
router.get(
  "/governor/region",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const regionId = (req.query.region_id as string) ?? "__global__";
    const config = await marketplaceGovernor.getEffectiveConfig(regionId);
    const state = await marketplaceGovernor.getGovernorState(regionId);
    res.json({ ok: true, region_id: regionId, config, state });
  })
);

// Step 18: insert metrics row (scheduler or manual)
router.post(
  "/governor/metrics/insert",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const row = req.body ?? {};
    if (!row.region_id || !row.window_start || !row.window_end) {
      return res.status(400).json({ ok: false, error: "region_id, window_start, window_end required" });
    }
    const inserted = await marketplaceGovernor.insertMetricsRow(row);
    res.json({ ok: true, inserted });
  })
);

// Step 18: compute governor state for region
router.post(
  "/governor/compute",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { region_id } = req.body ?? {};
    const actor = getActorId(req);
    const state = await marketplaceGovernor.computeRegion(String(region_id ?? "__global__"), actor);
    res.json({ ok: true, state });
  })
);

// Step 18: manual override of governor outputs
router.post(
  "/governor/override",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { region_id, patch, reason } = req.body ?? {};
    const actor = getActorId(req);
    const state = await marketplaceGovernor.overrideRegion({
      region_id: String(region_id ?? "__global__"),
      actor,
      patch: patch ?? {},
      reason,
    });
    res.json({ ok: true, state });
  })
);

// Step 18: upsert config (merge patch into existing)
router.post(
  "/governor/config/upsert",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { region_id, patch } = req.body ?? {};
    const actor = getActorId(req);
    const config = await marketplaceGovernor.upsertConfig({
      region_id: String(region_id ?? "__global__"),
      actor,
      patch: patch ?? {},
    });
    res.json({ ok: true, config });
  })
);

// Step 10: config by region (parameterized - after static paths)
router.get(
  "/governor/:regionId",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const regionId = req.params.regionId;
    const cfg = await adminGovernor.getRegionGovernorConfig(regionId);
    res.json({ ok: true, cfg });
  })
);

router.post(
  "/governor/:regionId",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const regionId = req.params.regionId;
    const cfg = await adminGovernor.upsertRegionGovernorConfig({
      actorId: getActorId(req),
      regionId,
      config: req.body?.config ?? {},
    });
    res.json({ ok: true, cfg });
  })
);

// ---- Feature flags ----
router.get(
  "/flags",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const key = (req.query.key as string) || undefined;
    const regionId = (req.query.region_id as string) || undefined;
    const flags = await adminFlags.listFeatureFlags(key || null, regionId || null);
    res.json({ ok: true, flags });
  })
);

// ---- Runtime config (Step 11 debug) ----
router.get(
  "/runtime-config/bundle",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const regionId = (req.query.region_id as string) || undefined;
    const loader = getRuntimeConfigLoader();
    const bundle = await loader.getBundle(regionId || null);
    res.json({ ok: true, bundle });
  })
);

router.get(
  "/runtime-config/active",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const type = (req.query.type as string) || "goals";
    const regionId = (req.query.region_id as string) || undefined;
    const loader = getRuntimeConfigLoader();
    const active = await loader.getActive(type as "goals" | "rewards" | "levels" | "governor" | "full_bundle", regionId || null);
    res.json({ ok: true, active });
  })
);

router.post(
  "/flags",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const body = req.body ?? {};
    const created = await adminFlags.setFeatureFlag({
      actorId: getActorId(req),
      key: String(body.key),
      regionId: body.region_id ?? null,
      enabled: Boolean(body.enabled),
      variant: body.variant ?? null,
      config: body.config ?? {},
      effectiveAt: body.effective_at ?? null,
    });
    res.json({ ok: true, created });
  })
);

// ---- Badges (Step 14) ----
router.get(
  "/badges",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const r = await query(
      `SELECT id, name, description, category, icon_key, is_profile_visible, is_enabled, sort_order, trigger
       FROM badge_definitions
       ORDER BY category ASC, sort_order ASC`
    );
    res.json({ ok: true, badges: r.rows });
  })
);

router.post(
  "/badges/upsert",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const b = req.body ?? {};
    const id = String(b.id ?? "");
    if (!id) return res.status(400).json({ ok: false, error: "id required" });

    const r = await query(
      `INSERT INTO badge_definitions
        (id, name, description, category, icon_key, is_profile_visible, is_enabled, sort_order, trigger, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, now())
       ON CONFLICT (id)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         icon_key = EXCLUDED.icon_key,
         is_profile_visible = EXCLUDED.is_profile_visible,
         is_enabled = EXCLUDED.is_enabled,
         sort_order = EXCLUDED.sort_order,
         trigger = EXCLUDED.trigger,
         updated_at = now()
       RETURNING *`,
      [
        id,
        String(b.name ?? ""),
        String(b.description ?? ""),
        String(b.category ?? "fun"),
        b.icon_key ?? null,
        Boolean(b.is_profile_visible ?? false),
        Boolean(b.is_enabled ?? true),
        Number(b.sort_order ?? 0),
        JSON.stringify(b.trigger ?? {}),
      ]
    );
    res.json({ ok: true, badge: r.rows[0] });
  })
);

router.post(
  "/badges/enable",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { id, is_enabled } = req.body ?? {};
    const r = await query(
      `UPDATE badge_definitions SET is_enabled = $2, updated_at = now() WHERE id = $1 RETURNING id, is_enabled`,
      [String(id), Boolean(is_enabled)]
    );
    res.json({ ok: true, badge: r.rows[0] ?? null });
  })
);

// ---- Seasons (Step 15) ----
router.get(
  "/seasons",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const r = await query(
      `SELECT id, name, description, starts_at, ends_at, is_enabled, regions, rule
       FROM season_rules
       ORDER BY starts_at DESC`
    );
    res.json({ ok: true, seasons: r.rows });
  })
);

router.post(
  "/seasons/upsert",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const s = req.body ?? {};
    const id = String(s.id ?? "");
    if (!id) return res.status(400).json({ ok: false, error: "id required" });

    const r = await query(
      `INSERT INTO season_rules (id, name, description, starts_at, ends_at, is_enabled, regions, rule, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz, $6, $7, $8::jsonb, now())
       ON CONFLICT (id)
       DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         is_enabled = EXCLUDED.is_enabled,
         regions = EXCLUDED.regions,
         rule = EXCLUDED.rule,
         updated_at = now()
       RETURNING *`,
      [
        id,
        String(s.name ?? ""),
        String(s.description ?? ""),
        String(s.starts_at ?? "2026-01-01T00:00:00Z"),
        String(s.ends_at ?? "2026-12-31T23:59:59Z"),
        Boolean(s.is_enabled ?? true),
        s.regions ?? null,
        JSON.stringify(s.rule ?? {}),
      ]
    );
    res.json({ ok: true, season: r.rows[0] });
  })
);

router.post(
  "/seasons/enable",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const { id, is_enabled } = req.body ?? {};
    const r = await query(
      `UPDATE season_rules SET is_enabled = $2, updated_at = now() WHERE id = $1 RETURNING id, is_enabled`,
      [String(id), Boolean(is_enabled)]
    );
    res.json({ ok: true, season: r.rows[0] ?? null });
  })
);

// ---- Progress Debug (Step 17) ----
const progressDebugService = new ProgressDebugService();

router.get(
  "/cleaners/:id/progress-debug",
  authedHandler(async (req: AuthedRequest, res: Response) => {
    const cleanerId = req.params.id;
    const jobId = (req.query.job_id as string) ?? undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 200;

    const out = await progressDebugService.getCleanerDebug({
      cleaner_id: cleanerId,
      job_id: jobId,
      limit,
    });
    res.json({ ok: true, ...out });
  })
);

export default router;
