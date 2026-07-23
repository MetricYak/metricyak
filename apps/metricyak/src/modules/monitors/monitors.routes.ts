import { createRoute } from '@hono/zod-openapi';
import type { MetricDefinition, MonitorComparisonOperator } from '@metricyak/storage';
import {
  ERROR_TYPES,
  errorItem,
  errorResponse,
  NotFoundError,
  ValidationError,
} from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { orNotFound, requireProject } from '@/http/scope.js';
import {
  CreateMonitorRequest,
  DeleteMonitorResponse,
  isEqualityOperator,
  ListMonitorsQuery,
  ListMonitorsResponse,
  MonitorResponse,
  MonitorScopedParams,
  metricYieldsIntegerValues,
  ProjectScopedParams,
  toMonitorResponse,
  UpdateMonitorRequest,
} from '@/modules/monitors/monitors.schemas.js';

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
    query: ListMonitorsQuery,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListMonitorsResponse } },
      description: 'A page of monitors for the project.',
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
  const { monitors, monitorEventKeys, metrics, projects } = c.var.container.repos;

  await requireProject(projects, projectId);
  const metric = orNotFound(
    await metrics.getDefinition(metricId, projectId),
    'The metric could not be found.',
  );

  rejectEqualityOnFractionalMetric(condition.operator, metric.definition);

  const eventNames = metric.definition.events.map((event) => event.type);
  const record = await c.var.container.db.transaction(async (tx) => {
    const created = await monitors.create(
      {
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
      },
      tx,
    );
    await monitorEventKeys.sync(created.id, projectId, eventNames, tx);
    return created;
  });

  await c.var.container.dirty.addMonitoredKeys(
    eventNames.map((eventName) => ({ projectId, eventName })),
  );

  return respond(c, MonitorResponse, toMonitorResponse(record, null), 201);
});

monitorsRouter.openapi(listMonitorsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { page, pageSize, q, status } = c.req.valid('query');
  const { monitors, projects, monitorRuntime } = c.var.container.repos;

  await requireProject(projects, projectId);

  const { monitors: records, hasMore } = await monitors.listPage(projectId, {
    page,
    pageSize,
    q,
    status,
  });
  const stateMap = await monitorRuntime.getTotalStateByMonitorIds(records.map((r) => r.id));

  return respond(
    c,
    ListMonitorsResponse,
    {
      monitors: records.map((r) => toMonitorResponse(r, stateMap.get(r.id) ?? null)),
      hasMore,
    },
    200,
  );
});

monitorsRouter.openapi(getMonitorRoute, async (c) => {
  const { projectId, monitorId } = c.req.valid('param');
  const { monitors, projects, monitorRuntime } = c.var.container.repos;

  await requireProject(projects, projectId);
  const record = orNotFound(
    await monitors.get(monitorId, projectId),
    'The monitor could not be found.',
  );

  const stateMap = await monitorRuntime.getTotalStateByMonitorIds([record.id]);

  return respond(
    c,
    MonitorResponse,
    toMonitorResponse(record, stateMap.get(record.id) ?? null),
    200,
  );
});

monitorsRouter.openapi(updateMonitorRoute, async (c) => {
  const { projectId, monitorId } = c.req.valid('param');
  const input = c.req.valid('json');
  const { monitors, monitorEventKeys, metrics, projects, monitorRuntime } = c.var.container.repos;

  await requireProject(projects, projectId);
  const existing = orNotFound(
    await monitors.get(monitorId, projectId),
    'The monitor could not be found.',
  );

  const watchedMetricId = input.metricId ?? existing.metricId;
  const watchedMetric = orNotFound(
    await metrics.getDefinition(watchedMetricId, projectId),
    'The metric could not be found.',
  );
  if (input.metricId !== undefined || input.condition !== undefined) {
    const operator = input.condition?.operator ?? existing.condition.operator;
    rejectEqualityOnFractionalMetric(operator, watchedMetric.definition);
  }
  const eventNames = watchedMetric.definition.events.map((event) => event.type);

  const record = orNotFound(
    await c.var.container.db.transaction(async (tx) => {
      const updated = await monitors.update(
        monitorId,
        projectId,
        {
          metricId: input.metricId,
          name: input.name,
          description: input.description,
          scope: input.scope,
          condition: input.condition,
          window: input.window,
          holdFor: input.holdFor,
          enabled: input.enabled,
          missingData: input.missingData,
        },
        tx,
      );

      if (updated) {
        await monitorEventKeys.sync(updated.id, projectId, eventNames, tx);
      }

      return updated;
    }),
    'The monitor could not be found.',
  );

  await c.var.container.dirty.addMonitoredKeys(
    eventNames.map((eventName) => ({ projectId, eventName })),
  );

  const stateMap = await monitorRuntime.getTotalStateByMonitorIds([record.id]);

  return respond(
    c,
    MonitorResponse,
    toMonitorResponse(record, stateMap.get(record.id) ?? null),
    200,
  );
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
