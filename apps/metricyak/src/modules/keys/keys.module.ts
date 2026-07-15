import keysRouter from '@/modules/keys/keys.routes.js';
import type { AppModule } from '@/modules/module.js';

export const keysModule: AppModule = {
  routes: keysRouter,
};
