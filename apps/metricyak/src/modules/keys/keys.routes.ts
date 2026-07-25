import { createRoute } from '@hono/zod-openapi';
import type { ProjectKeyState } from '@metricyak/storage';
import type { Context } from 'hono';
import { ConflictError, errorResponse } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { requireProject } from '@/http/scope.js';
import { ensureKeyForProject } from '@/modules/keys/ensure-key.js';
import { ProjectKeyParams, ProjectKeyStateResponse } from '@/modules/keys/keys.schemas.js';

export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

function stateResponse(state: ProjectKeyState) {
  return {
    active: state.active
      ? {
          key: state.active.key,
          createdAt: state.active.createdAt.toISOString(),
          lastUsedAt: state.active.lastUsedAt ? state.active.lastUsedAt.toISOString() : null,
        }
      : null,
    grace: state.grace?.expiresAt
      ? { key: state.grace.key, expiresAt: state.grace.expiresAt.toISOString() }
      : null,
  };
}

function withoutStoring(c: Context): void {
  c.header('Cache-Control', 'no-store');
}

export const getProjectKeyRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/key',
  request: { params: ProjectKeyParams },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectKeyStateResponse } },
      description:
        'The current project key, and the previous key if one is still in its grace window.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

export const generateProjectKeyRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/key',
  request: { params: ProjectKeyParams },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectKeyStateResponse } },
      description: 'A project key was generated.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
    409: errorResponse('The project already has an active key.'),
  },
});

export const rollProjectKeyRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/key/roll',
  request: { params: ProjectKeyParams },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectKeyStateResponse } },
      description: 'A new key was issued and the previous key entered its grace window.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
    409: errorResponse('The project has no active key to roll.'),
  },
});

export const revokeProjectKeyRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/key',
  request: { params: ProjectKeyParams },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectKeyStateResponse } },
      description: 'Every key for the project was revoked and stops accepting events immediately.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

export const revokeGraceKeyRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/key/grace',
  request: { params: ProjectKeyParams },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectKeyStateResponse } },
      description: 'The previous key was revoked ahead of its grace deadline.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

const keysRouter = createRouter();

keysRouter.openapi(getProjectKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const state = await ensureKeyForProject(projectKeys, projectId, new Date());

  withoutStoring(c);
  return respond(c, ProjectKeyStateResponse, stateResponse(state), 200);
});

keysRouter.openapi(generateProjectKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const now = new Date();
  const existing = await projectKeys.getState(projectId, now);
  if (existing.active) {
    throw new ConflictError('This project already has an active key. Roll it instead.');
  }

  await projectKeys.generate(projectId);
  const state = await projectKeys.getState(projectId, now);

  withoutStoring(c);
  return respond(c, ProjectKeyStateResponse, stateResponse(state), 201);
});

keysRouter.openapi(rollProjectKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const state = await projectKeys.roll(projectId, GRACE_PERIOD_MS, new Date());
  if (!state) {
    throw new ConflictError('This project has no active key to roll.');
  }

  withoutStoring(c);
  return respond(c, ProjectKeyStateResponse, stateResponse(state), 200);
});

keysRouter.openapi(revokeProjectKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const now = new Date();
  await projectKeys.revokeAll(projectId, now);
  const state = await projectKeys.getState(projectId, now);

  withoutStoring(c);
  return respond(c, ProjectKeyStateResponse, stateResponse(state), 200);
});

keysRouter.openapi(revokeGraceKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const now = new Date();
  await projectKeys.revokeGrace(projectId, now);
  const state = await projectKeys.getState(projectId, now);

  withoutStoring(c);
  return respond(c, ProjectKeyStateResponse, stateResponse(state), 200);
});

export default keysRouter;
