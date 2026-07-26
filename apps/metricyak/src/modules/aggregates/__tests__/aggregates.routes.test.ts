import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
} from '@metricyak/queue';
import type { Database, MetricSummary } from '@metricyak/storage';
import { MetricsRepository, TOTAL_SENTINEL } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { type Container, createContainer } from '@/container/container.js';
import { createMetricReads, type ReadsAggregates } from '@/modules/aggregates/aggregates.reads.js';
import type { PartialRow } from '@/modules/aggregates/types.js';
import type { EventsReads, ListEventsPageParams } from '@/modules/events/events-reads.js';

const fakeDatabase = {} as Database;
const projectId = '00000000-0000-4000-8000-0000000000f2';
const metricId = '00000000-0000-4000-8000-0000000000f3';

const metric: MetricSummary = {
  metricId,
  version: 1,
  name: 'Signups',
  definition: {
    events: [{ key: 'signups', source: 'web', type: 'signup', aggregation: 'count' }],
    dimensions: ['plan', 'country'],
  },
};

class StubMetrics extends MetricsRepository {
  constructor() {
    super(fakeDatabase);
  }

  override async getDefinition(id: string, project: string): Promise<MetricSummary | null> {
    return id === metricId && project === projectId ? metric : null;
  }
}

function partial(bucketStart: Date, count: number): PartialRow {
  return {
    bucketStart,
    seriesKey: 'signups',
    dimName: TOTAL_SENTINEL,
    dimValue: TOTAL_SENTINEL,
    count,
    sum: 0,
    min: null,
    max: null,
  };
}

function buildApp(aggregates: ReadsAggregates, eventsReads?: EventsReads) {
  const base = createContainer(
    fakeDatabase,
    new InMemoryEventsProducer(),
    new InMemoryMonitorSignalsProducer(),
    new InMemoryMonitorEvalProducer(),
    {} as ClickHouseClient,
    new InMemoryMonitorDirtyBuffer(),
  );
  const container: Container = {
    ...base,
    repos: { ...base.repos, metrics: new StubMetrics() },
    reads: createMetricReads({ aggregates }),
    eventsReads: eventsReads ?? base.eventsReads,
  };
  return createApp(container);
}

function recordingEventsReads(): {
  eventsReads: EventsReads;
  lastListCall: () => ListEventsPageParams | null;
} {
  let lastListCall: ListEventsPageParams | null = null;
  return {
    eventsReads: {
      listPage: async (params) => {
        lastListCall = params;
        return {
          events: [
            {
              id: '00000000-0000-4000-8000-0000000000e1',
              name: 'signup',
              timestamp: '2026-07-26T00:30:00.000Z',
              properties: { plan: 'pro' },
            },
          ],
          hasMore: false,
        };
      },
    },
    lastListCall: () => lastListCall,
  };
}

function recordingAggregates(): {
  aggregates: ReadsAggregates;
  lastBucketCall: () => Parameters<ReadsAggregates['bucketPartials']>[0] | null;
} {
  let lastBucketCall: Parameters<ReadsAggregates['bucketPartials']>[0] | null = null;
  return {
    aggregates: {
      windowPartials: async () => [],
      bucketPartials: async (params) => {
        lastBucketCall = params;
        return [partial(new Date('2026-07-26T00:00:00.000Z'), 3)];
      },
    },
    lastBucketCall: () => lastBucketCall,
  };
}

const seriesUrl = `/v1/projects/${projectId}/metrics/${metricId}/series?from=2026-07-26T00:00:00.000Z&to=2026-07-26T02:00:00.000Z&granularity=1h`;

