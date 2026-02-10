/**
 * PureTask Gamification — In-memory metric provider for tests
 */

import { MetricProvider, MetricValue, Window } from "./types";

export class InMemoryMetricProvider implements MetricProvider {
  constructor(private data: Record<string, MetricValue>) {}

  async getMetric(params: {
    cleaner_id: string;
    metric_key: string;
    window?: Window | null;
    filters?: Record<string, unknown>;
    now?: Date;
  }): Promise<MetricValue> {
    const windowKey = params.window ? JSON.stringify(params.window) : "null";
    const filterKey = params.filters ? JSON.stringify(params.filters) : "{}";
    const keysToTry = [
      `${params.metric_key}::${windowKey}::${filterKey}`,
      `${params.metric_key}::${windowKey}`,
      params.metric_key,
    ];
    for (const k of keysToTry) {
      if (k in this.data) return this.data[k];
    }
    return null;
  }
}
