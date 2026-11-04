import { httpInstrumentationMiddleware } from "@hono/otel";
import { Hono } from "hono";
import type { Config } from "@/config/index.js";
import type { AppEnv } from "./env.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { requestLogger } from "./request-logger.js";

export function createApp(config: Config): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(httpInstrumentationMiddleware());
  app.use(async (c, next) => {
    c.set("config", config);
    await next();
  });
  app.use(requestLogger);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  return app;
}
