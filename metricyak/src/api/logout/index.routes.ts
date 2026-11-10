import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";
import { clearSessionCookie, SESSION_COOKIE_NAME } from "../session-cookie.js";

export const logoutRouter = new Hono<AppEnv>();

logoutRouter.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await c.var.sessionService.deleteSession(c.var.db, token);
  }
  clearSessionCookie(c);

  return c.body(null, 204);
});
