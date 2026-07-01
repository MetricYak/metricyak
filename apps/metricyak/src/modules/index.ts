import { eventsModule } from './events/events.module.js';
import { keysModule } from './keys/keys.module.js';
import { metricsModule } from './metrics/metrics.module.js';
import type { AppModule } from './module.js';
import { monitorsModule } from './monitors/monitors.module.js';
import { projectsModule } from './projects/projects.module.js';

export const modules: readonly AppModule[] = [
  eventsModule,
  keysModule,
  metricsModule,
  monitorsModule,
  projectsModule,
];
