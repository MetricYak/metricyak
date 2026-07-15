import { InMemoryEventsProducer, InMemoryMonitorSignalsProducer } from '@metricyak/queue';
import type { CreateMetricInput, Database, MetricRecord, ProjectRecord } from '@metricyak/storage';
import { MetricsRepository, ProjectsRepository } from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { type Container, createContainer } from '@/container/container.js';

const fakeDatabase = {} as Database;
const projectId = '00000000-0000-4000-8000-0000000000f2';

class StubProjects extends ProjectsRepository {
  constructor(private readonly project: ProjectRecord | null) {
    super(fakeDatabase);
  }

  override async get(id: string): Promise<ProjectRecord | null> {
    return this.project && this.project.id === id ? this.project : null;
  }
}

class StubMetrics extends MetricsRepository {
  constructor(private readonly store: MetricRecord[]) {
    super(fakeDatabase);
  }

  override async listForProject(id: string): Promise<MetricRecord[]> {
    return this.store.filter((record) => record.projectId === id);
  }

  override async create(input: CreateMetricInput): Promise<MetricRecord> {
    const now = new Date();
    const record: MetricRecord = {
      id: `00000000-0000-4000-8000-${(this.store.length + 1).toString().padStart(12, '0')}`,
      projectId: input.projectId,
      version: 1,
      name: input.name,
      description: input.description ?? null,
      definition: input.definition,
      createdAt: now,
      updatedAt: now,
    };
    this.store.push(record);
    return record;
  }
}

function buildApp(store: MetricRecord[], project: ProjectRecord | null) {
  const base = createContainer(
    fakeDatabase,
    new InMemoryEventsProducer(),
    new InMemoryMonitorSignalsProducer(),
  );
  const container: Container = {
    ...base,
    repos: {
      ...base.repos,
      metrics: new StubMetrics(store),
      projects: new StubProjects(project),
    },
  };
  return createApp(container);
}

const project: ProjectRecord = {
  id: projectId,
  organizationId: '00000000-0000-4000-8000-0000000000f0',
  name: 'Acme',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('metrics routes', () => {
  let store: MetricRecord[];
  beforeEach(() => {
    store = [];
  });

  it('GET /v1/projects/:projectId/metrics returns 404 for an unknown project', async () => {
    const res = await buildApp(store, null).request(`/v1/projects/${projectId}/metrics`);
    expect(res.status).toBe(404);
  });

  it('GET /v1/projects/:projectId/metrics returns an empty array when there are none', async () => {
    const res = await buildApp(store, project).request(`/v1/projects/${projectId}/metrics`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST then GET returns the created metric', async () => {
    const app = buildApp(store, project);
    const createRes = await app.request(`/v1/projects/${projectId}/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Monthly Active Users',
        description: 'Distinct users active in the last 30 days.',
        definition: {
          events: [
            { key: 'mau', source: 'posthog', type: 'session.started', aggregation: 'count' },
          ],
        },
      }),
    });
    expect(createRes.status).toBe(201);

    const listRes = await app.request(`/v1/projects/${projectId}/metrics`);
    expect(listRes.status).toBe(200);
    const body = await listRes.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Monthly Active Users');
    expect(body[0].definition.events[0].key).toBe('mau');
  });

  it('POST /v1/projects/:projectId/metrics rejects an empty name with 400', async () => {
    const res = await buildApp(store, project).request(`/v1/projects/${projectId}/metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        definition: {
          events: [
            { key: 'mau', source: 'posthog', type: 'session.started', aggregation: 'count' },
          ],
        },
      }),
    });
    expect(res.status).toBe(400);
  });
});
