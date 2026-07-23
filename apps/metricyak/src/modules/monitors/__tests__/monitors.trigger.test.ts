import { InMemoryMonitorDirtyBuffer } from '@metricyak/queue';
import { describe, expect, it } from 'vitest';
import { markBatchDirty } from '@/modules/monitors/monitors.trigger.js';

describe('markBatchDirty', () => {
  it('marks only distinct, monitored (projectId, eventName) pairs', async () => {
    const dirty = new InMemoryMonitorDirtyBuffer();
    await dirty.addMonitoredKeys([{ projectId: 'p1', eventName: 'purchase' }]);

    const marked = await markBatchDirty(
      dirty,
      [
        { projectId: 'p1', name: 'purchase' },
        { projectId: 'p1', name: 'purchase' },
        { projectId: 'p1', name: 'signup' },
      ],
      new Date('2026-07-22T00:00:00.000Z'),
    );

    expect(marked).toBe(1);
    const due = await dirty.popDue(new Date('2026-07-22T00:00:10.000Z'), 100);
    expect(due).toEqual([{ projectId: 'p1', eventName: 'purchase' }]);
  });
});
