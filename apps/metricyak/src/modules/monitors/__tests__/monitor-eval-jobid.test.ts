import { monitorEvalJobId } from '@metricyak/queue';
import { describe, expect, it } from 'vitest';

describe('monitorEvalJobId', () => {
  const monitorId = '11111111-1111-1111-1111-111111111111';

  it('is stable for the same monitor + slot', () => {
    const slot = new Date('2026-07-17T00:00:00.000Z');
    expect(monitorEvalJobId(monitorId, slot)).toBe(monitorEvalJobId(monitorId, slot));
  });

  it('differs across slots so a failed slot never blocks the next (the #64 fix)', () => {
    const slotA = new Date('2026-07-17T00:00:00.000Z');
    const slotB = new Date('2026-07-17T00:01:00.000Z');
    expect(monitorEvalJobId(monitorId, slotA)).not.toBe(monitorEvalJobId(monitorId, slotB));
  });
});
