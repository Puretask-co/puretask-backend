/**
 * PureTask Gamification — MetricProvider adapter
 * Wraps metricsCalculator to satisfy the MetricProvider interface used by goal/level evaluators.
 */

import { computeMetric, MetricWindow, MetricFilters } from "../metricsCalculator";
import { MetricProvider, MetricValue, Window } from "./types";

function toMetricWindow(w: Window | null | undefined): MetricWindow | null {
  if (!w) return null;
  if (w.type === "lifetime") return null;
  if (w.type === "days") return { type: "days", value: w.value };
  if (w.type === "last_jobs") return { type: "last_jobs", value: w.value };
  return null;
}

function toMetricFilters(f: Record<string, unknown> | undefined): MetricFilters {
  if (!f) return {};
  return f as MetricFilters;
}

/**
 * Adapter that delegates to metricsCalculator.computeMetric.
 */
export class MetricsCalculatorMetricProvider implements MetricProvider {
  async getMetric(params: {
    cleaner_id: string;
    metric_key: string;
    window?: Window | null;
    filters?: Record<string, unknown>;
    now?: Date;
  }): Promise<MetricValue> {
    const window = toMetricWindow(params.window);
    const filters = toMetricFilters(params.filters);

    const result = await computeMetric(params.cleaner_id, params.metric_key, {
      window,
      filters,
    });

    if (result === null) return null;
    return result.value;
  }
}
