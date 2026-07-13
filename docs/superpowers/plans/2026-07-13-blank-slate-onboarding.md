# Blank-slate Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh MetricYak install work with no seed script by adding first-class organization creation, a UI onboarding flow, fail-fast config/schema checks, and setup docs.

**Architecture:** Add an `organizations` API module (list/create) mirroring the existing `projects` module; back it with new `OrganizationsRepository` methods that own slug generation and uniqueness. In the UI, replace the hardcoded org stub with real API calls, give `ProjectContext` an explicit bootstrap status, and render an onboarding screen when no organization exists. Harden startup with fail-fast `DATABASE_URL` validation and a schema-presence probe, and document the setup in `.env.example` + README.

**Tech Stack:** TypeScript, Hono + `@hono/zod-openapi`, Drizzle ORM (node-postgres), Zod, React + React Router, Vitest, Testcontainers, pnpm workspaces + Turborepo.

## Global Constraints

- No auth, users, sessions, or tenant scoping — explicitly out of scope; design must not add them.
- Migrations stay explicit (`pnpm db:migrate`) in dev and prod — never auto-run on boot.
- No automatic seeding anywhere; `pnpm db:seed` remains a manual convenience only.
- Organization `name` and `slug` columns are `varchar(64)`; `slug` is `.notNull().unique()`.
- Follow existing module conventions: `*.routes.ts`, `*.schemas.ts`, `*.module.ts`, registered in `modules/index.ts`.
- Route tests: `createApp(createContainer(...))` + `app.request(...)` with `InMemoryEventsProducer` and a stubbed DB/repository (per `AGENTS.md`).
- Integration tests use Testcontainers `postgres:17-alpine` and require Docker.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- Error responses are arrays of `ErrorItem` (`error_type`, `error_code`, `message`, `attribute`) via `AppError` subclasses.

> **Note on repository interface (minor spec refinement):** The spec sketched `OrganizationsRepository.create({ name, slug })`. This plan has the repository own slug generation and collision retry via `create({ name })`, because uniqueness is a persistence concern best kept next to the unique constraint. The HTTP contract (`POST /v1/organizations` with `{ name }`) is unchanged.

> **Note on git policy:** Commit steps below are the standard TDD rhythm for the implementer. This repo's org policy is "don't commit/push without explicit ask" — the human driving execution authorizes these commits by choosing to run the plan.

---

## File structure

**Backend — `packages/storage`:**
- Create `src/lib/slug.ts` — pure `slugify(name)` helper.
- Modify `src/repositories/organizations.repository.ts` — add `list()`, `create({ name })`.
- Create `src/repositories/__tests__/organizations.integration.test.ts` — repo integration tests.
- Create `src/lib/__tests__/slug.test.ts` — slug unit tests.

**Backend — `apps/metricyak`:**
- Create `src/modules/organizations/organizations.schemas.ts`
- Create `src/modules/organizations/organizations.routes.ts`
- Create `src/modules/organizations/organizations.module.ts`
- Create `src/modules/organizations/__tests__/organizations.routes.test.ts`
- Modify `src/modules/index.ts` — register `organizationsModule`.
- Modify `src/config.ts` — export `parseConfig`, tighten `DATABASE_URL`.
- Create `src/__tests__/config.test.ts`
- Create `src/bootstrap/schema.ts` — `assertSchemaReady(db)`.
- Create `src/bootstrap/__tests__/schema.test.ts`
- Modify `src/index.ts` and `src/worker.ts` — call `assertSchemaReady`.

**Frontend — `apps/metricyak-ui`:**
- Modify `src/api/organizations.ts` — real `listOrganizations`, add `createOrganization`.
- Modify `src/contexts/ProjectContext.tsx` — add bootstrap `status`.
- Create `src/components/onboarding/OnboardingPage.tsx`
- Modify `src/components/shell/AppLayout.tsx` — gate on status.

**Docs / root:**
- Create `.env.example`
- Modify `README.md`

---

## Task 1: Slug helper (pure function)

**Files:**
- Create: `packages/storage/src/lib/slug.ts`
- Test: `packages/storage/src/lib/__tests__/slug.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string` — lowercased, hyphenated, alphanumerics only, collapsed/trimmed hyphens, capped at 64 chars, falls back to `'org'` when the input has no usable characters.

- [ ] **Step 1: Write the failing test**

