import { eq } from "drizzle-orm";
import { afterEach, describe, expect, vi } from "vitest";
import { organizationResponseSchema } from "@/api/organizations/schemas.js";
import { organizations } from "@/db/schema/organizations.js";
import { post, test } from "../fixtures.js";

describe("POST /api/organizations", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates an organization", async ({ app, db }) => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    vi.setSystemTime(now);

    const response = await post(app, "/api/organizations", { name: "MetricYak" });

    expect(response.status).toBe(201);
    const body = organizationResponseSchema.parse(await response.json());
    expect(body).toEqual({
      id: expect.any(String),
      name: "MetricYak",
      is_active: true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    const records = await db.select().from(organizations).where(eq(organizations.id, body.id));
    expect(records).toEqual([{ id: body.id, name: "MetricYak", isActive: true, createdAt: now, updatedAt: now }]);
  });

  test.for([
    {
      case: "is longer than 72 characters",
      name: "a".repeat(73),
      code: "too_big",
      detail: "The field should have no more than 72 characters.",
    },
    {
      case: "is longer than 72 characters after trimming",
      name: ` ${"a".repeat(73)} `,
      code: "too_big",
      detail: "The field should have no more than 72 characters.",
    },
    { case: "is empty", name: "", code: "too_small", detail: "The field should have at least 1 character" },
    {
      case: "is only whitespace",
      name: "   ",
      code: "too_small",
      detail: "The field should have at least 1 character",
    },
    {
      case: "is null",
      name: null,
      code: "invalid_type",
      detail: "Invalid input: expected string, received null",
    },
  ])("rejects a name that $case", async ({ name, code, detail }, { app, db }) => {
    const response = await post(app, "/api/organizations", { name });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      errors: [{ error_type: "invalid_request", error_code: code, detail, param: "name" }],
    });
    expect(await db.$count(organizations)).toBe(0);
  });
});
