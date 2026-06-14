import { Hono } from 'hono';
import { logger } from 'hono/logger';
import health from './routes/health.js';

const app = new Hono();

app.use(logger());

app.route('/health', health);

export default app;
export type AppType = typeof app;
