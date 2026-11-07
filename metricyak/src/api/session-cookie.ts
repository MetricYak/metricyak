import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import type { CreatedSession } from "@/auth/session-service.js";
import type { AppEnv } from "./env.js";

export const SESSION_COOKIE_NAME = "metricyak_session";

export function setSessionCookie(c: Context<AppEnv>, { token, session }: CreatedSession): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: c.var.config.env !== "development",
    expires: session.expiresAt,
    maxAge: Math.floor((session.expiresAt.getTime() - session.createdAt.getTime()) / 1000),
  });
}
