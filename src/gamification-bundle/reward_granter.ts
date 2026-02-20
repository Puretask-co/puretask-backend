import { RewardDefinition, RewardGrant, ChoiceRewardGroup } from "./types";

/**
 * Reward grant logic (v1):
 * - Grants can be permanent (ends_at null) or temporary (duration_days).
 * - Stacking rules:
 *   - no_stack: do nothing if already active/permanent
 *   - extend_duration: if active temporary, extend ends_at; if expired, re-grant
 *   - extend_uses: add uses_remaining when same perk active
 *
 * This module is intentionally DB-agnostic: caller persists grants and checks existing grants.
 */

export function computeEndsAt(reward: RewardDefinition, grantedAt: Date): Date | null {
  if (reward.params?.permanent) return null;
  const days = reward.params?.duration_days;
  if (!days || typeof days !== "number") return null;
  const ends = new Date(grantedAt.getTime());
  ends.setUTCDate(ends.getUTCDate() + days);
  return ends;
}

export function initialUses(reward: RewardDefinition): number | null {
  const uses = reward.params?.uses;
  if (typeof uses === "number") return uses;
  return null;
}

export function isActive(grant: RewardGrant, now: Date): boolean {
  if (!grant.ends_at) return true; // permanent
  return new Date(grant.ends_at).getTime() > now.getTime();
}

export function shouldGrant(reward: RewardDefinition, existing: RewardGrant | null, now: Date): {action:"grant"|"extend"|"skip", newEndsAt?:Date|null, newUses?:number|null} {
  if (!existing) return {action:"grant"};

  const active = isActive(existing, now);

  if (reward.stacking_rule === "no_stack") {
    if (active) return {action:"skip"};
    return {action:"grant"};
  }

  if (reward.stacking_rule === "extend_duration") {
    const ends = computeEndsAt(reward, now);
    if (!ends) {
      // permanent or misconfigured: treat as no_stack
      return active ? {action:"skip"} : {action:"grant"};
    }
    if (!active) return {action:"grant"};
    // extend by duration_days from current ends_at
    const base = new Date(existing.ends_at!);
    const days = reward.params.duration_days as number;
    base.setUTCDate(base.getUTCDate() + days);
    return {action:"extend", newEndsAt: base};
  }

  if (reward.stacking_rule === "extend_uses") {
    const addUses = initialUses(reward) ?? 0;
    if (!active) return {action:"grant"};
    const currentUses = existing.uses_remaining ?? 0;
    return {action:"extend", newUses: currentUses + addUses};
  }

  return {action:"grant"};
}

/**
 * Create a new RewardGrant object (caller persists).
 */
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
    source: { source_type: params.source_type, source_id: params.source_id }
  };
}

/**
 * Choice rewards:
 * - Choice groups are not automatically granted; they create an "eligibility" record in DB in a real system.
 * - Here we provide validation for selection.
 */
export function validateChoiceSelection(group: ChoiceRewardGroup, reward_id: string): boolean {
  return group.options.includes(reward_id);
}

function cryptoRandomId(): string {
  // Node 18+ supports crypto.randomUUID(); but keep tiny fallback.
  try {
    // @ts-ignore
    return crypto.randomUUID();
  } catch {
    return "grant_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
}
