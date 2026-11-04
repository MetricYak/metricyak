import { trace } from "@opentelemetry/api";
import { type Logger, pino } from "pino";

const isDev = process.env.NODE_ENV !== "production";

function traceContext() {
  const span = trace.getActiveSpan();
  if (!span) {
    return {};
  }

  const { traceId, spanId, traceFlags } = span.spanContext();
  return { trace_id: traceId, span_id: spanId, trace_flags: traceFlags.toString(16).padStart(2, "0") };
}

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  base: { service: "metricyak" },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: { level: (label) => ({ level: label }) },
  mixin: traceContext,
  ...(isDev && { transport: { target: "pino-pretty", options: { colorize: true } } }),
});

export type { Logger };
