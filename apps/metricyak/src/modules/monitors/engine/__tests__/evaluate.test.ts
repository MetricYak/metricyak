import type { MonitorThresholdCondition } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { evaluateMonitor, type MonitorEvalState } from '../evaluate.js';

const lt5000: MonitorThresholdCondition = { operator: 'lt', value: 5000 };
const ok: MonitorEvalState = { status: 'ok', breachedSince: null };
const t0 = new Date('2026-07-13T00:00:00.000Z');
const later = (ms: number) => new Date(t0.getTime() + ms);

function input(overrides: Partial<{ holdForMs: number; missingData: 'skip' | 'zero' | 'fire' }> = {}) {
  return { condition: lt5000, holdForMs: 0, missingData: 'skip' as const, ...overrides };
}

describe('evaluateMonitor', () => {
  it('stays ok when the value does not breach', () => {
    const result = evaluateMonitor(input(), ok, 6000, t0);
    expect(result.nextState.status).toBe('ok');
    expect(result.fired).toBeNull();
  });

  it('fires immediately from ok when holdFor is zero', () => {
    const result = evaluateMonitor(input(), ok, 4000, t0);
    expect(result.nextState.status).toBe('firing');
    expect(result.fired).toEqual({ value: 4000, threshold: lt5000, occurredAt: t0 });
  });

  it('goes to pending (no fire) when holdFor has not elapsed', () => {
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), ok, 4000, t0);
    expect(result.nextState).toEqual({ status: 'pending', breachedSince: t0 });
    expect(result.fired).toBeNull();
  });

  it('fires from pending once holdFor elapses, keeping breachedSince', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 4000, later(60_000));
    expect(result.nextState).toEqual({ status: 'firing', breachedSince: t0 });
    expect(result.fired?.occurredAt).toEqual(later(60_000));
  });

  it('stays pending while breached but holdFor still pending', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 4000, later(30_000));
    expect(result.nextState).toEqual({ status: 'pending', breachedSince: t0 });
    expect(result.fired).toBeNull();
  });

  it('recovers to ok from pending when the breach clears (resets the timer)', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 6000, later(30_000));
    expect(result.nextState).toEqual({ status: 'ok', breachedSince: null });
    expect(result.fired).toBeNull();
  });

  it('does not re-fire while already firing', () => {
    const firing: MonitorEvalState = { status: 'firing', breachedSince: t0 };
    const result = evaluateMonitor(input(), firing, 4000, later(120_000));
    expect(result.nextState.status).toBe('firing');
    expect(result.fired).toBeNull();
  });

  it('re-arms to ok from firing when the value recovers', () => {
    const firing: MonitorEvalState = { status: 'firing', breachedSince: t0 };
    const result = evaluateMonitor(input(), firing, 6000, later(120_000));
    expect(result.nextState).toEqual({ status: 'ok', breachedSince: null });
    expect(result.fired).toBeNull();
  });

  describe('missingData with a null value', () => {
    it('skip leaves state untouched and never fires', () => {
      const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
      const result = evaluateMonitor(input({ missingData: 'skip' }), pending, null, later(90_000));
      expect(result.nextState).toBe(pending);
      expect(result.fired).toBeNull();
    });

    it('zero evaluates the condition against 0', () => {
      const result = evaluateMonitor(input({ missingData: 'zero' }), ok, null, t0);
      expect(result.nextState.status).toBe('firing'); // 0 < 5000
      expect(result.fired?.value).toBe(0);
    });

    it('fire treats a missing window as breached', () => {
      const gt: MonitorThresholdCondition = { operator: 'gt', value: 5000 };
      const result = evaluateMonitor(
        { condition: gt, holdForMs: 0, missingData: 'fire' },
        ok,
        null,
        t0,
      );
      expect(result.nextState.status).toBe('firing');
      expect(result.fired?.value).toBe(0);
    });
  });

  it('compares each operator correctly', () => {
    const cases: Array<[MonitorThresholdCondition, number, boolean]> = [
      [{ operator: 'lt', value: 10 }, 9, true],
      [{ operator: 'lte', value: 10 }, 10, true],
      [{ operator: 'gt', value: 10 }, 11, true],
      [{ operator: 'gte', value: 10 }, 10, true],
      [{ operator: 'eq', value: 10 }, 10, true],
      [{ operator: 'neq', value: 10 }, 11, true],
      [{ operator: 'lt', value: 10 }, 10, false],
    ];
    for (const [condition, value, breached] of cases) {
      const result = evaluateMonitor(
        { condition, holdForMs: 0, missingData: 'skip' },
        ok,
        value,
        t0,
      );
      expect(result.nextState.status).toBe(breached ? 'firing' : 'ok');
    }
  });
});
