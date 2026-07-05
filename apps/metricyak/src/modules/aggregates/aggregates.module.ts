import type { AppModule } from '../module.js';
import aggregatesRouter from './aggregates.routes.js';

export const aggregatesModule: AppModule = {
  routes: aggregatesRouter,
};
