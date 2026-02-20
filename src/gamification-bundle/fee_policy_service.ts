import { RewardEffectsService } from "./reward_effects_service";
import { withClient } from "../db/client";

export class FeePolicyService {
  private effects = new RewardEffectsService();

  async computePlatformFeePercent(params: {
    cleaner_id: string;
    region_id: string;
    base_platform_fee_percent: number;
  }): Promise<number> {
    const eff = await this.effects.getEffectiveEffects({ cleaner_id: params.cleaner_id, region_id: params.region_id });
    if (eff.paused) return params.base_platform_fee_percent;

    const discounted = params.base_platform_fee_percent - eff.platform_fee_discount_percent;
    return Math.max(discounted, 0);
  }

  async maybeConsumeInstantPayoutWaiver(params: { cleaner_id: string }): Promise<boolean> {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `SELECT id, uses_remaining
         FROM gamification_reward_grants
         WHERE cleaner_id=$1 AND status='active'
           AND uses_remaining IS NOT NULL AND uses_remaining > 0
         ORDER BY granted_at ASC
         LIMIT 1`,
        [params.cleaner_id]
      );

      if (!rows?.length) return false;

      await client.query(`SELECT gamification_use_reward($1)`, [rows[0].id]);
      return true;
    });
  }
}
