/**
 * Marketplace Health Governor Service (Step 18)
 * Regional thermostat: supply/demand/quality -> safe output knobs (multipliers/flags only).
 */

import { query } from "../db/client";

type AnyJson = Record<string, unknown>;

export type GovernorState = {
  region_id: string;
  state: "undersupply" | "balanced" | "oversupply" | "quality_risk";
  visibility_multiplier: number;
  early_exposure_minutes: number;
  acceptance_strictness_factor: number;
  quality_emphasis_factor: number;
  cash_rewards_enabled: boolean;
  reason?: string | null;
  based_on_window_end?: string | null;
  computed_at?: string;
  meta?: AnyJson;
};

const DEFAULTS = {
  undersupply_fill_minutes: 180,
  oversupply_fill_minutes: 30,
  max_cancel_rate: 0.12,
  max_dispute_rate: 0.06,
  min_avg_rating: 4.5,
  visibility_multiplier_min: 0.9,
  visibility_multiplier_max: 1.3,
  early_exposure_minutes_min: 0,
  early_exposure_minutes_max: 20,
  cash_rewards_enabled: true,
};

export class MarketplaceGovernorService {
  async computeRegion(regionId: string, actor: string | null = null): Promise<GovernorState> {
    const cfg = await this.getEffectiveConfig(regionId);
    const metrics = await this.getLatestMetrics(regionId);

    const classified = this.classify(metrics, cfg);
    const outputs = this.outputsForState(classified.state, cfg);

    const before = await this.getGovernorState(regionId);

    const after: GovernorState = {
      region_id: regionId,
      state: classified.state,
      visibility_multiplier: outputs.visibility_multiplier,
      early_exposure_minutes: outputs.early_exposure_minutes,
      acceptance_strictness_factor: outputs.acceptance_strictness_factor,
      quality_emphasis_factor: outputs.quality_emphasis_factor,
      cash_rewards_enabled: outputs.cash_rewards_enabled,
      reason: classified.reason,
      based_on_window_end: metrics?.window_end ? String(metrics.window_end) : null,
      meta: { metrics: metrics ?? null },
    };

    await this.saveGovernorState(after);
    await this.audit(regionId, "compute", actor, before, after);
    await this.syncCashFlagToBudget(regionId, after.cash_rewards_enabled);

    return after;
  }

  async overrideRegion(params: {
    region_id: string;
    actor: string;
    patch: Partial<GovernorState>;
    reason?: string;
  }): Promise<GovernorState> {
    const before = await this.getGovernorState(params.region_id);
    const cur: GovernorState = before ?? {
      region_id: params.region_id,
      state: "balanced",
      visibility_multiplier: 1.0,
      early_exposure_minutes: 0,
      acceptance_strictness_factor: 1.0,
      quality_emphasis_factor: 1.0,
      cash_rewards_enabled: true,
    };

    const after: GovernorState = {
      ...cur,
      ...params.patch,
      region_id: params.region_id,
      reason: params.reason ?? cur.reason ?? null,
      meta: { ...(cur.meta ?? {}), override: true } as AnyJson,
    };

    await this.saveGovernorState(after);
    await this.audit(params.region_id, "override", params.actor, before, after);
    await this.syncCashFlagToBudget(params.region_id, after.cash_rewards_enabled);

    return after;
  }

