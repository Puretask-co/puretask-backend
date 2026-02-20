/**
 * PureTask Gamification Engine — Types (v1)
 * Designed to be framework-agnostic and testable.
 */

export type GoalType = "core" | "stretch" | "maintenance" | "badge";

export type Window =
  | { type: "lifetime" }
  | { type: "days"; value: number }
  | { type: "last_jobs"; value: number };

export type Operator = ">=" | "<=" | "==" | "<" | ">" ;

export type MetricValue = number | boolean | Record<string, any> | null;

export interface GoalDefinition {
  id: string;
  level: number;
  type: GoalType;
  title: string;
  description: string;
  metric: string;
  operator: Operator;
  target: any;
  window?: Window | null;
  filters?: Record<string, any>;
  reward_ids?: string[];
}

export interface LevelRequirements {
  core_require_all: boolean;          // true
  stretch_required_count: number;     // usually 1
  maintenance_require_all: boolean;   // true for most levels; false for L8/L9 per spec
}

export interface LevelDefinition {
  level: number;
  name: string;
  requirements: LevelRequirements;
}

export interface RewardDefinition {
  id: string;
  kind: string;
  name: string;
  params: Record<string, any>;
  stacking_rule: "no_stack" | "extend_duration" | "extend_uses";
}

export interface ChoiceRewardGroup {
  id: string;
  title: string;
  description: string;
  options: string[]; // reward ids
}

export interface GoalProgressResult {
  goal_id: string;
  complete: boolean;
  progress_ratio: number; // 0..1
  current_value: MetricValue;
  target_value: any;
  remaining?: any;
  debug?: Record<string, any>;
}

export interface LevelEvaluationResult {
  cleaner_id: string;
  current_level: number;
  eligible_for_level: number; // highest eligible level based on progress (>= current)
  next_level: number | null;
  paused: boolean;
  pause_reasons: string[];
  core_complete_ids: string[];
  core_incomplete_ids: string[];
  stretch_complete_ids: string[];
  maintenance_failed_ids: string[];
}

export interface RewardGrant {
  grant_id: string;
  cleaner_id: string;
  reward_id: string;
  granted_at: string;   // ISO
  ends_at: string | null; // ISO or null if permanent
  uses_remaining: number | null;
  source: {
    source_type: "goal" | "level" | "admin";
    source_id: string; // goal id or level id
  };
}

export interface MetricProvider {
  /**
   * Return metric value for a cleaner. Implementations may read from DB, event log, cache, etc.
   * The provider is responsible for applying window & filters where possible.
   */
  getMetric(params: {
    cleaner_id: string;
    metric_key: string;
    window?: Window | null;
    filters?: Record<string, any>;
    now?: Date;
  }): Promise<MetricValue>;
}
