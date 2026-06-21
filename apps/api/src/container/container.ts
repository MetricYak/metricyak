import { type Database, MetricsRepository, ProjectsRepository } from '@metricyak/storage';

export type Container = {
  db: Database;
  repositories: {
    metrics: MetricsRepository;
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
      projects: new ProjectsRepository(db),
    },
  };
}
