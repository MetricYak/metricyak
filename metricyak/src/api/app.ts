import { httpInstrumentationMiddleware } from "@hono/otel";
import { Hono } from "hono";
import type { PasswordService } from "@/auth/password-service.js";
import type { SessionService } from "@/auth/session-service.js";
import type { Config } from "@/config/index.js";
import type { Database } from "@/db/index.js";
import type { EmailService } from "@/email/email-service.js";
import type { AppEnv } from "./env.js";
import { errorHandler, notFoundHandler } from "./error-handler.js";
import { loginRouter } from "./login/index.routes.js";
import { logoutRouter } from "./logout/index.routes.js";
import { organizationsRouter } from "./organizations/index.routes.js";
import { projectsRouter } from "./projects/index.routes.js";
import { requestLogger } from "./request-logger.js";
import { signupRouter } from "./signup/index.routes.js";

export function createApp(
  config: Config,
  db: Database,
  emailService: EmailService,
  passwordService: PasswordService,
  sessionService: SessionService,
): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(httpInstrumentationMiddleware());
  app.use(async (c, next) => {
    c.set("config", config);
    c.set("db", db);
    c.set("emailService", emailService);
    c.set("passwordService", passwordService);
    c.set("sessionService", sessionService);
    await next();
  });
  app.use(requestLogger);

  app.onError(errorHandler);
  app.notFound(notFoundHandler);

  app.route("/api", organizationsRouter);
  app.route("/api", projectsRouter);
  app.route("/api", signupRouter);
  app.route("/api", loginRouter);
  app.route("/api", logoutRouter);

  return app;
}
