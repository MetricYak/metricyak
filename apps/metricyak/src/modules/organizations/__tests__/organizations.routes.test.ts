import { InMemoryEventsProducer } from '@metricyak/queue';
import type { Database, OrganizationRecord } from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { createContainer } from '../../../container/container.js';

function buildApp(store: OrganizationRecord[]) {
  const container = createContainer({} as Database, new InMemoryEventsProducer());
  const stub = {
    async list() {
      return store;
    },
    async create({ name }: { name: string }) {
      const now = new Date();
      const org: OrganizationRecord = {
        id: '00000000-0000-4000-8000-0000000000f1',
        slug: name.toLowerCase(),
        name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.push(org);
      return org;
    },
    async get() {
      return null;
    },
  };
  (container.repositories as { organizations: unknown }).organizations = stub;
  return createApp(container);
}

describe('organizations routes', () => {
  let store: OrganizationRecord[];
  beforeEach(() => {
    store = [];
  });

  it('GET /v1/organizations returns an empty array when there are none', async () => {
    const res = await buildApp(store).request('/v1/organizations');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /v1/organizations creates and returns an organization', async () => {
    const res = await buildApp(store).request('/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Acme');
    expect(body.slug).toBe('acme');
    expect(typeof body.createdAt).toBe('string');
  });

  it('POST /v1/organizations rejects an empty name with 400', async () => {
    const res = await buildApp(store).request('/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});
