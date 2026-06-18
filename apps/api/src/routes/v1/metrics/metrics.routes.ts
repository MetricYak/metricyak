import { randomUUID } from 'node:crypto';
import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '../../../http/errors.js';
import { createRouter } from '../../../http/router.js';
import {
  CreateMetricParams,
  CreateMetricRequest,
  CreateMetricResponse,
} from './metrics.schemas.js';

export const createMetricRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/metrics',
  request: {
    params: CreateMetricParams,
    body: {
      content: { 'application/json': { schema: CreateMetricRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateMetricResponse } },
      description: 'A metric was successfully created.',
    },
    400: errorResponse('The request failed validation.'),
  },
});

const metricsRouter = createRouter();

metricsRouter.openapi(createMetricRoute, (c) => {
  const { name, description, definition } = c.req.valid('json');
  const now = new Date().toISOString();
  const metric = CreateMetricResponse.parse({
    id: randomUUID(),
    name,
    description,
    definition,
    createdAt: now,
    updatedAt: now,
  });
  return c.json(metric, 201);
});

export default metricsRouter;
