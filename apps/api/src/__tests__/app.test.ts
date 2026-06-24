import { MemoryPublisher } from '@metricyak/queue';
import type { Database } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { createContainer } from '../container/container.js';

const app = createApp(createContainer({} as Database, new MemoryPublisher()));

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
