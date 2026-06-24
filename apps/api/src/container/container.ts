import type { EventPublisher } from '@metricyak/queue';
import {
  type Database,
  MetricsRepository,
  MonitorsRepository,
  ProjectKeysRepository,
  ProjectsRepository,
} from '@metricyak/storage';

export type Container = {
  db: Database;
  publisher: EventPublisher;
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

export function createContainer(db: Database, publisher: EventPublisher): Container {
  return {
    db,
    publisher,
    projectKeys: new ProjectKeysRepository(db),
    repositories: {
      metrics: new MetricsRepository(db),
      monitors: new MonitorsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
