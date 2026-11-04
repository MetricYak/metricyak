import type { Context, ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ApiError, NotFoundError } from "@/errors/index.js";
import { logger } from "@/logger/index.js";
import type { AppEnv } from "./env.js";

export type ErrorItem = {
  error_type: string;
  error_code: string;
  detail: string;
  param: string | null;
};

function serializeError(err: Pick<ApiError, "type" | "code" | "detail">): { errors: ErrorItem[] } {
  return { errors: [{ error_type: err.type, error_code: err.code, detail: err.detail, param: null }] };
}

function apiErrorResponse(c: Context<AppEnv>, err: ApiError): Response {
  return c.json(serializeError(err), err.statusCode as ContentfulStatusCode);
}

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof HTTPException) {
    return c.json(serializeError({ type: ApiError.defaultType, code: "http_error", detail: err.message }), err.status);
  }

  const apiError = err instanceof ApiError ? err : new ApiError();
  if (apiError.statusCode >= 500) {
    logger.error({ err }, "Request failed");
  }

  return apiErrorResponse(c, apiError);
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) => apiErrorResponse(c, new NotFoundError());
