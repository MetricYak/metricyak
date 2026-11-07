import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { users } from "@/db/schema/users.js";
import { ForbiddenError, UnauthorizedError } from "@/errors/index.js";
import type { AppEnv } from "../env.js";
import { setSessionCookie } from "../session-cookie.js";
import { serializeUser } from "../signup/serializers.js";
import { validate } from "../validator.js";
import { loginSchema } from "./schemas.js";

export const loginRouter = new Hono<AppEnv>();

loginRouter.post("/login", validate("json", loginSchema), async (c) => {
  const request = c.req.valid("json");

  const [user] = await c.var.db.select().from(users).where(eq(users.email, request.email));

  if (!user?.isActive || user.passwordHash === null) {
    await c.var.passwordService.verifyAgainstDummy(request.password);
    throw new UnauthorizedError({ code: "invalid_credentials", detail: "Invalid email or password." });
  }

  if (!(await c.var.passwordService.verifyPassword(user.passwordHash, request.password))) {
    throw new UnauthorizedError({ code: "invalid_credentials", detail: "Invalid email or password." });
  }

  if (c.var.config.email.verificationRequired && user.emailVerifiedAt === null) {
    throw new ForbiddenError({
      code: "email_not_verified",
      detail: "Verify your email address before logging in.",
    });
  }

  const session = await c.var.sessionService.createSession(c.var.db, user.id, new Date());
  setSessionCookie(c, session);

  return c.json({ user: serializeUser(user) }, 200);
});
