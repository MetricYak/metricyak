import type { UserRecord } from "@/db/schema/users.js";
import type { UserResponse } from "./schemas.js";

export function serializeUser(record: UserRecord): UserResponse {
  return {
    id: record.id,
    first_name: record.firstName,
    last_name: record.lastName,
    email: record.email,
    is_email_verified: record.emailVerifiedAt !== null,
    job_role: record.jobRole,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}
