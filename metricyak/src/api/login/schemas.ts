import { z } from "zod";
import { signupSchema, userResponseSchema } from "../signup/schemas.js";

export const loginSchema = z.object({
  email: signupSchema.shape.email,
  password: z
    .string()
    .min(1, "The field should have at least 1 character")
    .max(128, "The field should have no more than 128 characters."),
});

export const loginResponseSchema = z.object({
  user: userResponseSchema,
});
