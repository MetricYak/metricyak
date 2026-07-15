# Absolute intra-package imports (`@/`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert intra-package relative imports (`./`, `../…`) to absolute (`@/…`) across the Node packages so imports no longer depend on file depth.

**Architecture:** Per-package TypeScript `paths` (`@/*` → `src/*`) give absolute imports at type-check time; `tsc-alias` rewrites the emitted `@/…` back to relative paths in `dist/` so `node dist/` runs alias-free; `tsx` (dev) resolves `paths` natively; `vitest` resolves them via `vite-tsconfig-paths`. A one-off Node codemod does the source rewrite, package by package, `storage` first as the proving ground.

**Tech Stack:** TypeScript (NodeNext ESM), `tsc`, `tsc-alias`, `tsx`, Vitest + `vite-tsconfig-paths`, pnpm workspaces, Turborepo, Biome.

## Global Constraints

- Node `>=24`, pnpm `>=11`. ESM throughout; `moduleResolution: NodeNext`.
- **The `.js` extension on import specifiers stays** (NodeNext requirement); the codemod preserves it. Never write `.ts` in a specifier.
- `@/` resolves to the **current package's own** `src/`. Cross-package imports (`@metricyak/*`) are unchanged.
- Only `apps/metricyak`, `packages/storage`, `packages/queue`. Do **not** touch `apps/metricyak-ui` (already uses `@/` via Vite).
- Biome: single quotes, 100-char width, trailing commas. Run `pnpm check:fix` before committing.
- Conventional Commits, subject line only. Work happens on branch `refactor/absolute-imports` (already created).
- No `any`, no `as` casts. Before marking done: `pnpm check-types && pnpm test` green, plus `pnpm lint`.
- Scope guard: no bundler, no dropping `.js`, no file moves, no unrelated refactoring.

---

### Task 1: Shared vitest path resolution

**Files:**
- Modify: `packages/vitest-config/src/index.ts`
- Modify: `packages/vitest-config/package.json`

**Interfaces:**
- Produces: `defineBaseConfig` gains a `vite-tsconfig-paths` plugin so any package's `@/` resolves to its own `src` during `vitest`. No signature change.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter @metricyak/vitest-config add vite-tsconfig-paths`
Expected: `vite-tsconfig-paths` appears in `packages/vitest-config/package.json` `dependencies`.

- [ ] **Step 2: Wire the plugin into the base config**

Replace the contents of `packages/vitest-config/src/index.ts` with:

```ts
import tsconfigPaths from 'vite-tsconfig-paths';
import type { UserConfig } from 'vitest/config';
import { defineConfig } from 'vitest/config';

export function defineBaseConfig(overrides?: UserConfig) {
  return defineConfig({
    ...overrides,
    plugins: [tsconfigPaths(), ...(overrides?.plugins ?? [])],
    test: {
      environment: 'node',
      include: ['src/**/__tests__/**/*.test.ts'],
      ...overrides?.test,
    },
  });
}
```

- [ ] **Step 3: Verify the suite is still green (plugin is inert until paths exist)**

Run: `pnpm test`
Expected: PASS — app and storage suites unchanged (no `@/` imports yet, so the plugin has nothing to resolve).

- [ ] **Step 4: Commit**

```bash
git add packages/vitest-config
git commit -m "build: add vite-tsconfig-paths to the shared vitest config"
```

---

### Task 2: Convert `packages/storage` (proving ground)

Storage is converted first and scrutinized hardest: it has the strongest tests (integration) and is consumed by the app, so it proves every consumer before the app/queue rollout. The codemod script is created here and reused later.

**Files:**
- Modify: `packages/storage/tsconfig.json`
- Modify: `packages/storage/package.json`
- Create: `<scratchpad>/codemod-absolute-imports.mjs` (NOT committed — one-off)
- Modify: every `packages/storage/src/**/*.ts` with an intra-package relative import (~31 files)

**Interfaces:**
- Consumes: Task 1's vitest plugin.
- Produces: the codemod script `codemod-absolute-imports.mjs` (Tasks 3 and 4 reuse it). Invocation: `node <scratchpad>/codemod-absolute-imports.mjs <absolute path to a package's src>`.

