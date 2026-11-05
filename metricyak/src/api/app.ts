import { httpInstrumentationMiddleware } from "@hono/otel";
import { Hono } from "hono";
import type { Config } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import type { AppEnv } from "./env.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { organizationsRouter } from "./organizations/index.routes.js";
import { requestLogger } from "./request-logger.js";

export function createApp(config: Config, db: Database): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(httpInstrumentationMiddleware());
  app.use(async (c, next) => {
    c.set("config", config);
    c.set("db", db);
    await next();
  });
  app.use(requestLogger);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.route("/api", organizationsRouter);

  return app;
}
