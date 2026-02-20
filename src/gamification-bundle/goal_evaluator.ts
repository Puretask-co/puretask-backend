import { GoalDefinition, GoalProgressResult, MetricProvider, MetricValue, Operator } from "./types";

/**
 * Compare a metric value to a target using an operator.
 * Supports:
 * - numbers
 * - booleans
 * - split count objects (e.g., {basic:10, deep:10}) with target as object of required minimums
 */
export function compare(metricValue: MetricValue, op: Operator, target: any): boolean {
  if (metricValue === null || metricValue === undefined) return false;

  // Object split requirements: metricValue is object, target is object => all keys must satisfy >=
  if (typeof metricValue === "object" && !Array.isArray(metricValue) && typeof target === "object" && target !== null) {
    for (const k of Object.keys(target)) {
      const mv = (metricValue as any)[k];
      const tv = target[k];
      if (typeof mv !== "number" || typeof tv !== "number") return false;
      if (mv < tv) return false;
    }
    return true;
  }

  if (typeof metricValue === "boolean") {
    const t = Boolean(target);
    if (op === "==") return metricValue === t;
    // Other operators don't make sense for booleans
    return false;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);

  if (Number.isNaN(mvNum) || Number.isNaN(tvNum)) return false;

  switch (op) {
    case ">=": return mvNum >= tvNum;
    case "<=": return mvNum <= tvNum;
    case "==": return mvNum === tvNum;
    case "<":  return mvNum < tvNum;
    case ">":  return mvNum > tvNum;
    default:   return false;
  }
}

/**
 * Compute progress ratio between 0 and 1 (best-effort).
 * For object split targets: average ratio over required keys capped at 1.
 * For booleans: 1 if equal else 0 (only supports == in practice).
 * For numbers: mv/target capped at 1 (for >= goals). For <= goals, ratio is target/mv capped at 1.
 */
export function progressRatio(metricValue: MetricValue, op: Operator, target: any): number {
  if (metricValue === null || metricValue === undefined) return 0;

  if (typeof metricValue === "object" && !Array.isArray(metricValue) && typeof target === "object" && target !== null) {
    const ratios: number[] = [];
    for (const k of Object.keys(target)) {
      const mv = (metricValue as any)[k];
      const tv = target[k];
      if (typeof mv !== "number" || typeof tv !== "number" || tv <= 0) return 0;
      ratios.push(Math.min(1, mv / tv));
    }
    if (!ratios.length) return 0;
    const avg = ratios.reduce((a,b)=>a+b,0) / ratios.length;
    return Math.max(0, Math.min(1, avg));
  }

  if (typeof metricValue === "boolean") {
    if (op !== "==") return 0;
    return metricValue === Boolean(target) ? 1 : 0;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(mvNum) || Number.isNaN(tvNum) || tvNum === 0) return 0;

  if (op === ">=") return Math.max(0, Math.min(1, mvNum / tvNum));
  if (op === "<=") return mvNum <= tvNum ? 1 : Math.max(0, Math.min(1, tvNum / mvNum));
  if (op === "==") return mvNum === tvNum ? 1 : Math.max(0, Math.min(1, mvNum / tvNum));
  if (op === "<")  return mvNum < tvNum ? 1 : Math.max(0, Math.min(1, tvNum / mvNum));
  if (op === ">")  return mvNum > tvNum ? 1 : Math.max(0, Math.min(1, mvNum / tvNum));
  return 0;
}

export function computeRemaining(metricValue: MetricValue, op: Operator, target: any): any {
  if (metricValue === null || metricValue === undefined) return target;

  if (typeof metricValue === "object" && !Array.isArray(metricValue) && typeof target === "object" && target !== null) {
    const rem: Record<string, number> = {};
    for (const k of Object.keys(target)) {
      const mv = (metricValue as any)[k] ?? 0;
      const tv = target[k];
      rem[k] = Math.max(0, tv - mv);
    }
    return rem;
  }

  if (typeof metricValue === "boolean") {
    return metricValue === Boolean(target) ? 0 : 1;
  }

  const mvNum = typeof metricValue === "number" ? metricValue : Number(metricValue);
  const tvNum = typeof target === "number" ? target : Number(target);
  if (Number.isNaN(mvNum) || Number.isNaN(tvNum)) return target;

  if (op === ">=") return Math.max(0, tvNum - mvNum);
  if (op === "<=") return mvNum <= tvNum ? 0 : mvNum - tvNum;
  if (op === "==") return mvNum === tvNum ? 0 : Math.abs(tvNum - mvNum);
  if (op === "<")  return mvNum < tvNum ? 0 : mvNum - tvNum;
  if (op === ">")  return mvNum > tvNum ? 0 : tvNum - mvNum;
  return target;
}

/**
 * Evaluate a single goal for a cleaner.
 */
export async function evaluateGoal(provider: MetricProvider, cleaner_id: string, goal: GoalDefinition, now = new Date()): Promise<GoalProgressResult> {
  const current = await provider.getMetric({
    cleaner_id,
    metric_key: goal.metric,
    window: goal.window ?? null,
    filters: goal.filters ?? {},
    now
  });

  const complete = compare(current, goal.operator, goal.target);
  const ratio = progressRatio(current, goal.operator, goal.target);
  const remaining = computeRemaining(current, goal.operator, goal.target);

  return {
    goal_id: goal.id,
    complete,
    progress_ratio: ratio,
    current_value: current,
    target_value: goal.target,
    remaining,
    debug: {
      metric: goal.metric,
      operator: goal.operator,
      window: goal.window ?? null,
      filters: goal.filters ?? {}
    }
  };
}

/**
 * Evaluate many goals.
 */
export async function evaluateGoals(provider: MetricProvider, cleaner_id: string, goals: GoalDefinition[], now = new Date()): Promise<GoalProgressResult[]> {
  // Run sequentially by default; swap to Promise.all with concurrency limiter if needed.
  const results: GoalProgressResult[] = [];
  for (const g of goals) {
    results.push(await evaluateGoal(provider, cleaner_id, g, now));
  }
  return results;
}
