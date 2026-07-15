# Dimension Path Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `MetricDefinition.dimensions` resolve nested event properties (e.g. `"$properties.geo.country"`), the same path-expression syntax `MetricEvent.field` already supports, instead of today's flat top-level-only lookup.

**Architecture:** Factor the path-walking logic already inside `extractField` out into a shared private `resolvePath` helper in `apps/metricyak/src/modules/aggregates/engine/ingest.ts`, and have `dimValueOf` call it too. No type changes, no new exports, no UI changes.

**Tech Stack:** TypeScript, Vitest.

## Global Constraints

- Single new git branch for this whole change; backend-only.
- `MetricDefinition.dimensions` stays `string[]` — no schema/type change.
- No display-name/alias layer — a dimension's declared string remains its own identifier.
- No new validation beyond what `field` already has (non-empty string).
- No UI changes required (`DimensionsField.tsx`/`EventFieldGroup.tsx` are already free-text with no picker).
- Full spec: `docs/superpowers/specs/2026-07-15-dimension-path-resolution-design.md`.

---

### Task 1: Extend dimension resolution to walk nested `$properties` paths

**Files:**
- Modify: `apps/metricyak/src/modules/aggregates/engine/ingest.ts:21-46`
- Test: `apps/metricyak/src/modules/aggregates/engine/__tests__/ingest.test.ts`

**Interfaces:**
- Consumes: existing exported `fieldPath(field: string): string[]` in `ingest.ts` (unchanged).
- Produces: `extractField(properties: Record<string, unknown>, field: string | null): number | null` — same exported signature and behavior as before (used by `buildIngestDeltas`). A new private `resolvePath(properties: Record<string, unknown>, path: string): unknown` is introduced but not exported — later tasks/tests exercise nested-path dimension resolution only through the existing exported `buildIngestDeltas` and `collectDimensionCandidates`, matching how the current, non-exported `dimValueOf` is already tested.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/dimension-path-resolution
```

- [ ] **Step 2: Write the failing tests**

In `apps/metricyak/src/modules/aggregates/engine/__tests__/ingest.test.ts`, add these three cases inside the existing `describe('buildIngestDeltas', ...)` block (after the `'spills dimension values...'` test):

```typescript
  it('resolves a nested $properties path for a dimension', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: { country: 'US' } })],
      matcher([target({ dimensions: ['$properties.geo.country'] })]),
      keepAll,
    );
    const nested = deltas.find((d) => d.dimName === '$properties.geo.country');
    expect(nested?.dimValue).toBe('US');
  });

  it('resolves an unprefixed nested dimension path', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: { country: 'CA' } })],
      matcher([target({ dimensions: ['geo.country'] })]),
      keepAll,
    );
    const nested = deltas.find((d) => d.dimName === 'geo.country');
    expect(nested?.dimValue).toBe('CA');
  });

  it('skips a dimension when an intermediate path segment is missing', () => {
    const deltas = buildIngestDeltas(
      [event({ geo: {} })],
      matcher([target({ dimensions: ['geo.country'] })]),
      keepAll,
    );
    expect(deltas.find((d) => d.dimName === 'geo.country')).toBeUndefined();
  });
```

And this case inside the existing `describe('collectDimensionCandidates', ...)` block:

```typescript
  it('resolves nested $properties paths when collecting candidates', () => {
    const candidates = collectDimensionCandidates(
      [event({ geo: { country: 'US' } }), event({ geo: { country: 'CA' } })],
      matcher([target({ dimensions: ['$properties.geo.country'] })]),
    );
    const [candidate] = [...candidates.values()];
    expect(candidate?.dimName).toBe('$properties.geo.country');
    expect([...(candidate?.values ?? [])].sort()).toEqual(['CA', 'US']);
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter @metricyak/app test -- ingest.test.ts`
Expected: the four new tests FAIL (nested paths aren't resolved yet — `deltas.find(...)` returns `undefined` where a value was expected, or the "skips" test's `toBeUndefined()` accidentally passes for the wrong reason since nothing resolves nested paths yet). All pre-existing tests in this file still PASS.

- [ ] **Step 4: Implement `resolvePath` and wire it into `extractField` and `dimValueOf`**

Replace lines 21-46 of `apps/metricyak/src/modules/aggregates/engine/ingest.ts` (currently `fieldPath`, `extractField`, and `dimValueOf`) with:

```typescript
export function fieldPath(field: string): string[] {
  const path = field.startsWith(FIELD_PREFIX) ? field.slice(FIELD_PREFIX.length) : field;
  return path.split('.');
}

function resolvePath(properties: Record<string, unknown>, path: string): unknown {
  let current: unknown = properties;
  for (const segment of fieldPath(path)) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function extractField(
  properties: Record<string, unknown>,
  field: string | null,
): number | null {
  if (field == null) return null;

  const value = Number(resolvePath(properties, field));
  return Number.isFinite(value) ? value : null;
}

function dimValueOf(properties: Record<string, unknown>, dimName: string): string | null {
  const raw = resolvePath(properties, dimName);
  if (raw == null) return null;
  return String(raw).slice(0, MAX_DIM_VALUE_LENGTH);
}
```

- [ ] **Step 5: Run the tests to verify everything passes**

Run: `pnpm --filter @metricyak/app test -- ingest.test.ts`
Expected: PASS — all tests in the file, including the four new ones and every pre-existing test (`fieldPath`, `extractField`, `buildIngestDeltas`, `collectDimensionCandidates` describe blocks).

- [ ] **Step 6: Run the full backend test suite and type-check as a regression guard**

Run: `pnpm --filter @metricyak/app test && pnpm --filter @metricyak/app check-types`
Expected: PASS with no failures or type errors (this file is small and low-fanout, but confirm nothing else references `dimValueOf`'s removed direct-property-access behavior).

- [ ] **Step 7: Commit**

```bash
git add apps/metricyak/src/modules/aggregates/engine/ingest.ts apps/metricyak/src/modules/aggregates/engine/__tests__/ingest.test.ts
git commit -m "feat: resolve nested \$properties paths for metric dimensions"
```

---

## Self-Review Notes

- **Spec coverage:** Semantics (dimensions reuse field's path syntax) → Task 1 Steps 2-5. Shared `resolvePath` refactor → Task 1 Step 4. Backward compatibility (bare keys unchanged) → already covered by pre-existing tests in the same file (`'emits a total row...'`, `'groups distinct raw dimension values...'`), re-verified in Step 5/6. No schema/type/UI change → nothing in this plan touches those files, matching the spec's scope guard.
- **Placeholder scan:** none — every step has full code and exact commands.
- **Type consistency:** `resolvePath(properties: Record<string, unknown>, path: string): unknown` is used identically by both `extractField` and `dimValueOf`; `extractField`'s exported signature is unchanged from its current form, so no caller elsewhere in the codebase needs updating.
