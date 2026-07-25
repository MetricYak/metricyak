import type { ProjectKeyState } from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import type { Container } from '@/container/container.js';

const PROJECT_ID = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';

function keyRecord(key: string, expiresAt: Date | null) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    projectId: PROJECT_ID,
    key,
    createdAt: new Date('2026-07-25T12:00:00.000Z'),
    lastUsedAt: null,
    expiresAt,
  };
}

type Stub = {
  state: ProjectKeyState;
  anyKey: boolean;
  generated: string[];
  rolled: number;
  revokedAll: number;
  revokedGrace: number;
  rollResult: ProjectKeyState | null;
};

function createStubbedApp(overrides: Partial<Stub> = {}) {
  const stub: Stub = {
    state: { active: null, grace: null },
    anyKey: false,
    generated: [],
    rolled: 0,
    revokedAll: 0,
    revokedGrace: 0,
    rollResult: null,
    ...overrides,
  };

  const container = {
    repos: {
      projects: { get: async () => ({ id: PROJECT_ID }) },
      projectKeys: {
        getState: async () => stub.state,
        hasAnyKey: async () => stub.anyKey,
        generate: async () => {
          stub.generated.push('myk_generated');
          const record = keyRecord('myk_generated', null);
          stub.state = { active: record, grace: null };
          return record;
        },
        roll: async () => {
          stub.rolled += 1;
          if (stub.rollResult) stub.state = stub.rollResult;
          return stub.rollResult;
        },
        revokeAll: async () => {
          stub.revokedAll += 1;
          stub.state = { active: null, grace: null };
          return true;
        },
        revokeGrace: async () => {
          stub.revokedGrace += 1;
          stub.state = { active: stub.state.active, grace: null };
          return true;
        },
      },
    },
  } as unknown as Container;

  return { app: createApp(container), stub };
}

describe('project key routes', () => {
  let active: ReturnType<typeof keyRecord>;

  beforeEach(() => {
    active = keyRecord('myk_active', null);
  });

  it('returns the active key', async () => {
    const { app } = createStubbedApp({ state: { active, grace: null }, anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.active.key).toBe('myk_active');
    expect(body.grace).toBeNull();
  });

  it('sets Cache-Control no-store on the key response', async () => {
    const { app } = createStubbedApp({ state: { active, grace: null }, anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`);

    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('mints a key for a project that has never had one', async () => {
    const { app, stub } = createStubbedApp({ anyKey: false });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`);
    const body = await res.json();

    expect(stub.generated).toHaveLength(1);
    expect(body.active.key).toBe('myk_generated');
  });

  it('does not mint a key for a project whose key was revoked', async () => {
    const { app, stub } = createStubbedApp({ anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`);
    const body = await res.json();

    expect(stub.generated).toHaveLength(0);
    expect(body.active).toBeNull();
  });

  it('generates a key on request when none is active', async () => {
    const { app, stub } = createStubbedApp({ anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`, { method: 'POST' });

    expect(res.status).toBe(201);
    expect(stub.generated).toHaveLength(1);
  });

  it('rejects generating a key when one is already active', async () => {
    const { app, stub } = createStubbedApp({ state: { active, grace: null }, anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`, { method: 'POST' });

    expect(res.status).toBe(409);
    expect(stub.generated).toHaveLength(0);
  });

  it('rolls the key and returns the new state', async () => {
    const rolledState = {
      active: keyRecord('myk_new', null),
      grace: keyRecord('myk_old', new Date('2026-07-26T12:00:00.000Z')),
    };
    const { app, stub } = createStubbedApp({
      state: { active, grace: null },
      anyKey: true,
      rollResult: rolledState,
    });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key/roll`, { method: 'POST' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(stub.rolled).toBe(1);
    expect(body.active.key).toBe('myk_new');
    expect(body.grace.key).toBe('myk_old');
  });

  it('rejects rolling when there is no active key', async () => {
    const { app } = createStubbedApp({ anyKey: true, rollResult: null });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key/roll`, { method: 'POST' });

    expect(res.status).toBe(409);
  });

  it('revokes the active and grace keys', async () => {
    const { app, stub } = createStubbedApp({ state: { active, grace: null }, anyKey: true });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key`, { method: 'DELETE' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(stub.revokedAll).toBe(1);
    expect(body.active).toBeNull();
  });

  it('revokes only the grace key', async () => {
    const { app, stub } = createStubbedApp({
      state: { active, grace: keyRecord('myk_old', new Date('2026-07-26T12:00:00.000Z')) },
      anyKey: true,
    });

    const res = await app.request(`/v1/projects/${PROJECT_ID}/key/grace`, { method: 'DELETE' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(stub.revokedGrace).toBe(1);
    expect(body.active.key).toBe('myk_active');
    expect(body.grace).toBeNull();
  });

  it('rejects an unknown project', async () => {
    const container = {
      repos: { projects: { get: async () => null }, projectKeys: {} },
    } as unknown as Container;

    const res = await createApp(container).request(`/v1/projects/${PROJECT_ID}/key`);

    expect(res.status).toBe(404);
  });

  it('rejects a malformed project id', async () => {
    const { app } = createStubbedApp();

    const res = await app.request('/v1/projects/not-a-uuid/key');

    expect(res.status).toBe(400);
  });
});
