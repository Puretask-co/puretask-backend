import { evaluateGoals } from "../../puretask_gamification_step5/src/goal_evaluator";
import { evaluateLevels } from "../../puretask_gamification_step5/src/level_evaluator";
import { GoalDefinition, LevelDefinition } from "../../puretask_gamification_step5/src/types";
import { SqlMetricProvider } from "./sql_metric_provider";
import config from "../config/config.json";

export class ProgressionService {
  private provider = new SqlMetricProvider();

  getLevelDefinitions(): LevelDefinition[] {
    const levels: LevelDefinition[] = [];
    for (let i=1;i<=10;i++) {
      const maintenanceRequireAll = !([8,9].includes(i)); // per spec
      levels.push({
        level: i,
        name: `Level ${i}`,
        requirements: { core_require_all: true, stretch_required_count: 1, maintenance_require_all: maintenanceRequireAll }
      });
    }
    return levels;
  }

  getGoals(): GoalDefinition[] {
    return (config as any).goals as GoalDefinition[];
  }

  async getCleanerProgression(cleaner_id: string, current_level: number) {
    const goals = this.getGoals();
    const levels = this.getLevelDefinitions();

    const lvlGoals = goals.filter(g => g.level === current_level);
    const goalProgress = await evaluateGoals(this.provider, cleaner_id, lvlGoals);
    const levelEval = await evaluateLevels({
      cleaner_id,
      current_level,
      provider: this.provider,
      level_definitions: levels,
      goals
    });

    const nextBestActions = goalProgress
      .filter(g => !g.complete)
      .sort((a,b)=>a.progress_ratio - b.progress_ratio)
      .slice(0,2);

    return { levelEval, goalProgress, nextBestActions };
  }
}
