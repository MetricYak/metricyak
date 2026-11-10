import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { ForbiddenError } from "@/errors/index.js";
import type { AppEnv } from "../env.js";

const honoCsrf = csrf();

export const csrfProtection = createMiddleware<AppEnv>(async (c, next) => {
  try {
    await honoCsrf(c, async () => {});
  } catch (err) {
    throw err instanceof HTTPException && err.status === 403
      ? new ForbiddenError({ detail: "Cross-origin requests are not allowed." })
      : err;
  }

  await next();
});
