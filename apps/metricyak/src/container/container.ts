import type { EventsProducer } from '@metricyak/queue';
import {
  type Database,
  EventsRepository,
  FailedEventsRepository,
  MetricsRepository,
  MonitorsRepository,
  OrganizationsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';

export type Container = {
  readonly db: Database;
  readonly producer: EventsProducer;
  readonly projectKeys: ProjectKeysRepository;
  readonly events: EventsRepository;
  readonly failedEvents: FailedEventsRepository;
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
  return {
    db,
    producer,
    projectKeys: new ProjectKeysRepository(db),
    events: new EventsRepository(db),
    failedEvents: new FailedEventsRepository(db),
    repositories: {
      metrics: new MetricsRepository(db),
      monitors: new MonitorsRepository(db),
      organizations: new OrganizationsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