`packages/storage/src/lib/__tests__/slug.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { slugify } from '../slug.js';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugify('Acme Rockets')).toBe('acme-rockets');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugify('  Foo & Bar!! ')).toBe('foo-bar');
  });

  it('falls back to "org" when no usable characters remain', () => {
    expect(slugify('!!!')).toBe('org');
    expect(slugify('')).toBe('org');
  });

  it('caps length at 64 characters', () => {
    expect(slugify('a'.repeat(100)).length).toBe(64);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/storage exec vitest run src/lib/__tests__/slug.test.ts`
Expected: FAIL — cannot find module `../slug.js`.

- [ ] **Step 3: Write minimal implementation**

`packages/storage/src/lib/slug.ts`
```ts
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');

  return base.length > 0 ? base : 'org';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/storage exec vitest run src/lib/__tests__/slug.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/lib/slug.ts packages/storage/src/lib/__tests__/slug.test.ts
git commit -m "feat(storage): add slugify helper for organization slugs"
```

---

## Task 2: OrganizationsRepository `list()` and `create()`

**Files:**
- Modify: `packages/storage/src/repositories/organizations.repository.ts`
- Test: `packages/storage/src/repositories/__tests__/organizations.integration.test.ts`

**Interfaces:**
- Consumes: `slugify` from `../lib/slug.js` (Task 1); `organizations` table from `../schema/organizations.js`.
- Produces:
  - `OrganizationsRepository.list(): Promise<OrganizationRecord[]>`
  - `OrganizationsRepository.create(input: { name: string }): Promise<OrganizationRecord>` — derives a unique slug via `slugify`, retrying with `-2`, `-3`, … suffixes on unique-violation (Postgres `23505`).

- [ ] **Step 1: Write the failing test**

`packages/storage/src/repositories/__tests__/organizations.integration.test.ts`
```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../schema/index.js';
import { OrganizationsRepository } from '../organizations.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

let container: StartedPostgreSqlContainer;
let pool: Pool;
let repo: OrganizationsRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  await migrate(db, { migrationsFolder });
  repo = new OrganizationsRepository(db);
}, 120_000);

afterAll(async () => {
  await pool?.end();
  await container?.stop();
});

beforeEach(async () => {
  await pool.query('TRUNCATE organizations CASCADE');
});

describe('OrganizationsRepository', () => {
  it('creates an organization with a derived slug', async () => {
    const org = await repo.create({ name: 'Acme Rockets' });
    expect(org.name).toBe('Acme Rockets');
    expect(org.slug).toBe('acme-rockets');
    expect(org.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('disambiguates a colliding slug with a numeric suffix', async () => {
    const first = await repo.create({ name: 'Acme' });
    const second = await repo.create({ name: 'Acme' });
    expect(first.slug).toBe('acme');
    expect(second.slug).toBe('acme-2');
  });

  it('lists all organizations', async () => {
    await repo.create({ name: 'One' });
    await repo.create({ name: 'Two' });
    const all = await repo.list();
    expect(all.map((o) => o.name).sort()).toEqual(['One', 'Two']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/storage exec vitest run src/repositories/__tests__/organizations.integration.test.ts`
Expected: FAIL — `repo.list`/`repo.create` is not a function. (Requires Docker.)

- [ ] **Step 3: Write minimal implementation**

Replace the body of `packages/storage/src/repositories/organizations.repository.ts` with:
```ts
import { eq } from 'drizzle-orm';
import type { Database } from '../client.js';
import { slugify } from '../lib/slug.js';
import { organizations } from '../schema/organizations.js';

export type OrganizationRecord = {
  id: string;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateOrganizationInput = {
  name: string;
};

const UNIQUE_VIOLATION = '23505';
const MAX_SLUG_ATTEMPTS = 25;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION;
}

export class OrganizationsRepository {
  constructor(private readonly db: Database) {}

  async get(id: string): Promise<OrganizationRecord | null> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    return org ?? null;
  }

  async list(): Promise<OrganizationRecord[]> {
    return this.db.select().from(organizations);
  }

  async create(input: CreateOrganizationInput): Promise<OrganizationRecord> {
    const base = slugify(input.name);

    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 1 ? base : `${base}-${attempt}`.slice(0, 64);
      try {
        const [org] = await this.db
          .insert(organizations)
          .values({ name: input.name, slug })
          .returning();
        if (!org) throw new Error('Failed to insert organization.');
        return org;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_SLUG_ATTEMPTS) continue;
        throw error;
      }
    }

    throw new Error('Could not generate a unique slug for the organization.');
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/storage exec vitest run src/repositories/__tests__/organizations.integration.test.ts`
Expected: PASS (3 tests). If Docker is unavailable, note the skip; do not mark done without a Docker run.

