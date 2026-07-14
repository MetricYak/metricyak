import type { StoredEvent } from '@metricyak/queue';
import type {
  AggregatesRepository,
  BucketPartialDelta,
  EventsRepository,
  Executor,
} from '@metricyak/storage';
import { OTHER_SENTINEL, TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import type { MatcherMap, MatchTarget, MetricMatcher } from '../../aggregates/engine/matcher.js';
import { createIngestPipeline } from '../events.ingest.js';

type EventsStub = Pick<EventsRepository, 'insertBatch'>;
type AggregatesStub = Pick<
  AggregatesRepository,
  'claimBatch' | 'admitDimensionValues' | 'upsertBaseBuckets'
>;
type MatcherStub = Pick<MetricMatcher, 'resolve'>;

// The pipeline forwards the transaction executor to repositories without ever
// inspecting it; the stubs ignore it, so a real Executor is unnecessary here.
const transactionExecutor = {} as Executor;
const runInTransaction = <T>(fn: (tx: Executor) => Promise<T>): Promise<T> =>
  fn(transactionExecutor);

const countMetricOnCountry: MatchTarget = {
  metricId: 'metric-1',
  metricVersion: 1,
  eventKey: 'purchases',
  aggregation: 'count',
  field: null,
  dimensions: ['country'],
};

const matcherFor = (targets: MatchTarget[]): MatcherMap => new Map([['purchase', targets]]);

function purchase(id: string, insertId: string | null, country: string): StoredEvent {
  return {
    id,
    insertId,
    name: 'purchase',
    timestamp: '2026-01-01T00:00:00.000Z',
    properties: { country },
  };
}

function findDelta(
  deltas: readonly BucketPartialDelta[],
  dimName: string,
  dimValue: string,
): BucketPartialDelta | undefined {
  return deltas.find((delta) => delta.dimName === dimName && delta.dimValue === dimValue);
}

describe('createIngestPipeline', () => {
  it('inserts, aggregates, and upserts base buckets for matched events', async () => {
    let insertCalled = false;
    let upserted: BucketPartialDelta[] | null = null;

    const events: EventsStub = {
      insertBatch: async (rows) => {
        insertCalled = true;
        return rows.map((row) => row.id);
      },
    };
    const aggregates: AggregatesStub = {
      claimBatch: async () => true,
      admitDimensionValues: async (_metricId, _version, _dimName, candidates) =>
        new Set(candidates),
      upsertBaseBuckets: async (deltas) => {
        upserted = deltas;
      },
    };
    const matcher: MatcherStub = { resolve: async () => matcherFor([countMetricOnCountry]) };

    const pipeline = createIngestPipeline({ events, aggregates, matcher, runInTransaction });
    await pipeline.ingestBatch({
      projectId: 'project-1',
      batchId: 'batch-1',
      events: [purchase('e1', 'a', 'us'), purchase('e2', 'b', 'ca')],
    });

    expect(insertCalled).toBe(true);
    if (upserted === null) throw new Error('upsertBaseBuckets was not called');
    expect(findDelta(upserted, TOTAL_SENTINEL, TOTAL_SENTINEL)?.count).toBe(2);
    expect(findDelta(upserted, 'country', 'us')?.count).toBe(1);
    expect(findDelta(upserted, 'country', 'ca')?.count).toBe(1);
  });

  it('does nothing when the batch is already claimed', async () => {
    let insertCalled = false;
    let upsertCalled = false;

    const events: EventsStub = {
      insertBatch: async (rows) => {
        insertCalled = true;
        return rows.map((row) => row.id);
      },
    };
    const aggregates: AggregatesStub = {
      claimBatch: async () => false,
      admitDimensionValues: async (_metricId, _version, _dimName, candidates) =>
        new Set(candidates),
      upsertBaseBuckets: async () => {
        upsertCalled = true;
      },
    };
    const matcher: MatcherStub = { resolve: async () => matcherFor([countMetricOnCountry]) };

    const pipeline = createIngestPipeline({ events, aggregates, matcher, runInTransaction });
    await pipeline.ingestBatch({
      projectId: 'project-1',
      batchId: 'batch-1',
      events: [purchase('e1', 'a', 'us')],
    });

    expect(insertCalled).toBe(false);
    expect(upsertCalled).toBe(false);
  });

  it('counts only the events the insert reports as new', async () => {
    let upserted: BucketPartialDelta[] | null = null;

    const events: EventsStub = {
      insertBatch: async (rows) => (rows[0] ? [rows[0].id] : []),
    };
    const aggregates: AggregatesStub = {
      claimBatch: async () => true,
      admitDimensionValues: async (_metricId, _version, _dimName, candidates) =>
        new Set(candidates),
      upsertBaseBuckets: async (deltas) => {
        upserted = deltas;
      },
    };
    const matcher: MatcherStub = { resolve: async () => matcherFor([countMetricOnCountry]) };

    const pipeline = createIngestPipeline({ events, aggregates, matcher, runInTransaction });
    await pipeline.ingestBatch({
      projectId: 'project-1',
      batchId: 'batch-1',
      events: [purchase('e1', 'a', 'us'), purchase('e2', 'b', 'us')],
    });

    if (upserted === null) throw new Error('upsertBaseBuckets was not called');
    expect(findDelta(upserted, TOTAL_SENTINEL, TOTAL_SENTINEL)?.count).toBe(1);
  });

  it('folds an unadmitted dimension value into the $other bucket', async () => {
    let upserted: BucketPartialDelta[] | null = null;

    const events: EventsStub = {
      insertBatch: async (rows) => rows.map((row) => row.id),
    };
    const aggregates: AggregatesStub = {
      claimBatch: async () => true,
      admitDimensionValues: async () => new Set(['us']),
      upsertBaseBuckets: async (deltas) => {
        upserted = deltas;
      },
    };
    const matcher: MatcherStub = { resolve: async () => matcherFor([countMetricOnCountry]) };

    const pipeline = createIngestPipeline({ events, aggregates, matcher, runInTransaction });
    await pipeline.ingestBatch({
      projectId: 'project-1',
      batchId: 'batch-1',
      events: [purchase('e1', 'a', 'us'), purchase('e2', 'b', 'ca')],
    });

    if (upserted === null) throw new Error('upsertBaseBuckets was not called');
    expect(findDelta(upserted, 'country', 'us')?.count).toBe(1);
    expect(findDelta(upserted, 'country', OTHER_SENTINEL)?.count).toBe(1);
    expect(findDelta(upserted, 'country', 'ca')).toBeUndefined();
  });
});
