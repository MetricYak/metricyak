import { createClickHouseClient, migrate } from '@metricyak/clickhouse';
import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import {
  chRawBreakdown,
  chWindowPartials,
  createClickHouseReadsAggregates,
} from '@/modules/aggregates/clickhouse-reads.js';
import { windowValues } from '@/modules/aggregates/engine/materialize.js';

const PROJECT_ID = '00000000-0000-0000-0000-0000000000aa';

describe('clickhouse-reads (integration)', () => {
  let container: StartedTestContainer;
  let client: ReturnType<typeof createClickHouseClient>;

  beforeAll(async () => {
    container = await new GenericContainer('clickhouse/clickhouse-server:24.8')
      .withExposedPorts(8123)
      .withEnvironment({
        CLICKHOUSE_USER: 'test',
        CLICKHOUSE_PASSWORD: 'test',
        CLICKHOUSE_DB: 'test',
      })
      .withWaitStrategy(Wait.forHttp('/ping', 8123))
      .start();
    const url = `http://test:test@${container.getHost()}:${container.getMappedPort(8123)}/test`;
    client = createClickHouseClient(url);
    await migrate(client);
  }, 120_000);

  afterAll(async () => {
    await client?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await client.command({ query: 'TRUNCATE TABLE events' });
  });

  async function seedPurchases(): Promise<void> {
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [
        {
          id: '00000000-0000-0000-0000-0000000000b1',
          project_id: PROJECT_ID,
          insert_id: 'e1',
          name: 'purchase',
          timestamp: '2026-01-01 00:00:00.000',
          properties: JSON.stringify({ country: 'US', amount: '10' }),
        },
        {
          id: '00000000-0000-0000-0000-0000000000b2',
          project_id: PROJECT_ID,
          insert_id: 'e2',
          name: 'purchase',
          timestamp: '2026-01-01 00:01:00.000',
          properties: JSON.stringify({ country: 'US', amount: '5' }),
        },
        {
          id: '00000000-0000-0000-0000-0000000000b3',
          project_id: PROJECT_ID,
          insert_id: 'e3',
          name: 'purchase',
          timestamp: '2026-01-01 00:02:00.000',
          properties: JSON.stringify({ country: 'CA', amount: '7' }),
        },
        {
          id: '00000000-0000-0000-0000-0000000000b4',
          project_id: PROJECT_ID,
          insert_id: 'e4',
          name: 'purchase',
          timestamp: '2026-01-01 00:03:00.000',
          properties: JSON.stringify({ country: 'US', amount: 'n/a' }),
        },
      ],
    });
  }

  it('rawBreakdown groups by a property dimension and extracts numeric values as NULL-safe', async () => {
    await seedPurchases();

    const rows = await chRawBreakdown(client, {
      projectId: PROJECT_ID,
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });

    const byDim = Object.fromEntries(rows.map((r) => [r.dimValue, r]));
    expect(byDim.US).toMatchObject({ count: 3, sum: 15, min: 5, max: 10 }); // 'n/a' ignored in sum/min/max
    expect(byDim.CA).toMatchObject({ count: 1, sum: 7, min: 7, max: 7 });
  });

  it('falls back to $other when the dimension key is absent from properties', async () => {
    await client.insert({
      table: 'events',
      format: 'JSONEachRow',
      values: [
        {
          id: '00000000-0000-0000-0000-0000000000c1',
          project_id: PROJECT_ID,
          insert_id: 'e5',
          name: 'purchase',
          timestamp: '2026-01-01 00:00:00.000',
          properties: JSON.stringify({ amount: '9' }),
        },
      ],
    });

    const rows = await chRawBreakdown(client, {
      projectId: PROJECT_ID,
      eventNames: ['purchase'],
      dimField: 'country',
      valuePath: ['amount'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-02T00:00:00Z'),
    });

    expect(rows).toEqual([{ dimValue: '$other', count: 1, sum: 9, min: 9, max: 9 }]);
  });

  describe('FINAL deduplication', () => {
    it('does not double-count a duplicate physical row for the same (project_id, insert_id) before a background merge runs', async () => {
      // Simulates an at-least-once Kafka delivery where the ingestion MV's insert was retried,
      // producing two physical rows for one logical event. ReplacingMergeTree only dedups these
      // at background-merge time, so without `FINAL` in the read query this would double-count.
      //
      // `insert_deduplicate: 0` disables ClickHouse's separate insert-block dedup
      // (`non_replicated_deduplication_window`, set on the `events` table), which would otherwise
      // silently absorb a byte-identical duplicate block before it ever became two physical rows.
      // That block-level dedup is a best-effort safety net, not the mechanism this system relies
      // on for correctness — per the design comment in packages/clickhouse/src/kafka-ingestion.ts,
      // "idempotency is handled downstream by the `events` ReplacingMergeTree deduplicating on
      // (project_id, insert_id)". Disabling it here reproduces the real failure mode: two active
      // parts, each holding one physical row, un-merged.
      const duplicateRow = {
        id: '00000000-0000-0000-0000-0000000000d1',
        project_id: PROJECT_ID,
        insert_id: 'dup-1',
        name: 'purchase',
        timestamp: '2026-01-01 00:00:00.000',
        properties: JSON.stringify({ country: 'US', amount: '10' }),
      };
      await client.insert({
        table: 'events',
        format: 'JSONEachRow',
        values: [duplicateRow],
        clickhouse_settings: { insert_deduplicate: 0 },
      });
      await client.insert({
        table: 'events',
        format: 'JSONEachRow',
        values: [duplicateRow],
        clickhouse_settings: { insert_deduplicate: 0 },
      });

      const rows = await chRawBreakdown(client, {
        projectId: PROJECT_ID,
        eventNames: ['purchase'],
        dimField: 'country',
        valuePath: ['amount'],
        from: new Date('2026-01-01T00:00:00Z'),
        to: new Date('2026-01-02T00:00:00Z'),
      });

      const byDim = Object.fromEntries(rows.map((r) => [r.dimValue, r]));
      expect(byDim.US).toMatchObject({ count: 1, sum: 10, min: 10, max: 10 });
    });
  });

  describe('chWindowPartials', () => {
    const metric: MetricSummary = {
      metricId: 'metric-1',
      version: 1,
      name: 'Purchases',
      definition: {
        events: [
          {
            key: 'purchases',
            source: 'web',
            type: 'purchase',
            aggregation: 'sum',
            field: '$properties.amount',
          },
        ],
        dimensions: ['country'],
      },
    };
    const window = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-02T00:00:00Z') };

    async function seedPurchases(): Promise<void> {
      await client.insert({
        table: 'events',
        format: 'JSONEachRow',
        values: [
          {
            id: '00000000-0000-0000-0000-0000000000b1',
            project_id: PROJECT_ID,
            insert_id: 'e1',
            name: 'purchase',
            timestamp: '2026-01-01 00:00:00.000',
            properties: JSON.stringify({ country: 'US', amount: '10' }),
          },
          {
            id: '00000000-0000-0000-0000-0000000000b2',
            project_id: PROJECT_ID,
            insert_id: 'e2',
            name: 'purchase',
            timestamp: '2026-01-01 00:01:00.000',
            properties: JSON.stringify({ country: 'US', amount: '5' }),
          },
          {
            id: '00000000-0000-0000-0000-0000000000b3',
            project_id: PROJECT_ID,
            insert_id: 'e3',
            name: 'purchase',
            timestamp: '2026-01-01 00:02:00.000',
            properties: JSON.stringify({ country: 'CA', amount: '7' }),
          },
          {
            id: '00000000-0000-0000-0000-0000000000b4',
            project_id: PROJECT_ID,
            insert_id: 'e4',
            name: 'purchase',
            timestamp: '2026-01-01 00:03:00.000',
            properties: JSON.stringify({ country: 'US', amount: 'n/a' }),
          },
        ],
      });
    }

    it('emits a $total row and per-declared-dimension rows per event key', async () => {
      await seedPurchases();

      const partials = await chWindowPartials(client, { metric, projectId: PROJECT_ID, window });

      const totals = partials.filter((p) => p.dimName === TOTAL_SENTINEL);
      expect(totals).toHaveLength(1);
      expect(totals[0]).toMatchObject({
        seriesKey: 'purchases',
        dimValue: TOTAL_SENTINEL,
        count: 4,
        sum: 22,
      }); // 'n/a' ignored
      const country = partials.filter((p) => p.dimName === 'country');
      const byVal = Object.fromEntries(country.map((p) => [p.dimValue, p]));
      expect(byVal.US).toMatchObject({ seriesKey: 'purchases', count: 3, sum: 15 });
      expect(byVal.CA).toMatchObject({ seriesKey: 'purchases', count: 1, sum: 7 });
    });

    it('feeds windowValues to produce the correct sum scalar', async () => {
      await seedPurchases();

      const partials = await chWindowPartials(client, { metric, projectId: PROJECT_ID, window });
      const total = windowValues(metric.definition, partials).find(
        (v) => v.dimName === TOTAL_SENTINEL,
      );

      expect(total?.value).toBe(22);
    });
  });

  describe('createClickHouseReadsAggregates', () => {
    const metric: MetricSummary = {
      metricId: 'metric-1',
      version: 1,
      name: 'Purchases',
      definition: {
        events: [
          {
            key: 'purchases',
            source: 'web',
            type: 'purchase',
            aggregation: 'sum',
            field: '$properties.amount',
          },
        ],
        dimensions: ['country'],
      },
    };
    const window = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-01-02T00:00:00Z') };
    const emptyWindow = {
      from: new Date('2025-01-01T00:00:00Z'),
      to: new Date('2025-01-02T00:00:00Z'),
    };

    it('value() returns the $total scalar and a splitBy breakdown from ClickHouse', async () => {
      await seedPurchases();
      const reads = createMetricReads({ aggregates: createClickHouseReadsAggregates(client) });

      const res = await reads.value(metric, PROJECT_ID, window, 'country');

      expect(res.value).toBe(22);
      const byDim = Object.fromEntries((res.breakdown ?? []).map((b) => [b.dimValue, b.value]));
      expect(byDim).toMatchObject({ US: 15, CA: 7 });
    });

    it('breakdown() ranks movers over an undeclared dimension via rawBreakdown', async () => {
      await seedPurchases();
      const undeclared: MetricSummary = {
        ...metric,
        definition: { ...metric.definition, dimensions: [] },
      };
      const reads = createMetricReads({ aggregates: createClickHouseReadsAggregates(client) });

      const res = await reads.breakdown(
        undeclared,
        PROJECT_ID,
        { current: window, compare: emptyWindow },
        'country',
        10,
      );

      expect(res.kind).toBe('movers');
    });
  });
});
