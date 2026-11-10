import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
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

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    secure: c.var.config.env !== "development",
  });
}
