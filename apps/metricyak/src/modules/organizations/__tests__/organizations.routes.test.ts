import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
} from '@metricyak/queue';
import {
  type CreateOrganizationInput,
  type Database,
  type OrganizationRecord,
  OrganizationsRepository,
} from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { type Container, createContainer } from '@/container/container.js';

const fakeDatabase = {} as Database;

class StubOrganizations extends OrganizationsRepository {
  constructor(private readonly store: OrganizationRecord[]) {
    super(fakeDatabase);
  }

  override async list(): Promise<OrganizationRecord[]> {
    return this.store;
  }

  override async create({ name }: CreateOrganizationInput): Promise<OrganizationRecord> {
    const now = new Date();
    const org: OrganizationRecord = {
      id: '00000000-0000-4000-8000-0000000000f1',
      slug: name.toLowerCase(),
      name,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    this.store.push(org);
    return org;
  }

  override async get(): Promise<OrganizationRecord | null> {
    return null;
  }
}

function buildApp(store: OrganizationRecord[]) {
  const base = createContainer(
    fakeDatabase,
    new InMemoryEventsProducer(),
    new InMemoryMonitorSignalsProducer(),
    new InMemoryMonitorEvalProducer(),
    {} as ClickHouseClient,
    new InMemoryMonitorDirtyBuffer(),
  );
  const container: Container = {
    ...base,
    repos: { ...base.repos, organizations: new StubOrganizations(store) },
  };
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
