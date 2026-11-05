import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The field should have at least 1 character")
    .max(72, "The field should have no more than 72 characters."),
});

export const organizationResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;
