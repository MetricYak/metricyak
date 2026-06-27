import type { AppModule } from '../module.js';
import metricsRouter from './metrics.routes.js';

export const metricsModule: AppModule = {
  routes: metricsRouter,
};
