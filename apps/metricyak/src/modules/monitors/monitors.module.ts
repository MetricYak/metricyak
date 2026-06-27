import type { AppModule } from '../module.js';
import monitorsRouter from './monitors.routes.js';

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
};
