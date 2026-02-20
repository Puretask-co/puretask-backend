import { GoalDefinition, GoalProgressResult, LevelDefinition, LevelEvaluationResult, MetricProvider } from "./types";
import { evaluateGoals } from "./goal_evaluator";

/**
 * Evaluate level eligibility and pause state from goals.
 * Rules (locked):
 * - Levels never demote.
 * - Level-up requires: all core complete + >= N stretch complete (usually 1) + maintenance compliant (if maintenance_require_all).
 * - If maintenance fails, progression/rewards pause (but level remains).
 */
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
    goalsByLevel.set(g.level, [...(goalsByLevel.get(g.level) ?? []), g]);
  }

  // Evaluate maintenance for current level (pause rules)
  const currentLevelGoals = goalsByLevel.get(current_level) ?? [];
  const maintenanceGoals = currentLevelGoals.filter(g => g.type === "maintenance");
  const maintenanceResults = await evaluateGoals(provider, cleaner_id, maintenanceGoals, now);
  const maintenanceFailed = maintenanceResults.filter(r => !r.complete).map(r => r.goal_id);

  const levelDef = level_definitions.find(ld => ld.level === current_level);
  const maintenance_required = levelDef?.requirements.maintenance_require_all ?? TrueFallback();

  const paused = maintenance_required && maintenanceFailed.length > 0;
  const pause_reasons = paused ? maintenanceFailed.map(id => `maintenance_failed:${id}`) : [];

  // Determine eligibility for each level >= current
  let eligible_for_level = current_level;

  for (const ld of level_definitions.sort((a,b)=>a.level-b.level)) {
    if (ld.level < current_level) continue;

    const lvlGoals = goalsByLevel.get(ld.level) ?? [];
    const core = lvlGoals.filter(g => g.type === "core");
    const stretch = lvlGoals.filter(g => g.type === "stretch");
    const maint = lvlGoals.filter(g => g.type === "maintenance");

    const [coreRes, stretchRes, maintRes] = await Promise.all([
      evaluateGoals(provider, cleaner_id, core, now),
      evaluateGoals(provider, cleaner_id, stretch, now),
      evaluateGoals(provider, cleaner_id, maint, now),
    ]);

    const coreComplete = coreRes.every(r => r.complete);
    const stretchCompleteCount = stretchRes.filter(r => r.complete).length;
    const maintOk = (ld.requirements.maintenance_require_all ? maintRes.every(r => r.complete) : true);

    const eligible = coreComplete && (stretchCompleteCount >= ld.requirements.stretch_required_count) && maintOk;

    if (eligible && ld.level > eligible_for_level) {
      eligible_for_level = ld.level;
    }
  }

  const next_level = eligible_for_level >= 10 ? null : eligible_for_level + 1;

  // For UI breakdown at current level
  const currentCoreRes = await evaluateGoals(provider, cleaner_id, currentLevelGoals.filter(g=>g.type==="core"), now);
  const currentStretchRes = await evaluateGoals(provider, cleaner_id, currentLevelGoals.filter(g=>g.type==="stretch"), now);

  return {
    cleaner_id,
    current_level,
    eligible_for_level,
    next_level,
    paused,
    pause_reasons,
    core_complete_ids: currentCoreRes.filter(r=>r.complete).map(r=>r.goal_id),
    core_incomplete_ids: currentCoreRes.filter(r=>!r.complete).map(r=>r.goal_id),
    stretch_complete_ids: currentStretchRes.filter(r=>r.complete).map(r=>r.goal_id),
    maintenance_failed_ids: maintenanceFailed,
  };
}

function TrueFallback(): boolean {
  // default to true for safety per spec (maintenance pauses progress by default)
  return true;
}