- [ ] **Step 5: Commit**

```bash
git add packages/storage/src/repositories/organizations.repository.ts packages/storage/src/repositories/__tests__/organizations.integration.test.ts
git commit -m "feat(storage): add organization list and create with unique slugs"
```

---

## Task 3: Organizations API module (`GET`/`POST /v1/organizations`)

**Files:**
- Create: `apps/metricyak/src/modules/organizations/organizations.schemas.ts`
- Create: `apps/metricyak/src/modules/organizations/organizations.routes.ts`
- Create: `apps/metricyak/src/modules/organizations/organizations.module.ts`
- Modify: `apps/metricyak/src/modules/index.ts`
- Test: `apps/metricyak/src/modules/organizations/__tests__/organizations.routes.test.ts`

**Interfaces:**
- Consumes: `OrganizationsRepository.list()` / `create({ name })` (Task 2); `createRouter` from `../../http/router.js`; `createApp`/`createContainer` for tests.
- Produces:
  - `GET /v1/organizations` → `200` with `OrganizationResponse[]`
  - `POST /v1/organizations` (body `{ name: string }`) → `201` with `OrganizationResponse`
  - `organizationsModule: AppModule` exported as default router + module.
  - `OrganizationResponse` = `{ id, slug, name, createdAt, updatedAt }` (ISO strings).

- [ ] **Step 1: Write the failing test**

`apps/metricyak/src/modules/organizations/__tests__/organizations.routes.test.ts`
```ts
import { InMemoryEventsProducer } from '@metricyak/queue';
import type { Database, OrganizationRecord } from '@metricyak/storage';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../../app.js';
import { createContainer } from '../../../container/container.js';

function buildApp(store: OrganizationRecord[]) {
  const container = createContainer({} as Database, new InMemoryEventsProducer());
  const stub = {
    async list() {
      return store;
    },
    async create({ name }: { name: string }) {
      const now = new Date();
      const org: OrganizationRecord = {
        id: '00000000-0000-4000-8000-0000000000f1',
        slug: name.toLowerCase(),
        name,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      store.push(org);
      return org;
    },
    async get() {
      return null;
    },
  };
  (container.repositories as { organizations: unknown }).organizations = stub;
  return createApp(container);
}

describe('organizations routes', () => {
  let store: OrganizationRecord[];
  beforeEach(() => {
    store = [];
  });

  it('GET /v1/organizations returns an empty array when there are none', async () => {
    const res = await buildApp(store).request('/v1/organizations');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /v1/organizations creates and returns an organization', async () => {
    const res = await buildApp(store).request('/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Acme' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe('Acme');
    expect(body.slug).toBe('acme');
    expect(typeof body.createdAt).toBe('string');
  });

  it('POST /v1/organizations rejects an empty name with 400', async () => {
    const res = await buildApp(store).request('/v1/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app exec vitest run src/modules/organizations/__tests__/organizations.routes.test.ts`
Expected: FAIL — route `/v1/organizations` returns 404 (module not registered yet).

- [ ] **Step 3a: Create the schemas**

`apps/metricyak/src/modules/organizations/organizations.schemas.ts`
```ts
import { z } from '@hono/zod-openapi';

export const CreateOrganizationRequest = z.object({
  name: z
    .string()
    .min(1, 'The name must not be empty.')
    .max(64, 'The name must be 64 characters or fewer.')
    .openapi({ description: 'The name for the new organization.', example: 'Acme Rockets' }),
});

const OrganizationSummary = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ListOrganizationsResponse = z.array(OrganizationSummary);
export const CreateOrganizationResponse = OrganizationSummary;
```

- [ ] **Step 3b: Create the routes**

