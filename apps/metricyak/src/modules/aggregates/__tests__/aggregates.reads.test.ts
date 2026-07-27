import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createMetricReads, type ReadsAggregates } from '@/modules/aggregates/aggregates.reads.js';
import type { PartialRow } from '@/modules/aggregates/types.js';

const countMetric: MetricSummary = {
  metricId: 'metric-1',
  version: 1,
  name: 'Purchases',
  definition: {
    events: [{ key: 'purchases', source: 'web', type: 'purchase', aggregation: 'count' }],
  },
};

const bucketStart = new Date('2026-01-01T00:00:00.000Z');

function partial(dimName: string, dimValue: string, count: number): PartialRow {
  return {
    bucketStart,
    seriesKey: 'purchases',
    dimName,
    dimValue,
    count,
    sum: 0,
    min: null,
    max: null,
  };
}

describe('createMetricReads.value', () => {
  it('returns the $total value for the window', async () => {
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [partial(TOTAL_SENTINEL, TOTAL_SENTINEL, 5)],
      bucketPartials: async () => [],
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.value(
      countMetric,
      'project-1',
      { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-01-01T01:00:00.000Z') },
      { filters: [] },
    );

    expect(result.value).toBe(5);
    expect(result.breakdown).toBeUndefined();
  });

  it('includes a per-dimension breakdown when splitBy is given', async () => {
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [
        partial(TOTAL_SENTINEL, TOTAL_SENTINEL, 5),
        partial('country', 'us', 3),
        partial('country', 'ca', 2),
      ],
      bucketPartials: async () => [],
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.value(
      countMetric,
      'project-1',
      { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-01-01T01:00:00.000Z') },
      { splitBy: 'country', filters: [] },
    );

    expect(result.value).toBe(5);
    expect(result.breakdown).toEqual([
      { dimValue: 'us', value: 3 },
      { dimValue: 'ca', value: 2 },
    ]);
  });

  it('passes the metric, projectId, window, and filters through to windowPartials', async () => {
    let params: Parameters<ReadsAggregates['windowPartials']>[0] | null = null;
    const aggregates: ReadsAggregates = {
      windowPartials: async (p) => {
        params = p;
        return [];
      },
      bucketPartials: async () => [],
    };
    const reads = createMetricReads({ aggregates });

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    await reads.value(
      countMetric,
      'project-1',
      { from, to },
      { filters: [{ name: 'country', value: 'us' }] },
    );

    if (params === null) throw new Error('windowPartials was not called');
    expect(params.metric).toBe(countMetric);
    expect(params.projectId).toBe('project-1');
    expect(params.window).toEqual({ from, to });
    expect(params.filters).toEqual([{ name: 'country', value: 'us' }]);
  });
});

describe('createMetricReads.series', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');
  const to = new Date('2026-01-01T02:00:00.000Z');

  function bucketed(bucketStart: Date, count: number): PartialRow {
    return { ...partial(TOTAL_SENTINEL, TOTAL_SENTINEL, count), bucketStart };
  }

  it('returns one point per bucket, in window order', async () => {
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [],
      bucketPartials: async () => [
        bucketed(new Date('2026-01-01T01:00:00.000Z'), 4),
        bucketed(new Date('2026-01-01T00:00:00.000Z'), 9),
      ],
    };
    const reads = createMetricReads({ aggregates });

    const series = await reads.series(
      countMetric,
      'project-1',
      { from, to },
      {
        granularity: '1h',
        filters: [],
        maxSeries: 6,
      },
    );

    expect(series).toHaveLength(1);
    expect(series[0]?.dimValue).toBeNull();
    expect(series[0]?.points.map((point) => point.start.toISOString())).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T01:00:00.000Z',
    ]);
    expect(series[0]?.points.map((point) => point.value)).toEqual([9, 4]);
  });

  it('passes the granularity and filters through to bucketPartials', async () => {
    let params: Parameters<ReadsAggregates['bucketPartials']>[0] | null = null;
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [],
      bucketPartials: async (p) => {
        params = p;
        return [];
      },
    };
    const reads = createMetricReads({ aggregates });

    await reads.series(
      countMetric,
      'project-1',
      { from, to },
      {
        granularity: '15m',
        filters: [{ name: 'country', value: 'us' }],
        maxSeries: 6,
      },
    );

    if (params === null) throw new Error('bucketPartials was not called');
    expect(params.metric).toBe(countMetric);
    expect(params.projectId).toBe('project-1');
    expect(params.window).toEqual({ from, to });
    expect(params.granularity).toBe('15m');
    expect(params.filters).toEqual([{ name: 'country', value: 'us' }]);
  });
});
