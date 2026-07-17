// K consecutive failed eval slots before a monitor is treated as an incident.
export const MONITOR_EVAL_FAILURE_THRESHOLD = 3;

// Backoff for a monitor stuck in `error`. Base equals the dispatch interval
// (MONITOR_DISPATCH_INTERVAL_MS in @metricyak/queue); duplicated here to avoid a
// storage -> queue dependency.
const BASE_MS = 60_000;
const CAP_MS = 15 * 60_000;
// Largest exponent worth computing: 2 ** 4 * BASE_MS (960_000) already exceeds CAP_MS,
// so clamping the exponent here prevents 2 ** n overflow at huge failure counts.
const MAX_EXPONENT = 8;

/**
 * Exponential backoff derived purely from the consecutive-failure counter:
 * base at the threshold, doubling per further failure, clamped to the cap.
 */
export function monitorEvalBackoffMs(consecutiveFailures: number): number {
  const stepsPastThreshold = consecutiveFailures - MONITOR_EVAL_FAILURE_THRESHOLD;
  if (stepsPastThreshold <= 0) return BASE_MS;
  const exponent = Math.min(stepsPastThreshold, MAX_EXPONENT);
  return Math.min(CAP_MS, BASE_MS * 2 ** exponent);
}
