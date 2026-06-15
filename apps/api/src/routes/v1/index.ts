import { createRouter } from '../../http/router.js';
import metricsRouter from './metrics/metrics.routes.js';

const v1Router = createRouter();

v1Router.route('/', metricsRouter);

export default v1Router;
