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
import { MetricMatcher } from '../modules/aggregates/engine/matcher.js';

export type Container = {
  readonly db: Database;
  readonly producer: EventsProducer;
  readonly projectKeys: ProjectKeysRepository;
  readonly events: EventsRepository;
  readonly failedEvents: FailedEventsRepository;
  readonly aggregates: AggregatesRepository;
  readonly matcher: MetricMatcher;
  readonly repositories: {
    readonly metrics: MetricsRepository;
    readonly monitors: MonitorsRepository;
    readonly organizations: OrganizationsRepository;
    readonly projects: ProjectsRepository;
  };
};

export type AppEnv = {
  Variables: {
    container: Container;
  };
};

export function createContainer(db: Database, producer: EventsProducer): Container {
  const metrics = new MetricsRepository(db);

  return {
    db,
    producer,
    projectKeys: new ProjectKeysRepository(db),
    events: new EventsRepository(db),
    failedEvents: new FailedEventsRepository(db),
    aggregates: new AggregatesRepository(db),
    matcher: new MetricMatcher(metrics),
    repositories: {
      metrics,
      monitors: new MonitorsRepository(db),
      organizations: new OrganizationsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
