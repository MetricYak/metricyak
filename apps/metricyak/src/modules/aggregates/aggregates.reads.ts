import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { windowValues } from '@/modules/aggregates/engine/materialize.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

export type Window = { from: Date; to: Date };

export type ValueResult = {
  value: number | null;
  breakdown?: { dimValue: string; value: number | null }[];
};

export type ReadsAggregates = {
  windowPartials(params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
  }): Promise<PartialRow[]>;
};

export type MetricReads = {
  value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    splitBy?: string,
  ): Promise<ValueResult>;
};

export function createMetricReads(deps: { aggregates: ReadsAggregates }): MetricReads {
  const { aggregates } = deps;

  async function value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    splitBy?: string,
  ): Promise<ValueResult> {
    const partials = await aggregates.windowPartials({ metric, projectId, window });
    const values = windowValues(metric.definition, partials);
    const total = values.find((v) => v.dimName === TOTAL_SENTINEL)?.value ?? null;
    const breakdown = splitBy
      ? values
          .filter((v) => v.dimName === splitBy)
          .map((v) => ({ dimValue: v.dimValue, value: v.value }))
      : undefined;
    return { value: total, breakdown };
  }

  return { value };
}
