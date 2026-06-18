import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { AppError, ERROR_TYPES, errorItem, ValidationError } from './errors.js';

export function createRouter() {
  const router = new OpenAPIHono({
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

    console.error('Unhandled error:', err);
    return c.json(
      [errorItem(ERROR_TYPES.internal, 'internal_error', 'Internal Server Error')],
      500,
    );
  });

  return router;
}
