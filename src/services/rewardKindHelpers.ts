/**
 * Reward kind helpers (Step 13)
 * Detect cash rewards and resolve amount in cents.
 */

export function isCashReward(reward: {
  kind?: string;
  params?: { amount_cents?: number; amount_usd?: number };
}): { is_cash: boolean; amount_cents: number } {
  if (!reward) return { is_cash: false, amount_cents: 0 };
  if (reward.kind !== "cash_bonus") return { is_cash: false, amount_cents: 0 };

  const params = reward.params ?? {};
  let cents = Number(params.amount_cents ?? 0);
  if (cents <= 0 && params.amount_usd != null) {
    cents = Math.round(Number(params.amount_usd) * 100);
  }
  return { is_cash: cents > 0, amount_cents: cents };
}
