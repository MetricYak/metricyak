import type { EventsProducer } from '@metricyak/queue';
import {
  AggregatesRepository,
  type Database,
  EventsRepository,
  FailedEventsRepository,
  MetricsRepository,
  MonitorsRepository,
  OrganizationsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';
import { createMetricReads, type MetricReads } from '../modules/aggregates/aggregates.reads.js';
import { MetricMatcher } from '../modules/aggregates/engine/matcher.js';
import {
  createIngestPipeline,
  type IngestPipeline,
  type RunInTransaction,
} from '../modules/events/events.ingest.js';

export type Repositories = {
  readonly projectKeys: ProjectKeysRepository;
  readonly events: EventsRepository;
  readonly failedEvents: FailedEventsRepository;
  readonly aggregates: AggregatesRepository;
  readonly metrics: MetricsRepository;
  readonly monitors: MonitorsRepository;
  readonly organizations: OrganizationsRepository;
  readonly projects: ProjectsRepository;
};

export type Container = {
  readonly db: Database;
  readonly producer: EventsProducer;
  readonly matcher: MetricMatcher;
  readonly runInTransaction: RunInTransaction;
  readonly repos: Repositories;
  readonly ingest: IngestPipeline;
  readonly reads: MetricReads;
};

export type AppEnv = {
  Variables: {
    container: Container;
  };
};

export function createContainer(db: Database, producer: EventsProducer): Container {
  const metrics = new MetricsRepository(db);
  const events = new EventsRepository(db);
  const aggregates = new AggregatesRepository(db);
  const matcher = new MetricMatcher(metrics);
  const runInTransaction: RunInTransaction = (fn) => db.transaction(fn);

  const repos: Repositories = {
    projectKeys: new ProjectKeysRepository(db),
    events,
    failedEvents: new FailedEventsRepository(db),
    aggregates,
    metrics,
    monitors: new MonitorsRepository(db),
    organizations: new OrganizationsRepository(db),
    projects: new ProjectsRepository(db),
  };

  const ingest = createIngestPipeline({ events, aggregates, matcher, runInTransaction });
  const reads = createMetricReads({ aggregates });

  return { db, producer, matcher, runInTransaction, repos, ingest, reads };
}
