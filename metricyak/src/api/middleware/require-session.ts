import { createMiddleware } from "hono/factory";
import { UnauthorizedError } from "@/errors/index.js";
import type { AuthenticatedEnv } from "../env.js";
import { getSessionToken } from "../session-cookie.js";

export const requireSession = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  const token = getSessionToken(c);
  const user = token ? await c.var.sessionService.findUserBySessionToken(c.var.db, token, new Date()) : null;
  if (!user?.isActive) {
    throw new UnauthorizedError();
  }

  c.set("user", user);
  await next();
});
