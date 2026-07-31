import type { AppModule } from '@/modules/module.js';
import signalsRouter from '@/modules/signals/signals.routes.js';

export const signalsModule: AppModule = {
  routes: signalsRouter,
};
