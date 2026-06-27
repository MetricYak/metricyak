import { randomUUID } from 'node:crypto';
import { createRoute } from '@hono/zod-openapi';
import { errorResponse, UnauthorizedError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
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
  const { projectKeys, producer } = c.var.container;

  const keyRecord = await projectKeys.findActiveByKey(project_key);
  if (!keyRecord) {
    throw new UnauthorizedError('You are not allowed to perform this action.');
  }

  const eventList = Array.isArray(events) ? events : [events];
  const now = new Date().toISOString();

  const job = {
    projectId: keyRecord.projectId,
    events: eventList.map((e) => ({
      id: randomUUID(),
      name: e.name,
      timestamp: e.timestamp ?? now,
      properties: e.properties ?? {},
    })),
  };

  await producer.enqueue(job);

  return c.json({ accepted: eventList.length }, 202);
});

export default eventsRouter;
