import { randomUUID } from 'node:crypto';
import { createRoute } from '@hono/zod-openapi';
import { computeBatchId } from '@metricyak/queue';
import { errorResponse, UnauthorizedError } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { requireProject } from '@/http/scope.js';
import { dropDuplicateInsertIds } from '@/modules/events/events.dedup.js';
import {
  IngestRequest,
  IngestResponse,
  ListEventsParams,
  ListEventsQuery,
  ListEventsResponse,
} from '@/modules/events/events.schemas.js';

export const ingestRoute = createRoute({
  method: 'post',
  path: '/ingest',
  request: {
    body: {
      content: { 'application/json': { schema: IngestRequest } },
      required: true,
    },
  },
  responses: {
    202: {
      content: { 'application/json': { schema: IngestResponse } },
      description: 'Events accepted.',
    },
    400: errorResponse('The request failed validation.'),
    401: errorResponse('You are not allowed to perform this action.'),
  },
});

const eventsRouter = createRouter();

eventsRouter.openapi(ingestRoute, async (c) => {
  const { project_key, events } = c.req.valid('json');
  const { producer, repos } = c.var.container;

  const keyRecord = await repos.projectKeys.findActiveByKey(project_key);
  if (!keyRecord) {
    throw new UnauthorizedError('You are not allowed to perform this action.');
  }

  const eventList = Array.isArray(events) ? events : [events];
  const now = new Date().toISOString();

  const storedEvents = dropDuplicateInsertIds(
    eventList.map((e) => ({
      id: randomUUID(),
      insertId: e.insert_id ?? null,
      name: e.name,
      timestamp: e.timestamp ?? now,
      properties: e.properties ?? {},
    })),
  );

  await producer.enqueue({
    projectId: keyRecord.projectId,
    batchId: computeBatchId(storedEvents.map((e) => e.id)),
    events: storedEvents,
  });

  return c.json({ accepted: storedEvents.length }, 202);
});

export const listEventsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/events',
  request: { params: ListEventsParams, query: ListEventsQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: ListEventsResponse } },
      description: 'A page of events for the project.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

eventsRouter.openapi(listEventsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { from, to, sort, page, pageSize } = c.req.valid('query');
  const { repos, eventsReads } = c.var.container;

  await requireProject(repos.projects, projectId);

  const result = await eventsReads.listPage({
    projectId,
    from: from ? new Date(from) : null,
    to: to ? new Date(to) : null,
    sort,
    page,
    pageSize,
  });

  return respond(c, ListEventsResponse, result, 200);
});

export default eventsRouter;
