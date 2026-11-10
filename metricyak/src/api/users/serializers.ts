import type { UserRecord } from "@/db/schema/users.js";
import { serializeUser } from "../signup/serializers.js";
import type { CurrentUserResponse } from "./schemas.js";

export function serializeCurrentUser(
  record: UserRecord,
  currentOrganizationId: string | null,
  currentProjectId: string | null,
): CurrentUserResponse {
  return {
    ...serializeUser(record),
    current_organization_id: currentOrganizationId,
    current_project_id: currentProjectId,
  };
}
