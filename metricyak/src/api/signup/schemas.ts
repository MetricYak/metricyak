import { z } from "zod";
import { createOrganizationSchema } from "../organizations/schemas.js";

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "The field should have at least 1 character")
    .max(150, "The field should have no more than 150 characters."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "The field should have no more than 254 characters.")
    .pipe(z.email("The field should be a valid email address.")),
  password: z
    .string()
    .min(8, "The field should have at least 8 characters")
    .max(128, "The field should have no more than 128 characters."),
  organization_name: createOrganizationSchema.shape.name,
  heard_about_us: z
    .string()
    .trim()
    .min(1, "The field should have at least 1 character")
    .max(255, "The field should have no more than 255 characters.")
    .optional(),
  job_role: z
    .string()
    .trim()
    .min(1, "The field should have at least 1 character")
    .max(100, "The field should have no more than 100 characters."),
});

export const userResponseSchema = z.object({
  id: z.uuid(),
  first_name: z.string(),
  last_name: z.string().nullable(),
  email: z.email(),
  is_email_verified: z.boolean(),
  job_role: z.string().nullable(),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
});

export const signupResponseSchema = z.object({
  user: userResponseSchema,
});

export type UserResponse = z.infer<typeof userResponseSchema>;
