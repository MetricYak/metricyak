import { createMiddleware } from "hono/factory";
import { routePath } from "hono/route";
import { logger } from "@/logger/index.js";
import type { AppEnv } from "./env.js";

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  await next();

  if (c.var.skipRequestLog) {
    return;
  }

  logger.info(
    {
      "http.request.method": c.req.method,
      "http.route": routePath(c),
      "url.path": c.req.path,
      "http.response.status_code": c.res.status,
    },
    "HTTP request",
  );
});

// For high-volume routes where a log line per request costs more than it tells us.
export const skipRequestLog = createMiddleware<AppEnv>(async (c, next) => {
  c.set("skipRequestLog", true);
  await next();
});
