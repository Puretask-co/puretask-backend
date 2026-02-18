// src/config/cleanerLevels/index.ts
// Loader for gamification config: goals, levels, rewards, in-app copy

import path from "path";
import fs from "fs";

export interface GoalDefinition {
  id: string;
  level: number;
  type: "core" | "stretch" | "maintenance";
  title: string;
  description: string;
  metric: string;
  operator: string;
  target: number | boolean;
  window: { type: string; value: number } | null;
  filters: Record<string, unknown>;
  scope: string;
  enabled: boolean;
  reward_ids: string[];
}

export interface LevelDefinition {
  level: number;
  name: string;
  requirements: {
    core_complete_all: boolean;
    stretch_complete_min: number;
    maintenance_require_all: boolean;
  };
}

export interface RewardDefinition {
  id: string;
  kind: string;
  name: string;
  params: Record<string, unknown>;
  stacking_rule: string;
  enabled: boolean;
  /** Cost classification: "cash" (direct payout) vs "non_cash" (visibility, permissions, etc.) */
  cost_type?: "cash" | "non_cash";
  /** When this reward applies; e.g. { "job.has_addons": true } for add-on-only boosts */
  applies_when?: Record<string, unknown>;
  /** Optional: mutually exclusive choice group; cleaner picks one from group */
  choice_group_id?: string;
  /** Optional: region scope for governor tuning; null = all regions */
  applies_to_regions?: string[] | null;
}

export interface LevelCopy {
  description: string;
  coreHelper?: string;
  stretchHelper?: string;
  maintenanceHelper?: string;
}

export interface GoodFaithDeclineReason {
  id: string;
  label: string;
  description: string;
  rule: string;
  config?: Record<string, unknown>;
}

export interface GoodFaithDeclinesConfig {
  reasons: GoodFaithDeclineReason[];
  limits: { good_faith_per_7_days: number; beyond_limit_still_count_toward_acceptance: boolean };
  short_notice_hours?: number;
  acceptance_rate_formula?: string;
}

export interface BadgeTrigger {
  metric?: string;
  operator?: string;
  target?: number;
  type?: string;
  window?: { type: string; value: number };
  filters?: Record<string, unknown>;
  templateId?: string;
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  metric?: string;
  operator?: string;
  target?: number;
  filters?: Record<string, unknown>;
  window?: { type: string; value: number };
  show_on_profile?: boolean;
}

export interface BadgesConfig {
  meta?: { version: string; rules: string[] };
  core: BadgeDefinition[];
  fun: BadgeDefinition[];
  categories?: string[];
}

const CONFIG_DIR = path.resolve(__dirname);

function loadJson<T>(filename: string): T {
  const filepath = path.join(CONFIG_DIR, filename);
  const raw = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(raw) as T;
}

let _goals: GoalDefinition[] | null = null;
let _levels: LevelDefinition[] | null = null;
let _rewards: RewardDefinition[] | null = null;
let _levelCopy: { global: Record<string, string>; levels: Record<string, LevelCopy> } | null = null;
let _goodFaithDeclines: GoodFaithDeclinesConfig | null = null;
let _badges: BadgesConfig | null = null;
let _quickTemplates: {
  templates: Array<{ id: string; key: string; label: string; copy: string; category: string }>;
  meaningfulMessageMinChars?: number;
} | null = null;
let _bestPractices: {
  cards: Array<{ id: string; title: string; description: string; category?: string }>;
} | null = null;
let _seasonalRules: { rules: Array<Record<string, unknown>> } | null = null;
let _rewardUnlocksByLevel: Record<string, { unlocks: string[]; note: string }> | null = null;
let _choiceRewardGroups: Record<
  string,
  { id: string; title: string; description: string; options: string[] }
> | null = null;

/**
 * Get all goal definitions from config
 */
export function getGoals(): GoalDefinition[] {
  if (!_goals) {
    _goals = loadJson<GoalDefinition[]>("goals.json");
  }
  return _goals;
}

/**
 * Get goals for a specific level
 */
export function getGoalsForLevel(level: number): GoalDefinition[] {
  return getGoals().filter((g) => g.level === level);
}

/**
 * Get all level definitions
 */
