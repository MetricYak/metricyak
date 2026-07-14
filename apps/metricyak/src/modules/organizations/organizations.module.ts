import type { AppModule } from '../module.js';
import organizationsRouter from './organizations.routes.js';

export const organizationsModule: AppModule = {
  routes: organizationsRouter,
};
