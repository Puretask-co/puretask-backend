/**
 * PureTask Gamification — Progression Service
 * Wires the engine (goal/level evaluators) with config and metric provider.
 */

import {
  evaluateGoals,
  evaluateLevels,
  MetricsCalculatorMetricProvider,
  GoalDefinition,
  LevelDefinition,
  GoalProgressResult,
  LevelEvaluationResult,
} from "../lib/gamification";
import { getGoals, getLevels } from "../config/cleanerLevels";
import { getRuntimeConfigLoader } from "./runtimeConfigLoader";

const provider = new MetricsCalculatorMetricProvider();

function toLevelDefinition(level: {
  level: number;
  name: string;
  requirements: {
    core_complete_all?: boolean;
    stretch_complete_min?: number;
    maintenance_require_all?: boolean;
  };
}): LevelDefinition {
  return {
    level: level.level,
    name: level.name,
    requirements: {
      core_require_all: level.requirements.core_complete_all ?? true,
      stretch_required_count: level.requirements.stretch_complete_min ?? 1,
      maintenance_require_all: level.requirements.maintenance_require_all ?? true,
    },
  };
}

function toGoalDefinition(g: {
  id: string;
  level: number;
  type: string;
  title: string;
  description: string;
  metric: string;
  operator: string;
  target: number | boolean | Record<string, number>;
  window?: { type: string; value: number } | null;
  filters?: Record<string, unknown>;
  reward_ids?: string[];
}): GoalDefinition {
  let window: GoalDefinition["window"] = null;
  if (g.window) {
    if (g.window.type === "days") window = { type: "days", value: g.window.value };
    else if (g.window.type === "last_jobs") window = { type: "last_jobs", value: g.window.value };
    else window = { type: "lifetime" };
  }
  return {
    id: g.id,
    level: g.level,
    type: g.type as GoalDefinition["type"],
    title: g.title,
    description: g.description,
    metric: g.metric,
    operator: g.operator as GoalDefinition["operator"],
    target: g.target,
    window,
    filters: g.filters ?? {},
    reward_ids: g.reward_ids ?? [],
  };
}

/**
 * Get level definitions from config
 */
export function getLevelDefinitions(): LevelDefinition[] {
  const raw = getLevels();
  return raw.map(toLevelDefinition);
}

/**
 * Get goal definitions from config
 */
export function getGoalDefinitions(): GoalDefinition[] {
  const raw = getGoals();
  return raw.filter((g) => g.enabled !== false).map(toGoalDefinition);
}

export interface ProgressionResult {
  levelEval: LevelEvaluationResult;
  goalProgress: GoalProgressResult[];
  nextBestActions: GoalProgressResult[];
}

/**
 * Get full progression for a cleaner at a given level.
 * Uses RuntimeConfigLoader (Step 11) when admin_config_versions has data; falls back to static config.
 */
export async function getCleanerProgression(
  cleanerId: string,
  currentLevel: number,
  now = new Date(),
  regionId?: string | null
): Promise<ProgressionResult> {
  const loader = getRuntimeConfigLoader();
  const bundle = await loader.getBundle(regionId ?? null);

  const goalsRaw = Array.isArray(bundle.goals)
    ? bundle.goals
    : ((bundle.goals as { goals?: unknown[] })?.goals ?? getGoals());
  const levelsRaw = Array.isArray(bundle.levels)
    ? bundle.levels
    : ((bundle.levels as { levels?: unknown[] })?.levels ?? getLevels());

  const goals = (goalsRaw as Array<{ enabled?: boolean }>)
    .filter((g) => g.enabled !== false)
    .map((g) => toGoalDefinition(g as Parameters<typeof toGoalDefinition>[0]));
  const levels = (levelsRaw as Parameters<typeof toLevelDefinition>[]).map(toLevelDefinition);
  const levelGoals = goals.filter((g) => g.level === currentLevel);

  const goalProgress = await evaluateGoals(provider, cleanerId, levelGoals, now);
  const levelEval = await evaluateLevels({
    cleaner_id: cleanerId,
    current_level: currentLevel,
    provider,
    level_definitions: levels,
    goals,
    now,
  });

  const nextBestActions = [...goalProgress.filter((g) => !g.complete)]
    .sort((a, b) => a.progress_ratio - b.progress_ratio)
    .slice(0, 3);

  return {
    levelEval,
    goalProgress,
    nextBestActions,
  };
}