- [ ] **Step 1: Add `tsc-alias`**

Run: `pnpm --filter @metricyak/storage add -D tsc-alias`
Expected: `tsc-alias` in `packages/storage/package.json` `devDependencies`.

- [ ] **Step 2: Add `baseUrl` + `paths` to the storage tsconfig**

In `packages/storage/tsconfig.json`, add to `compilerOptions` (alongside `outDir`/`rootDir`):

```jsonc
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 3: Change the build to rewrite aliases**

In `packages/storage/package.json`, change the `build` script:

```json
"build": "tsc && tsc-alias"
```

- [ ] **Step 4: Prove the plumbing on ONE file before mass-converting (GO/NO-GO)**

Manually edit `packages/storage/src/repositories/index.ts` — change each relative re-export to `@/`. For example:

```ts
// before
export * from './aggregates.repository.js';
// after
export * from '@/repositories/aggregates.repository.js';
```

Then verify all four consumers:

Run: `pnpm --filter @metricyak/storage check-types`
Expected: PASS (TypeScript resolves `@/`).

Run: `pnpm --filter @metricyak/storage build && grep -rn "@/" packages/storage/dist || echo "NO ALIASES IN DIST"`
Expected: prints `NO ALIASES IN DIST` (tsc-alias rewrote every `@/` to a relative path).

Run: `node --input-type=module -e "import('./packages/storage/dist/index.js').then(() => console.log('DIST IMPORT OK'))"`
Expected: prints `DIST IMPORT OK` (Node resolves the rewritten dist at runtime; `index.js` only re-exports, so no DB connection occurs).

Run: `pnpm --filter @metricyak/storage test`
Expected: PASS (vitest resolves `@/` via the Task 1 plugin). Requires Docker for integration tests.

Run: `pnpm --filter @metricyak/app check-types`
Expected: PASS (the app still consumes `@metricyak/storage` unchanged).

**If any of these fail, STOP** and diagnose before proceeding — the mechanism is not proven.

- [ ] **Step 5: Write the codemod script**

Write this to `<scratchpad>/codemod-absolute-imports.mjs` (use the scratchpad dir from the environment; it is not committed):

```js
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const pkgSrc = process.argv[2];
if (!pkgSrc) {
  console.error('usage: node codemod-absolute-imports.mjs <absolute path to package src>');
  process.exit(1);
}

// Matches `from '<spec>'` (import-from, export-from) and bare `import '<spec>'`
// where <spec> is a relative specifier. Cross-package specifiers (no leading ./ or ../)
// are not matched.
const SPEC_RE = /((?:from|import)\s+)(['"])(\.\.?\/[^'"]+)(['"])/g;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function toAlias(fileDir, spec) {
  const resolved = path.resolve(fileDir, spec);
  const rel = path.relative(pkgSrc, resolved);
  if (rel.startsWith('..')) return null; // escapes package src — leave untouched
  return `@/${rel.split(path.sep).join('/')}`;
}

