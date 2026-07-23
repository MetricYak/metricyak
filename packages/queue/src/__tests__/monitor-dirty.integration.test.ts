import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisMonitorDirtyBuffer } from '@/monitor-dirty.js';

describe('RedisMonitorDirtyBuffer (integration)', () => {
  let container: StartedTestContainer;
  let buffer: RedisMonitorDirtyBuffer;

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    const url = `redis://${container.getHost()}:${container.getMappedPort(6379)}`;
    buffer = new RedisMonitorDirtyBuffer(url);
  }, 120_000);

  afterAll(async () => {
    await buffer?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await buffer.flushAll();
  });

  it('coalesces many marks of one key into a single due entry', async () => {
    const now = new Date('2026-07-22T00:00:00.000Z');
    const key = { projectId: 'p1', eventName: 'purchase' };
    for (let i = 0; i < 10_000; i++) await buffer.markDirty([key], new Date(now.getTime() + i));

    const notYet = await buffer.popDue(now, 100);
    expect(notYet).toEqual([]);

    const later = await buffer.popDue(new Date(now.getTime() + 10_000), 100);
    expect(later).toEqual([key]);
  });

  it('membership gate filters unmonitored keys', async () => {
    await buffer.addMonitoredKeys([{ projectId: 'p1', eventName: 'purchase' }]);
    const filtered = await buffer.filterMonitored([
      { projectId: 'p1', eventName: 'purchase' },
      { projectId: 'p1', eventName: 'signup' },
    ]);
    expect(filtered).toEqual([{ projectId: 'p1', eventName: 'purchase' }]);
  });
});
