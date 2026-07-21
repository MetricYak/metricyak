# AGENTS.md

This file provides guidance on how to work with the metricyak repository.

## Project

MetricYak is an open-source platform for **metric-powered autonomous workflows**: declare metrics over an event stream, define monitors that watch those metrics, and fire automated steps when a metric crosses a threshold.

## UI rules
@UI.md

## Technology

- **Runtime:** Node `>=24`, pnpm `>=11` (see root `engines`). ESM throughout.
- **HTTP:** [Hono](https://hono.dev) with `@hono/node-server` and `@hono/zod-openapi` for typed, OpenAPI-annotated routes.
- **Queue:** [BullMQ](https://docs.bullmq.io) backed by Redis. The `@metricyak/queue` package wraps producers and worker factories.
- **Storage:** [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL (`pg` driver). Schema lives in `packages/storage/src/schema/`; migrations are generated with `drizzle-kit`.
- **Validation:** Zod v4 throughout — schemas drive both runtime validation and TypeScript types.
- **Linter/formatter:** Biome (`pnpm lint` / `pnpm check:fix`). Single-quote strings, 100-char line width, trailing commas always.
- **Dependency versions** for shared libs (vitest, zod, drizzle-orm, …) are pinned in the **pnpm `catalog:`** in `pnpm-workspace.yaml`. Reference them as `"vitest": "catalog:"` rather than hardcoding versions.


## Code Style

The goal: a reader understands exactly what the code does from names and flow
alone — no comments, no decoding.

- **No comments.** Names carry the meaning. A comment explaining *what* code
  does is a signal to rename or split it instead. (OpenAPI `description` fields
  and similar API-contract metadata are data, not code comments — those stay.)
- **Intention-revealing names.** A name says what the thing is or does:
  `insertedEvents`, `dropDuplicateInsertIds`, `duplicateCount` — never `res`,
  `tmp`, `data`, `xs`. No jargon in internal names; a newcomer should read them
  without a glossary. Established public/domain terms (`insert_id`) are fine —
  they're what callers already know.
- **Small functions, one job each.** If a function filters *and* aggregates
  *and* logs, split it. One idea per function.
- **Split by concern, not by line count.** A distinct, reusable, independently
  testable concern earns its own file — the module `*.ts` split and the engine's
  `bucketing.ts` / `matcher.ts` / `ingest.ts` are the pattern. But don't
  fragment a straight sequential flow across files; that makes it *harder* to
  follow. Test: distinct testable concern → own file; the caller's own
  step-by-step flow → inline.
- **Readable top-to-bottom flow.** A function body should read like a sentence
  describing its steps. Don't make a reader jump around or mentally execute
  clever expressions to work out the order of operations.
- **Make intent visible; don't lean on hidden subtleties.** Prefer an explicit,
  named guard over trusting a framework or DB quirk the reader can't see — e.g.
  an explicit `dropDuplicateInsertIds` rather than silently relying on
  `ON CONFLICT DO NOTHING` to collapse intra-batch duplicates.
- **Pure at the boundary; no shared mutable state.** A function's result
  depends only on its arguments — it doesn't read or mutate module-level or
  global state, and it doesn't mutate its inputs (hence `readonly` params).
  Local mutation *inside* a function (building up a `Map`/array in a loop) is
  fine and often the clearest form; the ban is on *shared* mutable state.
  Deliberate encapsulated state (e.g. `MetricMatcher`'s cache) is not a global —
  it's owned, injected, and testable.


### Container / dependency injection (`src/container/container.ts`)

A `Container` object is created at startup and injected into every Hono handler via `c.var.container`. It holds the `Database`, the `EventsProducer`, and all repositories.

### Repositories (`packages/storage/src/repositories/`)

One class per domain entity: `EventsRepository`, `FailedEventsRepository`, `MetricsRepository`, `MonitorsRepository`, `ProjectKeysRepository`, `ProjectsRepository`. Each takes a `Database` (Drizzle `NodePgDatabase` instance) in its constructor.


## TypeScript conventions

Strict by default. The shared `@metricyak/typescript-config/base` enables `strict`, **`noUncheckedIndexedAccess`**, `noUnusedLocals`, `noUnusedParameters`, and `forceConsistentCasingInFileNames`. Every package extends it.

- **ESM imports use explicit `.js` extensions** on relative paths, even from `.ts` files (`import { x } from './x.js'`) — required by `NodeNext` resolution.
- **Intra-package imports use the `@/` alias** (`import { x } from '@/modules/foo.js'`), not relative paths, where `@/` is the current package's `src/`. The `.js` extension still applies. Cross-package imports use the package name (`@metricyak/storage`). Type-checking resolves `@/` via tsconfig `paths`; `tsc-alias` rewrites `@/` to relative paths in `dist/` at build time so `node dist/` runs with no alias resolver, and vitest resolves it via a `resolve.alias` in the shared config.
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
