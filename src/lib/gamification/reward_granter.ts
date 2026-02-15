/**
 * PureTask Gamification — Reward Granter
 * Handles grant logic: permanent vs temporary, stacking rules, choice validation.
 * Caller persists grants; this module is DB-agnostic.
 */

import { RewardDefinition, RewardGrant, ChoiceRewardGroup } from "./types";

export function computeEndsAt(reward: RewardDefinition, grantedAt: Date): Date | null {
  if ((reward.params as Record<string, unknown>)?.permanent) return null;
  const days = (reward.params as Record<string, unknown>)?.duration_days as number | undefined;
  if (!days || typeof days !== "number") return null;
  const ends = new Date(grantedAt.getTime());
  ends.setUTCDate(ends.getUTCDate() + days);
  return ends;
}

export function initialUses(reward: RewardDefinition): number | null {
  const uses = (reward.params as Record<string, unknown>)?.uses as number | undefined;
  return typeof uses === "number" ? uses : null;
}

export function isActive(grant: RewardGrant, now: Date): boolean {
  if (!grant.ends_at) return true;
  return new Date(grant.ends_at).getTime() > now.getTime();
}

export function shouldGrant(
  reward: RewardDefinition,
  existing: RewardGrant | null,
  now: Date
): {
  action: "grant" | "extend" | "skip";
  newEndsAt?: Date | null;
  newUses?: number | null;
} {
  if (!existing) return { action: "grant" };

  const active = isActive(existing, now);

  if (reward.stacking_rule === "no_stack") {
    if (active) return { action: "skip" };
    return { action: "grant" };
  }

  if (reward.stacking_rule === "extend_duration") {
    const ends = computeEndsAt(reward, now);
    if (!ends) {
      return active ? { action: "skip" } : { action: "grant" };
    }
    if (!active) return { action: "grant" };
    const base = new Date(existing.ends_at!);
    const days = (reward.params as Record<string, number>).duration_days;
    base.setUTCDate(base.getUTCDate() + days);
    return { action: "extend", newEndsAt: base };
  }

  if (reward.stacking_rule === "extend_uses") {
    const addUses = initialUses(reward) ?? 0;
    if (!active) return { action: "grant" };
    const currentUses = existing.uses_remaining ?? 0;
    return { action: "extend", newUses: currentUses + addUses };
  }

  return { action: "grant" };
}

export function makeGrant(params: {
  cleaner_id: string;
  reward: RewardDefinition;
  source_type: "goal" | "level" | "admin";
  source_id: string;
  granted_at?: Date;
}): RewardGrant {
  const granted_at = params.granted_at ?? new Date();
  const endsAt = computeEndsAt(params.reward, granted_at);
  return {
    grant_id: cryptoRandomId(),
    cleaner_id: params.cleaner_id,
    reward_id: params.reward.id,
    granted_at: granted_at.toISOString(),
    ends_at: endsAt ? endsAt.toISOString() : null,
    uses_remaining: initialUses(params.reward),
    source: { source_type: params.source_type, source_id: params.source_id },
  };
}

export function validateChoiceSelection(group: ChoiceRewardGroup, reward_id: string): boolean {
  return group.options.includes(reward_id);
}

function cryptoRandomId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return "grant_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}
