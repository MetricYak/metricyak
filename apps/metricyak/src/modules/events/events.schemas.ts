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
