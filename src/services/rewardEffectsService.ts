/**
 * PureTask Gamification — Reward Effects Service (Step 9)
 * Converts active reward grants into actionable effects for ranking, fees, payouts.
 * Respects maintenance pause and governor caps.
 */

import { query } from "../db/client";
import { getRewards } from "../config/cleanerLevels";
import { getRuntimeConfigLoader } from "./runtimeConfigLoader";
import { isGovernorEnabled } from "../lib/gamificationFeatureFlags";
import { MarketplaceGovernorService } from "./marketplaceGovernorService";

type AnyJson = Record<string, unknown>;

export type RewardEffectContext = {
  cleaner_id: string;
  region_id?: string | null;
  now?: Date;
};

export type EffectiveEffects = {
  visibility_multiplier: number;
  early_exposure_minutes: number;
  /** Extra early exposure when ranking for add-on jobs */
  early_exposure_addon_minutes: number;
  addon_job_multiplier: number;
  platform_fee_discount_percent: number;
  instant_payout_fee_waivers_remaining: number;
  paused: boolean;
  pause_reasons: string[];
  active_reward_ids: string[];
};

const GOVERNOR_DEFAULTS = {
  visibility_cap_multiplier: 1.35,
  early_exposure_cap_minutes: 30,
  fee_discount_cap_percent: 10,
  early_exposure_bump_multiplier: 1.08,
};

/**
 * RewardEffectsService — maps active grants to effective modifiers.
 * Uses RuntimeConfigLoader (Step 11) for rewards + governor when available.
 */
export class RewardEffectsService {
  async getEffectiveEffects(ctx: RewardEffectContext): Promise<EffectiveEffects> {
    const pause = await this.getPauseStatus(ctx.cleaner_id);
    if (pause.paused) {
      return {
        visibility_multiplier: 1.0,
        early_exposure_minutes: 0,
        early_exposure_addon_minutes: 0,
        addon_job_multiplier: 1.0,
        platform_fee_discount_percent: 0,
        instant_payout_fee_waivers_remaining: 0,
        paused: true,
        pause_reasons: pause.pause_reasons,
        active_reward_ids: [],
      };
    }

    const loader = getRuntimeConfigLoader();
    const bundle = await loader.getBundle(ctx.region_id ?? null);

    const rewardsArr = Array.isArray(bundle.rewards)
      ? bundle.rewards
      : ((bundle.rewards as { rewards?: unknown[] })?.rewards ?? getRewards());
    const rewardsById = new Map<string, AnyJson>();
    for (const r of rewardsArr as Array<{ id: string; enabled?: boolean }>) {
      if (r.enabled !== false) rewardsById.set(r.id, r);
    }

    let gov: Record<string, unknown> =
      (bundle.governor as { caps?: Record<string, unknown> })?.caps ??
      (bundle.governor as Record<string, unknown>) ??
      {};
    if (ctx.region_id && Object.keys(gov).length === 0) {
      const r = await query<{ config: unknown }>(
        `SELECT config FROM region_governor_config WHERE region_id = $1`,
        [ctx.region_id]
      );
      gov = (r.rows[0]?.config as Record<string, unknown>) ?? {};
    }

    const activeRewardIds = await this.getActiveRewardIds(ctx.cleaner_id);

    let visibility = 1.0;
    let early = 0;
    let earlyAddon = 0;
    let addonMult = 1.0;
    let feeDiscount = 0;
    let instantWaivers = 0;

    for (const rewardId of activeRewardIds) {
      const reward = rewardsById.get(rewardId) as AnyJson | undefined;
      if (!reward) continue;

      const kind = reward.kind as string;
      const params = (reward.params ?? {}) as AnyJson;
      const appliesWhen = (reward.applies_when ?? {}) as AnyJson;

      // Visibility / ranking multipliers
      if (
        kind === "visibility_boost" ||
        kind === "ranking_multiplier" ||
        kind === "featured_slot"
      ) {
        const mult = Number(params.multiplier ?? 1.0);
        if (appliesWhen["job.has_addons"] === true) {
          addonMult *= mult;
        } else {
          visibility *= mult;
        }
        continue;
      }

      if (kind === "ranking_weight") {
        const delta = Number(params.delta_percent ?? 0);
        visibility *= 1 + delta / 100;
        continue;
      }

      // Early exposure
      if (kind === "exposure_window") {
        const mins = Number(params.minutes ?? 0);
        if (appliesWhen["job.has_addons"] === true) {
          earlyAddon += mins;
        } else {
          early += mins;
        }
        continue;
      }

      // Platform fee discount
      if (kind === "fee_discount") {
        const delta = Number(params.delta_percent ?? 0);
        feeDiscount += Math.abs(delta);
        continue;
      }

      // Instant payout fee waivers (uses)
      if (kind === "payout_fee" && params.waive_fee === true) {
        // Sum uses from grants - we need to get uses_remaining from DB per grant
        // For aggregate we use the reward's initial uses; actual remaining comes from grants
        instantWaivers += Number(params.uses ?? 0);
        continue;
      }
    }

    // Sum actual instant payout waiver uses from active grants
    const waiverUses = await this.getInstantPayoutWaiverUses(ctx.cleaner_id);
    instantWaivers = waiverUses;

    const visCap = Number((gov as Record<string, unknown>).visibility_cap_multiplier ?? GOVERNOR_DEFAULTS.visibility_cap_multiplier);
    const earlyCap = Number((gov as Record<string, unknown>).early_exposure_cap_minutes ?? GOVERNOR_DEFAULTS.early_exposure_cap_minutes);
    const feeCap = Number((gov as Record<string, unknown>).fee_discount_cap_percent ?? GOVERNOR_DEFAULTS.fee_discount_cap_percent);

    visibility = Math.min(visibility, visCap);
    early = Math.min(early, earlyCap);
    earlyAddon = Math.min(earlyAddon, earlyCap);
    feeDiscount = Math.min(feeDiscount, feeCap);

    // Step 18: Apply governor knobs when governor_enabled
    const governorOn = await isGovernorEnabled({ region_id: ctx.region_id });
    if (governorOn && ctx.region_id) {
      const governor = new MarketplaceGovernorService();
      const state = await governor.getGovernorState(ctx.region_id);
      if (state) {
        visibility *= state.visibility_multiplier;
        early += state.early_exposure_minutes;
      }
    }

    return {
      visibility_multiplier: visibility,
      early_exposure_minutes: early,
      early_exposure_addon_minutes: earlyAddon,
      addon_job_multiplier: addonMult,
      platform_fee_discount_percent: feeDiscount,
      instant_payout_fee_waivers_remaining: instantWaivers,
      paused: false,
      pause_reasons: [],
      active_reward_ids: activeRewardIds,
    };
  }

