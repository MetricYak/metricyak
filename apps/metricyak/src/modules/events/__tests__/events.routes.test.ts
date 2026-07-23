import type { ClickHouseClient } from '@metricyak/clickhouse';
import {
  InMemoryEventsProducer,
  InMemoryMonitorDirtyBuffer,
  InMemoryMonitorEvalProducer,
  InMemoryMonitorSignalsProducer,
} from '@metricyak/queue';
import type { Database, ProjectRecord } from '@metricyak/storage';
import { ProjectsRepository } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import { type Container, createContainer } from '@/container/container.js';
import type { EventRecord, EventsReads } from '@/modules/events/events-reads.js';

const fakeDatabase = {} as Database;
const projectId = '00000000-0000-4000-8000-0000000000f3';

class StubProjects extends ProjectsRepository {
  constructor(private readonly project: ProjectRecord | null) {
    super(fakeDatabase);
  }

  override async get(id: string): Promise<ProjectRecord | null> {
    return this.project && this.project.id === id ? this.project : null;
  }
}

function fakeEventsReads(events: EventRecord[], hasMore = false): EventsReads {
  return {
    listPage: async () => ({ events, hasMore }),
  };
}

function buildApp(project: ProjectRecord | null, eventsReads: EventsReads = fakeEventsReads([])) {
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
    eventsReads,
    repos: { ...base.repos, projects: new StubProjects(project) },
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

describe('events read routes', () => {
  it('GET /v1/projects/:projectId/events returns 404 for an unknown project', async () => {
    const res = await buildApp(null).request(`/v1/projects/${projectId}/events`);
    expect(res.status).toBe(404);
  });

  it('GET /v1/projects/:projectId/events returns an empty page', async () => {
    const res = await buildApp(project).request(`/v1/projects/${projectId}/events`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events: [], hasMore: false });
  });

  it('returns events and hasMore exactly as the port reports them', async () => {
    const events: EventRecord[] = [
      {
        id: '1',
        name: 'page.viewed',
        timestamp: '2026-01-01T00:00:00.000Z',
        properties: { path: '/pricing' },
      },
      {
        id: '2',
        name: 'page.viewed',
        timestamp: '2026-01-01T00:01:00.000Z',
        properties: { path: '/docs' },
      },
    ];
    const res = await buildApp(project, fakeEventsReads(events, true)).request(
      `/v1/projects/${projectId}/events?pageSize=25`,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ events, hasMore: true });
  });

  it('rejects a pageSize outside the allowed set with 400', async () => {
    const res = await buildApp(project).request(`/v1/projects/${projectId}/events?pageSize=30`);
    expect(res.status).toBe(400);
  });

  it('rejects a negative page with 400', async () => {
    const res = await buildApp(project).request(`/v1/projects/${projectId}/events?page=-1`);
    expect(res.status).toBe(400);
  });
});
