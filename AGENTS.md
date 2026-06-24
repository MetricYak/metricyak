# AGENTS.md

This file provides guidance on how to work with the metricyak repository.

## Project

MetricYak is an open-source platform for **metric-powered autonomous workflows**: declare metrics over an event stream, define monitors that watch those metrics and declare workflows that watch those metrics, provide investigations and fire automated steps when a metric crosses a threshold 


## Technology

- **Runtime:** Node `>=24`, pnpm `>=11` (see root `engines`). ESM throughout.
- **Dependency versions** for shared libs (vitest, …) are pinned in the **pnpm `catalog:`** in `pnpm-workspace.yaml`. Reference them as `"vitest": "catalog:"` rather than hardcoding versions. Extend the catalog as new shared deps are added.

## TypeScript conventions

Strict by default. The shared `@metricyak/typescript-config/base` enables `strict`, **`noUncheckedIndexedAccess`**, `noUnusedLocals`, `noUnusedParameters`, and `forceConsistentCasingInFileNames`. Every package extends it.

- **ESM imports use explicit `.js` extensions** on relative paths, even from `.ts` files (`import { x } from './x.js'`) — required by `NodeNext` resolution.
- **No `any`.** Biome errors on it. Use `unknown` + narrowing, a proper interface, or a generic.
- **No `as` casts**, except `as const` and a *single, documented* boundary cast centralized in a helper (see `toJsonObject` in `definitionProjection.ts` for the validated-definition → `jsonb` boundary). Never `as unknown as`. Avoid non-null `!` (Biome warns) — guard or narrow instead.
- **Explicit return types on all exported functions.** Don't rely on inference for the public contract.
- **`readonly` by default** on hand-written interface properties and incoming array params (`events: readonly IngestEvent[]`). Exception: a `readonly` *property* may still hold a mutable array type when a downstream API needs it (Drizzle `.values()` — keep the property `readonly`, the element type mutable).
- **Discriminated unions** for results and state machines, keyed by a literal `kind`. Handle them with a `switch` that has an **exhaustive `never` default**:
  ```ts
  default: {
    const _exhaustive: never = result;
    throw new Error(`Unhandled result: ${JSON.stringify(_exhaustive)}`);
  }
  ```
- **Branded types for identifiers** (`MetricName`, `WorkflowName` — Zod `.brand()`).
- **Prefer narrow return types** (`'push' | 'pull'`) over wide ones (`string`).
- **Error handling:** narrow `unknown` errors with a type guard (see `fkConstraintName`); predicate-style verifiers return `false` rather than throwing.

### Deliberate deviations (don't "fix" these)

- **Types are co-located with their Zod schemas / implementation**, not in separate `types.ts` files. `export type X = z.infer<typeof X>` next to the schema is the idiom here; the type is derived, so splitting it adds indirection with no safety gain.
- **Zod-inferred domain types are left mutable** (no deep-`readonly` wrapper). The parse boundary returns fresh objects and the code doesn't mutate them; enforcing deep immutability isn't worth the type machinery or the runtime freeze. `readonly`-by-default applies to *hand-written* interfaces.


## Testing

- **Vitest.** Test files live in colocated `__tests__/` folders next to the code under test (`src/foo.ts` → `src/__tests__/foo.test.ts`).
- **Test through the interface, not the implementation.** Don't assert on a library's internal call sequence.
- Layered approach:
  - **Pure unit tests** (no DB) for projections, primitives, and helpers.
  - **Real-Postgres integration tests** via Testcontainers (`postgres:17-alpine`): start a container, run migrations, isolate tests with `TRUNCATE … CASCADE` in `beforeEach`. **Requires Docker** to be available (present on standard CI runners).
  - **Route tests** mock the store (`vi.mock`) and use the minimal `actorDb` double from `@metricyak/testing`, asserting result→status mapping and validation/auth behavior.
- Shared fixtures, the `sendRequest` helper, and `actorDb` live in `@metricyak/testing`; storage-local test utilities (e.g. the `one<T>()` single-row narrower) live in `packages/storage/src/__tests__/support.ts`.


## Commands

Run these from the **repo root** unless noted. Turborepo fans them out across all workspace packages automatically.

| Task | Command |
|---|---|
| Build all packages | `pnpm build` |
| Run all tests | `pnpm test` |
| Type-check all packages | `pnpm check-types` |
| Lint (read-only) | `pnpm lint` |
| Lint + format check (CI mode) | `pnpm ci` |
| Auto-fix lint & formatting | `pnpm check:fix` |
| Clean all build artifacts | `pnpm clean` |

**Notes:**
- `pnpm test` runs `vitest run` (single-pass, not watch) — safe for CI and agent use.
- Integration tests require Docker (Testcontainers spins up `postgres:17-alpine`). Skip or expect failures in environments without Docker.
- Before marking a change done, always run `pnpm check-types && pnpm test`.

## Git & pull requests

- **Conventional Commits** for commit messages and PR titles (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `build:`, `chore:`).
- **Branch per change** — don't commit directly to `main`. Open a PR; it must pass CI before merge.
- Keep PRs focused; describe the change, call out deliberate deviations, and state how it was verified.
