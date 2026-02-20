import { MetricProvider, MetricValue, Window } from "./types";

/**
 * InMemoryMetricProvider is used for unit/integration tests.
 * You provide a map keyed by `${metric_key}` or `${metric_key}::${windowKey}::${filterKey}`.
 * The evaluator calls getMetric; we return deterministic values.
 */
export class InMemoryMetricProvider implements MetricProvider {
  private data: Record<string, MetricValue>;
  constructor(data: Record<string, MetricValue>) {
    this.data = data;
  }

  async getMetric(params: { cleaner_id: string; metric_key: string; window?: Window | null; filters?: Record<string, any>; now?: Date }): Promise<MetricValue> {
    const windowKey = params.window ? JSON.stringify(params.window) : "null";
    const filterKey = params.filters ? JSON.stringify(params.filters) : "{}";
    const keysToTry = [
      `${params.metric_key}::${windowKey}::${filterKey}`,
      `${params.metric_key}::${windowKey}`,
      `${params.metric_key}`
    ];
    for (const k of keysToTry) {
      if (k in this.data) return this.data[k];
    }
    return null;
  }
}
