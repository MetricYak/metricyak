import { createRoute } from '@hono/zod-openapi';
import { errorResponse, NotFoundError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  CreateProjectKeyParams,
  CreateProjectKeyRequest,
  CreateProjectKeyResponse,
  ListProjectKeysParams,
  ListProjectKeysResponse,
  RevokeProjectKeyParams,
  RevokeProjectKeyResponse,
} from './keys.schemas.js';

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
  const { projectKeys, repositories } = c.var.container;

  const project = await repositories.projects.get(projectId);
  if (!project) {
    throw new NotFoundError('The project could not be found.');
  }

  const record = await projectKeys.create({ projectId, name });

  return c.json(
    CreateProjectKeyResponse.parse({
      id: record.id,
      projectId: record.projectId,
      name: record.name,
      key: record.key,
      createdAt: record.createdAt.toISOString(),
    }),
    201,
  );
});

keysRouter.openapi(listProjectKeysRoute, async (c) => {
  const { projectId } = c.req.valid('param');
  const { projectKeys, repositories } = c.var.container;

  const project = await repositories.projects.get(projectId);
  if (!project) {
    throw new NotFoundError('The project could not be found.');
  }

  const records = await projectKeys.listByProject(projectId);

  return c.json(
    ListProjectKeysResponse.parse(
      records.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
      })),
    ),
    200,
  );
});

keysRouter.openapi(revokeProjectKeyRoute, async (c) => {
  const { projectId, keyId } = c.req.valid('param');
  const { projectKeys, repositories } = c.var.container;

  const project = await repositories.projects.get(projectId);
  if (!project) {
    throw new NotFoundError('The project could not be found.');
  }

  const revoked = await projectKeys.revoke(projectId, keyId);
  if (!revoked) {
    throw new NotFoundError('The project key could not be found.');
  }

  return c.json({ revoked: true }, 200);
});

export default keysRouter;
