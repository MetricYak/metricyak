import { describe, expect, it } from 'vitest';
import { LastUsedTracker } from '@/modules/events/last-used-tracker.js';

const START = new Date('2026-07-25T12:00:00.000Z');

function at(offsetMs: number): Date {
  return new Date(START.getTime() + offsetMs);
}

describe('LastUsedTracker', () => {
  it('writes on the first use of a key', () => {
    expect(new LastUsedTracker().shouldWrite('key-1', START)).toBe(true);
  });

  it('suppresses a second write inside the interval', () => {
    const tracker = new LastUsedTracker();
    tracker.shouldWrite('key-1', START);

    expect(tracker.shouldWrite('key-1', at(59_000))).toBe(false);
  });

  it('writes again once the interval has passed', () => {
    const tracker = new LastUsedTracker();
    tracker.shouldWrite('key-1', START);

    expect(tracker.shouldWrite('key-1', at(60_000))).toBe(true);
  });

  it('tracks keys independently', () => {
    const tracker = new LastUsedTracker();
    tracker.shouldWrite('key-1', START);

    expect(tracker.shouldWrite('key-2', START)).toBe(true);
  });
});
