import { createRoute } from '@hono/zod-openapi';
import { errorResponse, NotFoundError } from '../../../http/errors.js';
import { createRouter } from '../../../http/router.js';
import {
  CreateMonitorParams,
  CreateMonitorRequest,
  CreateMonitorResponse,
} from './monitors.schemas.js';

export const createMonitorRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/monitors',
  request: {
    params: CreateMonitorParams,
    body: {
      content: { 'application/json': { schema: CreateMonitorRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateMonitorResponse } },
      description: 'A monitor was successfully created.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project or metric could not be found.'),
  },
});

const monitorsRouter = createRouter();

monitorsRouter.openapi(createMonitorRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { name, description, metricId, scope, condition, window, holdFor, workflowId } =
    c.req.valid('json');
  const { monitors, metrics, projects } = c.var.container.repositories;

  const project = await projects.get(projectId);
  if (!project) {
    throw new NotFoundError('The project could not be found');
  }

  const metric = await metrics.get(metricId, projectId);
  if (!metric) {
    throw new NotFoundError('The metric could not be found');
  }

  const record = await monitors.create({
    projectId,
    metricId,
    name,
    description,
    scope,
    condition,
    window,
    holdFor,
    workflowId,
  });

  const monitor = CreateMonitorResponse.parse({
    monitorId: record.id,
    name: record.name,
    description: record.description,
    metricId: record.metricId,
    scope: record.scope,
    condition: record.condition,
    window: record.window,
    holdFor: record.holdFor,
    workflowId: record.workflowId,
    createdOn: record.createdAt.toISOString(),
  });

  return c.json(monitor, 201);
});

export default monitorsRouter;