`apps/metricyak/src/modules/organizations/organizations.routes.ts`
```ts
import { createRoute } from '@hono/zod-openapi';
import { errorResponse } from '../../http/errors.js';
import { createRouter } from '../../http/router.js';
import {
  CreateOrganizationRequest,
  CreateOrganizationResponse,
  ListOrganizationsResponse,
} from './organizations.schemas.js';

export const listOrganizationsRoute = createRoute({
  method: 'get',
  path: '/organizations',
  responses: {
    200: {
      content: { 'application/json': { schema: ListOrganizationsResponse } },
      description: 'All organizations.',
    },
  },
});

export const createOrganizationRoute = createRoute({
  method: 'post',
  path: '/organizations',
  request: {
    body: {
      content: { 'application/json': { schema: CreateOrganizationRequest } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateOrganizationResponse } },
      description: 'An organization was created.',
    },
    400: errorResponse('The request failed validation.'),
  },
});

const organizationsRouter = createRouter();

organizationsRouter.openapi(listOrganizationsRoute, async (c) => {
  const { organizations } = c.var.container.repositories;
  const records = await organizations.list();

  return c.json(
    ListOrganizationsResponse.parse(
      records.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    ),
    200,
  );
});

organizationsRouter.openapi(createOrganizationRoute, async (c) => {
  const { name } = c.req.valid('json');
  const { organizations } = c.var.container.repositories;
  const record = await organizations.create({ name });

  return c.json(
    CreateOrganizationResponse.parse({
      id: record.id,
      slug: record.slug,
      name: record.name,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }),
    201,
  );
});

export default organizationsRouter;
```

- [ ] **Step 3c: Create the module and register it**

`apps/metricyak/src/modules/organizations/organizations.module.ts`
```ts
import type { AppModule } from '../module.js';
import organizationsRouter from './organizations.routes.js';

export const organizationsModule: AppModule = {
  routes: organizationsRouter,
};
```

Modify `apps/metricyak/src/modules/index.ts` — add the import and array entry (alphabetical, before `projectsModule`):
```ts
import { aggregatesModule } from './aggregates/aggregates.module.js';
import { eventsModule } from './events/events.module.js';
import { keysModule } from './keys/keys.module.js';
import { metricsModule } from './metrics/metrics.module.js';
import type { AppModule } from './module.js';
import { monitorsModule } from './monitors/monitors.module.js';
import { organizationsModule } from './organizations/organizations.module.js';
import { projectsModule } from './projects/projects.module.js';

export const modules: readonly AppModule[] = [
  aggregatesModule,
  eventsModule,
  keysModule,
  metricsModule,
  monitorsModule,
  organizationsModule,
  projectsModule,
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app exec vitest run src/modules/organizations/__tests__/organizations.routes.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/metricyak/src/modules/organizations apps/metricyak/src/modules/index.ts
git commit -m "feat(organizations): add GET and POST /v1/organizations"
```

---

## Task 4: Fail-fast `DATABASE_URL` validation

**Files:**
- Modify: `apps/metricyak/src/config.ts`
- Test: `apps/metricyak/src/__tests__/config.test.ts`

**Interfaces:**
- Produces: `parseConfig(env: NodeJS.ProcessEnv): Config` — exported, throws `ZodError` on invalid input. `loadConfig()` delegates to it. `DATABASE_URL` must be a `postgres://` or `postgresql://` URL that includes a password.

- [ ] **Step 1: Write the failing test**

`apps/metricyak/src/__tests__/config.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { parseConfig } from '../config.js';

const base = { RUN_WORKER_INLINE: 'true' };

describe('parseConfig DATABASE_URL', () => {
  it('accepts a credentialed postgres URL', () => {
    const cfg = parseConfig({
      ...base,
      DATABASE_URL: 'postgres://metricyak:metricyak@localhost:5432/metricyak',
    });
    expect(cfg.databaseUrl).toContain('postgres://');
  });

  it('rejects a non-postgres scheme', () => {
    expect(() => parseConfig({ ...base, DATABASE_URL: 'http://localhost:5432' })).toThrow(
      /postgres/i,
    );
  });

  it('rejects a URL without a password', () => {
    expect(() =>
      parseConfig({ ...base, DATABASE_URL: 'postgres://metricyak@localhost:5432/metricyak' }),
    ).toThrow(/password/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app exec vitest run src/__tests__/config.test.ts`
