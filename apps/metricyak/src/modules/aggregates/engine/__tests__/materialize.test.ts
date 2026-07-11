import type { MetricDefinition, PartialRow } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { windowValues } from '../materialize.js';

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
