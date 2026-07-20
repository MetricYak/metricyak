import { z } from '@hono/zod-openapi';

const MAX_BATCH_SIZE = 500;
const MAX_EVENT_NAME_LENGTH = 255;
const MAX_INSERT_ID_LENGTH = 255;
const MAX_PROPERTIES_JSON_CHARS = 16 * 1024;

export const IngestEvent = z
  .object({
    name: z
      .string()
      .min(1, 'The event name must not be empty.')
      .max(
        MAX_EVENT_NAME_LENGTH,
        `The event name must be at most ${MAX_EVENT_NAME_LENGTH} characters.`,
      )
      .openapi({
        example: 'signup_completed',
      }),
    insert_id: z
      .string()
      .min(1, 'The insert_id must not be empty.')
      .max(
        MAX_INSERT_ID_LENGTH,
        `The insert_id must be at most ${MAX_INSERT_ID_LENGTH} characters.`,
      )
      .optional()
      .openapi({
        description:
          'Client-supplied idempotency key. Events retried with the same insert_id are counted once.',
        example: 'evt_a1b2c3d4',
      }),
    timestamp: z.iso.datetime().optional().openapi({
      description: 'ISO 8601 timestamp. Defaults to the server receive time when omitted.',
      example: '2025-01-15T12:00:00.000Z',
    }),
    properties: z
      .record(z.string(), z.unknown())
      .refine(
        (value) => JSON.stringify(value).length <= MAX_PROPERTIES_JSON_CHARS,
        `Event properties are too large (max ${MAX_PROPERTIES_JSON_CHARS} serialized characters).`,
      )
      .optional()
      .openapi({
        description: 'Arbitrary key-value properties for the event.',
        example: { plan: 'pro', country: 'US' },
      }),
  })
  .openapi('IngestEvent');

export type IngestEvent = z.infer<typeof IngestEvent>;

const IngestEvents = z.union([
  IngestEvent,
  z
    .array(IngestEvent)
    .min(1, 'The events array must not be empty.')
    .max(MAX_BATCH_SIZE, `A maximum of ${MAX_BATCH_SIZE} events may be sent per request.`),
]);

export const IngestRequest = z
  .object({
    project_key: z.string().min(1, 'The project_key must not be empty.').openapi({
      description: 'Publishable project key.',
      example: 'myk_bV69kLXz4PqRmaSTV2NZeK7YdJjMhKFWgqi5fexR9s2',
    }),
    events: IngestEvents,
  })
  .openapi('IngestRequest');

export const IngestResponse = z
  .object({
    accepted: z.number().int().openapi({
      description: 'Number of events accepted and enqueued.',
      example: 1,
    }),
  })
  .openapi('IngestResponse');

export const EVENT_PAGE_SIZES: readonly number[] = [25, 50, 75, 100];

export const ListEventsParams = z.object({
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const ListEventsQuery = z.object({
  from: z.iso
    .datetime()
    .optional()
    .openapi({
      param: { name: 'from', in: 'query' },
      description: 'Inclusive lower time bound. Omit for no lower bound.',
    }),
  to: z.iso
    .datetime()
    .optional()
    .openapi({
      param: { name: 'to', in: 'query' },
      description: 'Exclusive upper time bound. Defaults to the request time when omitted.',
    }),
  sort: z
    .enum(['asc', 'desc'])
    .default('desc')
    .openapi({ param: { name: 'sort', in: 'query' } }),
  page: z.coerce
    .number()
    .int('The page must be an integer.')
    .min(0, 'The page must not be negative.')
    .default(0)
    .openapi({ param: { name: 'page', in: 'query' } }),
  pageSize: z.coerce
    .number()
    .int('The pageSize must be an integer.')
    .refine((value) => EVENT_PAGE_SIZES.includes(value), {
      error: `The pageSize must be one of: ${EVENT_PAGE_SIZES.join(', ')}.`,
    })
    .default(25)
    .openapi({ param: { name: 'pageSize', in: 'query' } }),
});

export const EventItem = z
  .object({
    id: z.string(),
    name: z.string(),
    timestamp: z.iso.datetime(),
    properties: z.record(z.string(), z.unknown()),
  })
  .openapi('EventItem');

export const ListEventsResponse = z
  .object({
    events: z.array(EventItem),
    hasMore: z.boolean(),
  })
  .openapi('ListEventsResponse');
