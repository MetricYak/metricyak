import type { EventsProducer, MonitorSignalsProducer } from '@metricyak/queue';
import {
  AggregatesRepository,
  type Database,
  EventsRepository,
  FailedEventsRepository,
  MetricsRepository,
  MonitorRuntimeRepository,
  MonitorsRepository,
  OrganizationsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';
import { MetricMatcher } from '../modules/aggregates/engine/matcher.js';

export type Container = {
  readonly db: Database;
  readonly producer: EventsProducer;
  readonly signals: MonitorSignalsProducer;
  readonly projectKeys: ProjectKeysRepository;
  readonly events: EventsRepository;
  readonly failedEvents: FailedEventsRepository;
  readonly aggregates: AggregatesRepository;
  readonly matcher: MetricMatcher;
  readonly repositories: {
    readonly metrics: MetricsRepository;
    readonly monitors: MonitorsRepository;
    readonly monitorRuntime: MonitorRuntimeRepository;
    readonly organizations: OrganizationsRepository;
    readonly projects: ProjectsRepository;
  };
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
): Container {
  const metrics = new MetricsRepository(db);

  return {
    db,
    producer,
    signals,
    projectKeys: new ProjectKeysRepository(db),
    events: new EventsRepository(db),
    failedEvents: new FailedEventsRepository(db),
    aggregates: new AggregatesRepository(db),
    matcher: new MetricMatcher(metrics),
    repositories: {
      metrics,
      monitors: new MonitorsRepository(db),
      monitorRuntime: new MonitorRuntimeRepository(db),
      organizations: new OrganizationsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
