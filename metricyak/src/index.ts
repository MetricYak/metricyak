import { type ServerType, serve } from "@hono/node-server";
import type { NodeSDK } from "@opentelemetry/sdk-node";
import type { Hono } from "hono";
import { createApp } from "@/api/app.js";
import type { AppEnv } from "@/api/env.js";
import { type Config, loadConfig } from "@/config/index.js";
import { logger } from "@/logger/index.js";
import { startTelemetry } from "@/telemetry/index.js";

function startHttpServer(app: Hono<AppEnv>, config: Config["http"]): ServerType {
  const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
    logger.info({ port: info.port }, "HTTP server started");
  });

  server.on("error", (err) => {
    logger.fatal({ err }, "HTTP server error");
    process.exit(1);
  });

  return server;
}

function registerShutdown(server: ServerType, telemetry: NodeSDK): void {
  const shutdown = (signal: NodeJS.Signals) => {
    logger.info({ signal }, "Shutting down HTTP server");

    server.close(async (closeErr) => {
      if (closeErr) {
        logger.error({ err: closeErr }, "HTTP server closed with an error");
      } else {
        logger.info("HTTP server stopped");
      }

      try {
        await telemetry.shutdown();
      } catch (err) {
        logger.error({ err }, "Telemetry shutdown failed");
      }

      process.exit(closeErr ? 1 : 0);
    });
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
}

function registerCrashHandlers(): void {
  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Unhandled promise rejection");
    process.exit(1);
  });
}

function main(): void {
  registerCrashHandlers();

  const config = loadConfig();
  logger.info({ env: config.env }, "Configuration loaded");

  const telemetry = startTelemetry();

  const server = startHttpServer(createApp(config), config.http);
  registerShutdown(server, telemetry);
}

main();
