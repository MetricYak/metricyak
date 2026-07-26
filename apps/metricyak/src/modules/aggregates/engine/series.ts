import type { MetricDefinition } from '@metricyak/storage';
import { OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import { evaluateExpression, parseExpression } from '@/modules/aggregates/engine/expression.js';
import { aggregateScalar, windowValues } from '@/modules/aggregates/engine/materialize.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

export const GRANULARITIES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type Granularity = (typeof GRANULARITIES)[number];

export const GRANULARITY_MS: Readonly<Record<Granularity, number>> = {
  '1m': 60_000,
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
  '1d': 24 * 60 * 60_000,
};

export const MAX_SERIES_BUCKETS = 180;

export type SeriesPoint = { start: Date; value: number | null };

export type MetricSeries = { dimValue: string | null; points: SeriesPoint[] };

export type BuildSeriesParams = {
  definition: MetricDefinition;
  partials: readonly PartialRow[];
  from: Date;
  to: Date;
  granularity: Granularity;
  splitBy?: string;
  maxSeries: number;
};

export function bucketCountFor(from: Date, to: Date, granularity: Granularity): number {
  const span = to.getTime() - from.getTime();
  return span <= 0 ? 0 : Math.ceil(span / GRANULARITY_MS[granularity]);
}

export function bucketStarts(from: Date, to: Date, granularity: Granularity): Date[] {
  const step = GRANULARITY_MS[granularity];
  const starts: Date[] = [];
  for (let at = from.getTime(); at < to.getTime(); at += step) {
    starts.push(new Date(at));
  }
  return starts;
}

function emptyValue(definition: MetricDefinition): number | null {
  const exprSource = definition.value ?? definition.events[0]?.key;
  if (exprSource == null) return null;
  const aggregationByKey = new Map(
    definition.events.map((event) => [event.key, event.aggregation]),
  );
  return evaluateExpression(parseExpression(exprSource), (identifier) => {
    const aggregation = aggregationByKey.get(identifier);
    if (aggregation === undefined) return null;
    return aggregateScalar(aggregation, undefined);
  });
}

function rankedDimValues(
  definition: MetricDefinition,
  partials: readonly PartialRow[],
  splitBy: string,
  maxSeries: number,
): string[] {
  return windowValues(definition, partials)
    .filter((entry) => entry.dimName === splitBy)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, maxSeries)
    .map((entry) => entry.dimValue);
}

function foldOthers(
  partials: readonly PartialRow[],
  splitBy: string,
  keep: readonly string[],
): PartialRow[] {
  const kept = new Set(keep);
  return partials.map((partial) =>
    partial.dimName === splitBy && !kept.has(partial.dimValue)
      ? { ...partial, dimValue: OTHER_SENTINEL }
      : partial,
  );
}

function groupByBucket(partials: readonly PartialRow[]): Map<number, PartialRow[]> {
  const byBucket = new Map<number, PartialRow[]>();
  for (const partial of partials) {
    const key = partial.bucketStart.getTime();
    const existing = byBucket.get(key);
    if (existing) existing.push(partial);
    else byBucket.set(key, [partial]);
  }
  return byBucket;
}

export function buildSeries(params: BuildSeriesParams): MetricSeries[] {
  const { definition, partials, from, to, granularity, splitBy, maxSeries } = params;
  const starts = bucketStarts(from, to, granularity);
  const fallback = emptyValue(definition);

  if (!splitBy) {
    const byBucket = groupByBucket(partials);
    const points = starts.map((start) => {
      const rows = byBucket.get(start.getTime()) ?? [];
      const total = windowValues(definition, rows).find(
        (entry) => entry.dimName === TOTAL_SENTINEL,
      );
      return { start, value: total ? total.value : fallback };
    });
    return [{ dimValue: null, points }];
  }

  const keep = rankedDimValues(definition, partials, splitBy, maxSeries);
  const folded = foldOthers(partials, splitBy, keep);
  const byBucket = groupByBucket(folded);
  const foldedAny = folded.some(
    (partial) => partial.dimName === splitBy && partial.dimValue === OTHER_SENTINEL,
  );
  const dimValues = foldedAny ? [...keep, OTHER_SENTINEL] : keep;

  return dimValues.map((dimValue) => ({
    dimValue,
    points: starts.map((start) => {
      const rows = byBucket.get(start.getTime()) ?? [];
      const match = windowValues(definition, rows).find(
        (entry) => entry.dimName === splitBy && entry.dimValue === dimValue,
      );
      return { start, value: match ? match.value : fallback };
    }),
  }));
}
