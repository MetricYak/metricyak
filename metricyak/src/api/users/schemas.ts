import { z } from "zod";
import { userResponseSchema } from "../signup/schemas.js";

export const currentUserResponseSchema = userResponseSchema.extend({
  current_organization_id: z.uuid().nullable(),
  current_project_id: z.uuid().nullable(),
});

export const getCurrentUserResponseSchema = z.object({
  user: currentUserResponseSchema,
});

export type CurrentUserResponse = z.infer<typeof currentUserResponseSchema>;
