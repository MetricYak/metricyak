import type { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function respond<S extends z.ZodType, Status extends ContentfulStatusCode>(
  c: Context,
  schema: S,
  payload: z.input<S>,
  status: Status,
) {
  return c.json(schema.parse(payload), status);
}