let changed = 0;
for (const file of await walk(pkgSrc)) {
  const src = await readFile(file, 'utf8');
  const dir = path.dirname(file);
  let touched = false;
  const out = src.replace(SPEC_RE, (match, pre, q1, spec, q2) => {
    const alias = toAlias(dir, spec);
    if (!alias) return match;
    touched = true;
    return `${pre}${q1}${alias}${q2}`;
  });
  if (touched) {
    await writeFile(file, out);
    changed += 1;
  }
}
console.log(`rewrote ${changed} files under ${pkgSrc}`);
```

- [ ] **Step 6: Run the codemod on the rest of storage**

Run: `node <scratchpad>/codemod-absolute-imports.mjs "$(pwd)/packages/storage/src"`
Expected: prints `rewrote N files under …/packages/storage/src`.

- [ ] **Step 7: Format**

Run: `pnpm check:fix`
Expected: Biome reorders/normalizes the rewritten import lines; no errors.

- [ ] **Step 8: Verify storage fully**

Run: `pnpm --filter @metricyak/storage check-types`
Expected: PASS.

Run: `pnpm --filter @metricyak/storage build && grep -rn "@/" packages/storage/dist || echo "NO ALIASES IN DIST"`
Expected: `NO ALIASES IN DIST`.

Run: `pnpm --filter @metricyak/storage test`
Expected: PASS (37+ tests).

Run: `grep -rn "from '\\.\\./" packages/storage/src || echo "NO MULTI-LEVEL RELATIVE IMPORTS"`
Expected: `NO MULTI-LEVEL RELATIVE IMPORTS` (single-level `./` may remain by choice; see note). 

> Note: the codemod converts *all* relative specifiers including single-level `./`. This grep asserts the multi-level ones (the pain) are gone. Same-directory `./x.js` also becomes `@/…/x.js`; that is expected and fine.

- [ ] **Step 9: Commit**

```bash
git add packages/storage
git commit -m "refactor(storage): use @/ absolute imports"
```

---

### Task 3: Convert `apps/metricyak`

**Files:**
- Modify: `apps/metricyak/tsconfig.json`
- Modify: `apps/metricyak/package.json`
- Modify: every `apps/metricyak/src/**/*.ts` with an intra-package relative import (~50 files)

**Interfaces:**
- Consumes: the codemod script from Task 2; Task 1's vitest plugin.

- [ ] **Step 1: Add `tsc-alias`**

Run: `pnpm --filter @metricyak/app add -D tsc-alias`
Expected: `tsc-alias` in `apps/metricyak/package.json` `devDependencies`.

- [ ] **Step 2: Add `baseUrl` + `paths`**

In `apps/metricyak/tsconfig.json`, add to `compilerOptions`:

```jsonc
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 3: Change the build**

In `apps/metricyak/package.json`, change: `"build": "tsc && tsc-alias"`.

- [ ] **Step 4: Run the codemod**

Run: `node <scratchpad>/codemod-absolute-imports.mjs "$(pwd)/apps/metricyak/src"`
Expected: prints `rewrote N files under …/apps/metricyak/src`.

- [ ] **Step 5: Format**

Run: `pnpm check:fix`
Expected: no errors.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @metricyak/app check-types`
Expected: PASS.

- [ ] **Step 7: Verify the dev resolver (`tsx`) resolves `@/`**

Run: `pnpm --filter @metricyak/app exec tsx --eval "import('@/app.js').then(() => console.log('TSX RESOLVES @/'))"`
Expected: prints `TSX RESOLVES @/` (tsx resolves the alias against the app tsconfig; `app.js` builds the Hono app without connecting to a DB).

> If tsx does not resolve `@/`, add `"tsconfig": "./tsconfig.json"` awareness by running from the app dir, or confirm the tsx version is `>=4.19`. Do not proceed until this passes.

- [ ] **Step 8: Verify the built output runs under Node**

Run: `pnpm --filter @metricyak/app build && grep -rn "@/" apps/metricyak/dist || echo "NO ALIASES IN DIST"`
Expected: `NO ALIASES IN DIST`.

Run: `node --input-type=module -e "import('./apps/metricyak/dist/app.js').then(() => console.log('DIST APP IMPORT OK'))"`
Expected: prints `DIST APP IMPORT OK` (imports the Hono app graph — no DB. `index.js` is not used here because it connects to the DB on load).

- [ ] **Step 9: Run the app tests**

Run: `pnpm --filter @metricyak/app test`
Expected: PASS (77+ tests).

- [ ] **Step 10: Commit**

```bash
git add apps/metricyak
git commit -m "refactor(app): use @/ absolute imports"
```

---

### Task 4: Convert `packages/queue`

Queue is flat (no multi-level pain) but converted for a uniform convention. It has no tests, so verification leans on type-check, the dist grep, and the fact that the app (Task 3) consumes it.

**Files:**
- Modify: `packages/queue/tsconfig.json`
- Modify: `packages/queue/package.json`
- Modify: `packages/queue/src/**/*.ts` (~3 files)

- [ ] **Step 1: Add `tsc-alias`**

Run: `pnpm --filter @metricyak/queue add -D tsc-alias`
Expected: `tsc-alias` in `packages/queue/package.json` `devDependencies`.

- [ ] **Step 2: Add `baseUrl` + `paths`**

In `packages/queue/tsconfig.json`, add to `compilerOptions`:

```jsonc
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

