import { OpenAPIHono } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { AppError, ERROR_CODES, formatValidationError, ValidationError } from './errors.js';

export function createRouter() {
  const router = new OpenAPIHono({
    defaultHook: (result) => {
      if (!result.success) {
        throw new ValidationError(formatValidationError(result.error));
      }
    },
  });

  router.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json(err.toResponse(), err.status);
    }

    if (err instanceof HTTPException) {
      return c.json({ error_code: ERROR_CODES.internal, message: err.message }, err.status);
    }

    console.error('Unhandled error:', err);
    return c.json({ error_code: ERROR_CODES.internal, message: 'Internal Server Error' }, 500);
  });

  return router;
}
