import { aggregatesModule } from './aggregates/aggregates.module.js';
import { eventsModule } from './events/events.module.js';
import { keysModule } from './keys/keys.module.js';
import { metricsModule } from './metrics/metrics.module.js';
import type { AppModule } from './module.js';
import { monitorsModule } from './monitors/monitors.module.js';
import { organizationsModule } from './organizations/organizations.module.js';
import { projectsModule } from './projects/projects.module.js';

export const modules: readonly AppModule[] = [
  aggregatesModule,
  eventsModule,
  keysModule,
  metricsModule,
  monitorsModule,
  organizationsModule,
  projectsModule,
];
