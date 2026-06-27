import type { EventsProducer } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';

export type Container = {
  db: Database;
  producer: EventsProducer;
  projectKeys: ProjectKeysRepository;
  repositories: {
    metrics: MetricsRepository;
    monitors: MonitorsRepository;
    projects: ProjectsRepository;
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
    repositories: {
      metrics: new MetricsRepository(db),
      monitors: new MonitorsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
