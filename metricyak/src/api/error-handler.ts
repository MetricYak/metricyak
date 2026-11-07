import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError, NotFoundError, ValidationError } from "@/errors/index.js";
import { logger } from "@/logger/index.js";
import type { AppEnv } from "./env.js";

export type ErrorItem = {
  error_type: string;
  error_code: string;
  detail: string;
  param: string | null;
};

function serializeError(err: ApiError): { errors: ErrorItem[] } {
  return { errors: [{ error_type: err.type, error_code: err.code, detail: err.detail, param: null }] };
}

function serializeValidationError(err: ValidationError): { errors: ErrorItem[] } {
  return {
    errors: err.params.map(({ code, detail, param }) => ({ error_type: err.type, error_code: code, detail, param })),
  };
}

function apiErrorResponse(c: Context<AppEnv>, err: ApiError): Response {
  const body = err instanceof ValidationError ? serializeValidationError(err) : serializeError(err);
  return c.json(body, err.statusCode as ContentfulStatusCode);
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(serializeError(new ApiError({ code: "http_error", detail: err.message })), err.status);
  }

  const apiError = err instanceof ApiError ? err : new ApiError();
  if (apiError.statusCode >= 500) {
    logger.error({ err }, "Request failed");
  }

  return apiErrorResponse(c, apiError);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => apiErrorResponse(c, new NotFoundError());
