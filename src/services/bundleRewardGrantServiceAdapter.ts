/**
 * Bundle-style RewardGrantService: delegates to existing gamificationRewardService.
 * Use when bundle-derived code expects a class with grantForCompletedGoals(), etc.
 * See: docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 6.
 */

import {
  grantForCompletedGoals,
  getActiveRewards,
  getOpenChoiceEligibilities,
  selectChoiceReward,
} from "./gamificationRewardService";

export class RewardGrantService {
  /**
   * Grant rewards for completed goal IDs (bundle API).
   */
  async grantForCompletedGoals(cleaner_id: string, completed_goal_ids: string[]): Promise<void> {
    await grantForCompletedGoals(cleaner_id, completed_goal_ids);
  }

  /**
   * Get active rewards for a cleaner.
   */
  async getActiveRewards(cleaner_id: string) {
    return getActiveRewards(cleaner_id);
  }

  /**
   * Get open choice eligibilities for a cleaner.
   */
  async getOpenChoiceEligibilities(cleaner_id: string) {
    return getOpenChoiceEligibilities(cleaner_id);
  }

  /**
   * Select a choice reward from an eligibility (bundle API).
   */
  async selectChoiceReward(cleaner_id: string, eligibility_id: string, reward_id: string) {
    return selectChoiceReward({
      cleanerId: cleaner_id,
      eligibilityId: eligibility_id,
      rewardId: reward_id,
    });
  }
}
