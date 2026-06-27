import type { AppModule } from './module.js';
import { eventsModule } from './events/events.module.js';
import { keysModule } from './keys/keys.module.js';
import { metricsModule } from './metrics/metrics.module.js';
import { monitorsModule } from './monitors/monitors.module.js';

/**
 * All registered feature modules. app.ts mounts their routes; startWorkers()
 * boots their workers. To add a new domain: create modules/<domain>/<domain>.module.ts
 * and add it here — no other boot code needs changing.
 *
 * Future: investigations, workflows, …
 */
export const modules: readonly AppModule[] = [
  eventsModule,
  keysModule,
  metricsModule,
  monitorsModule,
];
