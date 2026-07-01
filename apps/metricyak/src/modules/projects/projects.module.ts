import type { AppModule } from '../module.js';
import projectsRouter from './projects.routes.js';

export const projectsModule: AppModule = {
  routes: projectsRouter,
};
