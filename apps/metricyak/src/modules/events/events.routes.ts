import { randomUUID } from 'node:crypto';
import { createRoute } from '@hono/zod-openapi';
import { computeBatchId } from '@metricyak/queue';
import { errorResponse, UnauthorizedError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import { dropDuplicateInsertIds } from './events.dedup.js';
import { IngestRequest, IngestResponse } from './events.schemas.js';

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

export default eventsRouter;