- [ ] **Step 3: Change the build**

In `packages/queue/package.json`, change: `"build": "tsc && tsc-alias"`.

- [ ] **Step 4: Run the codemod**

Run: `node <scratchpad>/codemod-absolute-imports.mjs "$(pwd)/packages/queue/src"`
Expected: prints `rewrote N files under …/packages/queue/src`.

- [ ] **Step 5: Format and verify**

Run: `pnpm check:fix`
Expected: no errors.

Run: `pnpm --filter @metricyak/queue check-types`
Expected: PASS.

Run: `pnpm --filter @metricyak/queue build && grep -rn "@/" packages/queue/dist || echo "NO ALIASES IN DIST"`
Expected: `NO ALIASES IN DIST`.

- [ ] **Step 6: Commit**

```bash
git add packages/queue
git commit -m "refactor(queue): use @/ absolute imports"
```

---

### Task 5: Documentation + full-workspace gate

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/adr/0001-absolute-imports-with-tsc-alias.md`

- [ ] **Step 1: Update AGENTS.md**

In the "TypeScript conventions" section of `AGENTS.md`, immediately after the bullet about ESM `.js` extensions, add:

```markdown
- **Intra-package imports use the `@/` alias** (`@/modules/foo.js`), not relative
  paths, where `@/` is the current package's `src/`. The `.js` extension still
  applies. Cross-package imports use the package name (`@metricyak/storage`).
  Type-checking uses tsconfig `paths`; `tsc-alias` rewrites `@/` to relative
  paths in `dist/` at build time so `node dist/` runs with no alias resolver.
```

- [ ] **Step 2: Write the ADR**

Create `docs/adr/0001-absolute-imports-with-tsc-alias.md`:

```markdown
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

Use TypeScript `paths` (`@/*` → `src/*`, per package) for type-checking, and
run `tsc-alias` after `tsc` to rewrite emitted `@/` specifiers to relative
paths in `dist/`. `tsx` resolves `paths` natively; Vitest resolves them via
`vite-tsconfig-paths`. The `.js` extension is retained (NodeNext).

## Alternatives considered

- **Node subpath imports (`#`)**: Node-native, no build step, but prod runs
  `dist` while dev/test run `src`, forcing conditional `imports` mappings and
  `--conditions` flags across the mixed tsx/tsc-watch/vitest runners. Rejected
  as fragile for this setup.
- **Bundler (tsup/esbuild)**: would resolve aliases at build and allow dropping
  `.js`, but changes the build model for every package. Rejected as
  disproportionate; revisit only if we decide to drop extensions.

## Consequences

- Builds gain a `tsc-alias` step and a `tsc-alias` dev dependency per package.
- `dist/` contains only relative paths; runtime needs no alias resolver.
- New contributors must know `@/` = the current package's `src/`.
```

- [ ] **Step 3: Full-workspace gate**

Run: `pnpm check-types`
Expected: PASS (6/6 packages).

Run: `pnpm test`
Expected: PASS (app + storage suites; Docker required for integration).

Run: `pnpm lint && pnpm exec biome format .`
Expected: no findings, no fixes.

Run: `pnpm build && grep -rn "@/" apps/metricyak/dist packages/storage/dist packages/queue/dist || echo "ALL DIST ALIAS-FREE"`
Expected: `ALL DIST ALIAS-FREE`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/adr
git commit -m "docs: document the @/ import convention and record ADR"
```

---

## Notes for the executor

- The codemod script lives in the scratchpad and is intentionally **not** committed (one-off tool, per spec).
- `packages/storage/drizzle.config.ts` sits at the package root (outside `src/`), so the codemod never touches it; drizzle-kit reads schema by file glob, not by import, so it is unaffected.
- `packages/storage/src/seed.ts` is inside `src/`, so its imports get aliased; it runs via `tsx` (`db:seed`), which resolves `@/`, and is covered by `check-types`.
- If the app dev `tsx` check (Task 3, Step 7) fails, that is a hard blocker — surface it rather than working around it.
