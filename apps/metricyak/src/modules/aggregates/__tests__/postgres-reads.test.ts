import type { AggregatesRepository, MetricSummary, PartialRow } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createPostgresReadsAggregates } from '@/modules/aggregates/postgres-reads.js';

const metric: MetricSummary = {
  metricId: 'metric-1',
  version: 3,
  name: 'Purchases',
  definition: { events: [{ key: 'purchases', source: 'web', type: 'purchase', aggregation: 'count' }] },
};

describe('createPostgresReadsAggregates', () => {
  it('windowPartials calls getPartials with minute granularity and the metric id/version/range', async () => {
    let called: Parameters<AggregatesRepository['getPartials']>[0] | null = null;
    const stub: Pick<AggregatesRepository, 'getPartials' | 'rawBreakdown'> = {
      getPartials: async (p) => {
        called = p;
        return [] as PartialRow[];
      },
      rawBreakdown: async () => [],
    };
    const reads = createPostgresReadsAggregates(stub);

    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-01T01:00:00.000Z');
    await reads.windowPartials({ metric, projectId: 'project-1', window: { from, to } });

    if (called === null) throw new Error('getPartials was not called');
    expect(called.metricId).toBe('metric-1');
    expect(called.metricVersion).toBe(3);
    expect(called.granularity).toBe('minute');
    expect(called.rangeStart).toEqual(from);
    expect(called.rangeEnd).toEqual(to);
  });

  it('rawBreakdown passes params through unchanged', async () => {
    let called: unknown = null;
    const stub: Pick<AggregatesRepository, 'getPartials' | 'rawBreakdown'> = {
      getPartials: async () => [],
      rawBreakdown: async (p) => {
        called = p;
        return [];
      },
    };
    const reads = createPostgresReadsAggregates(stub);
    const params = {
      projectId: 'project-1',
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: new Date('2026-01-02T00:00:00.000Z'),
    };

    await reads.rawBreakdown(params);

    expect(called).toEqual(params);
  });
});
