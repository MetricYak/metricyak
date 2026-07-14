import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '../../http/errors.js';
import { respond } from '../../http/respond.js';
import { createRouter } from '../../http/router.js';
import { orNotFound } from '../../http/scope.js';
import {
  CreateProjectParams,
  CreateProjectRequest,
  CreateProjectResponse,
  ListProjectsParams,
  ListProjectsResponse,
  UpdateProjectParams,
  UpdateProjectRequest,
  UpdateProjectResponse,
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

export const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/organizations/{organizationId}/projects/{projectId}',
  request: {
    params: UpdateProjectParams,
    body: {
      content: { 'application/json': { schema: UpdateProjectRequest } },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UpdateProjectResponse } },
      description: 'The project was updated.',
    },
    400: errorResponse('The request failed validation.'),
    404: errorResponse('The organization or project could not be found.'),
  },
});

const projectsRouter = createRouter();

projectsRouter.openapi(listProjectsRoute, async (c) => {
  const { organizationId } = c.req.valid('param');
  const { organizations, projects } = c.var.container.repos;

  orNotFound(await organizations.get(organizationId), 'The organization could not be found.');

  const records = await projects.listByOrganization(organizationId);

  return respond(
    c,
    ListProjectsResponse,
    records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      name: r.name,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    200,
  );
});

projectsRouter.openapi(createProjectRoute, async (c) => {
  const { organizationId } = c.req.valid('param');
  const { name } = c.req.valid('json');
  const { organizations, projects } = c.var.container.repos;

  orNotFound(await organizations.get(organizationId), 'The organization could not be found.');

  const record = await projects.create({ organizationId, name });

  return respond(
    c,
    CreateProjectResponse,
    {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
    201,
  );
});

projectsRouter.openapi(updateProjectRoute, async (c) => {
  const { organizationId, projectId } = c.req.valid('param');
  const { name } = c.req.valid('json');
  const { organizations, projects } = c.var.container.repos;

  orNotFound(await organizations.get(organizationId), 'The organization could not be found.');
  orNotFound(await projects.get(projectId, organizationId), 'The project could not be found.');

  const record = orNotFound(
    await projects.update(projectId, { name }),
    'The project could not be found.',
  );

  return respond(
    c,
    UpdateProjectResponse,
    {
      id: record.id,
      organizationId: record.organizationId,
      name: record.name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    },
    200,
  );
});

export default projectsRouter;
