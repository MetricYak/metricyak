import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { clearSessionCookie, getSessionToken } from "../session-cookie.js";

export const logoutRouter = new Hono<AppEnv>();

logoutRouter.post("/logout", async (c) => {
  const token = getSessionToken(c);
  if (token) {
    await c.var.sessionService.deleteSession(c.var.db, token);
  }
  clearSessionCookie(c);

  return c.body(null, 204);
});
