import aggregatesRouter from '@/modules/aggregates/aggregates.routes.js';
import type { AppModule } from '@/modules/module.js';

export const aggregatesModule: AppModule = {
  routes: aggregatesRouter,
};
