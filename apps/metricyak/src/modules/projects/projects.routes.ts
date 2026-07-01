import { createRoute } from '@hono/zod-openapi';
import { errorResponse, NotFoundError } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  CreateProjectParams,
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsParams,
  ListProjectsResponse,
} from './projects.schemas.js';

export const listProjectsRoute = createRoute({
  method: 'get',
  path: '/organizations/{organizationId}/projects',
  request: {
    params: ListProjectsParams,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListProjectsResponse } },
      description: 'Projects for the organization.',
    },
    404: errorResponse('The organization could not be found.'),
  },
});

export const createProjectRoute = createRoute({
  method: 'post',
  path: '/organizations/{organizationId}/projects',
  request: {
    params: CreateProjectParams,
    body: {
      content: { 'application/json': { schema: CreateProjectRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateProjectResponse } },
      description: 'A project was created.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The organization could not be found.'),
  },
});

const projectsRouter = createRouter();

projectsRouter.openapi(listProjectsRoute, async (c) => {
  const { organizationId } = c.req.valid('param');
  const { organizations, projects } = c.var.container.repositories;

  const organization = await organizations.get(organizationId);
  if (!organization) {
    throw new NotFoundError('The organization could not be found.');
  }

  const records = await projects.listByOrganization(organizationId);

  return c.json(
    ListProjectsResponse.parse(
      records.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    ),
    200,
  );
});

projectsRouter.openapi(createProjectRoute, async (c) => {
  const { organizationId } = c.req.valid('param');
  const { name } = c.req.valid('json');
  const { organizations, projects } = c.var.container.repositories;

  const organization = await organizations.get(organizationId);
  if (!organization) {
    throw new NotFoundError('The organization could not be found.');
  }

  const record = await projects.create({ organizationId, name });

  return c.json(
    CreateProjectResponse.parse({
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }),
    201,
  );
});

export default projectsRouter;
