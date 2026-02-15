/**
 * PureTask Gamification — Level Evaluator
 * No demotions. Level-up = all core + >= N stretch + maintenance compliant.
 * Maintenance failure pauses progression (level remains).
 */

import { GoalDefinition, LevelDefinition, LevelEvaluationResult, MetricProvider } from "./types";
import { evaluateGoals } from "./goal_evaluator";

export async function evaluateLevels(params: {
  cleaner_id: string;
  current_level: number;
  provider: MetricProvider;
  level_definitions: LevelDefinition[];
  goals: GoalDefinition[];
  now?: Date;
}): Promise<LevelEvaluationResult> {
  const { cleaner_id, current_level, provider, level_definitions, goals } = params;
  const now = params.now ?? new Date();

  const goalsByLevel = new Map<number, GoalDefinition[]>();
  for (const g of goals) {
    const list = goalsByLevel.get(g.level) ?? [];
    list.push(g);
    goalsByLevel.set(g.level, list);
  }

  const currentLevelGoals = goalsByLevel.get(current_level) ?? [];
  const maintenanceGoals = currentLevelGoals.filter((g) => g.type === "maintenance");
  const maintenanceResults = await evaluateGoals(provider, cleaner_id, maintenanceGoals, now);
  const maintenanceFailed = maintenanceResults.filter((r) => !r.complete).map((r) => r.goal_id);

  const levelDef = level_definitions.find((ld) => ld.level === current_level);
  const maintenanceRequired = levelDef?.requirements.maintenance_require_all ?? true;

  const paused = maintenanceRequired && maintenanceFailed.length > 0;
  const pause_reasons = paused ? maintenanceFailed.map((id) => `maintenance_failed:${id}`) : [];

  let eligible_for_level = current_level;

  const sortedLevels = [...level_definitions].sort((a, b) => a.level - b.level);

  for (const ld of sortedLevels) {
    if (ld.level < current_level) continue;

    const lvlGoals = goalsByLevel.get(ld.level) ?? [];
    const core = lvlGoals.filter((g) => g.type === "core");
    const stretch = lvlGoals.filter((g) => g.type === "stretch");
    const maint = lvlGoals.filter((g) => g.type === "maintenance");

    const [coreRes, stretchRes, maintRes] = await Promise.all([
      evaluateGoals(provider, cleaner_id, core, now),
      evaluateGoals(provider, cleaner_id, stretch, now),
      evaluateGoals(provider, cleaner_id, maint, now),
    ]);

    const coreComplete = core.length === 0 || coreRes.every((r) => r.complete);
    const stretchCompleteCount = stretchRes.filter((r) => r.complete).length;
    const maintOk =
      !ld.requirements.maintenance_require_all ||
      maint.length === 0 ||
      maintRes.every((r) => r.complete);

    const eligible =
      coreComplete && stretchCompleteCount >= ld.requirements.stretch_required_count && maintOk;

    if (eligible && ld.level > eligible_for_level) {
      eligible_for_level = ld.level;
    }
  }

  const next_level = eligible_for_level >= 10 ? null : eligible_for_level + 1;

  const currentCoreRes = await evaluateGoals(
    provider,
    cleaner_id,
    currentLevelGoals.filter((g) => g.type === "core"),
    now
  );
  const currentStretchRes = await evaluateGoals(
    provider,
    cleaner_id,
    currentLevelGoals.filter((g) => g.type === "stretch"),
    now
  );

  return {
    cleaner_id,
    current_level,
    eligible_for_level,
    next_level,
    paused,
    pause_reasons,
    core_complete_ids: currentCoreRes.filter((r) => r.complete).map((r) => r.goal_id),
    core_incomplete_ids: currentCoreRes.filter((r) => !r.complete).map((r) => r.goal_id),
    stretch_complete_ids: currentStretchRes.filter((r) => r.complete).map((r) => r.goal_id),
    maintenance_failed_ids: maintenanceFailed,
  };
}