describe('GET /v1/projects/:projectId/metrics/:metricId/series', () => {
  it('returns a series with one point per bucket', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(seriesUrl);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.granularity).toBe('1h');
    expect(body.series).toHaveLength(1);
    expect(body.series[0].dimValue).toBeNull();
    expect(body.series[0].points).toHaveLength(2);
    expect(body.series[0].points[0]).toEqual({ start: '2026-07-26T00:00:00.000Z', value: 3 });
  });

  it('returns 404 for an unknown metric', async () => {
    const unknownId = '00000000-0000-4000-8000-0000000000ff';
    const res = await buildApp(recordingAggregates().aggregates).request(
      `/v1/projects/${projectId}/metrics/${unknownId}/series?from=2026-07-26T00:00:00.000Z&to=2026-07-26T02:00:00.000Z&granularity=1h`,
    );

    expect(res.status).toBe(404);
  });

  it('rejects a granularity needing more buckets than the cap allows', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `/v1/projects/${projectId}/metrics/${metricId}/series?from=2026-06-26T00:00:00.000Z&to=2026-07-26T00:00:00.000Z&granularity=1m`,
    );

    expect(res.status).toBe(400);
  });

  it('accepts a window sitting exactly on the bucket cap', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `/v1/projects/${projectId}/metrics/${metricId}/series?from=2026-07-26T00:00:00.000Z&to=2026-07-26T03:00:00.000Z&granularity=1m`,
    );

    expect(res.status).toBe(200);
  });

  it('rejects a window whose end is not after its start', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `/v1/projects/${projectId}/metrics/${metricId}/series?from=2026-07-26T02:00:00.000Z&to=2026-07-26T02:00:00.000Z&granularity=1h`,
    );

    expect(res.status).toBe(400);
  });

  it('rejects a splitBy that is not a declared dimension', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `${seriesUrl}&splitBy=nope`,
    );

    expect(res.status).toBe(400);
  });

  it('accepts a single filter and a repeated filter identically', async () => {
    const app = buildApp(recordingAggregates().aggregates);

    expect((await app.request(`${seriesUrl}&filter=plan:pro`)).status).toBe(200);
    expect((await app.request(`${seriesUrl}&filter=plan:pro&filter=country:US`)).status).toBe(200);
  });

  it('passes parsed filters through to the aggregates port', async () => {
    const recorder = recordingAggregates();

    await buildApp(recorder.aggregates).request(`${seriesUrl}&filter=plan:pro&filter=country:US`);

    expect(recorder.lastBucketCall()?.filters).toEqual([
      { name: 'plan', value: 'pro' },
      { name: 'country', value: 'US' },
    ]);
  });

  it('rejects a filter that is not formatted name:value', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `${seriesUrl}&filter=plan`,
    );

    expect(res.status).toBe(400);
  });

  it('rejects a filter naming an undeclared dimension', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `${seriesUrl}&filter=nope:1`,
    );

    expect(res.status).toBe(400);
  });

  it('rejects an unknown granularity', async () => {
    const res = await buildApp(recordingAggregates().aggregates).request(
      `/v1/projects/${projectId}/metrics/${metricId}/series?from=2026-07-26T00:00:00.000Z&to=2026-07-26T02:00:00.000Z&granularity=2h`,
    );

    expect(res.status).toBe(400);
  });
});

const metricEventsUrl = `/v1/projects/${projectId}/metrics/${metricId}/events?from=2026-07-26T00:00:00.000Z&to=2026-07-26T02:00:00.000Z`;

describe('GET /v1/projects/:projectId/metrics/:metricId/events', () => {
  it('returns a page of events', async () => {
    const recorder = recordingEventsReads();

    const res = await buildApp(recordingAggregates().aggregates, recorder.eventsReads).request(
      metricEventsUrl,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasMore).toBe(false);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe('signup');
  });

  it('restricts the page to the metric definition event types', async () => {
    const recorder = recordingEventsReads();

    await buildApp(recordingAggregates().aggregates, recorder.eventsReads).request(metricEventsUrl);

    expect(recorder.lastListCall()?.names).toEqual(['signup']);
  });

  it('translates filters into property predicates', async () => {
    const recorder = recordingEventsReads();

    await buildApp(recordingAggregates().aggregates, recorder.eventsReads).request(
      `${metricEventsUrl}&filter=plan:pro`,
    );

    expect(recorder.lastListCall()?.propertyEquals).toEqual([{ path: 'plan', value: 'pro' }]);
  });

  it('rejects a filter naming an undeclared dimension', async () => {
    const res = await buildApp(
      recordingAggregates().aggregates,
      recordingEventsReads().eventsReads,
    ).request(`${metricEventsUrl}&filter=nope:1`);

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown metric', async () => {
    const unknownId = '00000000-0000-4000-8000-0000000000ff';
    const res = await buildApp(
      recordingAggregates().aggregates,
      recordingEventsReads().eventsReads,
    ).request(
      `/v1/projects/${projectId}/metrics/${unknownId}/events?from=2026-07-26T00:00:00.000Z&to=2026-07-26T02:00:00.000Z`,
    );

    expect(res.status).toBe(404);
  });

  it('rejects an unsupported pageSize', async () => {
    const res = await buildApp(
      recordingAggregates().aggregates,
      recordingEventsReads().eventsReads,
    ).request(`${metricEventsUrl}&pageSize=7`);

    expect(res.status).toBe(400);
  });
});