  async getGovernorState(regionId: string): Promise<GovernorState | null> {
    try {
      const r = await query(
        `SELECT region_id, state, visibility_multiplier, early_exposure_minutes,
                acceptance_strictness_factor, quality_emphasis_factor, cash_rewards_enabled,
                reason, based_on_window_end, computed_at, meta
         FROM region_governor_state
         WHERE region_id = $1`,
        [regionId]
      );
      const row = r.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        region_id: String(row.region_id),
        state: row.state as GovernorState["state"],
        visibility_multiplier: Number(row.visibility_multiplier),
        early_exposure_minutes: Number(row.early_exposure_minutes),
        acceptance_strictness_factor: Number(row.acceptance_strictness_factor),
        quality_emphasis_factor: Number(row.quality_emphasis_factor),
        cash_rewards_enabled: Boolean(row.cash_rewards_enabled),
        reason: row.reason as string | null,
        based_on_window_end: row.based_on_window_end ? String(row.based_on_window_end) : null,
        computed_at: row.computed_at ? String(row.computed_at) : undefined,
        meta: row.meta as AnyJson,
      };
    } catch {
      return null;
    }
  }

  async getEffectiveConfig(regionId: string): Promise<AnyJson> {
    const globalRow = await this.getConfigRow("__global__");
    const regionalRow = regionId !== "__global__" ? await this.getConfigRow(regionId) : null;

    const global = (globalRow?.config as AnyJson) ?? {};
    const regional = (regionalRow?.config as AnyJson) ?? {};
    return { ...DEFAULTS, ...global, ...regional };
  }

  async insertMetricsRow(row: AnyJson): Promise<{ id: string } | null> {
    try {
      const r = await query(
        `INSERT INTO region_marketplace_metrics
         (region_id, window_start, window_end, active_cleaners, available_cleaners, job_requests, jobs_booked,
          median_fill_minutes, cancel_rate, dispute_rate, avg_rating, on_time_rate, acceptance_rate, meta)
         VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
         RETURNING id`,
        [
          row.region_id,
          row.window_start,
          row.window_end,
          Number(row.active_cleaners ?? 0),
          Number(row.available_cleaners ?? 0),
          Number(row.job_requests ?? 0),
          Number(row.jobs_booked ?? 0),
          row.median_fill_minutes != null ? Number(row.median_fill_minutes) : null,
          row.cancel_rate != null ? Number(row.cancel_rate) : null,
          row.dispute_rate != null ? Number(row.dispute_rate) : null,
          row.avg_rating != null ? Number(row.avg_rating) : null,
          row.on_time_rate != null ? Number(row.on_time_rate) : null,
          row.acceptance_rate != null ? Number(row.acceptance_rate) : null,
          JSON.stringify(row.meta ?? {}),
        ]
      );
      const id = (r.rows[0] as { id: string })?.id;
      return id ? { id } : null;
    } catch {
      return null;
    }
  }

  async upsertConfig(params: {
    region_id: string;
    actor: string;
    patch: AnyJson;
  }): Promise<{ region_id: string; config: AnyJson }> {
    const before = await this.getConfigRow(params.region_id);
    const cur = (before?.config as AnyJson) ?? {};
    const merged = { ...cur, ...params.patch };

    await query(
      `INSERT INTO region_governor_config (region_id, config, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (region_id)
       DO UPDATE SET config = EXCLUDED.config, updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [params.region_id, JSON.stringify(merged), params.actor]
    );

    await this.audit(params.region_id, "config_update", params.actor, before, { config: merged });
    return { region_id: params.region_id, config: merged };
  }

  private classify(
    metrics: AnyJson | null,
    cfg: AnyJson
  ): { state: GovernorState["state"]; reason: string } {
    if (!metrics || metrics.median_fill_minutes == null) {
      return { state: "balanced", reason: "no_metrics" };
    }

    const cancel = Number(metrics.cancel_rate ?? 0);
    const dispute = Number(metrics.dispute_rate ?? 0);
    const avg = Number(metrics.avg_rating ?? 5);

    if (
      cancel > Number(cfg.max_cancel_rate ?? DEFAULTS.max_cancel_rate) ||
      dispute > Number(cfg.max_dispute_rate ?? DEFAULTS.max_dispute_rate) ||
      avg < Number(cfg.min_avg_rating ?? DEFAULTS.min_avg_rating)
    ) {
      return { state: "quality_risk", reason: "quality_threshold_breached" };
    }

    const fill = Number(metrics.median_fill_minutes);
    if (fill >= Number(cfg.undersupply_fill_minutes ?? DEFAULTS.undersupply_fill_minutes)) {
      return { state: "undersupply", reason: "median_fill_high" };
    }
    if (fill <= Number(cfg.oversupply_fill_minutes ?? DEFAULTS.oversupply_fill_minutes)) {
      return { state: "oversupply", reason: "median_fill_low" };
    }
    return { state: "balanced", reason: "within_thresholds" };
  }

  private outputsForState(
    state: GovernorState["state"],
    cfg: AnyJson
  ): {
    visibility_multiplier: number;
    early_exposure_minutes: number;
    acceptance_strictness_factor: number;
    quality_emphasis_factor: number;
    cash_rewards_enabled: boolean;
  } {
    const clamp = (x: number, min: number, max: number) => Math.min(Math.max(x, min), max);
    const vmin = Number(cfg.visibility_multiplier_min ?? DEFAULTS.visibility_multiplier_min);
    const vmax = Number(cfg.visibility_multiplier_max ?? DEFAULTS.visibility_multiplier_max);
    const mmin = Number(cfg.early_exposure_minutes_min ?? DEFAULTS.early_exposure_minutes_min);
    const mmax = Number(cfg.early_exposure_minutes_max ?? DEFAULTS.early_exposure_minutes_max);

    let visibility = 1.0;
    let early = 0;
    let acceptance = 1.0;
    let quality = 1.0;
    let cash = Boolean(cfg.cash_rewards_enabled ?? DEFAULTS.cash_rewards_enabled);

    if (state === "undersupply") {
      visibility = 1.2;
      early = 10;
      acceptance = 0.9;
      quality = 0.95;
      cash = true;
    } else if (state === "oversupply") {
      visibility = 0.95;
      early = 0;
      acceptance = 1.05;
      quality = 1.1;
      cash = false;
    } else if (state === "quality_risk") {
      visibility = 0.95;
      early = 0;
      acceptance = 1.0;
      quality = 1.25;
      cash = false;
    }

    return {
      visibility_multiplier: clamp(visibility, vmin, vmax),
      early_exposure_minutes: clamp(early, mmin, mmax),
      acceptance_strictness_factor: acceptance,
      quality_emphasis_factor: quality,
      cash_rewards_enabled: cash,
    };
  }

  private async getConfigRow(regionId: string): Promise<{ config: unknown } | null> {
    try {
      const r = await query(
        `SELECT config FROM region_governor_config WHERE region_id = $1`,
        [regionId]
      );
      return (r.rows[0] as { config: unknown }) ?? null;
    } catch {
      return null;
    }
  }

  private async getLatestMetrics(regionId: string): Promise<AnyJson | null> {
    try {
      const r = await query(
        `SELECT * FROM region_marketplace_metrics
         WHERE region_id = $1
         ORDER BY window_end DESC
         LIMIT 1`,
        [regionId]
      );
      return (r.rows[0] as AnyJson) ?? null;
    } catch {
      return null;
    }
  }

  private async saveGovernorState(s: GovernorState): Promise<void> {
    await query(
      `INSERT INTO region_governor_state
        (region_id, state, visibility_multiplier, early_exposure_minutes,
         acceptance_strictness_factor, quality_emphasis_factor, cash_rewards_enabled,
         reason, based_on_window_end, computed_at, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz, now(), $10::jsonb)
       ON CONFLICT (region_id)
       DO UPDATE SET
         state = EXCLUDED.state,
         visibility_multiplier = EXCLUDED.visibility_multiplier,
         early_exposure_minutes = EXCLUDED.early_exposure_minutes,
         acceptance_strictness_factor = EXCLUDED.acceptance_strictness_factor,
         quality_emphasis_factor = EXCLUDED.quality_emphasis_factor,
         cash_rewards_enabled = EXCLUDED.cash_rewards_enabled,
         reason = EXCLUDED.reason,
         based_on_window_end = EXCLUDED.based_on_window_end,
         computed_at = now(),
         meta = EXCLUDED.meta`,
      [
        s.region_id,
        s.state,
        s.visibility_multiplier,
        s.early_exposure_minutes,
        s.acceptance_strictness_factor,
        s.quality_emphasis_factor,
        s.cash_rewards_enabled,
        s.reason ?? null,
        s.based_on_window_end ?? null,
        JSON.stringify(s.meta ?? {}),
      ]
    );
  }

  private async audit(
    regionId: string,
    action: string,
    actor: string | null,
    beforeVal: unknown,
    afterVal: unknown
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO region_governor_audit (region_id, action, actor, before_state, after_state)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)`,
        [regionId, action, actor ?? null, JSON.stringify(beforeVal ?? null), JSON.stringify(afterVal ?? null)]
      );
    } catch {
      // Non-critical
    }
  }

  private async syncCashFlagToBudget(regionId: string, cashEnabled: boolean): Promise<void> {
    if (regionId === "__global__") return;
    try {
      await query(
        `INSERT INTO admin_reward_budget (scope, region_id, emergency_disable_all_rewards, cash_rewards_enabled, cash_cap_daily_cents, cash_cap_monthly_cents, updated_at)
         VALUES ('region', $1, false, $2, 0, 0, now())
         ON CONFLICT (scope, region_id)
         DO UPDATE SET cash_rewards_enabled = EXCLUDED.cash_rewards_enabled, updated_at = now()`,
        [regionId, cashEnabled]
      );
    } catch {
      // Schema may differ; safe no-op
    }
  }
}