export function getLevels(): LevelDefinition[] {
  if (!_levels) {
    _levels = loadJson<LevelDefinition[]>("levels.json");
  }
  return _levels;
}

/**
 * Get level definition by number
 */
export function getLevel(level: number): LevelDefinition | undefined {
  return getLevels().find((l) => l.level === level);
}

/**
 * Get all reward definitions
 */
export function getRewards(): RewardDefinition[] {
  if (!_rewards) {
    _rewards = loadJson<RewardDefinition[]>("rewards.json");
  }
  return _rewards;
}

/**
 * Get reward by id
 */
export function getReward(id: string): RewardDefinition | undefined {
  return getRewards().find((r) => r.id === id);
}

/**
 * Get in-app copy for levels (cleaner-facing)
 */
export function getLevelCopy(): {
  global: Record<string, string>;
  levels: Record<string, LevelCopy>;
} {
  if (!_levelCopy) {
    _levelCopy = loadJson<{ global: Record<string, string>; levels: Record<string, LevelCopy> }>(
      "levelCopy.json"
    );
  }
  return _levelCopy;
}

/**
 * Get copy for a specific level
 */
export function getLevelCopyForLevel(level: number): LevelCopy | undefined {
  const { levels } = getLevelCopy();
  return levels[String(level)];
}

/**
 * Get good-faith decline config (reasons, limits, short notice threshold)
 */
export function getGoodFaithDeclines(): GoodFaithDeclinesConfig {
  if (!_goodFaithDeclines) {
    _goodFaithDeclines = loadJson<GoodFaithDeclinesConfig>("goodFaithDeclines.json");
  }
  return _goodFaithDeclines;
}

/**
 * Get badges config (core + fun)
 */
export function getBadges(): BadgesConfig {
  if (!_badges) {
    _badges = loadJson<BadgesConfig>("badges.json");
  }
  return _badges;
}

/**
 * Get quick message templates
 */
export function getQuickTemplates(): {
  templates: Array<{ id: string; key: string; label: string; copy: string; category: string }>;
  meaningfulMessageMinChars?: number;
} {
  if (!_quickTemplates) {
    _quickTemplates = loadJson<typeof _quickTemplates>("quickTemplates.json");
  }
  return _quickTemplates ?? { templates: [] };
}

/**
 * Get best practices (non-gating guidance)
 */
export function getBestPractices(): {
  cards: Array<{ id: string; title: string; description: string; category?: string }>;
} {
  if (!_bestPractices) {
    _bestPractices = loadJson<typeof _bestPractices>("bestPractices.json");
  }
  return _bestPractices ?? { cards: [] };
}

/**
 * Get seasonal challenge rules
 */
export function getSeasonalRules(): { rules: Array<Record<string, unknown>> } {
  if (!_seasonalRules) {
    _seasonalRules = loadJson<typeof _seasonalRules>("seasonalRules.json");
  }
  return _seasonalRules ?? { rules: [] };
}

/**
 * Get reward unlocks per level (v1.2 hybrid model)
 */
export function getRewardUnlocksByLevel(): Record<string, { unlocks: string[]; note: string }> {
  if (!_rewardUnlocksByLevel) {
    _rewardUnlocksByLevel = loadJson<typeof _rewardUnlocksByLevel>("rewardUnlocksByLevel.json");
  }
  return _rewardUnlocksByLevel ?? {};
}

/**
 * Get choice reward groups (choose-one rewards)
 */
export function getChoiceRewardGroups(): Record<
  string,
  { id: string; title: string; description: string; options: string[] }
> {
  if (!_choiceRewardGroups) {
    _choiceRewardGroups = loadJson<typeof _choiceRewardGroups>("choiceRewardGroups.json");
  }
  return _choiceRewardGroups ?? {};
}

/**
 * Clear cached config (useful when config files are updated at runtime)
 */
export function clearConfigCache(): void {
  _goals = null;
  _levels = null;
  _rewards = null;
  _levelCopy = null;
  _goodFaithDeclines = null;
  _badges = null;
  _quickTemplates = null;
  _bestPractices = null;
  _seasonalRules = null;
  _rewardUnlocksByLevel = null;
  _choiceRewardGroups = null;
}
