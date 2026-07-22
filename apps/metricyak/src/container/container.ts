import type { ClickHouseClient } from '@metricyak/clickhouse';
import type { EventsProducer, MonitorEvalProducer, MonitorSignalsProducer } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorEventKeysRepository,
  MonitorRuntimeRepository,
  MonitorsRepository,
  OrganizationsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';
import { createMetricReads, type MetricReads } from '@/modules/aggregates/aggregates.reads.js';
import { createClickHouseReadsAggregates } from '@/modules/aggregates/clickhouse-reads.js';
import { createClickHouseEventsReads, type EventsReads } from '@/modules/events/events-reads.js';

export type Repositories = {
  readonly projectKeys: ProjectKeysRepository;
  readonly metrics: MetricsRepository;
  readonly monitors: MonitorsRepository;
  readonly monitorEventKeys: MonitorEventKeysRepository;
  readonly monitorRuntime: MonitorRuntimeRepository;
  readonly organizations: OrganizationsRepository;
  readonly projects: ProjectsRepository;
};

export type Container = {
  readonly db: Database;
  readonly producer: EventsProducer;
  readonly signals: MonitorSignalsProducer;
  readonly evalProducer: MonitorEvalProducer;
  readonly repos: Repositories;
  readonly reads: MetricReads;
  readonly eventsReads: EventsReads;
  readonly clickhouse: ClickHouseClient;
};

export type AppEnv = {
  Variables: {
    container: Container;
  };
};

export function createContainer(
  db: Database,
  producer: EventsProducer,
  signals: MonitorSignalsProducer,
  evalProducer: MonitorEvalProducer,
  clickhouse: ClickHouseClient,
): Container {
  const metrics = new MetricsRepository(db);

  const repos: Repositories = {
    projectKeys: new ProjectKeysRepository(db),
    metrics,
    monitors: new MonitorsRepository(db),
    monitorEventKeys: new MonitorEventKeysRepository(db),
    monitorRuntime: new MonitorRuntimeRepository(db),
    organizations: new OrganizationsRepository(db),
    projects: new ProjectsRepository(db),
  };

  const reads = createMetricReads({ aggregates: createClickHouseReadsAggregates(clickhouse) });
  const eventsReads = createClickHouseEventsReads(clickhouse);

  return { db, producer, signals, evalProducer, repos, reads, eventsReads, clickhouse };
}
