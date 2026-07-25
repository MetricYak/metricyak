import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import type { Container } from '@/container/container.js';

const ORG_ID = 'b1a2c3d4-e5f6-4789-abcd-ef0123456789';
const PROJECT_ID = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';

function createStubbedApp() {
  const generatedFor: string[] = [];

  const container = {
    repos: {
      organizations: { get: async () => ({ id: ORG_ID }) },
      projects: {
        create: async () => ({
          id: PROJECT_ID,
          organizationId: ORG_ID,
          name: 'Proj',
          createdAt: new Date('2026-07-25T12:00:00.000Z'),
          updatedAt: new Date('2026-07-25T12:00:00.000Z'),
        }),
      },
      projectKeys: {
        generate: async (projectId: string) => {
          generatedFor.push(projectId);
          return {
            id: 'key-1',
            projectId,
            key: 'myk_new',
            createdAt: new Date(),
            lastUsedAt: null,
            expiresAt: null,
          };
        },
      },
    },
  } as unknown as Container;

  return { app: createApp(container), generatedFor };
}

describe('project creation', () => {
  it('mints a project key for the new project', async () => {
    const { app, generatedFor } = createStubbedApp();

    const res = await app.request(`/v1/organizations/${ORG_ID}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Proj' }),
    });

    expect(res.status).toBe(201);
    expect(generatedFor).toEqual([PROJECT_ID]);
  });
});
