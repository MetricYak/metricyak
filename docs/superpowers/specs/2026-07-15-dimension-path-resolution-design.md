# Dimension path resolution

## Goal

Let `MetricDefinition.dimensions` reach nested event properties, the same way `MetricEvent.field` already can. Today `field` supports path expressions (`$properties.checkout.total`, walked into nested objects), but `dimensions` only does a flat `properties[dimName]` lookup — a dimension whose value lives anywhere but the top level of the properties bag simply can't be declared.

Non-goal: a display-name/alias layer (a dimension's declared string stays its own identifier — no separate `{name, path}` split), a property-discovery picker in the UI, and any change to the `MetricDefinition`/`dimensions` *type* (it stays `string[]`).

## Current behavior

`apps/metricyak/src/modules/aggregates/engine/ingest.ts`:

- `extractField` (lines 26-40): strips an optional `$properties.` prefix, splits the remainder on `.`, walks the resulting path into the event's `properties` object, returns a `number | null`.
- `dimValueOf` (lines 42-46): `properties[dimName]` — direct, one level, no prefix handling, no path splitting. Returns a `string | null`.

There is no aliasing/mapping layer anywhere in the codebase; whatever string is declared is looked up verbatim.

## Change

Factor the shared "walk into nested properties" logic out of `extractField` into a `resolvePath` helper, and have `dimValueOf` use it too:

```typescript
function resolvePath(properties: Record<string, unknown>, path: string): unknown {
  let current: unknown = properties;
  for (const segment of fieldPath(path)) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function extractField(properties: Record<string, unknown>, field: string | null): number | null {
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

`fieldPath` (already present, lines 21-24) is unchanged and reused as-is.

Both call sites in `ingest.ts` — `buildIngestDeltas` and `collectDimensionCandidates` — keep calling `dimValueOf` exactly as before; only its internals change. `dimName` continues to serve as the bucket-storage identifier (`dimensionKey`/`compositeKey`) unchanged — it's already treated as an opaque string there, so a longer path string works identically.

## Compatibility

Fully backward compatible: `fieldPath()` on a plain key with no `.` and no `$properties.` prefix returns a single-segment path, so every existing bare-key dimension (`"plan"`, `"country"`) resolves exactly as it does today.

Known, accepted limitation carried over from `field`: a raw property key containing a literal `.` would be misread as a nested path. This risk already exists for `field` in production; extending `dimensions` to share it isn't a new failure mode, just the same documented tradeoff. No evidence today of a real property key containing a literal dot, so not worth solving now.

No new validation is introduced. `field` has no format validation beyond non-empty string today; `dimensions` gets none either, for consistency.

## UI

No UI code changes. `DimensionsField.tsx` (tag input) and `EventFieldGroup.tsx` (`field` input) are already unconstrained free-text with no picker or autocomplete on either — a user could already type a dotted string like `"geo.country"` into the dimensions input today; it simply wouldn't resolve until this change lands. An optional, non-blocking follow-up: update `DimensionsField.tsx`'s placeholder copy to hint at nested-path support (mirroring `field`'s `"e.g. amount_usd"`), but this is cosmetic and not required for the feature to work.

## Testing

Unit tests in `ingest.ts`'s test suite:

- Bare key dimension — regression guard, unchanged behavior.
- `$properties.`-prefixed nested dimension resolves correctly.
- Un-prefixed nested dimension (`"geo.country"`) resolves correctly.
- Missing intermediate object → `null`, event doesn't contribute to that dimension (no throw).
- Existing `extractField` tests still pass unchanged after the `resolvePath` extraction.

## Scope guard

Single new branch, backend-only: the `resolvePath` refactor in `ingest.ts` plus tests. No schema/type change, no alias/mapping concept, no UI change, no property-discovery feature.