Expected: FAIL — `parseConfig` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `apps/metricyak/src/config.ts`, replace the `DATABASE_URL` line and refactor `loadConfig`. First, add a validator above `ConfigSchema`:
```ts
function isPostgresUrlWithPassword(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
    return url.password.length > 0;
  } catch {
    return false;
  }
}
```
Change the schema field to:
```ts
    DATABASE_URL: z
      .string()
      .min(1, 'DATABASE_URL is required.')
      .refine(isPostgresUrlWithPassword, {
        message:
          'DATABASE_URL must be a postgres://user:password@host:port/db URL (with a password).',
      }),
```
Then export a `parseConfig` and have `loadConfig` use it:
```ts
export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = ConfigSchema.parse(env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    port: parsed.PORT,
    workerConcurrency: parsed.WORKER_CONCURRENCY,
    runWorkerInline: parsed.RUN_WORKER_INLINE,
    runWorkersInApi: parsed.RUN_WORKERS_IN_API,
  };
}

export function loadConfig(): Config {
  if (existsSync(ROOT_ENV)) {
    process.loadEnvFile(ROOT_ENV);
  }
  return parseConfig(process.env);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app exec vitest run src/__tests__/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/metricyak/src/config.ts apps/metricyak/src/__tests__/config.test.ts
git commit -m "feat(config): fail fast on non-postgres or credential-less DATABASE_URL"
```

---

## Task 5: Startup schema-presence check

**Files:**
- Create: `apps/metricyak/src/bootstrap/schema.ts`
- Test: `apps/metricyak/src/bootstrap/__tests__/schema.test.ts`
- Modify: `apps/metricyak/src/index.ts`, `apps/metricyak/src/worker.ts`

**Interfaces:**
- Consumes: `Database` from `@metricyak/storage`.
- Produces: `assertSchemaReady(db: Pick<Database, 'execute'>): Promise<void>` — resolves when the `organizations` table exists; throws an `Error` whose message names `pnpm db:migrate` when the relation is missing (Postgres `42P01`).

- [ ] **Step 1: Write the failing test**

`apps/metricyak/src/bootstrap/__tests__/schema.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { assertSchemaReady } from '../schema.js';

describe('assertSchemaReady', () => {
  it('resolves when the query succeeds', async () => {
    const db = { execute: async () => ({ rows: [] }) };
    await expect(assertSchemaReady(db)).resolves.toBeUndefined();
  });

  it('throws a migrate hint when the table is missing (42P01)', async () => {
    const db = {
      execute: async () => {
        throw Object.assign(new Error('relation "organizations" does not exist'), {
          code: '42P01',
        });
      },
    };
    await expect(assertSchemaReady(db)).rejects.toThrow(/db:migrate/);
  });

  it('rethrows unexpected errors unchanged', async () => {
    const db = {
      execute: async () => {
        throw new Error('connection refused');
      },
    };
    await expect(assertSchemaReady(db)).rejects.toThrow(/connection refused/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app exec vitest run src/bootstrap/__tests__/schema.test.ts`
Expected: FAIL — cannot find module `../schema.js`.

- [ ] **Step 3: Write minimal implementation**

`apps/metricyak/src/bootstrap/schema.ts`
```ts
import { sql } from 'drizzle-orm';

const UNDEFINED_TABLE = '42P01';

type SchemaProbe = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

export async function assertSchemaReady(db: SchemaProbe): Promise<void> {
  try {
    await db.execute(sql`select 1 from "organizations" limit 1`);
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === UNDEFINED_TABLE
    ) {
      throw new Error(
        'Database schema is missing. Run migrations first: `pnpm --filter @metricyak/storage db:migrate`.',
      );
    }
    throw error;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app exec vitest run src/bootstrap/__tests__/schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire into startup**

In `apps/metricyak/src/index.ts`, after `const db = createDatabase(config.databaseUrl);` add:
```ts
await assertSchemaReady(db);
```
and the import at the top:
```ts
import { assertSchemaReady } from './bootstrap/schema.js';
```
Do the same in `apps/metricyak/src/worker.ts` (after its `createDatabase` call, add the import and the `await assertSchemaReady(db);`).

- [ ] **Step 6: Verify build + full app test suite**

Run: `pnpm --filter @metricyak/app check-types && pnpm --filter @metricyak/app test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/metricyak/src/bootstrap/schema.ts apps/metricyak/src/bootstrap/__tests__/schema.test.ts apps/metricyak/src/index.ts apps/metricyak/src/worker.ts
git commit -m "feat(bootstrap): refuse to serve without schema and point to db:migrate"
```

---

## Task 6: UI organizations API client

**Files:**
- Modify: `apps/metricyak-ui/src/api/organizations.ts`

**Interfaces:**
- Consumes: `apiFetch` from `@/lib/api`.
- Produces:
  - `listOrganizations(): Promise<Organization[]>` → `GET /v1/organizations`
  - `createOrganization(name: string): Promise<Organization>` → `POST /v1/organizations`
  - `type Organization = { id: string; name: string; slug: string }`

- [ ] **Step 1: Replace the stub**

`apps/metricyak-ui/src/api/organizations.ts`
```ts
import { apiFetch } from '@/lib/api';

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export function listOrganizations(): Promise<Organization[]> {
  return apiFetch<Organization[]>('/v1/organizations');
}

