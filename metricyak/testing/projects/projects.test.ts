import { afterEach, describe, expect, vi } from "vitest";
import { projectResponseSchema } from "@/api/projects/schemas.js";
import type { Database } from "@/db/index.js";
import { organizations } from "@/db/schema/organizations.js";
import { projects } from "@/db/schema/projects.js";
import { post, test } from "../fixtures.js";

async function createOrganization(db: Database, isActive = true): Promise<string> {
  const [organization] = await db.insert(organizations).values({ name: "Yak Herders", isActive }).returning();
  if (!organization) {
    throw new Error("Insert returned no organization");
  }
  return organization.id;
}

const organizationNotFoundErrorResponse = {
  errors: [
    {
      error_type: "invalid_request",
      error_code: "organization_not_found",
      detail: "Organization was not found",
      param: null,
    },
  ],
};

describe("POST /api/organizations/:organization_id/projects", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates a project successfully", async ({ app, db }) => {
    const organizationId = await createOrganization(db);
    const now = new Date("2026-01-01T00:00:00.000Z");
    const projectName = "The Yaks";
    vi.setSystemTime(now);

    const response = await post(app, `/api/organizations/${organizationId}/projects`, {
      name: projectName,
    });

    expect(response.status).toBe(201);
    const body = projectResponseSchema.parse(await response.json());
    expect(body).toEqual({
      id: expect.any(String),
      name: projectName,
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const projectRecords = await db.select().from(projects);
    expect(projectRecords).toEqual([
      {
        id: body.id,
        organizationId,
        name: projectName,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  test("accepts a name of 216 characters after trimming", async ({ app, db }) => {
    const organizationId = await createOrganization(db);
    const projectName = "a".repeat(216);
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, `/api/organizations/${organizationId}/projects`, { name: ` ${projectName} ` });

    expect(response.status).toBe(201);

    const body = projectResponseSchema.parse(await response.json());
    expect(body).toEqual({
      id: expect.any(String),
      name: projectName,
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const projectRecords = await db.select().from(projects);
    expect(projectRecords).toEqual([
      {
        id: body.id,
        organizationId,
        name: projectName,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  test("returns not found for an unknown organization", async ({ app, db }) => {
    const projectName = "The Yaks";
    const response = await post(app, "/api/organizations/019a5f00-0000-7000-8000-000000000000/projects", {
      name: projectName,
    });

    expect(response.status).toBe(404);

    expect(await response.json()).toEqual(organizationNotFoundErrorResponse);
    const projectRecords = await db.select().from(projects);
    expect(projectRecords.length).toBe(0);
  });

  test("rejects an organization id that is not a uuid", async ({ app, db }) => {
    const projectName = "The Yaks";
    const response = await post(app, "/api/organizations/yak/projects", { name: projectName });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [
        {
          error_type: "invalid_request",
          error_code: "invalid_format",
          detail: "The field should be a valid UUID.",
          param: "organization_id",
        },
      ],
    });
    expect(await db.$count(projects)).toBe(0);
  });

  test("returns not found for an inactive organization", async ({ app, db }) => {
    const projectName = "The Yaks";
    const organizationId = await createOrganization(db, false);

    const response = await post(app, `/api/organizations/${organizationId}/projects`, {
      name: projectName,
    });

    expect(response.status).toBe(404);

    expect(await response.json()).toEqual(organizationNotFoundErrorResponse);

    const projectRecords = await db.select().from(projects);
    expect(projectRecords.length).toBe(0);
  });

  test.for([
    {
      case: "is longer than 216 characters",
      projectName: "a".repeat(217),
      code: "too_big",
      detail: "The field should have no more than 216 characters.",
    },
    {
      case: "is longer than 216 characters after trimming",
      projectName: ` ${"a".repeat(217)} `,
      code: "too_big",
      detail: "The field should have no more than 216 characters.",
    },
    { case: "is empty", projectName: "", code: "too_small", detail: "The field should have at least 1 character" },
    {
      case: "is only whitespace",
      projectName: "   ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "is null",
      projectName: null,
      code: "invalid_type",
      detail: "Invalid input: expected string, received null",
    },
  ])("rejects a name that $case", async ({ projectName, code, detail }, { app, db }) => {
    const organizationId = await createOrganization(db);

    const response = await post(app, `/api/organizations/${organizationId}/projects`, { name: projectName });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ error_type: "invalid_request", error_code: code, detail, param: "name" }],
    });
    const projectRecords = await db.select().from(projects);
    expect(projectRecords.length).toBe(0);
  });
});
