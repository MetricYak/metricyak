import { type Database, MetricsRepository } from '@metricyak/storage';

export type Container = {
  db: Database;
  repositories: {
    metrics: MetricsRepository;
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
    },
  };
}
