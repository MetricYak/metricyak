# Absolute intra-package imports (`@/`)

## Goal

Replace intra-package **relative** imports (`./`, `../…`) with **absolute** ones (`@/…`) across the Node packages, so imports stop depending on the file's depth in the tree. Today there are 258 relative imports across 84 files; 17 files reach up multiple levels (`../../…`) — the finicky ones. The frontend (`apps/metricyak-ui`) already uses `@/` via Vite; this brings the backend in line.

Non-goal: dropping the `.js` extension, introducing a bundler, moving files, or touching the UI.

## Convention

In each Node package, `@/` resolves to **that package's own** `src/`. Only intra-package relative specifiers change; cross-package imports (`@metricyak/storage`, `@metricyak/queue`) are already absolute and stay as-is. The `.js` extension stays exactly as today (a NodeNext requirement, independent of relative-vs-absolute).

```ts
// before
import { createMetricReads } from '../../aggregates/aggregates.reads.js';
// after
import { createMetricReads } from '@/modules/aggregates/aggregates.reads.js';
```

## Mechanism

TypeScript `paths` for type-checking + `tsc-alias` to rewrite the emitted output. Chosen over Node subpath imports (`#`, fragile across the mixed tsx/tsc-watch/vitest dev model given prod runs `dist` and dev/test run `src`) and over switching to a bundler (biggest change; only justified if dropping `.js`).

Applies to: `apps/metricyak`, `packages/storage`, `packages/queue`. The UI is already done.

## Config changes (per package)

- **tsconfig**: add `baseUrl: "."` and `paths: { "@/*": ["src/*"] }`. Must live in each package's own tsconfig — `paths`/`baseUrl` resolve relative to the file that declares them, so they cannot go in the shared `typescript-config/*.json`.
- **build script**: `tsc` → `tsc && tsc-alias`. `tsc-alias` reads the tsconfig `paths` and rewrites emitted `@/…` specifiers to relative paths in `dist/`, so `node dist/` runs with no aliases at runtime. Adds a `tsc-alias` dev dependency.
- **dev**: unchanged — `tsx` resolves tsconfig `paths` natively.
- **test**: add `vite-tsconfig-paths` to the shared `defineBaseConfig` (`packages/vitest-config`) so each package's `@/` resolves to its own `src` during vitest runs.

## Execution

A one-off codemod (ts-morph, run via `tsx`, discarded after) rewrites each intra-package relative import specifier to its `@/`-prefixed, `src`-absolute form, preserving the `.js` suffix. Run package-by-package so each package is independently verifiable.

## Documentation

- **AGENTS.md**: keep the `.js`-extension rule; add the `@/` alias rule (intra-package imports use `@/…`; the extension stays).
- **ADR** (`docs/adr/0001-*.md`, created lazily): record the `tsc-alias` decision and the alternatives rejected (subpath imports, bundler), so future contributors understand why the build has a rewrite step.

## Verification

Risk lives in whether all four consumers resolve `@/`. **Step 1 is a spike**: wire `@/` into one package and prove each consumer works before mass-converting:

1. `tsc --noEmit` type-checks `@/` imports.
2. `tsx` boots the dev entrypoint resolving `@/`.
3. `vitest` runs with the tsconfig-paths plugin.
4. `tsc && tsc-alias` produces a `dist/` with **no `@/` remaining**, and `node dist/index.js` boots.

Also verify in the spike: `drizzle.config.ts` and `seed.ts` (drizzle-kit's esbuild-based config loader may not honor tsconfig `paths` — if so, those files keep relative imports or get a targeted fix).

Then, per package: codemod → `check-types` → build → assert `dist/` contains no `@/` → tests green. Full workspace gate at the end (`check-types`, `test`, Biome lint + format).

## Scope guard

No bundler, no dropping `.js`, no file moves, no UI changes, no unrelated refactoring. Purely relative → `@/` plus the config to support it.
