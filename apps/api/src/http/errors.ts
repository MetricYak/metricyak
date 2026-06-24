import { z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const ERROR_TYPES = {
  validation: 'validation_error',
  not_found: 'not_found_error',
  unauthorized: 'unauthorized_error',
  internal: 'internal_error',
} as const;

export type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES];

export const ErrorItemSchema = z
  .object({
    error_type: z.string().openapi({ example: ERROR_TYPES.validation }),
    error_code: z.string().openapi({ example: 'required' }),
    message: z.string().openapi({ example: 'This field is required.' }),
    attribute: z.string().nullable().openapi({ example: 'name' }),
  })
  .openapi('ErrorItem');

export type ErrorItem = z.infer<typeof ErrorItemSchema>;

export const ErrorResponseSchema = z.array(ErrorItemSchema).openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function errorItem(
  errorType: ErrorType,
  errorCode: string,
  message: string,
  attribute: string | null = null,
): ErrorItem {
  return { error_type: errorType, error_code: errorCode, message, attribute };
}

export class AppError extends Error {
  readonly status: ContentfulStatusCode;
  readonly errors: ErrorItem[];

  constructor(status: ContentfulStatusCode, errors: ErrorItem[]) {
    super(errors[0]?.message ?? 'Error');
    this.name = new.target.name;
    this.status = status;
    this.errors = errors;
  }

  toResponse(): ErrorResponse {
    return this.errors;
  }
}

export class ValidationError extends AppError {
  constructor(errors: ErrorItem[]) {
    super(400, errors);
  }

  static fromZodError(error: z.ZodError, input?: unknown): ValidationError {
    return new ValidationError(zodErrorToItems(error, input));
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, attribute: string | null = null) {
    super(404, [errorItem(ERROR_TYPES.not_found, 'not_found', message, attribute)]);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized.') {
    super(401, [errorItem(ERROR_TYPES.unauthorized, 'unauthorized', message)]);
  }
}

function attributeFromPath(path: ReadonlyArray<PropertyKey>): string | null {
  return path.length === 0 ? null : path.map(String).join('.');
}

function valueAtPath(input: unknown, path: ReadonlyArray<PropertyKey>): unknown {
  let current = input;
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

function errorCodeFromIssue(issue: z.core.$ZodIssue, input: unknown): string {
  if (issue.code === 'invalid_type') {
    const value = valueAtPath(input, issue.path);
    if (value === undefined || value === null) {
      return 'required';
    }
  }
  return issue.code;
}

const VALIDATION_MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  invalid_type: 'An invalid value was provided.',
};

function messageForCode(code: string, issue: z.core.$ZodIssue): string {
  return VALIDATION_MESSAGES[code] ?? issue.message;
}

export function zodErrorToItems(error: z.ZodError, input?: unknown): ErrorItem[] {
  return error.issues.map((issue) => {
    const code = errorCodeFromIssue(issue, input);
    return errorItem(
      ERROR_TYPES.validation,
      code,
      messageForCode(code, issue),
      attributeFromPath(issue.path),
    );
  });
}

export function errorResponse(description: string) {
  return {
    content: { 'application/json': { schema: ErrorResponseSchema } },
    description,
  } as const;
}
