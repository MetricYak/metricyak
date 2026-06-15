import { z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const ERROR_CODES = {
  validation: 'validation_error',
  internal: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const ErrorResponseSchema = z
  .object({
    error_code: z.string().openapi({ example: ERROR_CODES.validation }),
    message: z.string().openapi({ example: 'Invalid Project Id.' }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export class AppError extends Error {
  readonly errorCode: ErrorCode;
  readonly status: ContentfulStatusCode;

  constructor(errorCode: ErrorCode, message: string, status: ContentfulStatusCode) {
    super(message);
    this.name = new.target.name;
    this.errorCode = errorCode;
    this.status = status;
  }

  toResponse(): ErrorResponse {
    return { error_code: this.errorCode, message: this.message };
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.validation, message, 400);
  }
}

export function errorResponse(description: string) {
  return {
    content: { 'application/json': { schema: ErrorResponseSchema } },
    description,
  } as const;
}

export function formatValidationError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.map(String).join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join('; ');
}
