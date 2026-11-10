import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "@/errors/index.js";
import type { AuthenticatedEnv } from "../env.js";
import { SESSION_COOKIE_NAME } from "../session-cookie.js";

export const requireSession = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  const user = token ? await c.var.sessionService.findUserBySessionToken(c.var.db, token, new Date()) : null;
  if (!user?.isActive) {
    throw new UnauthorizedError();
  }

  c.set("user", user);
  await next();
});
