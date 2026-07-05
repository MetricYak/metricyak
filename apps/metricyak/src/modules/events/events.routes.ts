import { randomUUID } from 'node:crypto';
import { createRoute } from '@hono/zod-openapi';
import { computeBatchId } from '@metricyak/queue';
import { errorResponse, UnauthorizedError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  EventsListResponse,
  EventsParams,
  EventsQuery,
  IngestRequest,
  IngestResponse,
} from './events.schemas.js';

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

const listEventsRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/events',
  request: { params: EventsParams, query: EventsQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: EventsListResponse } },
      description: 'A page of events for the project.',
    },
  },
});

const eventsRouter = createRouter();

eventsRouter.openapi(ingestRoute, async (c) => {
  const { project_key, events } = c.req.valid('json');
  const { projectKeys, producer } = c.var.container;

  const keyRecord = await projectKeys.findActiveByKey(project_key);
  if (!keyRecord) {
    throw new UnauthorizedError('You are not allowed to perform this action.');
  }

  const eventList = Array.isArray(events) ? events : [events];
  const now = new Date().toISOString();

  const storedEvents = eventList.map((e) => ({
    id: randomUUID(),
    name: e.name,
    source: e.source,
    timestamp: e.timestamp ?? now,
    properties: e.properties ?? {},
  }));

  await producer.enqueue({
    projectId: keyRecord.projectId,
    batchId: computeBatchId(storedEvents.map((e) => e.id)),
    events: storedEvents,
  });

  return c.json({ accepted: eventList.length }, 202);
});

eventsRouter.openapi(listEventsRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { from, to, order, limit, offset } = c.req.valid('query');
  const { events } = c.var.container;

  const range = {
    projectId,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };

  const [rows, total] = await Promise.all([
    events.query({ ...range, order, limit, offset }),
    events.count(range),
  ]);

  return c.json(
    EventsListResponse.parse({
      events: rows.map((row) => ({
        id: row.id,
        name: row.name,
        source: row.source,
        timestamp: row.timestamp.toISOString(),
        properties: row.properties,
      })),
      total,
    }),
    200,
  );
});

export default eventsRouter;
