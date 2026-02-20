import { Router } from "express";
import { requireAdminRole } from "../middleware/rbac";
import { AdminConfigService } from "../services/admin_config_service";
import { AdminBudgetService } from "../services/admin_budget_service";
import { AdminGovernorService } from "../services/admin_governor_service";
import { AdminFeatureFlagService } from "../services/admin_feature_flag_service";
import { withClient } from "../db/client";

export const adminRouter = Router();

const configSvc = new AdminConfigService();
const budgetSvc = new AdminBudgetService();
const govSvc = new AdminGovernorService();
const flagSvc = new AdminFeatureFlagService();

/**
 * NOTE:
 * This assumes req.adminUser populated by your admin auth.
 * Minimal, build-ready endpoints for admin console.
 */

// ---- Audit ----
adminRouter.get("/admin/audit", requireAdminRole("support"), async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const rows = await withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  });
  res.json({ ok:true, rows });
});

// ---- Config versions ----
adminRouter.get("/admin/config/:type/active", requireAdminRole("support"), async (req, res) => {
  const type = req.params.type;
  const region_id = (req.query.region_id as string) ?? null;
  const active = await configSvc.getActiveConfig(type, region_id);
  res.json({ ok:true, active });
});

adminRouter.get("/admin/config/:type/versions", requireAdminRole("support"), async (req, res) => {
  const type = req.params.type;
  const region_id = (req.query.region_id as string) ?? null;
  const versions = await configSvc.listVersions(type, region_id);
  res.json({ ok:true, versions });
});

adminRouter.post("/admin/config/:type", requireAdminRole("ops"), async (req, res) => {
  const type = req.params.type as any;
  const actor = (req as any).adminUser.id;
  const region_id = (req.body?.region_id ?? null) as string | null;
  const effective_at = (req.body?.effective_at ?? null) as string | null;
  const payload = req.body?.payload;
  const change_summary = String(req.body?.change_summary ?? "");

  const created = await configSvc.createVersion({
    actor_admin_user_id: actor,
    config_type: type,
    region_id,
    effective_at,
    payload,
    change_summary,
    status: req.body?.status ?? "active"
  });

  res.json({ ok:true, created });
});

adminRouter.post("/admin/config/:type/rollback", requireAdminRole("ops"), async (req, res) => {
  const type = req.params.type;
  const actor = (req as any).adminUser.id;
  const region_id = (req.body?.region_id ?? null) as string | null;
  const version = Number(req.body?.version);
  const created = await configSvc.rollbackToVersion({
    actor_admin_user_id: actor,
    config_type: type,
    region_id,
    version
  });
  res.json({ ok:true, created });
});

// ---- Budget / kill switches ----
adminRouter.get("/admin/budget", requireAdminRole("support"), async (req, res) => {
  const scope = (req.query.scope as any) ?? "global";
  const region_id = (req.query.region_id as string) ?? null;
  const budget = await budgetSvc.getBudget(scope, region_id);
  res.json({ ok:true, budget });
});

adminRouter.post("/admin/budget", requireAdminRole("ops"), async (req, res) => {
  const actor = (req as any).adminUser.id;
  const body = req.body ?? {};
  const updated = await budgetSvc.upsertBudget({
    actor_admin_user_id: actor,
    scope: body.scope ?? "global",
    region_id: body.region_id ?? null,
    cash_cap_daily_cents: Number(body.cash_cap_daily_cents ?? 0),
    cash_cap_monthly_cents: Number(body.cash_cap_monthly_cents ?? 0),
    cash_rewards_enabled: Boolean(body.cash_rewards_enabled ?? true),
    emergency_disable_all_rewards: Boolean(body.emergency_disable_all_rewards ?? false),
  });
  res.json({ ok:true, updated });
});

// ---- Governor ----
adminRouter.get("/admin/governor/:region_id", requireAdminRole("support"), async (req, res) => {
  const region_id = req.params.region_id;
  const cfg = await govSvc.getRegionConfig(region_id);
  res.json({ ok:true, cfg });
});

adminRouter.post("/admin/governor/:region_id", requireAdminRole("ops"), async (req, res) => {
  const region_id = req.params.region_id;
  const actor = (req as any).adminUser.id;
  const cfg = await govSvc.upsertRegionConfig({
    actor_admin_user_id: actor,
    region_id,
    config: req.body?.config ?? {}
  });
  res.json({ ok:true, cfg });
});

// ---- Feature flags / A-B toggles ----
adminRouter.get("/admin/flags", requireAdminRole("support"), async (req, res) => {
  const key = (req.query.key as string) ?? null;
  const region_id = (req.query.region_id as string) ?? null;
  const flags = await flagSvc.listFlags(key, region_id);
  res.json({ ok:true, flags });
});

adminRouter.post("/admin/flags", requireAdminRole("ops"), async (req, res) => {
  const actor = (req as any).adminUser.id;
  const body = req.body ?? {};
  const created = await flagSvc.setFlag({
    actor_admin_user_id: actor,
    key: String(body.key),
    region_id: body.region_id ?? null,
    enabled: Boolean(body.enabled),
    variant: body.variant ?? null,
    config: body.config ?? {},
    effective_at: body.effective_at ?? null
  });
  res.json({ ok:true, created });
});
