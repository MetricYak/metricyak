import { createRouter } from '../../http/router.js';
import metricsRouter from './metrics/metrics.routes.js';
import monitorsRouter from './monitors/monitors.routes.js';

const v1Router = createRouter();

v1Router.route('/', metricsRouter);
v1Router.route('/', monitorsRouter);

export default v1Router;
