import { z } from '@hono/zod-openapi';

export const CreateOrganizationRequest = z.object({
  name: z
    .string()
    .min(1, 'The name must not be empty.')
    .max(64, 'The name must be 64 characters or fewer.')
    .openapi({ description: 'The name for the new organization.', example: 'Acme Rockets' }),
});

const OrganizationSummary = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ListOrganizationsResponse = z.array(OrganizationSummary);
export const CreateOrganizationResponse = OrganizationSummary;
