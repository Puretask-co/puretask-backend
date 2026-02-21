/**
 * Bundle-style ProgressionService: delegates to existing gamificationProgressionService.
 * Use when bundle-derived code expects a class with getLevelDefinitions(), getGoals(), getCleanerProgression().
 * See: docs/active/GAMIFICATION_BUNDLE_IMPLEMENTATION_GUIDE.md Step 6.
 */

import type { GoalDefinition, LevelDefinition } from "../lib/gamification";
import {
  getLevelDefinitions,
  getGoalDefinitions,
  getCleanerProgression,
} from "./gamificationProgressionService";

export class ProgressionService {
  getLevelDefinitions(): LevelDefinition[] {
    return getLevelDefinitions();
  }

  getGoals(): GoalDefinition[] {
    return getGoalDefinitions();
  }

  async getCleanerProgression(cleaner_id: string, current_level: number) {
    const result = await getCleanerProgression(cleaner_id, current_level);
    return {
      levelEval: result.levelEval,
      goalProgress: result.goalProgress,
      nextBestActions: result.nextBestActions,
    };
  }
}
