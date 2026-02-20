import config from "../config/config.json";
import { withClient } from "../db/client";

type AnyJson = Record<string, any>;

export type RewardEffectContext = {
  cleaner_id: string;
  region_id?: string | null;
  now?: Date;
};

export type EffectiveEffects = {
  visibility_multiplier: number;
  early_exposure_minutes: number;
  addon_job_multiplier: number;

  platform_fee_discount_percent: number;
  instant_payout_fee_waivers_remaining: number;

  paused: boolean;
  pause_reasons: string[];
  active_reward_ids: string[];
};

export class RewardEffectsService {
  private rewardsById = new Map<string, AnyJson>();
  private governorDefaults: AnyJson;

  constructor() {
    for (const r of (config as any).rewards ?? []) this.rewardsById.set(r.id, r);
    this.governorDefaults = (config as any).governor_defaults ?? {
      visibility_cap_multiplier: 1.35,
      early_exposure_cap_minutes: 30,
      fee_discount_cap_percent: 5
    };
  }

  async getEffectiveEffects(ctx: RewardEffectContext): Promise<EffectiveEffects> {
    const pause = await this.getPauseStatus(ctx.cleaner_id);
    if (pause.paused) {
      return {
        visibility_multiplier: 1.0,
        early_exposure_minutes: 0,
        addon_job_multiplier: 1.0,
        platform_fee_discount_percent: 0,
        instant_payout_fee_waivers_remaining: 0,
        paused: true,
        pause_reasons: pause.pause_reasons,
        active_reward_ids: []
      };
    }

    const activeRewardIds = await this.getActiveRewardIds(ctx.cleaner_id);
    const gov = await this.getGovernorKnobs(ctx.region_id ?? null);

    let visibility = 1.0;
    let early = 0;
    let addonMult = 1.0;
    let feeDiscount = 0;
    let instantWaivers = 0;

    for (const reward_id of activeRewardIds) {
      const reward = this.rewardsById.get(reward_id);
      if (!reward) continue;

      switch (reward.kind) {
        case "visibility_multiplier":
          visibility *= Number(reward.params?.multiplier ?? 1.0);
          break;
        case "early_exposure_minutes":
          early += Number(reward.params?.minutes ?? 0);
          break;
        case "addon_job_multiplier":
          addonMult *= Number(reward.params?.multiplier ?? 1.0);
          break;
        case "platform_fee_discount_percent":
          feeDiscount += Number(reward.params?.percent ?? 0);
          break;
        case "instant_payout_fee_waiver":
          instantWaivers += Number(reward.params?.uses ?? 0);
          break;
      }
    }

    const visCap = Number(gov.visibility_cap_multiplier ?? this.governorDefaults.visibility_cap_multiplier);
    const earlyCap = Number(gov.early_exposure_cap_minutes ?? this.governorDefaults.early_exposure_cap_minutes);
    const feeCap = Number(gov.fee_discount_cap_percent ?? this.governorDefaults.fee_discount_cap_percent);

    visibility = Math.min(visibility, visCap);
    early = Math.min(early, earlyCap);
    feeDiscount = Math.min(feeDiscount, feeCap);

    return {
      visibility_multiplier: visibility,
      early_exposure_minutes: early,
      addon_job_multiplier: addonMult,
      platform_fee_discount_percent: feeDiscount,
      instant_payout_fee_waivers_remaining: instantWaivers,
      paused: false,
      pause_reasons: [],
      active_reward_ids: activeRewardIds
    };
  }

  private async getActiveRewardIds(cleaner_id: string): Promise<string[]> {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT reward_id
         FROM gamification_cleaner_active_rewards
         WHERE cleaner_id=$1`,
        [cleaner_id]
      );
      return (rows ?? []).map((r:any)=>String(r.reward_id));
    });
  }

  private async getPauseStatus(cleaner_id: string): Promise<{ paused: boolean; pause_reasons: string[] }> {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT paused, pause_reasons
         FROM cleaner_level_status
         WHERE cleaner_id=$1`,
        [cleaner_id]
      );
      if (!rows?.length) return { paused: false, pause_reasons: [] };
      return { paused: Boolean(rows[0].paused), pause_reasons: (rows[0].pause_reasons ?? []) as string[] };
    });
  }

  private async getGovernorKnobs(region_id: string | null): Promise<AnyJson> {
    if (!region_id) return this.governorDefaults;

    return await withClient(async (client) => {
      try {
        const { rows } = await client.query(
          `SELECT config
           FROM region_governor_config
           WHERE region_id=$1`,
          [region_id]
        );
        return rows?.[0]?.config ?? this.governorDefaults;
      } catch {
        return this.governorDefaults;
      }
    });
  }
}
