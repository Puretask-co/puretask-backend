/**
 * PureTask Gamification — Fee Policy Service (Step 9)
 * Applies platform fee discounts and instant payout fee waivers from active rewards.
 */

import { withTransaction } from "../db/client";
import { RewardEffectsService } from "./rewardEffectsService";
import { getRewards } from "../config/cleanerLevels";

function getInstantPayoutWaiverRewardIds(): string[] {
  return getRewards()
    .filter((r) => r.kind === "payout_fee" && (r.params as { waive_fee?: boolean })?.waive_fee === true)
    .map((r) => r.id);
}

export class FeePolicyService {
  private effects = new RewardEffectsService();

  /**
   * Compute effective platform fee percent after reward discounts
   */
  async computePlatformFeePercent(params: {
    cleaner_id: string;
    region_id: string;
    base_platform_fee_percent: number;
  }): Promise<number> {
    const eff = await this.effects.getEffectiveEffects({
      cleaner_id: params.cleaner_id,
      region_id: params.region_id,
    });
    if (eff.paused) return params.base_platform_fee_percent;
    const discounted = params.base_platform_fee_percent - eff.platform_fee_discount_percent;
    return Math.max(discounted, 0);
  }

  /**
   * Consume one instant payout fee waiver if available.
   * Call when cleaner chooses instant payout and fee would otherwise apply.
   * Returns true if waiver was consumed, false if none available.
   */
  async maybeConsumeInstantPayoutWaiver(params: { cleaner_id: string }): Promise<boolean> {
    const waiverIds = getInstantPayoutWaiverRewardIds();
    if (waiverIds.length === 0) return false;

    return withTransaction(async (client) => {
      const placeholders = waiverIds.map((_, i) => `$${i + 2}`).join(",");
      const r = await client.query<{ id: string }>(
        `SELECT id
         FROM gamification_reward_grants
         WHERE cleaner_id = $1 AND status = 'active'
           AND reward_id IN (${placeholders})
           AND uses_remaining IS NOT NULL AND uses_remaining > 0
         ORDER BY granted_at ASC
         LIMIT 1`,
        [params.cleaner_id, ...waiverIds]
      );

      if (!r.rows?.length) return false;

      const grantId = r.rows[0].id;
      await client.query(`SELECT gamification_use_reward($1)`, [grantId]);
      return true;
    });
  }
}
