import { aggregatesModule } from '@/modules/aggregates/aggregates.module.js';
import { eventsModule } from '@/modules/events/events.module.js';
import { keysModule } from '@/modules/keys/keys.module.js';
import { metricsModule } from '@/modules/metrics/metrics.module.js';
import type { AppModule } from '@/modules/module.js';
import { monitorsModule } from '@/modules/monitors/monitors.module.js';
import { organizationsModule } from '@/modules/organizations/organizations.module.js';
import { projectsModule } from '@/modules/projects/projects.module.js';

export const modules: readonly AppModule[] = [
  aggregatesModule,
  eventsModule,
  keysModule,
  metricsModule,
  monitorsModule,
  organizationsModule,
  projectsModule,
];