export function createOrganization(name: string): Promise<Organization> {
  return apiFetch<Organization>('/v1/organizations', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @metricyak/metricyak-ui check-types`
Expected: PASS (no consumers break — `ProjectSwitcher` and `ProjectContext` import the same names).

- [ ] **Step 3: Commit**

```bash
git add apps/metricyak-ui/src/api/organizations.ts
git commit -m "feat(ui): call the real organizations API instead of a hardcoded stub"
```

---

## Task 7: `ProjectContext` bootstrap status

**Files:**
- Modify: `apps/metricyak-ui/src/contexts/ProjectContext.tsx`

**Interfaces:**
- Consumes: `listOrganizations` (Task 6), `listProjects` from `@/api/projects`.
- Produces: `useProjectContext()` gains `status: 'loading' | 'needs-onboarding' | 'ready' | 'error'` and `refresh(): void`; existing `activeOrg`, `activeProject`, `setActiveProject`, `updateActiveProject` unchanged.

- [ ] **Step 1: Add status to the context value and effect**

Replace `apps/metricyak-ui/src/contexts/ProjectContext.tsx` with:
```tsx
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { listOrganizations, type Organization } from '@/api/organizations';
import { listProjects, type Project } from '@/api/projects';

export type BootstrapStatus = 'loading' | 'needs-onboarding' | 'ready' | 'error';

type ProjectContextValue = {
  status: BootstrapStatus;
  activeOrg: Organization | null;
  activeProject: Project | null;
  setActiveProject: (project: Project, org: Organization) => void;
  updateActiveProject: (project: Project) => void;
  refresh: () => void;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable
  }
}

export function ProjectProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<BootstrapStatus>('loading');
  const [nonce, setNonce] = useState(0);
  const [activeOrg, setActiveOrgState] = useState<Organization | null>(() =>
    readStorage<Organization>('metricyak.active-org'),
  );
  const [activeProject, setActiveProjectState] = useState<Project | null>(() =>
    readStorage<Project>('metricyak.active-project'),
  );

  const setActiveProject = useCallback((project: Project, org: Organization): void => {
    setActiveProjectState(project);
    setActiveOrgState(org);
    writeStorage('metricyak.active-project', project);
    writeStorage('metricyak.active-org', org);
    setStatus('ready');
  }, []);

  const updateActiveProject = useCallback((project: Project): void => {
    setActiveProjectState((current) => {
      if (current?.id !== project.id) return current;
      writeStorage('metricyak.active-project', project);
      return project;
    });
  }, []);

  const refresh = useCallback((): void => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    listOrganizations()
      .then(async (orgs) => {
        if (cancelled) return;
        const org = orgs[0];
        if (!org) {
          setStatus('needs-onboarding');
          return;
        }
        const projects = await listProjects(org.id);
        if (cancelled) return;
        const project = projects[0];
        if (project && !activeProject) {
          setActiveProject(project, org);
        }
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [activeProject, setActiveProject, nonce]);

  return (
    <ProjectContext.Provider
      value={{ status, activeOrg, activeProject, setActiveProject, updateActiveProject, refresh }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjectContext must be used within ProjectProvider');
  return ctx;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm --filter @metricyak/metricyak-ui check-types`
Expected: PASS. (Existing consumers use `activeOrg`/`activeProject`/`setActiveProject`/`updateActiveProject`, all still present.)

- [ ] **Step 3: Commit**

```bash
git add apps/metricyak-ui/src/contexts/ProjectContext.tsx
git commit -m "feat(ui): give ProjectContext an explicit bootstrap status"
```

---

## Task 8: Onboarding screen + AppLayout gating

**Files:**
- Create: `apps/metricyak-ui/src/components/onboarding/OnboardingPage.tsx`
- Modify: `apps/metricyak-ui/src/components/shell/AppLayout.tsx`

**Interfaces:**
- Consumes: `useProjectContext` (`status`, `setActiveProject`, `refresh`), `createOrganization` (Task 6), `createProject` from `@/api/projects`, and the existing `Button`/`Input`/`Label` UI primitives from `@/components/ui/*`.
- Produces: `OnboardingPage` — collects org name + first project name, creates both, sets them active.

- [ ] **Step 1: Create the onboarding page**

`apps/metricyak-ui/src/components/onboarding/OnboardingPage.tsx`
```tsx
import { type FormEvent, useState } from 'react';
import { createOrganization } from '@/api/organizations';
import { createProject } from '@/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useProjectContext } from '@/contexts/ProjectContext';

export function OnboardingPage(): React.JSX.Element {
  const { setActiveProject } = useProjectContext();
  const [orgName, setOrgName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = orgName.trim().length > 0 && projectName.trim().length > 0 && !submitting;

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const org = await createOrganization(orgName.trim());
      const project = await createProject(org.id, projectName.trim());
      setActiveProject(project, { id: org.id, name: org.name, slug: org.slug });
    } catch {
      setError('Could not create your workspace. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Welcome to MetricYak</h1>
          <p className="text-sm text-muted-foreground">
            Create your organization and first project to get started.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Acme Rockets"
            maxLength={64}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-name">First project name</Label>
          <Input
            id="project-name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Web App"
            maxLength={128}
          />
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" disabled={!canSubmit} className="w-full">
          {submitting ? 'Creating…' : 'Create workspace'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Gate AppLayout on status**

Modify `apps/metricyak-ui/src/components/shell/AppLayout.tsx` to branch on status before the normal shell:
```tsx
import { type ReactNode, useState } from 'react';
import { navItems } from '@/components/sidebar/nav.config';
import { SidePanel } from '@/components/sidebar/SidePanel';
import { SubMenuPanel } from '@/components/sidebar/SubMenuPanel';
import { useProjectContext } from '@/contexts/ProjectContext';
import { OnboardingPage } from '@/components/onboarding/OnboardingPage';
import { MainContent } from './MainContent';

interface AppLayoutProps {
  children?: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { status } = useProjectContext();
  const [activeSubMenuId, setActiveSubMenuId] = useState<string | undefined>(undefined);

  const activeItem = activeSubMenuId
    ? navItems.find((item) => item.id === activeSubMenuId)
    : undefined;

  const handleOpenSubMenu = (id: string): void => {
    setActiveSubMenuId((current) => (current === id ? undefined : id));
  };

  if (status === 'needs-onboarding') {
    return <OnboardingPage />;
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen w-screen items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <h1 className="text-lg font-semibold">Can’t reach the API</h1>
          <p className="text-sm text-muted-foreground">
            The MetricYak backend isn’t responding. Check that it’s running, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <SidePanel activeSubMenuId={activeSubMenuId} onOpenSubMenu={handleOpenSubMenu} />
      {activeItem?.items?.length ? (
        <SubMenuPanel item={activeItem} onClose={() => setActiveSubMenuId(undefined)} />
      ) : null}
      <MainContent>{children}</MainContent>
    </div>
  );
}
```

> Confirmed during planning: `main.tsx` already wraps `<RouterProvider>` in `<ProjectProvider>`, so `AppLayout` (rendered via `App` → router) resolves `useProjectContext` — no wrapping change needed. The `text-destructive` token exists in `globals.css` (`--color-destructive`), so `text-destructive` is valid.

- [ ] **Step 3: Type-check + build**

Run: `pnpm --filter @metricyak/metricyak-ui check-types && pnpm --filter @metricyak/metricyak-ui build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/metricyak-ui/src/components/onboarding/OnboardingPage.tsx apps/metricyak-ui/src/components/shell/AppLayout.tsx
git commit -m "feat(ui): show onboarding when no organization exists"
```

---

## Task 9: `.env.example` and README

**Files:**
- Create: `.env.example`
- Modify: `README.md`

**Interfaces:** none (docs/config only).

- [ ] **Step 1: Create `.env.example`**

`.env.example`
```
# PostgreSQL connection string. Must be a credentialed postgres:// URL.
# Matches the docker-compose service (user/password/db all "metricyak").
DATABASE_URL=postgres://metricyak:metricyak@localhost:5432/metricyak

# Process events in-process without Redis (recommended for local dev).
RUN_WORKER_INLINE=true

# Required only when RUN_WORKER_INLINE is not set:
# REDIS_URL=redis://localhost:6379

# Optional:
# PORT=3000
# WORKER_CONCURRENCY=1
```

- [ ] **Step 2: Write the README**

`README.md`
```markdown
# MetricYak

Self-hostable product analytics. MetricYak can run two ways: **self-hosted**
(open source) or, in future, a **cloud-hosted** version. Both share the same
core: you create an organization and a project, then send events.

## Prerequisites

- Node.js and [pnpm](https://pnpm.io/)
- Docker (for Postgres and Redis via `docker-compose`)

## Getting started

1. **Copy the environment file** and adjust if needed:
   ```bash
   cp .env.example .env
   ```
   `DATABASE_URL` must be a credentialed `postgres://` URL — the app refuses to
   start otherwise, with a message telling you what's wrong.

2. **Start Postgres and Redis:**
   ```bash
   docker compose up -d
   ```

3. **Apply database migrations** (explicit — never run automatically):
   ```bash
   pnpm --filter @metricyak/storage db:migrate
   ```

4. **Run the app** (inline worker, no Redis needed):
   ```bash
   pnpm dev
   ```

5. **Open the UI** and complete onboarding. On a fresh database there are no
   organizations yet, so the app shows a short onboarding screen: name your
   organization and your first project, and you're in.

## Blank slate & onboarding

A fresh install starts with an empty database. There is **no seed step** for
normal use — the app provides onboarding to create your first organization and
project. (`pnpm --filter @metricyak/storage db:seed` exists only as a
convenience for scripted testing with a fixed dev org id.)

If you start the app before running migrations, it fails fast and tells you to
run `db:migrate`.

## Environment variables

See the environment-variable table in [`AGENTS.md`](./AGENTS.md).

## Common commands

Run from the repo root:

| Task | Command |
|---|---|
| Dev server (inline worker) | `pnpm dev` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Type-check | `pnpm check-types` |
| Lint + format check | `pnpm ci` |

Database commands run from `packages/storage/` — see `AGENTS.md`.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example README.md
git commit -m "docs: add .env.example and getting-started README"
```

---

## Task 10: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full workspace suite**

Run: `pnpm check-types && pnpm test`
Expected: PASS across all packages. (Org-repo integration test requires Docker; run with Docker available.)

- [ ] **Step 2: Manual blank-slate walkthrough**

```bash
# From a clean DB volume:
docker compose down -v && docker compose up -d
cp .env.example .env   # if not already present
pnpm --filter @metricyak/storage db:migrate
pnpm dev
```
Then:
1. Open the UI → expect the onboarding screen (no orgs).
2. Create org + first project → expect to land in the working app.
3. Reload → expect the app (not onboarding) with the org/project active.
4. Temporarily point `DATABASE_URL` at a bad value → expect a clear fail-fast message at startup (not a SASL error).
5. Drop the schema (or use a fresh unmigrated DB) → expect the "run db:migrate" startup message.

- [ ] **Step 3: Lint**

Run: `pnpm ci`
Expected: PASS (Biome lint + format).

---

## Self-review notes

- **Spec coverage:** Section 1 → Tasks 2, 3. Section 2 → Tasks 6, 7, 8. Section 3 → Tasks 4, 5, 9. Root-cause fix (bad `DATABASE_URL`) → Task 4 + `.env.example` (Task 9). All spec sections map to tasks.
- **Type consistency:** `Organization` (`id`/`name`/`slug`) is consistent across Tasks 6–8; `OrganizationRecord` (adds `isActive`/`createdAt`/`updatedAt` as `Date`) is the storage type used in Tasks 2–3; `BootstrapStatus` union is identical in Tasks 7 and 8; `createOrganization(name)` / `createProject(orgId, name)` signatures match their definitions.
- **Deviation flagged:** repository `create({ name })` owns slug generation (vs. the spec's `{ name, slug }`) — noted under Global Constraints.
