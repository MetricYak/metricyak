# Monitor Evaluation Runtime — Design

**Date:** 2026-07-13
**Status:** Approved for planning
**Scope:** Runtime only. The monitor *definition* surface (schema + CRUD, shipped in PR #31) is left unchanged.

## Problem

Monitors can be defined but nothing evaluates them. A monitor names one metric, a
threshold `condition` (`operator` + `value`), a `window`, a `holdFor`, and a `missingData`
policy. We need the runtime that periodically reads the metric's value over its window,
compares it to the threshold, applies `holdFor`, and — when the condition *crosses* into
breach — emits a durable signal to a downstream flow (that downstream flow is out of scope).

## What already exists (do not rebuild)

- `monitors` table: `condition` (`{operator, value}`), `window`, `holdFor`, `enabled`,
  `missingData` (`skip`/`zero`/`fire`), `nextEvalAt`, plus an `(enabled, next_eval_at)` index —
  the schema already anticipates a polling evaluator. `scope` jsonb is present but unused
  (pass-through); leave it untouched, out of scope for this work.
- CRUD API + Zod schemas for monitors.
- Metric window read: compose `aggregates.getPartials({ metricId, metricVersion,
  granularity: 'minute', rangeStart, rangeEnd })` with `windowValues(definition, partials)`,
  then take the `$total` (`TOTAL_SENTINEL`) row's value. This is exactly what the
  `GET .../metrics/{metricId}/value` route does today.
- Queue infra: BullMQ + Redis via `@metricyak/queue` (connection, producer, worker-factory,
  queue-name/job-type definitions). A separate worker process (`worker.ts`) starts workers
  from each module's `workers` array via `bootstrap/workers.ts`. `RUN_WORKER_INLINE=true`
  runs them in-process for dev.

## Decisions (locked)

1. **Runtime only** — no changes to the definition surface.
2. **Periodic scheduler**, not event-reactive. `holdFor`, no-data-fires, and time-based
   windows require a clock, not just metric writes.
3. **Single tick evaluates all due monitors** (Approach A). One repeatable job claims every
   due monitor and evaluates them in a loop. `evaluateMonitor` is a pure function, so moving
   to a fan-out-per-monitor model later changes only *who calls it*, not the logic.
4. **Edge-triggered firing**: fire once when the condition first crosses into breach (after
   `holdFor`), stay quiet while it remains breached, re-arm only after recovery. No recovery
   signal in v1 (the `monitor_events.type` column leaves room to add one additively).
5. **Durable outbox → queue**: the `fired` record is written in the same transaction as the
   state change, then a relay enqueues it to a `monitor-signals` queue. At-least-once with
   idempotent dedupe downstream. The consumer is a no-op stub — the "another flow" boundary.
6. **Whole-metric only** in v1 (series = `$total`). State and event tables are keyed by
   `(monitor_id, series)` so per-series firing needs no migration later.
7. **Fixed 60s cadence** for all enabled monitors in v1 (`next_eval_at = now + 60s`).
   Per-monitor cadence scaling is deferred; the `next_eval_at` column already supports it.

## Components & data flow

```
BullMQ repeatable job (every 60s)
        │
        ▼
  monitor-tick handler
   ├─ claim due monitors (enabled, next_eval_at <= now, FOR UPDATE SKIP LOCKED)
   └─ for each monitor:
        ├─ read window value   ← getWindowValue(metric, window) → $total
        ├─ evaluateMonitor(monitor, state, value, now)   ← pure transition fn
        └─ in ONE tx:  upsert monitor_state
                       if fired → insert monitor_events (outbox row)
                       advance next_eval_at = now + 60s
        
  outbox relay (end of tick, after commits)
        └─ enqueue unrelayed monitor_events → 'monitor-signals' queue (jobId = event id)
           → no-op stub consumer
```

`evaluateMonitor` performs no I/O. It is the unit-testable core holding the state machine,
the comparison, and the `missingData` logic.

## Data model

Two new tables. `monitors` (config) is untouched.

### `monitor_state` — runtime state, one row per `(monitor_id, series)`

| column | type | notes |
|---|---|---|
| `monitor_id` | uuid, FK → monitors (cascade) | PK part |
| `series` | varchar | PK part; `$total` in v1 |
| `status` | varchar | `ok` \| `pending` \| `firing` |
| `breached_since` | timestamptz null | when condition first went true this episode; drives `holdFor` |
| `last_value` | double precision null | last computed window value (debug/UI) |
| `last_evaluated_at` | timestamptz null | |
| `updated_at` | timestamptz | |

State rows are created lazily on first evaluation; a missing row is treated as `ok`.

### `monitor_events` — durable outbox + firing history

| column | type | notes |
|---|---|---|
| `id` | uuid PK | used as the `monitor-signals` `jobId` for dedupe |
| `monitor_id` | uuid, FK → monitors (cascade) | |
| `series` | varchar | `$total` in v1 |
| `type` | varchar | `fired` (only value in v1; room for `recovered` later) |
| `value` | double precision | the value that crossed |
| `threshold` | jsonb | snapshot of `{operator, value}` at fire time |
| `occurred_at` | timestamptz | |
| `relayed_at` | timestamptz null | set when enqueued; `null` = unrelayed |
| `created_at` | timestamptz | |

Partial index `monitor_events (relayed_at) WHERE relayed_at IS NULL` keeps the relay's
"find unrelayed" query cheap.

`series` and `type` carry a single value each in v1 — kept because they are additive seams
(per-series firing, recovery signals) that avoid a later migration, not speculative surface.

## Evaluation algorithm (`evaluateMonitor`, pure)

**Inputs:** `monitor` (condition, window, holdFor, missingData), current `state`, computed
`value` (`null` if the window had no buckets), `now`.
**Output:** `{ nextState, event? }`.

**Step 1 — resolve value under `missingData`** (only when `value === null`):
- `skip` (default) → return early: state untouched, no fire, re-evaluate next tick.
- `zero` → treat value as `0`, continue.
- `fire` → treat condition as breached regardless, continue.

**Step 2 — breached?** Apply `condition.operator` (`lt/lte/gt/gte/eq/neq`) to the value.
`eq`/`neq` float-equality caveats are a definition-surface concern (already validated there);
the evaluator just compares.

**Step 3 — state transition:**

| current | breached? | `holdFor` elapsed? | → next | emit `fired`? |
|---|---|---|---|---|
| `ok` | no | — | `ok` | no |
| `ok` | yes | holdFor == 0 | `firing` | **yes** |
| `ok` | yes | holdFor > 0 | `pending` (set `breached_since = now`) | no |
| `pending` | no | — | `ok` (clear `breached_since`) | no |
| `pending` | yes | `now - breached_since ≥ holdFor` | `firing` | **yes** |
| `pending` | yes | not yet | `pending` (keep `breached_since`) | no |
| `firing` | yes | — | `firing` | no |
| `firing` | no | — | `ok` (re-arm) | no |

`last_value` / `last_evaluated_at` always updated. `holdFor` is measured from
`breached_since`, so flapping below threshold resets the timer — the condition must hold
continuously.

**Sampling caveat (documented, not fixed):** evaluation is discrete at tick resolution
(~60s). `holdFor` is enforced at that resolution, and a breach shorter than a tick that
recovers before the next tick will not fire. Standard for polled monitors.

## Dispatch — outbox relay

Runs at the end of each tick, after evaluations commit:

1. `SELECT ... FROM monitor_events WHERE relayed_at IS NULL ORDER BY occurred_at
   FOR UPDATE SKIP LOCKED` (bounded batch).
2. Enqueue each to the `monitor-signals` queue with `jobId = monitor_events.id`
   (job payload: monitorId, series, value, threshold, occurredAt).
3. Mark `relayed_at = now`.

The `fired` row commits transactionally with state → the outbox guarantee. The relay is
**at-least-once**: a crash after enqueue but before marking `relayed_at` re-enqueues next
tick; the constant `jobId` makes it idempotent. The `monitor-signals` **consumer is a no-op
stub** that logs — the downstream boundary. The relay is a separate function so it can become
its own repeatable job later without touching evaluation.

## Delivery — 4 additive PRs

Each PR is independently mergeable and exercised (no production code lands without either its
tests or its live caller).

1. **PR 1 — Evaluation core (pure).** `evaluateMonitor` + `getWindowValue(metric, window)`
   read helper (extracts the existing `getPartials` + `windowValues` → `$total` composition).
   No DB, no queues. Exhaustive unit tests.
2. **PR 2 — State & outbox storage.** `monitor_state` + `monitor_events` tables + migration;
   repo methods `claimDueMonitors`, `upsertMonitorState`, `insertMonitorEvent`,
   `findUnrelayedEvents`, `markRelayed`, each covered by integration tests in the existing
   `*.repository.integration.test.ts` style.
3. **PR 3 — Scheduler + tick (goes live).** BullMQ repeatable `monitor-tick` job + handler:
   claim due monitors → read → `evaluateMonitor` → commit state + any `fired` outbox row in
   one tx → advance `next_eval_at`. Registered via the module `workers` pattern. Monitors now
   evaluate and record firings.
4. **PR 4 — Signal relay + queue.** `monitor-signals` queue, relay step, `jobId` dedupe,
   no-op stub consumer. Signals now leave the system.

Optional: fold PR 2 into PR 3 if not-yet-wired repo methods are undesirable; kept split here
for reviewability since integration tests exercise them.

## Testing

- **Unit (PR 1):** every state-machine cell; `holdFor == 0` vs `> 0`; flapping resets
  `breached_since`; all three `missingData` policies; each operator. Pure fn → fast, total.
- **Integration (PR 2):** claim honors `enabled` / `next_eval_at` / `SKIP LOCKED`; state
  upsert + outbox insert atomic; unrelayed query + mark.
- **Integration (PR 3–4):** monitor over a seeded metric ticks → crosses → writes `fired` →
  relay enqueues once → stub consumes; recovery re-arms; a tick while `firing` does not
  re-fire.

## Out of scope / deferred

- Definition-surface changes (`scope` removal, `missingData` renaming, richer conditions).
- Per-series / `splitBy` firing (schema keyed to allow it later without migration).
- Recovery / all-clear signals (`type` column allows it later).
- Per-monitor cadence scaling by window (`next_eval_at` supports it later).
- The downstream `monitor-signals` consumer beyond the no-op stub.
- Fan-out-per-monitor evaluation (Approach B), sub-tick sampling, ClickHouse read path.
