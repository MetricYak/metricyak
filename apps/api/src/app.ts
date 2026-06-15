import { logger } from 'hono/logger';
import { createRouter } from './http/router.js';
import health from './routes/health.js';
import v1Router from './routes/v1/index.js';

const app = createRouter();

app.use(logger());
app.route('/v1', v1Router);
app.route('/health', health);

export default app;
export type AppType = typeof app;
