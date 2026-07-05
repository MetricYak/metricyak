import type { MetricDefinition, PartialRow } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { materializeValues, windowValues } from '../materialize.js';

const bucket = new Date('2025-01-15T12:00:00.000Z');

const partial = (overrides: Partial<PartialRow>): PartialRow => ({
  bucketStart: bucket,
  seriesKey: 'x',
  dimName: TOTAL_SENTINEL,
  dimValue: TOTAL_SENTINEL,
  count: 0,
  sum: 0,
  min: null,
  max: null,
  ...overrides,
});

describe('materializeValues', () => {
  it('defaults a single-event metric value to that event key aggregate', () => {
    const definition: MetricDefinition = {
      events: [{ key: 'purchases', source: 'app', type: 'purchase', aggregation: 'count' }],
    };
    const [row] = materializeValues(definition, 'minute', 'm1', 1, [
      partial({ seriesKey: 'purchases', count: 7 }),
    ]);
    expect(row?.value).toBe(7);
  });

  it('evaluates a multi-event value expression, average via sum/count', () => {
    const definition: MetricDefinition = {
      value: 'revenue / orders',
      events: [
        {
          key: 'revenue',
          source: 'app',
          type: 'purchase',
          aggregation: 'sum',
          field: '$properties.amount',
        },
        { key: 'orders', source: 'app', type: 'purchase', aggregation: 'count' },
      ],
    };
    const [row] = materializeValues(definition, 'hour', 'm1', 1, [
      partial({ seriesKey: 'revenue', sum: 100, count: 4 }),
      partial({ seriesKey: 'orders', count: 4 }),
    ]);
    expect(row?.value).toBe(25);
  });

  it('produces one value row per (bucket, dimension) group', () => {
    const definition: MetricDefinition = {
      events: [{ key: 'p', source: 'app', type: 'purchase', aggregation: 'count' }],
      dimensions: ['country'],
    };
    const rows = materializeValues(definition, 'minute', 'm1', 1, [
      partial({ seriesKey: 'p', count: 5 }),
      partial({ seriesKey: 'p', dimName: 'country', dimValue: 'US', count: 3 }),
      partial({ seriesKey: 'p', dimName: 'country', dimValue: 'CA', count: 2 }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.dimValue === 'US')?.value).toBe(3);
    expect(rows.find((r) => r.dimValue === TOTAL_SENTINEL)?.value).toBe(5);
  });

  it('yields a null value when a min aggregate has no data', () => {
    const definition: MetricDefinition = {
      events: [
        { key: 'latency', source: 'app', type: 'req', aggregation: 'min', field: '$properties.ms' },
      ],
    };
    const [row] = materializeValues(definition, 'minute', 'm1', 1, [
      partial({ seriesKey: 'latency', count: 1, min: null }),
    ]);
    expect(row?.value).toBeNull();
  });
});

describe('windowValues', () => {
  it('merges partials across buckets before evaluating the metric value', () => {
    const definition: MetricDefinition = {
      events: [{ key: 'p', source: 'app', type: 'purchase', aggregation: 'count' }],
    };
    const values = windowValues(definition, [
      partial({ seriesKey: 'p', count: 3, bucketStart: new Date('2025-01-15T12:00:00.000Z') }),
      partial({ seriesKey: 'p', count: 4, bucketStart: new Date('2025-01-15T12:01:00.000Z') }),
    ]);
    expect(values.find((v) => v.dimName === TOTAL_SENTINEL)?.value).toBe(7);
  });

  it('averages correctly across a window via merged sum/count', () => {
    const definition: MetricDefinition = {
      events: [
        {
          key: 'amt',
          source: 'app',
          type: 'purchase',
          aggregation: 'average',
          field: '$properties.amount',
        },
      ],
    };
    const values = windowValues(definition, [
      partial({
        seriesKey: 'amt',
        sum: 30,
        count: 3,
        bucketStart: new Date('2025-01-15T12:00:00.000Z'),
      }),
      partial({
        seriesKey: 'amt',
        sum: 10,
        count: 1,
        bucketStart: new Date('2025-01-15T12:01:00.000Z'),
      }),
    ]);
    expect(values.find((v) => v.dimName === TOTAL_SENTINEL)?.value).toBe(10);
  });
});
