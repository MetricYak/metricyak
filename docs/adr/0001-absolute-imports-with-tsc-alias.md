# 1. Absolute intra-package imports via `@/` and `tsc-alias`

## Status

Accepted

## Context

Intra-package imports were relative and depth-dependent (`../../…`), which is
error-prone in nested module trees. We want absolute `@/` imports (as the UI
already uses). The backend builds with `tsc` and runs `node dist/` in
production, while dev uses `tsx` and tests use Vitest — all from source.
`tsc` type-checks tsconfig `paths` but does not rewrite them in emitted JS, so
`node dist/` cannot resolve a bare `@/` at runtime.

## Decision

Use TypeScript `paths` (`@/*` → `./src/*`, per package, without `baseUrl` —
`baseUrl` is deprecated as of TypeScript 7) for type-checking, and run
`tsc-alias` after `tsc` to rewrite emitted `@/` specifiers to relative paths in
`dist/`. `tsx` resolves `paths` natively. Vitest resolves `@/` via a
`resolve.alias` in the shared `@metricyak/vitest-config` that maps `@/` to the
running package's `src/` (each package's vitest runs with its own directory as
cwd). The `.js` extension is retained (NodeNext).

## Alternatives considered

- **Node subpath imports (`#`)**: Node-native, no build step, but prod runs
  `dist` while dev/test run `src`, forcing conditional `imports` mappings and
  `--conditions` flags across the mixed tsx/tsc-watch/vitest runners. Rejected
  as fragile for this setup.
- **Bundler (tsup/esbuild)**: would resolve aliases at build and allow dropping
  `.js`, but changes the build model for every package. Rejected as
  disproportionate; revisit only if we decide to drop extensions.
- **`vite-tsconfig-paths` for Vitest**: tried first, but the installed version
  did not resolve `@/` against the Vitest-bundled Vite. Replaced with an
  explicit `resolve.alias`, which is dependency-free and deterministic.

## Consequences

- Builds gain a `tsc-alias` step and a `tsc-alias` dev dependency per package.
- `dist/` contains only relative paths; runtime needs no alias resolver.
- New contributors must know `@/` = the current package's `src/`.
