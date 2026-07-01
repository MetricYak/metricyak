import { z } from '@hono/zod-openapi';

const OrganizationIdParam = z.object({
  organizationId: z.uuid().openapi({
    param: { name: 'organizationId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const ListProjectsParams = OrganizationIdParam;
export const CreateProjectParams = OrganizationIdParam;

export const CreateProjectRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').openapi({
    description: 'The name for the new project.',
    example: 'iOS App',
  }),
});

const ProjectSummary = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ListProjectsResponse = z.array(ProjectSummary);
export const CreateProjectResponse = ProjectSummary;
