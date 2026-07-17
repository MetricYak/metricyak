import { describe, expect, it } from 'vitest';
import { MONITOR_EVAL_FAILURE_THRESHOLD, monitorEvalBackoffMs } from '@/lib/monitor-health.js';

describe('monitorEvalBackoffMs', () => {
  const K = MONITOR_EVAL_FAILURE_THRESHOLD;

  it('returns the base interval at the threshold', () => {
    expect(monitorEvalBackoffMs(K)).toBe(60_000);
  });

  it('doubles per failure beyond the threshold', () => {
    expect(monitorEvalBackoffMs(K + 1)).toBe(120_000);
    expect(monitorEvalBackoffMs(K + 2)).toBe(240_000);
  });

  it('is monotonic non-decreasing', () => {
    let prev = 0;
    for (let n = K; n < K + 40; n++) {
      const cur = monitorEvalBackoffMs(n);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it('clamps at the 15 minute cap and never overflows', () => {
    expect(monitorEvalBackoffMs(K + 100)).toBe(900_000);
    expect(Number.isFinite(monitorEvalBackoffMs(K + 1000))).toBe(true);
  });
});
