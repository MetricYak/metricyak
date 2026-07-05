import type {
  BucketGranularity,
  MetricAggregation,
  MetricDefinition,
  PartialRow,
  ValueBucketRow,
} from '@metricyak/storage';
import { evaluateExpression, parseExpression } from './expression.js';

export type AggregateSample = {
  count: number;
  sum: number;
  min: number | null;
  max: number | null;
};

export function aggregateScalar(
  aggregation: MetricAggregation,
  sample: AggregateSample | undefined,
): number | null {
  if (!sample) {
    return aggregation === 'count' || aggregation === 'sum' ? 0 : null;
  }

  switch (aggregation) {
    case 'count':
      return sample.count;
    case 'sum':
      return sample.sum;
    case 'average':
      return sample.count > 0 ? sample.sum / sample.count : null;
    case 'min':
      return sample.min;
    case 'max':
      return sample.max;
    default: {
      const _exhaustive: never = aggregation;
      throw new Error(`Unhandled aggregation: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

type Group = {
  bucketStart: Date;
  dimName: string;
  dimValue: string;
  rows: Map<string, PartialRow>;
};

export type DimensionValue = {
  dimName: string;
  dimValue: string;
  value: number | null;
};

function mergeInto(target: PartialRow, source: PartialRow): void {
  target.count += source.count;
  target.sum += source.sum;
  target.min =
    source.min === null
      ? target.min
      : target.min === null
        ? source.min
        : Math.min(target.min, source.min);
  target.max =
    source.max === null
      ? target.max
      : target.max === null
        ? source.max
        : Math.max(target.max, source.max);
}

export function windowValues(
  definition: MetricDefinition,
  partials: readonly PartialRow[],
): DimensionValue[] {
  const aggregationByKey = new Map(
    definition.events.map((event) => [event.key, event.aggregation]),
  );
  const exprSource = definition.value ?? definition.events[0]?.key;
  if (exprSource == null) return [];
  const expression = parseExpression(exprSource);

  const groups = new Map<
    string,
    { dimName: string; dimValue: string; rows: Map<string, PartialRow> }
  >();
  for (const partial of partials) {
    const groupKey = JSON.stringify([partial.dimName, partial.dimValue]);
    let group = groups.get(groupKey);
    if (!group) {
      group = { dimName: partial.dimName, dimValue: partial.dimValue, rows: new Map() };
      groups.set(groupKey, group);
    }
    const existing = group.rows.get(partial.seriesKey);
    if (existing) {
      mergeInto(existing, partial);
    } else {
      group.rows.set(partial.seriesKey, { ...partial });
    }
  }

  return [...groups.values()].map((group) => ({
    dimName: group.dimName,
    dimValue: group.dimValue,
    value: evaluateExpression(expression, (identifier) => {
      const aggregation = aggregationByKey.get(identifier);
      if (aggregation === undefined) return null;
      return aggregateScalar(aggregation, group.rows.get(identifier));
    }),
  }));
}

export function materializeValues(
  definition: MetricDefinition,
  granularity: BucketGranularity,
  metricId: string,
  metricVersion: number,
  partials: readonly PartialRow[],
): ValueBucketRow[] {
  const aggregationByKey = new Map(
    definition.events.map((event) => [event.key, event.aggregation]),
  );
  const exprSource = definition.value ?? definition.events[0]?.key;
  if (exprSource == null) return [];
  const expression = parseExpression(exprSource);

  const groups = new Map<string, Group>();
  for (const partial of partials) {
    const key = JSON.stringify([partial.bucketStart.getTime(), partial.dimName, partial.dimValue]);
    const group = groups.get(key);
    if (group) {
      group.rows.set(partial.seriesKey, partial);
    } else {
      groups.set(key, {
        bucketStart: partial.bucketStart,
        dimName: partial.dimName,
        dimValue: partial.dimValue,
        rows: new Map([[partial.seriesKey, partial]]),
      });
    }
  }

  const result: ValueBucketRow[] = [];
  for (const group of groups.values()) {
    const value = evaluateExpression(expression, (identifier) => {
      const aggregation = aggregationByKey.get(identifier);
      if (aggregation === undefined) return null;
      return aggregateScalar(aggregation, group.rows.get(identifier));
    });

    result.push({
      metricId,
      metricVersion,
      granularity,
      bucketStart: group.bucketStart,
      dimName: group.dimName,
      dimValue: group.dimValue,
      value,
    });
  }

  return result;
}
