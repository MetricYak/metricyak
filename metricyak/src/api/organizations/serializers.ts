import type { OrganizationRecord } from "@/db/schema/organizations.js";
import type { OrganizationResponse } from "./schemas.js";

export function serializeOrganization(record: OrganizationRecord): OrganizationResponse {
  return {
    id: record.id,
    name: record.name,
    is_active: record.isActive,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}
