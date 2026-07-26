import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import type { Container } from '@/container/container.js';
import { extractBearerKey } from '@/modules/events/project-key-auth.js';

describe('extractBearerKey', () => {
  it('reads the key from a bearer header', () => {
    expect(extractBearerKey('Bearer myk_abc')).toBe('myk_abc');
  });

  it('accepts a lowercase scheme', () => {
    expect(extractBearerKey('bearer myk_abc')).toBe('myk_abc');
  });

  it('rejects a missing header', () => {
    expect(extractBearerKey(undefined)).toBeNull();
  });

  it('rejects a non-bearer scheme', () => {
    expect(extractBearerKey('Basic myk_abc')).toBeNull();
  });

  it('rejects a bearer header with no value', () => {
    expect(extractBearerKey('Bearer')).toBeNull();
    expect(extractBearerKey('Bearer ')).toBeNull();
  });
});

const VALID_KEY = 'myk_valid';
const PROJECT_ID = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';

function createIngestApp() {
  const enqueued: unknown[] = [];
  const validated: string[] = [];

  const container = {
    producer: {
      enqueue: async (batch: unknown) => {
        enqueued.push(batch);
      },
    },
    lastUsed: { shouldWrite: () => false },
    repos: {
      projectKeys: {
        findValidByKey: async (key: string) => {
          validated.push(key);
          return key === VALID_KEY ? { id: 'key-1', projectId: PROJECT_ID } : null;
        },
        touchLastUsed: async () => undefined,
      },
    },
  } as unknown as Container;

  return { app: createApp(container), enqueued, validated };
}

const oneEvent = { events: [{ name: 'signup_completed' }] };

describe('ingest authentication', () => {
  it('accepts a valid bearer key and routes to its project', async () => {
    const { app, enqueued, validated } = createIngestApp();

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VALID_KEY}` },
      body: JSON.stringify(oneEvent),
    });

    expect(res.status).toBe(202);
    expect(enqueued).toHaveLength(1);
    expect(validated).toEqual([VALID_KEY]);
  });

  it('rejects a request with no Authorization header', async () => {
    const { app } = createIngestApp();

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(oneEvent),
    });

    expect(res.status).toBe(401);
  });

  it('rejects an unknown key', async () => {
    const { app } = createIngestApp();

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer myk_unknown' },
      body: JSON.stringify(oneEvent),
    });

    expect(res.status).toBe(401);
  });

  it('rejects an oversized batch without validating it', async () => {
    const { app } = createIngestApp();
    const tooManyEvents = {
      events: Array.from({ length: 900 }, () => ({ name: 'signup_completed' })),
    };

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer myk_unknown' },
      body: JSON.stringify(tooManyEvents),
    });

    expect(res.status).toBe(401);
  });

  it('ignores project_key in the body', async () => {
    const { app } = createIngestApp();

    const res = await app.request('/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_key: VALID_KEY, ...oneEvent }),
    });

    expect(res.status).toBe(401);
  });
});

type TrackerAppOptions = {
  readonly shouldWrite: boolean;
  readonly touchLastUsedRejects?: boolean;
};

function createIngestAppWithTracker(options: TrackerAppOptions) {
  const touched: string[] = [];
  const enqueued: unknown[] = [];

  const container = {
    producer: {
      enqueue: async (batch: unknown) => {
        enqueued.push(batch);
      },
    },
    lastUsed: { shouldWrite: () => options.shouldWrite },
    repos: {
      projectKeys: {
        findValidByKey: async () => ({ id: 'key-1', projectId: PROJECT_ID }),
        touchLastUsed: async (keyId: string) => {
          if (options.touchLastUsedRejects) {
            throw new Error('canceling statement due to statement timeout');
          }
          touched.push(keyId);
        },
      },
    },
  } as unknown as Container;

  return { app: createApp(container), touched, enqueued };
}

async function ingestWithValidKey(app: ReturnType<typeof createApp>): Promise<Response> {
  return app.request('/v1/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${VALID_KEY}` },
    body: JSON.stringify(oneEvent),
  });
}

describe('last-used write throttling', () => {
  it('records the key as used when the tracker allows a write', async () => {
    const { app, touched } = createIngestAppWithTracker({ shouldWrite: true });

    await ingestWithValidKey(app);

    expect(touched).toEqual(['key-1']);
  });

  it('skips the write when the tracker throttles it', async () => {
    const { app, touched } = createIngestAppWithTracker({ shouldWrite: false });

    await ingestWithValidKey(app);

    expect(touched).toEqual([]);
  });

  it('accepts the batch when recording the key as used fails', async () => {
    const { app, enqueued } = createIngestAppWithTracker({
      shouldWrite: true,
      touchLastUsedRejects: true,
    });

    const res = await ingestWithValidKey(app);

    expect(res.status).toBe(202);
    expect(enqueued).toHaveLength(1);
  });
});
