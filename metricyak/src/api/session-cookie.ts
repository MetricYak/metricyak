import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import type { CreatedSession } from "@/auth/session-service.js";

const SESSION_COOKIE_NAME = "id";

const SESSION_COOKIE_OPTIONS: CookieOptions = {
  prefix: "host",
  httpOnly: true,
  sameSite: "Lax",
  path: "/",
};

export function getSessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE_NAME, "host");
}

export function setSessionCookie(c: Context, { token, session }: CreatedSession): void {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    expires: session.expiresAt,
    maxAge: Math.floor((session.expiresAt.getTime() - session.createdAt.getTime()) / 1000),
  });
}

export function clearSessionCookie(c: Context): void {
  deleteCookie(c, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
}
