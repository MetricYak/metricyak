import type { AppModule } from '@/modules/module.js';
import projectsRouter from '@/modules/projects/projects.routes.js';

export const projectsModule: AppModule = {
  routes: projectsRouter,
};
