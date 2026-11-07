import { z } from "zod";

export const projectsParamSchema = z.object({
  organization_id: z.uuid("The field should be a valid UUID."),
});

export const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The field should have at least 1 character")
    .max(216, "The field should have no more than 216 characters."),
});

export const projectResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  is_active: z.boolean(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
