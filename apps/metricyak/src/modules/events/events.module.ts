import eventsRouter from '@/modules/events/events.routes.js';
import type { AppModule } from '@/modules/module.js';

export const eventsModule: AppModule = {
  routes: eventsRouter,
};
