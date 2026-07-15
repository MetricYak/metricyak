import type { AppModule } from '@/modules/module.js';
import organizationsRouter from '@/modules/organizations/organizations.routes.js';

export const organizationsModule: AppModule = {
  routes: organizationsRouter,
};
