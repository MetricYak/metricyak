import { createClickHouseClient, migrate } from '@metricyak/clickhouse';
import type { MetricSummary } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
import {
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

    it('resolves a dot-separated dimension name as a nested JSON path', async () => {
      await client.insert({
        table: 'events',
        format: 'JSONEachRow',
        values: [
          {
            id: '00000000-0000-0000-0000-0000000000e1',
            project_id: PROJECT_ID,
            insert_id: 'n1',
            name: 'purchase',
            timestamp: '2026-01-01 00:00:00.000',
            properties: JSON.stringify({ geo: { country: 'US' }, amount: '10' }),
          },
          {
            id: '00000000-0000-0000-0000-0000000000e2',
            project_id: PROJECT_ID,
            insert_id: 'n2',
            name: 'purchase',
            timestamp: '2026-01-01 00:01:00.000',
            properties: JSON.stringify({ geo: { country: 'CA' }, amount: '5' }),
          },
        ],
      });
      const nestedMetric: MetricSummary = {
        ...metric,
        definition: { ...metric.definition, dimensions: ['geo.country'] },
      };

      const partials = await chWindowPartials(client, {
        metric: nestedMetric,
        projectId: PROJECT_ID,
        window,
      });

      const byDim = partials.filter((p) => p.dimName === 'geo.country');
      const byVal = Object.fromEntries(byDim.map((p) => [p.dimValue, p]));
      expect(byVal.US).toMatchObject({ count: 1, sum: 10 });
      expect(byVal.CA).toMatchObject({ count: 1, sum: 5 });
      expect(byVal.$other).toBeUndefined();
    });

    it('does not double-count a duplicate physical row before a background merge runs', async () => {
      // Mirrors the FINAL-dedup coverage that used to live on chRawBreakdown (deleted along
      // with the breakdown() endpoint) — eventPartials's queries carry the same FINAL
      // requirement, so the regression coverage moves here rather than being dropped.
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

      const partials = await chWindowPartials(client, { metric, projectId: PROJECT_ID, window });

      const totals = partials.filter((p) => p.dimName === TOTAL_SENTINEL);
      expect(totals[0]).toMatchObject({ count: 1, sum: 10 });
      const country = partials.filter((p) => p.dimName === 'country');
      const byVal = Object.fromEntries(country.map((p) => [p.dimValue, p]));
      expect(byVal.US).toMatchObject({ count: 1, sum: 10 });
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

    it('value() returns the $total scalar and a splitBy breakdown from ClickHouse', async () => {
      await seedPurchases();
      const reads = createMetricReads({ aggregates: createClickHouseReadsAggregates(client) });

      const res = await reads.value(metric, PROJECT_ID, window, 'country');

      expect(res.value).toBe(22);
      const byDim = Object.fromEntries((res.breakdown ?? []).map((b) => [b.dimValue, b.value]));
      expect(byDim).toMatchObject({ US: 15, CA: 7 });
    });
  });
});
