import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { windowValues } from '@/modules/aggregates/engine/materialize.js';
import {
  buildSeries,
  type Granularity,
  type MetricSeries,
} from '@/modules/aggregates/engine/series.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

export type Window = { from: Date; to: Date };

export type DimensionFilter = { name: string; value: string };

export const MAX_CHART_SERIES = 6;

export type ValueResult = {
  value: number | null;
  breakdown?: { dimValue: string; value: number | null }[];
};

export type SeriesOptions = {
  granularity: Granularity;
  splitBy?: string;
  filters: readonly DimensionFilter[];
  maxSeries: number;
};

export type ValueOptions = {
  splitBy?: string;
  filters: readonly DimensionFilter[];
};

export type ReadsAggregates = {
  windowPartials(params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
    filters: readonly DimensionFilter[];
  }): Promise<PartialRow[]>;
  bucketPartials(params: {
    metric: MetricSummary;
    projectId: string;
    window: Window;
    granularity: Granularity;
    filters: readonly DimensionFilter[];
  }): Promise<PartialRow[]>;
};

export type MetricReads = {
  value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    options: ValueOptions,
  ): Promise<ValueResult>;
  series(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    options: SeriesOptions,
  ): Promise<MetricSeries[]>;
};

export function createMetricReads(deps: { aggregates: ReadsAggregates }): MetricReads {
  const { aggregates } = deps;

  async function value(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    options: ValueOptions,
  ): Promise<ValueResult> {
    const partials = await aggregates.windowPartials({
      metric,
      projectId,
      window,
      filters: options.filters,
    });
    const values = windowValues(metric.definition, partials);
    const total = values.find((v) => v.dimName === TOTAL_SENTINEL)?.value ?? null;
    const breakdown = options.splitBy
      ? values
          .filter((v) => v.dimName === options.splitBy)
          .map((v) => ({ dimValue: v.dimValue, value: v.value }))
      : undefined;
    return { value: total, breakdown };
  }

  async function series(
    metric: MetricSummary,
    projectId: string,
    window: Window,
    options: SeriesOptions,
  ): Promise<MetricSeries[]> {
    const partials = await aggregates.bucketPartials({
      metric,
      projectId,
      window,
      granularity: options.granularity,
      filters: options.filters,
    });
    return buildSeries({
      definition: metric.definition,
      partials,
      from: window.from,
      to: window.to,
      granularity: options.granularity,
      splitBy: options.splitBy,
      maxSeries: options.maxSeries,
    });
  }

  return { value, series };
}
