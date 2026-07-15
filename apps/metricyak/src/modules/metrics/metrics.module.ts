import metricsRouter from '@/modules/metrics/metrics.routes.js';
import type { AppModule } from '@/modules/module.js';

export const metricsModule: AppModule = {
  routes: metricsRouter,
};
