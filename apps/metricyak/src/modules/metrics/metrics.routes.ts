import { createRoute } from '@hono/zod-openapi';
import { errorResponse, NotFoundError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
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
    404: errorResponse('The project could not be found.'),
  },
});

const metricsRouter = createRouter();

metricsRouter.openapi(createMetricRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { name, description, definition } = c.req.valid('json');
  const { metrics, projects } = c.var.container.repositories;

  const project = await projects.get(projectId);
  if (!project) {
    throw new NotFoundError('The project could not be found');
  }

  const record = await metrics.create({ projectId, name, description, definition });

  const metric = CreateMetricResponse.parse({
    id: record.id,
    name: record.name,
    description: record.description,
    definition: record.definition,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
  return c.json(metric, 201);
});

export default metricsRouter;
