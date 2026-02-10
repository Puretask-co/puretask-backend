// src/config/scaling.ts
// Section 10: Cost, Scale & Performance - scaling tiers and targets

/**
 * Scaling tiers (Section 10).
 */
export type ScalingTier = "MVP" | "Growth" | "Scale";

export interface ScalingConfig {
  tier: ScalingTier;
  /** Max concurrent jobs */
  maxConcurrentJobs: number;
  /** Max DB connections in pool */
  maxDbConnections: number;
  /** Rate limit: requests per minute per IP */
  rateLimitPerMinute: number;
  /** Worker batch size */
  workerBatchSize: number;
  /** Cache TTL seconds (0 = no cache) */
  cacheTtlSeconds: number;
}

const TIERS: Record<ScalingTier, ScalingConfig> = {
  MVP: {
    tier: "MVP",
    maxConcurrentJobs: 100,
    maxDbConnections: 10,
    rateLimitPerMinute: 60,
    workerBatchSize: 5,
    cacheTtlSeconds: 60,
  },
  Growth: {
    tier: "Growth",
    maxConcurrentJobs: 1000,
    maxDbConnections: 30,
    rateLimitPerMinute: 120,
    workerBatchSize: 10,
    cacheTtlSeconds: 300,
  },
  Scale: {
    tier: "Scale",
    maxConcurrentJobs: 10000,
    maxDbConnections: 100,
    rateLimitPerMinute: 300,
    workerBatchSize: 25,
    cacheTtlSeconds: 600,
  },
};

function getTierFromEnv(): ScalingTier {
  const t = process.env.SCALING_TIER?.toUpperCase();
  if (t === "GROWTH" || t === "SCALE") return t as ScalingTier;
  return "MVP";
}

export const scalingConfig: ScalingConfig = TIERS[getTierFromEnv()];

/**
 * Cost centers for tracking (Section 10).
 */
export const COST_CENTERS = [
  "infra",
  "stripe",
  "sendgrid",
  "twilio",
  "storage",
  "openai",
  "n8n",
] as const;
