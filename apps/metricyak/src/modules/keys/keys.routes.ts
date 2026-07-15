import { createRoute } from '@hono/zod-openapi';
import { errorResponse, NotFoundError } from '@/http/errors.js';
import { respond } from '@/http/respond.js';
import { createRouter } from '@/http/router.js';
import { requireProject } from '@/http/scope.js';
import {
  CreateProjectKeyParams,
  CreateProjectKeyRequest,
  CreateProjectKeyResponse,
  ListProjectKeysParams,
  ListProjectKeysResponse,
  RevokeProjectKeyParams,
  RevokeProjectKeyResponse,
} from '@/modules/keys/keys.schemas.js';

export const createProjectKeyRoute = createRoute({
  method: 'post',
  path: '/projects/{projectId}/keys',
  request: {
    params: CreateProjectKeyParams,
    body: {
      content: { 'application/json': { schema: CreateProjectKeyRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateProjectKeyResponse } },
      description: 'A project key was created.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The project could not be found.'),
  },
});

export const listProjectKeysRoute = createRoute({
  method: 'get',
  path: '/projects/{projectId}/keys',
  request: {
    params: ListProjectKeysParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListProjectKeysResponse } },
      description: 'Project keys for the project.',
    },
    404: errorResponse('The project could not be found.'),
  },
});

export const revokeProjectKeyRoute = createRoute({
  method: 'delete',
  path: '/projects/{projectId}/keys/{keyId}',
  request: {
    params: RevokeProjectKeyParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: RevokeProjectKeyResponse } },
      description: 'The project key has been revoked and will no longer accept events.',
    },
    404: errorResponse('The project or project key could not be found.'),
  },
});

const keysRouter = createRouter();

keysRouter.openapi(createProjectKeyRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { name } = c.req.valid('json');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const record = await projectKeys.create({ projectId, name });

  return respond(
    c,
    CreateProjectKeyResponse,
    {
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      key: record.key,
      createdAt: record.createdAt.toISOString(),
    },
    201,
  );
});

keysRouter.openapi(listProjectKeysRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const records = await projectKeys.listByProject(projectId);

  return respond(
    c,
    ListProjectKeysResponse,
    records.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
      revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
    })),
    200,
  );
});

keysRouter.openapi(revokeProjectKeyRoute, async (c) => {
  const { projectId, keyId } = c.req.valid('param');
  const { projectKeys, projects } = c.var.container.repos;

  await requireProject(projects, projectId);

  const revoked = await projectKeys.revoke(projectId, keyId);
  if (!revoked) {
    throw new NotFoundError('The project key could not be found.');
  }

  return respond(c, RevokeProjectKeyResponse, { revoked: true }, 200);
});

export default keysRouter;
