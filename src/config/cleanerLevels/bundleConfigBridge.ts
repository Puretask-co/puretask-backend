/**
 * Returns a single config object compatible with bundle expectations.
 * Use in bundle-derived code that expects config.goals / config.rewards / config.levels.
 * See: docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 2.
 */
import { getGoals, getLevels, getRewards, getChoiceRewardGroups } from "./index";

export function getBundleConfig(): {
  goals: ReturnType<typeof getGoals>;
  levels: ReturnType<typeof getLevels>;
  rewards: ReturnType<typeof getRewards>;
  choiceRewardGroups: ReturnType<typeof getChoiceRewardGroups>;
} {
  return {
    goals: getGoals(),
    levels: getLevels(),
    rewards: getRewards(),
    choiceRewardGroups: getChoiceRewardGroups(),
  };
}
