import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  ListOrganizationsResponse,
} from './organizations.schemas.js';

export const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  responses: {
    200: {
      content: { 'application/json': { schema: ListOrganizationsResponse } },
      description: 'All organizations.',
    },
  },
});

export const createOrganizationRoute = createRoute({
  method: 'post',
  path: '/organizations',
  request: {
    body: {
      content: { 'application/json': { schema: CreateOrganizationRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateOrganizationResponse } },
      description: 'An organization was created.',
    },
    400: errorResponse('The request failed validation.'),
  },
});

const organizationsRouter = createRouter();

organizationsRouter.openapi(listOrganizationsRoute, async (c) => {
  const { organizations } = c.var.container.repositories;
  const records = await organizations.list();

  return c.json(
    ListOrganizationsResponse.parse(
      records.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    ),
    200,
  );
});

organizationsRouter.openapi(createOrganizationRoute, async (c) => {
  const { name } = c.req.valid('json');
  const { organizations } = c.var.container.repositories;
  const record = await organizations.create({ name });

  return c.json(
    CreateOrganizationResponse.parse({
      id: record.id,
      slug: record.slug,
      name: record.name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }),
    201,
  );
});

export default organizationsRouter;
