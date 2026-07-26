import { describe, expect, it } from 'vitest';
import { createApp } from '@/app.js';
import type { Container } from '@/container/container.js';

const ORG_ID = 'b1a2c3d4-e5f6-4789-abcd-ef0123456789';
const PROJECT_ID = 'd6ceaf26-fd71-4c38-90f1-2de20b946d00';

const TRANSACTION = Symbol('transaction');

function createStubbedApp({ failKeyMinting = false }: { failKeyMinting?: boolean } = {}) {
  const generatedFor: string[] = [];
  const createdNames: string[] = [];
  const writeExecutors: unknown[] = [];
  let rolledBack = false;

  const container = {
    db: {
      transaction: async (run: (tx: unknown) => Promise<unknown>) => {
        try {
          return await run(TRANSACTION);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    },
    repos: {
      organizations: { get: async () => ({ id: ORG_ID }) },
      projects: {
        create: async ({ name }: { name: string }, executor?: unknown) => {
          createdNames.push(name);
          writeExecutors.push(executor);
          return {
            id: PROJECT_ID,
            organizationId: ORG_ID,
            name,
            createdAt: new Date('2026-07-25T12:00:00.000Z'),
            updatedAt: new Date('2026-07-25T12:00:00.000Z'),
          };
        },
      },
      projectKeys: {
        generate: async (projectId: string, executor?: unknown) => {
          generatedFor.push(projectId);
          writeExecutors.push(executor);
          if (failKeyMinting) throw new Error('key minting failed');
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

  return {
    app: createApp(container),
    generatedFor,
    createdNames,
    writeExecutors,
    wasRolledBack: () => rolledBack,
  };
}

function postProject(app: ReturnType<typeof createApp>, name: string): Promise<Response> {
  return app.request(`/v1/organizations/${ORG_ID}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

describe('project creation', () => {
  it('mints a project key for the new project', async () => {
    const { app, generatedFor } = createStubbedApp();

    const res = await postProject(app, 'Proj');

    expect(res.status).toBe(201);
    expect(generatedFor).toEqual([PROJECT_ID]);
  });

  it('writes the project and its key on one transaction', async () => {
    const { app, writeExecutors } = createStubbedApp();

    await postProject(app, 'Proj');

    expect(writeExecutors).toHaveLength(2);
    expect(writeExecutors.every((executor) => executor === TRANSACTION)).toBe(true);
  });

  it('rolls the project back when its key cannot be minted', async () => {
    const { app, wasRolledBack } = createStubbedApp({ failKeyMinting: true });

    const res = await postProject(app, 'Proj');

    expect(res.status).toBe(500);
    expect(wasRolledBack()).toBe(true);
  });

  it('trims surrounding whitespace from the name', async () => {
    const { app, createdNames } = createStubbedApp();

    const res = await postProject(app, '  Proj  ');

    expect(res.status).toBe(201);
    expect(createdNames).toEqual(['Proj']);
  });

  it('rejects a name that is only whitespace', async () => {
    const { app, createdNames } = createStubbedApp();

    const res = await postProject(app, '   ');

    expect(res.status).toBe(400);
    expect(createdNames).toEqual([]);
  });
});