  private async getActiveRewardIds(cleanerId: string): Promise<string[]> {
    const r = await query<{ reward_id: string }>(
      `SELECT reward_id
       FROM gamification_cleaner_active_rewards
       WHERE cleaner_id = $1`,
      [cleanerId]
    );
    return (r.rows ?? []).map((row) => String(row.reward_id));
  }

  private async getPauseStatus(cleanerId: string): Promise<{ paused: boolean; pause_reasons: string[] }> {
    const r = await query<{ maintenance_paused: boolean; maintenance_paused_reason: string | null }>(
      `SELECT maintenance_paused, maintenance_paused_reason
       FROM cleaner_level_progress
       WHERE cleaner_id = $1`,
      [cleanerId]
    );
    if (!r.rows?.length) return { paused: false, pause_reasons: [] };
    const row = r.rows[0];
    const reasons: string[] = row.maintenance_paused_reason
      ? row.maintenance_paused_reason.split(";").map((s) => s.trim()).filter(Boolean)
      : [];
    return { paused: Boolean(row.maintenance_paused), pause_reasons: reasons };
  }

  private async getInstantPayoutWaiverUses(cleanerId: string): Promise<number> {
    const allRewards = getRewards();
    const waiverRewardIds = allRewards
      .filter((r) => r.kind === "payout_fee" && (r.params as { waive_fee?: boolean })?.waive_fee === true)
      .map((r) => r.id);
    if (waiverRewardIds.length === 0) return 0;
    const placeholders = waiverRewardIds.map((_, i) => `$${i + 2}`).join(",");
    const r = await query<{ total: string }>(
      `SELECT COALESCE(SUM(uses_remaining), 0)::text AS total
       FROM gamification_reward_grants
       WHERE cleaner_id = $1 AND status = 'active'
         AND reward_id IN (${placeholders})
         AND uses_remaining IS NOT NULL`,
      [cleanerId, ...waiverRewardIds]
    );
    return parseInt(r.rows[0]?.total ?? "0", 10);
  }
}
