# Adding a connector

A connector turns one vendor's webhook payload into MetricYak signals. It is a pure
function over bytes and configuration: it cannot read the database, enqueue work, or
see an HTTP request. That is deliberate — it keeps the review surface small enough
that we can accept connectors from people outside the team.

## The dependency rule

This package depends on `zod` and `node:crypto`, and nothing else. If your connector
needs a vendor SDK or a database driver, it belongs in its own package
(`@metricyak/connector-<vendor>`) implementing the same contract.

## Four files

```
src/providers/<vendor>/
  config.ts   the Zod schema for this connector's settings
  parse.ts    payload -> ParsedSignal[]
  index.ts    the assembled SignalProvider
  __tests__/
    <vendor>.test.ts
    fixtures/*.json
```

Then add one entry to `src/registry.ts`. Nothing else in the repository changes — no
route, no repository, no component.

## Capturing fixtures

Use a real delivery, not a hand-written payload. In your vendor's webhook settings,
find the recent-deliveries view, copy the request body verbatim, and redact only
tokens and personal data. Fixtures that drifted from reality are the main way a
connector breaks silently.

## What the conformance suite checks

`src/__tests__/conformance.test.ts` runs against every registered connector. Yours
must:

- return `[]` for an unrecognised payload, and never throw;
- return `[]` for a body that is not JSON, and never throw;
- return `bad_signature` for a tampered body;
- return `unsigned` when the signature header is missing;
- parse deterministically — same input, same output;
- declare a `configSchema` that rejects a non-object.

Beyond that, write tests for your vendor's semantics: which payloads you ignore, how
you map their status vocabulary onto ours, and that `externalId` stays stable across
every delivery in one lifecycle.

Every scoping field in your `configSchema` must actually be enforced in `parse.ts`. A
source configured for one project, repository or workspace has to ignore deliveries
from another — a signed delivery only proves the sender holds the secret, not that it
came from the thing the user configured.

## `externalId` is the important one

Most vendors send several deliveries for one real-world occurrence — a deployment
goes pending, then in progress, then succeeded. Every one of those must produce the
same `externalId`, because storage upserts on `(source_id, external_id)`. Key it on
the underlying object's id, never on the delivery's own id.

## `observedAt` orders those deliveries

`occurredAt` is when the thing happened, so it is the *same* on every delivery in a
lifecycle — that is what makes them collapse. `observedAt` is when the vendor emitted
*this* delivery, so it advances. Storage applies an update only when `observedAt` is
at least as new as what it already holds, which is what stops a retried or
out-of-order "started" from overwriting a "finished".

Set it from the per-delivery timestamp in the payload (GitHub: `deployment_status.created_at`),
never from the parent object's timestamp and never from `new Date()` — a wall-clock
read makes a stale delivery look like the newest one.

## Configuration is a generated form

You do not write UI. The connect form is generated from your `configSchema`, so use
`.describe()` for labels and helper text, `z.enum` where a select is right, and
`.default()` where a sensible default exists. Validation messages you write in the
schema are what the user sees against the field.
