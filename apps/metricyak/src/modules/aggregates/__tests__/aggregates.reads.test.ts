import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createMetricReads, type ReadsAggregates } from '@/modules/aggregates/aggregates.reads.js';
import type { PartialRow, RawBreakdownRow } from '@/modules/aggregates/types.js';

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
  return { bucketStart, seriesKey: 'purchases', dimName, dimValue, count, sum: 0, min: null, max: null };
}

const noRawBreakdown: ReadsAggregates['rawBreakdown'] = async () => [];

describe('createMetricReads.value', () => {
  it('returns the $total value for the window', async () => {
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [partial(TOTAL_SENTINEL, TOTAL_SENTINEL, 5)],
      rawBreakdown: noRawBreakdown,
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.value(countMetric, 'project-1', {
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-01T01:00:00.000Z'),
    });

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
      rawBreakdown: noRawBreakdown,
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.value(
      countMetric,
      'project-1',
      { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-01-01T01:00:00.000Z') },
      'country',
    );

    expect(result.value).toBe(5);
    expect(result.breakdown).toEqual([
      { dimValue: 'us', value: 3 },
      { dimValue: 'ca', value: 2 },
    ]);
  });

  it('passes the metric, projectId, and window through to windowPartials', async () => {
    let params: Parameters<ReadsAggregates['windowPartials']>[0] | null = null;
    const aggregates: ReadsAggregates = {
      windowPartials: async (p) => {
        params = p;
        return [];
      },
      rawBreakdown: noRawBreakdown,
    };
    const reads = createMetricReads({ aggregates });

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    await reads.value(countMetric, 'project-1', { from, to });

    if (params === null) throw new Error('windowPartials was not called');
    expect(params.metric).toBe(countMetric);
    expect(params.projectId).toBe('project-1');
    expect(params.window).toEqual({ from, to });
  });
});

describe('createMetricReads.breakdown', () => {
  const currentFrom = new Date('2026-01-02T00:00:00.000Z');
  const compareFrom = new Date('2026-01-01T00:00:00.000Z');
  const windows = {
    current: { from: currentFrom, to: new Date('2026-01-02T01:00:00.000Z') },
    compare: { from: compareFrom, to: new Date('2026-01-01T01:00:00.000Z') },
  };
  const declaredMetric: MetricSummary = {
    ...countMetric,
    definition: { ...countMetric.definition, dimensions: ['country'] },
  };

  it('ranks declared-dimension movers by absolute delta with contributions', async () => {
    const aggregates: ReadsAggregates = {
      windowPartials: async (p) =>
        p.window.from.getTime() === currentFrom.getTime()
          ? [partial('country', 'us', 10), partial('country', 'ca', 5)]
          : [partial('country', 'us', 6), partial('country', 'ca', 5)],
      rawBreakdown: noRawBreakdown,
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.breakdown(declaredMetric, 'project-1', windows, 'country', 20);

    if (result.kind !== 'movers') throw new Error(`expected movers, got ${result.kind}`);
    expect(result.movers[0]).toEqual({
      dimValue: 'us',
      current: 10,
      previous: 6,
      delta: 4,
      contribution: 1,
    });
    expect(result.movers[1]?.dimValue).toBe('ca');
    expect(result.movers[1]?.delta).toBe(0);
  });

  it('rejects an undeclared dimension on a multi-event metric', async () => {
    const multiEvent: MetricSummary = {
      ...countMetric,
      definition: {
        events: [
          { key: 'a', source: 'web', type: 'signup', aggregation: 'count' },
          { key: 'b', source: 'web', type: 'purchase', aggregation: 'count' },
        ],
      },
    };
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [],
      rawBreakdown: noRawBreakdown,
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.breakdown(multiEvent, 'project-1', windows, 'country', 20);

    expect(result.kind).toBe('unsupported-dimension');
  });

  it('computes an undeclared single-event breakdown from raw events', async () => {
    function rawRow(dimValue: string, count: number): RawBreakdownRow {
      return { dimValue, count, sum: 0, min: null, max: null };
    }
    const aggregates: ReadsAggregates = {
      windowPartials: async () => [],
      rawBreakdown: async (p) =>
        p.from.getTime() === currentFrom.getTime() ? [rawRow('us', 8)] : [rawRow('us', 3)],
    };
    const reads = createMetricReads({ aggregates });

    const result = await reads.breakdown(countMetric, 'project-1', windows, 'country', 20);

    if (result.kind !== 'movers') throw new Error(`expected movers, got ${result.kind}`);
    expect(result.movers[0]).toEqual({
      dimValue: 'us',
      current: 8,
      previous: 3,
      delta: 5,
      contribution: 1,
    });
  });
});
