import {
  type Database,
  MetricsRepository,
  MonitorsRepository,
  ProjectsRepository,
} from '@metricyak/storage';

export type Container = {
  db: Database;
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

export function createContainer(db: Database): Container {
  return {
    db,
    repositories: {
      metrics: new MetricsRepository(db),
      monitors: new MonitorsRepository(db),
      projects: new ProjectsRepository(db),
    },
  };
}
