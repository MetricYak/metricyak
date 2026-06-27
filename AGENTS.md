# AGENTS.md

This file provides guidance on how to work with the metricyak repository.

## Project

MetricYak is an open-source platform for **metric-powered autonomous workflows**: declare metrics over an event stream, define monitors that watch those metrics, and fire automated steps when a metric crosses a threshold.

## Monorepo layout

```
apps/
  metricyak/          # @metricyak/app — the HTTP API + BullMQ worker process
packages/
  storage/            # @metricyak/storage — Drizzle ORM + PostgreSQL (repositories, schema, migrations)
  queue/              # @metricyak/queue — BullMQ producer/worker abstractions
  typescript-config/  # @metricyak/typescript-config — shared tsconfig presets
  vitest-config/      # @metricyak/vitest-config — shared vitest config
```

## Technology

- **Runtime:** Node `>=24`, pnpm `>=11` (see root `engines`). ESM throughout.
- **HTTP:** [Hono](https://hono.dev) with `@hono/node-server` and `@hono/zod-openapi` for typed, OpenAPI-annotated routes.
- **Queue:** [BullMQ](https://docs.bullmq.io) backed by Redis. The `@metricyak/queue` package wraps producers and worker factories.
- **Storage:** [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL (`pg` driver). Schema lives in `packages/storage/src/schema/`; migrations are generated with `drizzle-kit`.
- **Validation:** Zod v4 throughout — schemas drive both runtime validation and TypeScript types.
- **Linter/formatter:** Biome (`pnpm lint` / `pnpm check:fix`). Single-quote strings, 100-char line width, trailing commas always.
- **Dependency versions** for shared libs (vitest, zod, drizzle-orm, …) are pinned in the **pnpm `catalog:`** in `pnpm-workspace.yaml`. Reference them as `"vitest": "catalog:"` rather than hardcoding versions.

## Architecture

### App modules (`apps/metricyak/src/modules/`)

Feature work is organized into modules. Each module is a directory with:
- `*.routes.ts` — Hono `OpenAPIHono` router with `createRoute` / `openapi` handlers
- `*.schemas.ts` — Zod schemas for request/response bodies
- `*.module.ts` — exports an `AppModule` (`{ routes?, workers?: WorkerFactory[] }`)

Current modules: **events**, **keys**, **metrics**, **monitors**.

All module routes are mounted under `/v1` by `createApp`. The `/health` route is registered directly on the root app.

### Container / dependency injection (`src/container/container.ts`)

A `Container` object is created at startup and injected into every Hono handler via `c.var.container`. It holds the `Database`, the `EventsProducer`, and all repositories.

### Repositories (`packages/storage/src/repositories/`)

One class per domain entity: `EventsRepository`, `FailedEventsRepository`, `MetricsRepository`, `MonitorsRepository`, `ProjectKeysRepository`, `ProjectsRepository`. Each takes a `Database` (Drizzle `NodePgDatabase` instance) in its constructor.

### Queue / worker architecture

Events are ingested synchronously by the API, which hands them off to an `EventsProducer`. Three concrete producers exist:

| Class | When used |
|---|---|
| `InProcessEventsProducer` | `RUN_WORKER_INLINE=true` — processes jobs in-process, no Redis needed |
| `BullEventsProducer` | Default — enqueues to Redis; a separate worker process dequeues |
| `InMemoryEventsProducer` | Tests only — accumulates jobs for assertions |

Worker factories are declared in each module's `*.module.ts` and collected at startup in `bootstrap/workers.ts`.

Failed jobs that exhaust all retries are written to the `failed_events` table (`FailedEventsRepository`).

## TypeScript conventions

Strict by default. The shared `@metricyak/typescript-config/base` enables `strict`, **`noUncheckedIndexedAccess`**, `noUnusedLocals`, `noUnusedParameters`, and `forceConsistentCasingInFileNames`. Every package extends it.

- **ESM imports use explicit `.js` extensions** on relative paths, even from `.ts` files (`import { x } from './x.js'`) — required by `NodeNext` resolution.
- **No `any`.** Biome errors on it. Use `unknown` + narrowing, a proper interface, or a generic.
- **No `as` casts**, except `as const` and a *single, documented* boundary cast centralized in a helper. Never `as unknown as`. Avoid non-null `!` (Biome warns) — guard or narrow instead.
- **Explicit return types on all exported functions.** Don't rely on inference for the public contract.
- **`readonly` by default** on hand-written interface properties and incoming array params (`events: readonly IngestEvent[]`).
- **Discriminated unions** for results and state machines, keyed by a literal `kind`. Handle them with a `switch` that has an **exhaustive `never` default**:
  ```ts
  default: {
    const _exhaustive: never = result;
    throw new Error(`Unhandled result: ${JSON.stringify(_exhaustive)}`);
  }
  ```
- **Branded types for identifiers** (Zod `.brand()`).
- **Prefer narrow return types** (`'push' | 'pull'`) over wide ones (`string`).
- **Error handling:** narrow `unknown` errors with a type guard; predicate-style verifiers return `false` rather than throwing.

### Deliberate deviations (don't "fix" these)

- **Types are co-located with their Zod schemas / implementation**, not in separate `types.ts` files. `export type X = z.infer<typeof X>` next to the schema is the idiom here.
- **Zod-inferred domain types are left mutable** (no deep-`readonly` wrapper). The parse boundary returns fresh objects and the code doesn't mutate them.


## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `REDIS_URL` | conditional | — | Required unless `RUN_WORKER_INLINE=true` |
| `PORT` | no | `3000` | HTTP listen port |
| `WORKER_CONCURRENCY` | no | `1` | BullMQ worker concurrency |
| `RUN_WORKER_INLINE` | no | `false` | Process events in-process; no Redis required |
| `RUN_WORKERS_IN_API` | no | `true` | Start BullMQ workers alongside the API in the same process |

The app auto-loads `../../.env` (repo root) if it exists.

## Testing

- **Vitest.** Test files live in colocated `__tests__/` folders next to the code under test (`src/foo.ts` → `src/__tests__/foo.test.ts`).
- **Test through the interface, not the implementation.** Don't assert on a library's internal call sequence.
- For route tests, construct the Hono app with `createApp(createContainer(...))` and call `app.request(...)` directly. Use `InMemoryEventsProducer` and a typed mock/stub for the database.
- Integration tests that need a real database use Testcontainers (`postgres:17-alpine`): start a container, run migrations, isolate tests with `TRUNCATE … CASCADE` in `beforeEach`. **Requires Docker.**


## Commands

Run these from the **repo root** unless noted. Turborepo fans them out across all workspace packages automatically.

| Task | Command |
|---|---|
| **Dev server** (inline worker, no Redis) | `pnpm dev` |
| Build all packages | `pnpm build` |
| Run all tests | `pnpm test` |
| Type-check all packages | `pnpm check-types` |
| Lint (read-only) | `pnpm lint` |
| Lint + format check (CI mode) | `pnpm ci` |
| Auto-fix lint & formatting | `pnpm check:fix` |
| Clean all build artifacts | `pnpm clean` |

**Database (run from `packages/storage/`):**

| Task | Command |
|---|---|
| Generate migration from schema diff | `pnpm db:generate` |
| Apply pending migrations | `pnpm db:migrate` |
| Push schema without migrations (dev only) | `pnpm db:push` |
| Open Drizzle Studio | `pnpm db:studio` |
| Seed the database | `pnpm db:seed` |

**Notes:**
- `pnpm dev` sets `RUN_WORKER_INLINE=true` so events are processed in-process — no Redis needed for local development.
- `pnpm test` runs `vitest run` (single-pass, not watch) — safe for CI and agent use.
- Integration tests require Docker (Testcontainers spins up `postgres:17-alpine`). Skip or expect failures in environments without Docker.
- Before marking a change done, always run `pnpm check-types && pnpm test`.

## Git & pull requests

- **Conventional Commits** for commit messages and PR titles (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `chore:`).
- **Branch per change** — don't commit directly to `main`. Open a PR; it must pass CI before merge.
- Keep PRs focused; describe the change, call out deliberate deviations, and state how it was verified.
