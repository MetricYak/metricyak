import type { AppModule } from '../module.js';
import keysRouter from './keys.routes.js';

export const keysModule: AppModule = {
  routes: keysRouter,
};
