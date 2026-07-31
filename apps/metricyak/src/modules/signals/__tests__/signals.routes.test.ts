import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorFiringsProducer,
} from '@metricyak/queue';
import { createSecretCipher, MasterKey } from '@metricyak/secrets';
import type {
  CreateSecretInput,
  CreateSignalSourceInput,
  Database,
  ProjectRecord,
  SecretRecord,
  SignalSourceRecord,
} from '@metricyak/storage';
import { ProjectsRepository, SignalSourcesRepository } from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { type Container, createContainer } from '@/container/container.js';

const fakeDatabase = {} as Database;
const projectId = '00000000-0000-4000-8000-0000000000f2';
const sourceId = '00000000-0000-4000-8000-0000000000a1';
const secretId = '00000000-0000-4000-8000-0000000000b1';

const project: ProjectRecord = {
  id: projectId,
  organizationId: '00000000-0000-4000-8000-0000000000f1',
  name: 'Proj',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
};

class StubProjects extends ProjectsRepository {
  constructor() {
    super(fakeDatabase);
  }

  override async get(id: string): Promise<ProjectRecord | null> {
    return id === projectId ? project : null;
  }
}

class StubSignalSources extends SignalSourcesRepository {
  readonly store: SignalSourceRecord[] = [];

  constructor() {
    super(fakeDatabase);
  }

  override async create(input: CreateSignalSourceInput): Promise<SignalSourceRecord> {
    const record: SignalSourceRecord = {
      id: sourceId,
      projectId: input.projectId,
      name: input.name,
      provider: input.provider,
      connectionKind: 'manual_webhook',
      config: input.config,
      installationId: null,
      secretId: input.secretId ?? null,
      status: 'awaiting_first_delivery',
      lastDeliveryAt: null,
      lastError: null,
      createdAt: new Date('2026-07-30T00:00:00Z'),
      updatedAt: new Date('2026-07-30T00:00:00Z'),
    };
    this.store.push(record);
    return record;
  }

  override async listByProject(id: string): Promise<SignalSourceRecord[]> {
    return this.store.filter((record) => record.projectId === id);
  }

  override async delete(id: string, ownerProjectId: string): Promise<boolean> {
    const index = this.store.findIndex(
      (record) => record.id === id && record.projectId === ownerProjectId,
    );
    if (index < 0) return false;
    this.store.splice(index, 1);
    return true;
  }
}

function buildApp(signalSources: StubSignalSources) {
  const created: CreateSecretInput[] = [];
  const base = createContainer(
    fakeDatabase,
    new InMemoryEventsProducer(),
    new InMemoryMonitorFiringsProducer(),
    new InMemoryMonitorEvalProducer(),
    {} as ClickHouseClient,
    new InMemoryMonitorDirtyBuffer(),
    createSecretCipher(MasterKey.of(Buffer.alloc(32, 7))),
  );
  const container: Container = {
    ...base,
    repos: {
      ...base.repos,
      projects: new StubProjects(),
      signalSources,
      secrets: {
        ...base.repos.secrets,
        async create(input: CreateSecretInput): Promise<SecretRecord> {
          created.push(input);
          return {
            id: secretId,
            projectId: input.projectId,
            name: input.name,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        },
      },
    },
  };
  return { app: createApp(container), created };
}

const githubSource = {
  name: 'acme/web',
  provider: 'github',
  config: { repo: 'acme/web', environments: [] },
};

describe('signal source routes', () => {
  let signalSources: StubSignalSources;

  beforeEach(() => {
    signalSources = new StubSignalSources();
  });

  it('serves each connector settings schema so the form can be rendered', async () => {
    const { app } = buildApp(signalSources);

    const response = await app.request('/v1/connectors');
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.connectors).toHaveLength(1);
    expect(body.connectors[0].provider).toBe('github');
    expect(body.connectors[0].configSchema.properties.repo).toBeDefined();
    expect(body.connectors[0].configSchema.properties.environments).toBeDefined();
  });

  it('creates a source and returns the payload url and secret once', async () => {
    const { app, created } = buildApp(signalSources);

    const response = await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(githubSource),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.secret).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(body.source.webhookUrl).toContain(`/webhooks/signals/${sourceId}`);
    expect(body.source.status).toBe('awaiting_first_delivery');
    expect(body.source.secretConfigured).toBe(true);
    expect(created).toHaveLength(1);
  });

  it('rejects settings the connector does not accept', async () => {
    const { app } = buildApp(signalSources);

    const response = await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...githubSource, config: { repo: 'not-a-repo' } }),
    });

    expect(response.status).toBe(400);
    expect(signalSources.store).toHaveLength(0);
  });

  it('rejects a connector nobody has registered', async () => {
    const { app } = buildApp(signalSources);

    const response = await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...githubSource, provider: 'bitbucket' }),
    });

    expect(response.status).toBe(404);
    expect(signalSources.store).toHaveLength(0);
  });

  it('does not create a source for a project that does not exist', async () => {
    const { app } = buildApp(signalSources);

    const response = await app.request(
      '/v1/projects/00000000-0000-4000-8000-0000000000ff/signal-sources',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(githubSource),
      },
    );

    expect(response.status).toBe(404);
    expect(signalSources.store).toHaveLength(0);
  });

  it('never returns the secret when listing sources', async () => {
    const { app } = buildApp(signalSources);
    await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(githubSource),
    });

    const response = await app.request(`/v1/projects/${projectId}/signal-sources`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.sources).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('whsec_');
    expect(body.sources[0].secretConfigured).toBe(true);
  });

  it('deletes a source', async () => {
    const { app } = buildApp(signalSources);
    await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(githubSource),
    });

    const response = await app.request(`/v1/projects/${projectId}/signal-sources/${sourceId}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(200);
    expect(signalSources.store).toHaveLength(0);
  });

  it('will not delete a source belonging to another project', async () => {
    const { app } = buildApp(signalSources);
    await app.request(`/v1/projects/${projectId}/signal-sources`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(githubSource),
    });

    const response = await app.request(
      `/v1/projects/00000000-0000-4000-8000-0000000000ff/signal-sources/${sourceId}`,
      { method: 'DELETE' },
    );

    expect(response.status).toBe(404);
    expect(signalSources.store).toHaveLength(1);
  });
});
