/**
 * Gamification feature flag helpers (Step 21-style).
 * Uses admin_feature_flags. Keys: gamification_enabled, governor_enabled, gamification_cash_enabled, etc.
 */

import { getEffectiveFeatureFlag } from "../services/adminFeatureFlagService";

export type GamificationFlagContext = {
  region_id?: string | null;
};

/**
 * Check if gamification (progression, rewards) is enabled for the given context.
 * When GAMIFICATION_ENABLED env is "false", gamification is disabled everywhere (overrides DB flag).
 */
export async function isGamificationEnabled(ctx: GamificationFlagContext = {}): Promise<boolean> {
  if (process.env.GAMIFICATION_ENABLED === "false") return false;
  const flag = await getEffectiveFeatureFlag("gamification_enabled", ctx.region_id ?? null);
  return flag?.enabled === true;
}

/**
 * Check if cash rewards are enabled (still subject to budget caps + governor).
 */
export async function isGamificationCashEnabled(
  ctx: GamificationFlagContext = {}
): Promise<boolean> {
  const flag = await getEffectiveFeatureFlag("gamification_cash_enabled", ctx.region_id ?? null);
  return flag?.enabled === true;
}

/**
 * Check if seasonal multipliers/challenges are enabled.
 */
export async function isGamificationSeasonsEnabled(
  ctx: GamificationFlagContext = {}
): Promise<boolean> {
  const flag = await getEffectiveFeatureFlag("gamification_seasons_enabled", ctx.region_id ?? null);
  return flag?.enabled === true;
}

/**
 * Check if badge awarding is enabled.
 */
export async function isGamificationBadgesEnabled(
  ctx: GamificationFlagContext = {}
): Promise<boolean> {
  const flag = await getEffectiveFeatureFlag("gamification_badges_enabled", ctx.region_id ?? null);
  return flag?.enabled === true;
}

/**
 * Check if Next Best Action is enabled.
 */
export async function isNextBestActionEnabled(ctx: GamificationFlagContext = {}): Promise<boolean> {
  const flag = await getEffectiveFeatureFlag(
    "gamification_next_best_action_enabled",
    ctx.region_id ?? null
  );
  return flag?.enabled === true;
}

/**
 * Check if governor outputs should be applied to ranking.
 */
export async function isGovernorEnabled(ctx: GamificationFlagContext = {}): Promise<boolean> {
  const flag = await getEffectiveFeatureFlag("governor_enabled", ctx.region_id ?? null);
  return flag?.enabled === true;
}
