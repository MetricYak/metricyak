import { createRoute, type z } from '@hono/zod-openapi';
import type {
  MetricDefinition,
  MonitorComparisonOperator,
  MonitorRecord,
} from '@metricyak/storage';
import {
  ERROR_TYPES,
  errorItem,
  errorResponse,
  NotFoundError,
  ValidationError,
} from '../../http/errors.js';
import { respond } from '../../http/respond.js';
import { createRouter } from '../../http/router.js';
import { orNotFound, requireProject } from '../../http/scope.js';
import {
  CreateMonitorRequest,
  DeleteMonitorResponse,
  isEqualityOperator,
  ListMonitorsResponse,
  MonitorResponse,
  MonitorScopedParams,
  metricYieldsIntegerValues,
  ProjectScopedParams,
  UpdateMonitorRequest,
} from './monitors.schemas.js';

function toMonitorResponse(record: MonitorRecord): z.input<typeof MonitorResponse> {
  return {
    monitorId: record.id,
    name: record.name,
    description: record.description,
    metricId: record.metricId,
    scope: record.scope,
    condition: record.condition,
    window: record.window,
    holdFor: record.holdFor,
    enabled: record.enabled,
    missingData: record.missingData,
    createdOn: record.createdAt.toISOString(),
    updatedOn: record.updatedAt.toISOString(),
  };
}

function rejectEqualityOnFractionalMetric(
  operator: MonitorComparisonOperator,
  definition: MetricDefinition,
): void {
  if (isEqualityOperator(operator) && !metricYieldsIntegerValues(definition)) {
    throw new ValidationError([
      errorItem(
        ERROR_TYPES.validation,
        'unsupported_operator',
        'The eq and neq operators require a metric that produces whole numbers.',
        'condition.operator',
      ),
    ]);
  }
}

export const createMonitorRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/monitors',
  request: {
    params: ProjectScopedParams,
    body: {
      content: { 'application/json': { schema: CreateMonitorRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: MonitorResponse } },
      description: 'A monitor was successfully created.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project or metric could not be found.'),
  },
});

export const listMonitorsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/monitors',
  request: {
    params: ProjectScopedParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListMonitorsResponse } },
      description: 'Monitors for the project.',
    },
    404: errorResponse('The project could not be found.'),
  },
});

export const getMonitorRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/monitors/{monitorId}',
  request: {
    params: MonitorScopedParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MonitorResponse } },
      description: 'The requested monitor.',
    },
    404: errorResponse('The project or monitor could not be found.'),
  },
});

export const updateMonitorRoute = createRoute({
  method: 'patch',
  path: '/projects/{projectId}/monitors/{monitorId}',
  request: {
    params: MonitorScopedParams,
    body: {
      content: { 'application/json': { schema: UpdateMonitorRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: MonitorResponse } },
      description: 'The monitor was updated.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project, monitor, or metric could not be found.'),
  },
});

export const deleteMonitorRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/monitors/{monitorId}',
  request: {
    params: MonitorScopedParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteMonitorResponse } },
      description: 'The monitor was deleted.',
    },
    404: errorResponse('The project or monitor could not be found.'),
  },
});

const monitorsRouter = createRouter();

monitorsRouter.openapi(createMonitorRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { name, description, metricId, scope, condition, window, holdFor, enabled, missingData } =
    c.req.valid('json');
  const { monitors, metrics, projects } = c.var.container.repos;

  await requireProject(projects, projectId);
  const metric = orNotFound(
    await metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  rejectEqualityOnFractionalMetric(condition.operator, metric.definition);

  const record = await monitors.create({
    projectId,
    metricId,
    name,
    description,
    scope,
    condition,
    window,
    holdFor,
    enabled,
    missingData,
  });

  return respond(c, MonitorResponse, toMonitorResponse(record), 201);
});

monitorsRouter.openapi(listMonitorsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { monitors, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const records = await monitors.list(projectId);

  return respond(c, ListMonitorsResponse, records.map(toMonitorResponse), 200);
});

monitorsRouter.openapi(getMonitorRoute, async (c) => {
  const { projectId, monitorId } = c.req.valid('param');
  const { monitors, projects } = c.var.container.repos;

  await requireProject(projects, projectId);
  const record = orNotFound(
    await monitors.get(monitorId, projectId),
    'The monitor could not be found.',
  );

  return respond(c, MonitorResponse, toMonitorResponse(record), 200);
});

monitorsRouter.openapi(updateMonitorRoute, async (c) => {
  const { projectId, monitorId } = c.req.valid('param');
  const input = c.req.valid('json');
  const { monitors, metrics, projects } = c.var.container.repos;

  await requireProject(projects, projectId);
  const existing = orNotFound(
    await monitors.get(monitorId, projectId),
    'The monitor could not be found.',
  );

  const watchedMetricId = input.metricId ?? existing.metricId;
  if (input.metricId !== undefined || input.condition !== undefined) {
    const metric = orNotFound(
      await metrics.getDefinition(watchedMetricId, projectId),
      'The metric could not be found.',
    );
    const operator = input.condition?.operator ?? existing.condition.operator;
    rejectEqualityOnFractionalMetric(operator, metric.definition);
  }

  const record = orNotFound(
    await monitors.update(monitorId, projectId, {
      metricId: input.metricId,
      name: input.name,
      description: input.description,
      scope: input.scope,
      condition: input.condition,
      window: input.window,
      holdFor: input.holdFor,
      enabled: input.enabled,
      missingData: input.missingData,
    }),
    'The monitor could not be found.',
  );

  return respond(c, MonitorResponse, toMonitorResponse(record), 200);
});

monitorsRouter.openapi(deleteMonitorRoute, async (c) => {
  const { projectId, monitorId } = c.req.valid('param');
  const { monitors, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const deleted = await monitors.delete(monitorId, projectId);
  if (!deleted) {
    throw new NotFoundError('The monitor could not be found.');
  }

  return respond(c, DeleteMonitorResponse, { deleted: true }, 200);
});

export default monitorsRouter;
