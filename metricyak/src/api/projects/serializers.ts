import type { ProjectRecord } from "@/db/schema/projects.js";
import type { ProjectResponse } from "./schemas.js";

export function serializeProject(record: ProjectRecord): ProjectResponse {
  return {
    id: record.id,
    name: record.name,
    is_active: record.isActive,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}
