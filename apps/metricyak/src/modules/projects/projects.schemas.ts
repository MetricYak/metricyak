import { z } from '@hono/zod-openapi';

const OrganizationIdParam = z.object({
  organizationId: z.uuid().openapi({
    param: { name: 'organizationId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
});

export const ListProjectsParams = OrganizationIdParam;
export const CreateProjectParams = OrganizationIdParam;

export const UpdateProjectParams = z.object({
  organizationId: z.uuid().openapi({
    param: { name: 'organizationId', in: 'path' },
    example: 'd6ceaf26-fd71-4c38-90f1-2de20b946d00',
  }),
  projectId: z.uuid().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
  }),
});

export const CreateProjectRequest = z.object({
  name: z.string().min(1, 'The name must not be empty.').openapi({
    description: 'The name for the new project.',
    example: 'iOS App',
  }),
});

export const UpdateProjectRequest = z.object({
  name: z
    .string()
    .min(1, 'The name must not be empty.')
    .max(128, 'The name must be 128 characters or fewer.')
    .openapi({
      description: 'The new name for the project.',
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
export const UpdateProjectResponse = ProjectSummary;
