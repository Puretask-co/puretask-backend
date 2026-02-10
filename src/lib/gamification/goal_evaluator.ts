/**
 * PureTask Gamification — Goal Evaluator
 * Evaluates goals against a metric provider with operators, windows, filters.
 */

import {
  GoalDefinition,
  GoalProgressResult,
  MetricProvider,
  MetricValue,
  Operator,
} from "./types";

/**
 * Compare metric value to target using operator.
 * Supports: numbers, booleans, split-count objects (e.g. {basic:10, deep:10}).
 */
export function compare(
  metricValue: MetricValue,
  op: Operator,
  target: number | boolean | Record<string, number>
): boolean {
  if (metricValue === null || metricValue === undefined) return false;

  if (
    typeof metricValue === "object" &&
    !Array.isArray(metricValue) &&
    typeof target === "object" &&
    target !== null
  ) {
    for (const k of Object.keys(target as Record<string, number>)) {
      const mv = (metricValue as Record<string, number>)[k];
      const tv = (target as Record<string, number>)[k];
      if (typeof mv !== "number" || typeof tv !== "number") return false;
      if (mv < tv) return false;
    }
    return true;
  }

  if (typeof metricValue === "boolean") {
    const t = Boolean(target);
    return op === "==" && metricValue === t;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);

  if (Number.isNaN(mvNum) || Number.isNaN(tvNum)) return false;

  switch (op) {
    case ">=":
      return mvNum >= tvNum;
    case "<=":
      return mvNum <= tvNum;
    case "==":
      return mvNum === tvNum;
    case "<":
      return mvNum < tvNum;
    case ">":
      return mvNum > tvNum;
    default:
      return false;
  }
}

/**
 * Compute progress ratio 0..1.
 */
export function progressRatio(
  metricValue: MetricValue,
  op: Operator,
  target: number | boolean | Record<string, number>
): number {
  if (metricValue === null || metricValue === undefined) return 0;

  if (
    typeof metricValue === "object" &&
    !Array.isArray(metricValue) &&
    typeof target === "object" &&
    target !== null
  ) {
    const ratios: number[] = [];
    for (const k of Object.keys(target as Record<string, number>)) {
      const mv = (metricValue as Record<string, number>)[k] ?? 0;
      const tv = (target as Record<string, number>)[k];
      if (typeof tv !== "number" || tv <= 0) return 0;
      ratios.push(Math.min(1, mv / tv));
    }
    if (ratios.length === 0) return 0;
    const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    return Math.max(0, Math.min(1, avg));
  }

  if (typeof metricValue === "boolean") {
    return op === "==" && metricValue === Boolean(target) ? 1 : 0;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(mvNum) || Number.isNaN(tvNum) || tvNum === 0) return 0;

  if (op === ">=") return Math.max(0, Math.min(1, mvNum / tvNum));
  if (op === "<=") return mvNum <= tvNum ? 1 : Math.max(0, Math.min(1, tvNum / mvNum));
  if (op === "==") return mvNum === tvNum ? 1 : Math.max(0, Math.min(1, mvNum / tvNum));
  if (op === "<") return mvNum < tvNum ? 1 : Math.max(0, Math.min(1, tvNum / mvNum));
  if (op === ">") return mvNum > tvNum ? 1 : Math.max(0, Math.min(1, mvNum / tvNum));
  return 0;
}

/**
 * Compute remaining value to reach target.
 */
export function computeRemaining(
  metricValue: MetricValue,
  op: Operator,
  target: number | boolean | Record<string, number>
): number | Record<string, number> | null {
  if (metricValue === null || metricValue === undefined) return target as number;

  if (
    typeof metricValue === "object" &&
    !Array.isArray(metricValue) &&
    typeof target === "object" &&
    target !== null
  ) {
    const rem: Record<string, number> = {};
    for (const k of Object.keys(target as Record<string, number>)) {
      const mv = (metricValue as Record<string, number>)[k] ?? 0;
      const tv = (target as Record<string, number>)[k];
      rem[k] = Math.max(0, tv - mv);
    }
    return rem;
  }

  if (typeof metricValue === "boolean") {
    return metricValue === Boolean(target) ? 0 : 1;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(mvNum) || Number.isNaN(tvNum)) return target as number;

  if (op === ">=") return Math.max(0, tvNum - mvNum);
  if (op === "<=") return mvNum <= tvNum ? 0 : mvNum - tvNum;
  if (op === "==") return mvNum === tvNum ? 0 : Math.abs(mvNum - tvNum);
  if (op === "<") return mvNum < tvNum ? 0 : mvNum - tvNum;
  if (op === ">") return mvNum > tvNum ? 0 : tvNum - mvNum;
  return target as number;
}

/**
 * Evaluate a single goal for a cleaner.
 */
export async function evaluateGoal(
  provider: MetricProvider,
  cleaner_id: string,
  goal: GoalDefinition,
  now = new Date()
): Promise<GoalProgressResult> {
  const window = goal.window ?? null;
  const filters = (goal.filters ?? {}) as Record<string, unknown>;

  const current = await provider.getMetric({
    cleaner_id,
    metric_key: goal.metric,
    window,
    filters,
    now,
  });

  const complete = compare(current, goal.operator as Operator, goal.target);
  const ratio = progressRatio(current, goal.operator as Operator, goal.target);
  const remaining = computeRemaining(current, goal.operator as Operator, goal.target);

  return {
    goal_id: goal.id,
    complete,
    progress_ratio: ratio,
    current_value: current,
    target_value: goal.target,
    remaining: remaining ?? undefined,
    debug: {
      metric: goal.metric,
      operator: goal.operator,
      window,
      filters,
    },
  };
}

/**
 * Evaluate many goals.
 */
export async function evaluateGoals(
  provider: MetricProvider,
  cleaner_id: string,
  goals: GoalDefinition[],
  now = new Date()
): Promise<GoalProgressResult[]> {
  const results: GoalProgressResult[] = [];
  for (const g of goals) {
    results.push(await evaluateGoal(provider, cleaner_id, g, now));
  }
  return results;
}
