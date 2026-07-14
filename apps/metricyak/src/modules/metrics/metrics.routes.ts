import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '../../http/errors.js';
import { respond } from '../../http/respond.js';
import { createRouter } from '../../http/router.js';
import { requireProject } from '../../http/scope.js';
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
  const { metrics, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const record = await metrics.create({ projectId, name, description, definition });

  return respond(
    c,
    CreateMetricResponse,
    {
      id: record.id,
      name: record.name,
      description: record.description,
      definition: record.definition,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
    201,
  );
});

export default metricsRouter;
