import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";
import { ValidationError } from "@/errors/index.js";

export function validate<Schema extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: Schema,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError(
        result.error.issues.map((issue) => ({
          code: issue.code,
          detail: issue.message,
          param: issue.path.join(".") || null,
        })),
      );
    }
  });
}
