import { OpenAPIHono } from '@hono/zod-openapi';
import { PG_CODES, pgErrorCode } from '@metricyak/storage';
import { HTTPException } from 'hono/http-exception';
import type { AppEnv } from '@/container/container.js';
import { AppError, ConflictError, ERROR_TYPES, errorItem, ValidationError } from '@/http/errors.js';

export function createRouter() {
  const router = new OpenAPIHono<AppEnv>({
    defaultHook: (result) => {
      if (!result.success) {
        throw ValidationError.fromZodError(result.error, (result as { data?: unknown }).data);
      }
    },
  });

  router.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(err.toResponse(), err.status);
    }

    if (err instanceof HTTPException) {
      return c.json([errorItem(ERROR_TYPES.internal, 'http_exception', err.message)], err.status);
    }

    if (pgErrorCode(err) === PG_CODES.uniqueViolation) {
      const conflict = new ConflictError();
      return c.json(conflict.toResponse(), conflict.status);
    }

    console.error('Unhandled error:', err);
    return c.json(
      [errorItem(ERROR_TYPES.internal, 'internal_error', 'Internal Server Error')],
      500,
    );
  });

  return router;
}
