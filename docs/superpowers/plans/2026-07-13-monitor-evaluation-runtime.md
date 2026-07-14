# Monitor Evaluation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the runtime that periodically evaluates each monitor against its metric's windowed value, applies `holdFor`, and emits a durable, edge-triggered signal when the threshold is crossed.

**Architecture:** A BullMQ repeatable job ticks every 60s. Its handler claims each due monitor (`enabled`, `next_eval_at <= now`) under a `FOR UPDATE SKIP LOCKED` row lock, reads the metric's `$total` value over the window, runs a pure `evaluateMonitor` state machine (`ok → pending → firing`, re-arm on recovery), and commits the new state plus any `fired` outbox row in one transaction. A relay enqueues unrelayed `fired` rows to a `monitor-signals` queue whose consumer is a no-op stub — the downstream "other flow" boundary.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), Hono, Drizzle ORM (Postgres, `snake_case` casing), BullMQ + Redis (`@metricyak/queue`), Vitest (+ Testcontainers for integration).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-13-monitor-evaluation-runtime-design.md`. Follow it; do not change the monitor *definition* surface (schema/CRUD from PR #31), and leave the unused `scope` column untouched.
- **Domain language:** names follow `CONTEXT.md`. A monitor **fires** when its **value** (a metric's scalar result over a **window** `[from, to)`) **crosses** a threshold condition, **held for** a duration; the downstream it routes to is a **Workflow**. "Signal" is the transport word for the emitted firing (the user's term). Do not introduce `alert`/`alarm`/`check`/`notification`/`hook`.
- **Read the value through `createMetricReads`, do NOT re-compose `getPartials` + `windowValues`.** PR #41 centralised metric reads into the `MetricReads` deep module (`apps/metricyak/src/modules/aggregates/aggregates.reads.ts`); the runtime consumes `createMetricReads({ aggregates }).value(metric, projectId, { from, to })` and takes `.value`. Re-deriving the read here would duplicate that module.
- **`MetricSummary` is `{ metricId, version, name, definition }`** (note `metricId`, not `id`). `MetricReads.value` takes the whole summary — pass it straight through; never hand-build `{ id, version, definition }`.
- **`series` is always `$total` (`TOTAL_SENTINEL`) in v1.** `type` on events is always `'fired'` in v1. Both columns exist only as additive seams — do not add branches for other values.
- **Cadence constant:** evaluation cadence is a single exported constant `MONITOR_TICK_INTERVAL_MS = 60_000`. Reuse it for both the repeatable-job interval and `next_eval_at` advancement.

### Code style — from `AGENTS.md` (every task obeys this)

The code below is written to satisfy these rules already; when you extend or adjust it, keep it that way. If any snippet here still reads as violating a rule, fix it — the rule wins over the snippet.

- **No comments — including in tests.** Names and flow carry the meaning; a comment explaining *what* code does is a signal to rename or split instead. (OpenAPI `description` fields are API-contract data, not comments — those stay.) The finished production snippets here are comment-free; where a snippet is a skeleton (the tick/relay tests, and `// edit this file` blocks), the inline `//` lines are plan scaffolding — replace them with real, comment-free code, and never leave a `// path/to/file.ts` locator header in the committed file.
- **Intention-revealing names, no jargon.** `assessBreach`, `breachedSince`, `MILLIS_PER_UNIT` — never `res`/`tmp`/`data`. A distinct, independently testable concern earns its own small function (that's why breach resolution is `assessBreach`, not an inline block).
- **Readable top-to-bottom flow; make intent visible.** Prefer an explicit named guard over trusting a DB/framework quirk the reader can't see.
- **Pure at the boundary; no shared mutable state.** `evaluateMonitor`, `assessBreach`, `compare`, `parseDuration` depend only on their arguments and don't mutate inputs. Ambient wall-clock time (`new Date()`) is read only in the worker wiring, never in the pure functions — they take `now`.
- **No dead code / no impossible branches.** Every method that lands is exercised by a test or a live caller in the same PR.

### TypeScript conventions — from `AGENTS.md`

- **ESM imports** use explicit `.js` specifiers, even from `.ts` sources.
- **`strict` + `noUncheckedIndexedAccess` + `noUnusedLocals/Parameters`.** Indexing a record yields `T | undefined` — guard it, don't assume.
- **No `any`. No `as` casts** except `as const` (and never `as unknown as`); avoid non-null `!`. Narrow with guards instead. `parseDuration` is written cast-free for exactly this reason.
- **Explicit return types on all exported functions.**
- **`readonly` on hand-written interface props and incoming array params.**
- **Discriminated unions keyed by a literal `kind` for results/state machines, handled by a `switch` with an exhaustive `never` default** (`assessBreach`'s return and the `compare`/`missingData` switches follow this).
- **Prefer narrow return types** over wide ones.

### Drizzle / storage

- **Drizzle casing is `snake_case`** (configured globally) — define columns in camelCase; DB names are snake_cased automatically. Match existing schema files.
- **Repository methods that participate in a transaction** take a trailing `executor: Executor = this.db` param, exactly like `AggregatesRepository.getPartials`.
- **Migrations:** generated with `pnpm --filter @metricyak/storage db:generate` into `packages/storage/migrations`. Never hand-edit generated SQL; if a table is wrong, fix the schema and regenerate.

### Git

- **Conventional Commits** for every commit (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`). Commit after each green step.
- **Branch per PR:** start each PR (1–4) on its own branch off `main` (`git checkout -b feat/monitor-<slice>`); never commit to `main`. Do NOT `git push` or open PRs — the user integrates and pushes.
- Before marking any change done: `pnpm check-types && pnpm test`, then `pnpm check:fix` for formatting.

---

## File Structure

**PR 1 — Evaluation core (pure), `apps/metricyak/src/modules/monitors/engine/`:**
- Create `duration.ts` — `parseDuration(value)` → milliseconds.
- Create `evaluate.ts` — `evaluateMonitor(...)` state machine + its types.
- Create `__tests__/duration.test.ts`, `__tests__/evaluate.test.ts`.
- (No read helper: the tick reuses the existing `MetricReads` module — see Global Constraints.)

**PR 2 — State & outbox storage, `packages/storage/src/`:**
- Create `schema/monitor-state.ts`, `schema/monitor-events.ts`; register both in `schema/index.ts`.
- Create `repositories/monitor-runtime.repository.ts` (`MonitorRuntimeRepository`); register in `repositories/index.ts`.
- Create `repositories/__tests__/monitor-runtime.repository.integration.test.ts`.
- Generate migration into `migrations/`.

**PR 3 — Scheduler + tick (goes live), `apps/metricyak/src/`:**
- Create `modules/monitors/monitors.tick.ts` — the tick handler (`runMonitorTick`).
- Create `modules/monitors/__tests__/monitors.tick.integration.test.ts`.
- Modify `packages/queue/src/queues.ts`, `worker-factory.ts`, `index.ts` — add `MONITOR_TICK_QUEUE`, worker + scheduler factory.
- Modify `apps/metricyak/src/modules/module.ts` — add optional `schedulers` to `AppModule`.
- Modify `apps/metricyak/src/bootstrap/workers.ts` — start module schedulers.
- Modify `apps/metricyak/src/modules/monitors/monitors.module.ts` — register worker + scheduler.
- Modify `apps/metricyak/src/container/container.ts` — add `monitorRuntime` repository.

**PR 4 — Signal relay + queue, `apps/metricyak/src/` + `packages/queue/src/`:**
- Modify `packages/queue/src/queues.ts`, `producer.ts`, `worker-factory.ts`, `index.ts` — add `MONITOR_SIGNALS_QUEUE`, its job type, producer, and worker.
- Create `modules/monitors/monitors.relay.ts` — `relayMonitorSignals(...)`.
- Create `modules/monitors/monitors.signals.worker.ts` — no-op stub consumer.
- Modify `monitors.tick.ts` to invoke the relay at end of tick; register the signals worker in the module.
- Create `modules/monitors/__tests__/monitors.relay.integration.test.ts`.

---

# PR 1 — Evaluation core (pure)

Pure, I/O-free logic. No DB, no queues. This is the correctness-critical piece.

### Task 1.1: Duration parser

**Files:**
- Create: `apps/metricyak/src/modules/monitors/engine/duration.ts`
- Test: `apps/metricyak/src/modules/monitors/engine/__tests__/duration.test.ts`

**Interfaces:**
- Produces: `parseDuration(value: string): number` — milliseconds. Accepts `\d+(s|m|h|d|w)` (the same grammar the definition schema validates). Throws on anything else.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/metricyak/src/modules/monitors/engine/__tests__/duration.test.ts
import { describe, expect, it } from 'vitest';
import { parseDuration } from '../duration.js';

describe('parseDuration', () => {
  it('parses each unit into milliseconds', () => {
    expect(parseDuration('30s')).toBe(30_000);
    expect(parseDuration('5m')).toBe(300_000);
    expect(parseDuration('1h')).toBe(3_600_000);
    expect(parseDuration('1d')).toBe(86_400_000);
    expect(parseDuration('1w')).toBe(604_800_000);
  });

  it('treats a zero duration as zero milliseconds', () => {
    expect(parseDuration('0m')).toBe(0);
  });

  it('throws on an unparseable duration', () => {
    expect(() => parseDuration('1y')).toThrow('Invalid duration');
    expect(() => parseDuration('abc')).toThrow('Invalid duration');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app test -- duration`
Expected: FAIL — cannot find module `../duration.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/metricyak/src/modules/monitors/engine/duration.ts
const MILLIS_PER_UNIT: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
};

export function parseDuration(value: string): number {
  const match = /^(\d+)([smhdw])$/.exec(value);
  const amount = match?.[1];
  const unit = match?.[2];
  const millisPerUnit = unit === undefined ? undefined : MILLIS_PER_UNIT[unit];
  if (amount === undefined || millisPerUnit === undefined) {
    throw new Error(`Invalid duration: "${value}". Expected a value such as "0m", "1h", or "1d".`);
  }
  return Number(amount) * millisPerUnit;
}
```

No `as` cast; `match?.[k]` and the record lookup are both `… | undefined` under `noUncheckedIndexedAccess`, and the single guard narrows all three.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app test -- duration`
Expected: PASS (3 tests).

> Package names (confirmed): app = `@metricyak/app`, storage = `@metricyak/storage`, queue = `@metricyak/queue`. Lint/format is Biome, run from the repo root as `pnpm lint` (`biome lint .`).

- [ ] **Step 5: Commit**

```bash
git add apps/metricyak/src/modules/monitors/engine/duration.ts apps/metricyak/src/modules/monitors/engine/__tests__/duration.test.ts
git commit -m "feat(monitors): add duration parser for windows and holdFor"
```

---

### Task 1.2: `evaluateMonitor` state machine

**Files:**
- Create: `apps/metricyak/src/modules/monitors/engine/evaluate.ts`
- Test: `apps/metricyak/src/modules/monitors/engine/__tests__/evaluate.test.ts`

**Interfaces:**
- Consumes: `MonitorComparisonOperator`, `MonitorMissingData`, `MonitorThresholdCondition` from `@metricyak/storage`.
- Produces:
  - `type MonitorStatus = 'ok' | 'pending' | 'firing'`
  - `type MonitorEvalState = { status: MonitorStatus; breachedSince: Date | null }`
  - `type MonitorEvalInput = { condition: MonitorThresholdCondition; holdForMs: number; missingData: MonitorMissingData }`
  - `type MonitorFired = { value: number; threshold: MonitorThresholdCondition; occurredAt: Date }`
  - `type MonitorEvalResult = { nextState: MonitorEvalState; fired: MonitorFired | null }`
  - `evaluateMonitor(input: MonitorEvalInput, state: MonitorEvalState, value: number | null, now: Date): MonitorEvalResult`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/metricyak/src/modules/monitors/engine/__tests__/evaluate.test.ts
import type { MonitorThresholdCondition } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { evaluateMonitor, type MonitorEvalState } from '../evaluate.js';

const lt5000: MonitorThresholdCondition = { operator: 'lt', value: 5000 };
const ok: MonitorEvalState = { status: 'ok', breachedSince: null };
const t0 = new Date('2026-07-13T00:00:00.000Z');
const later = (ms: number) => new Date(t0.getTime() + ms);

function input(overrides: Partial<{ holdForMs: number; missingData: 'skip' | 'zero' | 'fire' }> = {}) {
  return { condition: lt5000, holdForMs: 0, missingData: 'skip' as const, ...overrides };
}

describe('evaluateMonitor', () => {
  it('stays ok when the value does not breach', () => {
    const result = evaluateMonitor(input(), ok, 6000, t0);
    expect(result.nextState.status).toBe('ok');
    expect(result.fired).toBeNull();
  });

  it('fires immediately from ok when holdFor is zero', () => {
    const result = evaluateMonitor(input(), ok, 4000, t0);
    expect(result.nextState.status).toBe('firing');
    expect(result.fired).toEqual({ value: 4000, threshold: lt5000, occurredAt: t0 });
  });

  it('goes to pending (no fire) when holdFor has not elapsed', () => {
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), ok, 4000, t0);
    expect(result.nextState).toEqual({ status: 'pending', breachedSince: t0 });
    expect(result.fired).toBeNull();
  });

  it('fires from pending once holdFor elapses, keeping breachedSince', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 4000, later(60_000));
    expect(result.nextState).toEqual({ status: 'firing', breachedSince: t0 });
    expect(result.fired?.occurredAt).toEqual(later(60_000));
  });

  it('stays pending while breached but holdFor still pending', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 4000, later(30_000));
    expect(result.nextState).toEqual({ status: 'pending', breachedSince: t0 });
    expect(result.fired).toBeNull();
  });

  it('recovers to ok from pending when the breach clears (resets the timer)', () => {
    const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
    const result = evaluateMonitor(input({ holdForMs: 60_000 }), pending, 6000, later(30_000));
    expect(result.nextState).toEqual({ status: 'ok', breachedSince: null });
    expect(result.fired).toBeNull();
  });

  it('does not re-fire while already firing', () => {
    const firing: MonitorEvalState = { status: 'firing', breachedSince: t0 };
    const result = evaluateMonitor(input(), firing, 4000, later(120_000));
    expect(result.nextState.status).toBe('firing');
    expect(result.fired).toBeNull();
  });

  it('re-arms to ok from firing when the value recovers', () => {
    const firing: MonitorEvalState = { status: 'firing', breachedSince: t0 };
    const result = evaluateMonitor(input(), firing, 6000, later(120_000));
    expect(result.nextState).toEqual({ status: 'ok', breachedSince: null });
    expect(result.fired).toBeNull();
  });

  describe('missingData with a null value', () => {
    it('skip leaves state untouched and never fires', () => {
      const pending: MonitorEvalState = { status: 'pending', breachedSince: t0 };
      const result = evaluateMonitor(input({ missingData: 'skip' }), pending, null, later(90_000));
      expect(result.nextState).toBe(pending);
      expect(result.fired).toBeNull();
    });

    it('zero evaluates the condition against 0', () => {
      const result = evaluateMonitor(input({ missingData: 'zero' }), ok, null, t0);
      expect(result.nextState.status).toBe('firing'); // 0 < 5000
      expect(result.fired?.value).toBe(0);
    });

    it('fire treats a missing window as breached', () => {
      const gt: MonitorThresholdCondition = { operator: 'gt', value: 5000 };
      const result = evaluateMonitor(
        { condition: gt, holdForMs: 0, missingData: 'fire' },
        ok,
        null,
        t0,
      );
      expect(result.nextState.status).toBe('firing');
      expect(result.fired?.value).toBe(0);
    });
  });

  it('compares each operator correctly', () => {
    const cases: Array<[MonitorThresholdCondition, number, boolean]> = [
      [{ operator: 'lt', value: 10 }, 9, true],
      [{ operator: 'lte', value: 10 }, 10, true],
      [{ operator: 'gt', value: 10 }, 11, true],
      [{ operator: 'gte', value: 10 }, 10, true],
      [{ operator: 'eq', value: 10 }, 10, true],
      [{ operator: 'neq', value: 10 }, 11, true],
      [{ operator: 'lt', value: 10 }, 10, false],
    ];
    for (const [condition, value, breached] of cases) {
      const result = evaluateMonitor(
        { condition, holdForMs: 0, missingData: 'skip' },
        ok,
        value,
        t0,
      );
      expect(result.nextState.status).toBe(breached ? 'firing' : 'ok');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app test -- evaluate`
Expected: FAIL — cannot find module `../evaluate.js`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/metricyak/src/modules/monitors/engine/evaluate.ts
import type {
  MonitorComparisonOperator,
  MonitorMissingData,
  MonitorThresholdCondition,
} from '@metricyak/storage';

export type MonitorStatus = 'ok' | 'pending' | 'firing';

export type MonitorEvalState = {
  status: MonitorStatus;
  breachedSince: Date | null;
};

export type MonitorEvalInput = {
  condition: MonitorThresholdCondition;
  holdForMs: number;
  missingData: MonitorMissingData;
};

export type MonitorFired = {
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export type MonitorEvalResult = {
  nextState: MonitorEvalState;
  fired: MonitorFired | null;
};

const RECOVERED: MonitorEvalState = { status: 'ok', breachedSince: null };

type BreachAssessment =
  | { kind: 'stateUnchanged' }
  | { kind: 'assessed'; breached: boolean; value: number };

function compare(operator: MonitorComparisonOperator, value: number, threshold: number): boolean {
  switch (operator) {
    case 'lt':
      return value < threshold;
    case 'lte':
      return value <= threshold;
    case 'gt':
      return value > threshold;
    case 'gte':
      return value >= threshold;
    case 'eq':
      return value === threshold;
    case 'neq':
      return value !== threshold;
    default: {
      const unhandled: never = operator;
      throw new Error(`Unhandled operator: ${JSON.stringify(unhandled)}`);
    }
  }
}

function assessBreach(input: MonitorEvalInput, value: number | null): BreachAssessment {
  if (value !== null) {
    return {
      kind: 'assessed',
      breached: compare(input.condition.operator, value, input.condition.value),
      value,
    };
  }
  switch (input.missingData) {
    case 'skip':
      return { kind: 'stateUnchanged' };
    case 'zero':
      return {
        kind: 'assessed',
        breached: compare(input.condition.operator, 0, input.condition.value),
        value: 0,
      };
    case 'fire':
      return { kind: 'assessed', breached: true, value: 0 };
    default: {
      const unhandled: never = input.missingData;
      throw new Error(`Unhandled missingData: ${JSON.stringify(unhandled)}`);
    }
  }
}

export function evaluateMonitor(
  input: MonitorEvalInput,
  state: MonitorEvalState,
  value: number | null,
  now: Date,
): MonitorEvalResult {
  const assessment = assessBreach(input, value);

  if (assessment.kind === 'stateUnchanged') {
    return { nextState: state, fired: null };
  }

  if (!assessment.breached) {
    return { nextState: RECOVERED, fired: null };
  }

  if (state.status === 'firing') {
    return { nextState: state, fired: null };
  }

  const breachedSince =
    state.status === 'pending' && state.breachedSince ? state.breachedSince : now;

  if (now.getTime() - breachedSince.getTime() >= input.holdForMs) {
    return {
      nextState: { status: 'firing', breachedSince },
      fired: { value: assessment.value, threshold: input.condition, occurredAt: now },
    };
  }

  return { nextState: { status: 'pending', breachedSince }, fired: null };
}
```

`assessBreach` isolates the `missingData` policy as a `kind`-tagged discriminated union so `evaluateMonitor` reads as a top-to-bottom sentence; both switches carry an exhaustive `never` default.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app test -- evaluate`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add apps/metricyak/src/modules/monitors/engine/evaluate.ts apps/metricyak/src/modules/monitors/engine/__tests__/evaluate.test.ts
git commit -m "feat(monitors): add pure evaluateMonitor state machine"
```

- [ ] **Step 6: Typecheck the app package**

Run: `pnpm --filter @metricyak/app check-types`
Expected: PASS.

> PR 1 is now complete and independently mergeable: `parseDuration` + `evaluateMonitor` are pure and fully unit-tested, with no runtime wiring. The value read is deliberately deferred to the tick handler (PR 3), which reuses the existing `MetricReads` module rather than re-deriving it.

---

# PR 2 — State & outbox storage

New tables + repository, exercised by integration tests.

### Task 2.1: `monitor_state` and `monitor_events` schema + migration

**Files:**
- Create: `packages/storage/src/schema/monitor-state.ts`
- Create: `packages/storage/src/schema/monitor-events.ts`
- Modify: `packages/storage/src/schema/index.ts`
- Migration: `packages/storage/migrations/` (generated)

**Interfaces:**
- Produces (exported): `monitorState`, `MONITOR_STATUSES`, `MonitorStatus`; `monitorEvents`, `MONITOR_EVENT_TYPES`, `MonitorEventType`.

- [ ] **Step 1: Write `monitor-state.ts`**

```typescript
// packages/storage/src/schema/monitor-state.ts
import { doublePrecision, index, pgTable, primaryKey, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { monitors } from './monitors.js';

export const MONITOR_STATUSES = ['ok', 'pending', 'firing'] as const;
export type MonitorStatus = (typeof MONITOR_STATUSES)[number];

export const monitorState = pgTable(
  'monitor_state',
  {
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 256 }).notNull(),
    status: varchar('status', { length: 8 }).$type<MonitorStatus>().notNull().default('ok'),
    breachedSince: timestamp('breached_since', { mode: 'date', precision: 3, withTimezone: true }),
    lastValue: doublePrecision('last_value'),
    lastEvaluatedAt: timestamp('last_evaluated_at', {
      mode: 'date',
      precision: 3,
      withTimezone: true,
    }),
    updatedAt: timestamp('updated_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.monitorId, table.series] }),
    index('monitor_state_monitor_id_idx').on(table.monitorId),
  ],
);
```

- [ ] **Step 2: Write `monitor-events.ts`**

```typescript
// packages/storage/src/schema/monitor-events.ts
import { sql } from 'drizzle-orm';
import {
  doublePrecision,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { monitors } from './monitors.js';
import type { MonitorThresholdCondition } from './monitors.js';

export const MONITOR_EVENT_TYPES = ['fired'] as const;
export type MonitorEventType = (typeof MONITOR_EVENT_TYPES)[number];

export const monitorEvents = pgTable(
  'monitor_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    monitorId: uuid('monitor_id')
      .notNull()
      .references(() => monitors.id, { onDelete: 'cascade' }),
    series: varchar('series', { length: 256 }).notNull(),
    type: varchar('type', { length: 16 }).$type<MonitorEventType>().notNull(),
    value: doublePrecision('value').notNull(),
    threshold: jsonb('threshold').$type<MonitorThresholdCondition>().notNull(),
    occurredAt: timestamp('occurred_at', { mode: 'date', precision: 3, withTimezone: true }).notNull(),
    relayedAt: timestamp('relayed_at', { mode: 'date', precision: 3, withTimezone: true }),
    createdAt: timestamp('created_at', { mode: 'date', precision: 3, withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('monitor_events_monitor_id_idx').on(table.monitorId),
    index('monitor_events_unrelayed_idx')
      .on(table.occurredAt)
      .where(sql`${table.relayedAt} is null`),
  ],
);
```

- [ ] **Step 3: Register both tables in the schema barrel**

```typescript
// packages/storage/src/schema/index.ts — add these two lines in alphabetical position
export * from './monitor-events.js';
export * from './monitor-state.js';
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm --filter @metricyak/storage db:generate`
Expected: a new `NNNN_*.sql` under `packages/storage/migrations/` creating `monitor_state` and `monitor_events` with the partial index. Inspect it — confirm it only ADDs these two tables and their indexes (no changes to existing tables).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @metricyak/storage check-types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/storage/src/schema/monitor-state.ts packages/storage/src/schema/monitor-events.ts packages/storage/src/schema/index.ts packages/storage/migrations
git commit -m "feat(storage): add monitor_state and monitor_events tables"
```

---

### Task 2.2: `MonitorRuntimeRepository`

**Files:**
- Create: `packages/storage/src/repositories/monitor-runtime.repository.ts`
- Modify: `packages/storage/src/repositories/index.ts`
- Test: `packages/storage/src/repositories/__tests__/monitor-runtime.repository.integration.test.ts`

**Interfaces:**
- Consumes: `Executor`, `Database` from `../client.js`; `monitors`, `monitorState`, `monitorEvents`, and their types from the schema.
- Produces: `MonitorRuntimeRepository` with:
  - `listDueMonitors(now: Date, limit: number): Promise<MonitorRecord[]>` — enabled monitors with `next_eval_at <= now`, ordered by `next_eval_at`, capped at `limit`. No lock.
  - `lockDueMonitor(monitorId: string, now: Date, tx: Executor): Promise<MonitorRecord | null>` — re-selects the monitor `FOR UPDATE SKIP LOCKED` guarded on `enabled` and `next_eval_at <= now`; `null` if not lockable/no longer due.
  - `getState(monitorId: string, series: string, executor?: Executor): Promise<MonitorEvalStateRow | null>`
  - `upsertState(input: UpsertStateInput, executor?: Executor): Promise<void>` — insert-or-update on `(monitor_id, series)`.
  - `insertEvent(input: InsertEventInput, executor?: Executor): Promise<string>` — returns the new event id.
  - `setNextEvalAt(monitorId: string, nextEvalAt: Date, executor?: Executor): Promise<void>`
  - `findUnrelayedEvents(limit: number, executor?: Executor): Promise<MonitorEventRecord[]>`
  - `markRelayed(ids: readonly string[], relayedAt: Date, executor?: Executor): Promise<void>`
  - Types: `MonitorEvalStateRow`, `UpsertStateInput`, `InsertEventInput`, `MonitorEventRecord` (see implementation).

- [ ] **Step 1: Write the failing integration test**

```typescript
// packages/storage/src/repositories/__tests__/monitor-runtime.repository.integration.test.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Database } from '../../client.js';
import * as schema from '../../schema/index.js';
import { metricDefinitions, monitors, organizations, projects } from '../../schema/index.js';
import { MonitorRuntimeRepository } from '../monitor-runtime.repository.js';

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

describe('MonitorRuntimeRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let db: Database;
  let repo: MonitorRuntimeRepository;
  let projectId: string;
  let metricId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine').start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    db = drizzle({ client: pool, schema, casing: 'snake_case' });
    await migrate(db, { migrationsFolder });
    repo = new MonitorRuntimeRepository(db);
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table monitor_events, monitor_state, monitors, metric_definitions, projects, organizations restart identity cascade`,
    );
    const [org] = await db.insert(organizations).values({ slug: 'acme', name: 'Acme' }).returning();
    if (!org) throw new Error('failed to seed organization');
    const [project] = await db
      .insert(projects)
      .values({ organizationId: org.id, name: 'Proj' })
      .returning();
    if (!project) throw new Error('failed to seed project');
    projectId = project.id;
    const [metric] = await db.insert(metricDefinitions).values({ projectId }).returning();
    if (!metric) throw new Error('failed to seed metric definition');
    metricId = metric.id;
  });

  async function seedMonitor(overrides: { enabled?: boolean; nextEvalAt?: Date } = {}) {
    const [monitor] = await db
      .insert(monitors)
      .values({
        projectId,
        metricId,
        name: 'Revenue floor',
        condition: { operator: 'lt', value: 5000 },
        window: '1d',
        holdFor: '0m',
        enabled: overrides.enabled ?? true,
        nextEvalAt: overrides.nextEvalAt ?? new Date('2026-07-13T00:00:00.000Z'),
      })
      .returning();
    if (!monitor) throw new Error('failed to seed monitor');
    return monitor;
  }

  it('lists only enabled, due monitors ordered by next_eval_at', async () => {
    const now = new Date('2026-07-13T01:00:00.000Z');
    const due = await seedMonitor({ nextEvalAt: new Date('2026-07-13T00:30:00.000Z') });
    await seedMonitor({ enabled: false, nextEvalAt: new Date('2026-07-13T00:00:00.000Z') });
    await seedMonitor({ nextEvalAt: new Date('2026-07-13T02:00:00.000Z') }); // future

    const rows = await repo.listDueMonitors(now, 10);
    expect(rows.map((r) => r.id)).toEqual([due.id]);
  });

  it('upserts state and reads it back', async () => {
    const monitor = await seedMonitor();
    await repo.upsertState({
      monitorId: monitor.id,
      series: '$total',
      status: 'pending',
      breachedSince: new Date('2026-07-13T00:00:00.000Z'),
      lastValue: 4000,
      lastEvaluatedAt: new Date('2026-07-13T00:00:00.000Z'),
    });
    await repo.upsertState({
      monitorId: monitor.id,
      series: '$total',
      status: 'firing',
      breachedSince: new Date('2026-07-13T00:00:00.000Z'),
      lastValue: 3000,
      lastEvaluatedAt: new Date('2026-07-13T00:01:00.000Z'),
    });

    const state = await repo.getState(monitor.id, '$total');
    expect(state).toMatchObject({ status: 'firing', lastValue: 3000 });
  });

  it('inserts an event and relays it exactly once', async () => {
    const monitor = await seedMonitor();
    const id = await repo.insertEvent({
      monitorId: monitor.id,
      series: '$total',
      type: 'fired',
      value: 3000,
      threshold: { operator: 'lt', value: 5000 },
      occurredAt: new Date('2026-07-13T00:01:00.000Z'),
    });

    const unrelayed = await repo.findUnrelayedEvents(10);
    expect(unrelayed.map((e) => e.id)).toEqual([id]);

    await repo.markRelayed([id], new Date('2026-07-13T00:02:00.000Z'));
    expect(await repo.findUnrelayedEvents(10)).toEqual([]);
  });

  it('commits state + event atomically inside a caller transaction', async () => {
    const monitor = await seedMonitor();
    await db.transaction(async (tx) => {
      const locked = await repo.lockDueMonitor(monitor.id, new Date('2026-07-13T01:00:00.000Z'), tx);
      expect(locked?.id).toBe(monitor.id);
      await repo.upsertState(
        {
          monitorId: monitor.id,
          series: '$total',
          status: 'firing',
          breachedSince: new Date('2026-07-13T01:00:00.000Z'),
          lastValue: 3000,
          lastEvaluatedAt: new Date('2026-07-13T01:00:00.000Z'),
        },
        tx,
      );
      await repo.insertEvent(
        {
          monitorId: monitor.id,
          series: '$total',
          type: 'fired',
          value: 3000,
          threshold: { operator: 'lt', value: 5000 },
          occurredAt: new Date('2026-07-13T01:00:00.000Z'),
        },
        tx,
      );
      await repo.setNextEvalAt(monitor.id, new Date('2026-07-13T01:01:00.000Z'), tx);
    });

    expect(await repo.getState(monitor.id, '$total')).toMatchObject({ status: 'firing' });
    expect((await repo.findUnrelayedEvents(10)).length).toBe(1);
    expect(await repo.listDueMonitors(new Date('2026-07-13T01:00:30.000Z'), 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/storage test -- monitor-runtime`
Expected: FAIL — cannot find module `../monitor-runtime.repository.js`.

- [ ] **Step 3: Write the repository**

```typescript
// packages/storage/src/repositories/monitor-runtime.repository.ts
import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm';
import type { Database, Executor } from '../client.js';
import { type MonitorEventType, monitorEvents } from '../schema/monitor-events.js';
import { type MonitorStatus, monitorState } from '../schema/monitor-state.js';
import { type MonitorThresholdCondition, monitors } from '../schema/monitors.js';
import type { MonitorRecord } from './monitors.repository.js';

export type MonitorEvalStateRow = {
  monitorId: string;
  series: string;
  status: MonitorStatus;
  breachedSince: Date | null;
  lastValue: number | null;
  lastEvaluatedAt: Date | null;
};

export type UpsertStateInput = {
  monitorId: string;
  series: string;
  status: MonitorStatus;
  breachedSince: Date | null;
  lastValue: number | null;
  lastEvaluatedAt: Date;
};

export type InsertEventInput = {
  monitorId: string;
  series: string;
  type: MonitorEventType;
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export type MonitorEventRecord = {
  id: string;
  monitorId: string;
  series: string;
  type: MonitorEventType;
  value: number;
  threshold: MonitorThresholdCondition;
  occurredAt: Date;
};

export class MonitorRuntimeRepository {
  constructor(private readonly db: Database) {}

  async listDueMonitors(now: Date, limit: number): Promise<MonitorRecord[]> {
    return this.db
      .select()
      .from(monitors)
      .where(and(eq(monitors.enabled, true), lte(monitors.nextEvalAt, now)))
      .orderBy(asc(monitors.nextEvalAt))
      .limit(limit);
  }

  async lockDueMonitor(
    monitorId: string,
    now: Date,
    tx: Executor,
  ): Promise<MonitorRecord | null> {
    const [monitor] = await tx
      .select()
      .from(monitors)
      .where(
        and(eq(monitors.id, monitorId), eq(monitors.enabled, true), lte(monitors.nextEvalAt, now)),
      )
      .for('update', { skipLocked: true })
      .limit(1);
    return monitor ?? null;
  }

  async getState(
    monitorId: string,
    series: string,
    executor: Executor = this.db,
  ): Promise<MonitorEvalStateRow | null> {
    const [row] = await executor
      .select({
        monitorId: monitorState.monitorId,
        series: monitorState.series,
        status: monitorState.status,
        breachedSince: monitorState.breachedSince,
        lastValue: monitorState.lastValue,
        lastEvaluatedAt: monitorState.lastEvaluatedAt,
      })
      .from(monitorState)
      .where(and(eq(monitorState.monitorId, monitorId), eq(monitorState.series, series)))
      .limit(1);
    return row ?? null;
  }

  async upsertState(input: UpsertStateInput, executor: Executor = this.db): Promise<void> {
    await executor
      .insert(monitorState)
      .values({
        monitorId: input.monitorId,
        series: input.series,
        status: input.status,
        breachedSince: input.breachedSince,
        lastValue: input.lastValue,
        lastEvaluatedAt: input.lastEvaluatedAt,
      })
      .onConflictDoUpdate({
        target: [monitorState.monitorId, monitorState.series],
        set: {
          status: input.status,
          breachedSince: input.breachedSince,
          lastValue: input.lastValue,
          lastEvaluatedAt: input.lastEvaluatedAt,
        },
      });
  }

  async insertEvent(input: InsertEventInput, executor: Executor = this.db): Promise<string> {
    const [row] = await executor
      .insert(monitorEvents)
      .values({
        monitorId: input.monitorId,
        series: input.series,
        type: input.type,
        value: input.value,
        threshold: input.threshold,
        occurredAt: input.occurredAt,
      })
      .returning({ id: monitorEvents.id });
    if (!row) throw new Error('Failed to insert monitor event.');
    return row.id;
  }

  async setNextEvalAt(
    monitorId: string,
    nextEvalAt: Date,
    executor: Executor = this.db,
  ): Promise<void> {
    await executor.update(monitors).set({ nextEvalAt }).where(eq(monitors.id, monitorId));
  }

  async findUnrelayedEvents(
    limit: number,
    executor: Executor = this.db,
  ): Promise<MonitorEventRecord[]> {
    return executor
      .select({
        id: monitorEvents.id,
        monitorId: monitorEvents.monitorId,
        series: monitorEvents.series,
        type: monitorEvents.type,
        value: monitorEvents.value,
        threshold: monitorEvents.threshold,
        occurredAt: monitorEvents.occurredAt,
      })
      .from(monitorEvents)
      .where(isNull(monitorEvents.relayedAt))
      .orderBy(asc(monitorEvents.occurredAt))
      .limit(limit);
  }

  async markRelayed(
    ids: readonly string[],
    relayedAt: Date,
    executor: Executor = this.db,
  ): Promise<void> {
    if (ids.length === 0) return;
    await executor
      .update(monitorEvents)
      .set({ relayedAt })
      .where(inArray(monitorEvents.id, [...ids]));
  }
}
```

- [ ] **Step 4: Register the repository in the barrel**

```typescript
// packages/storage/src/repositories/index.ts — add in alphabetical position
export * from './monitor-runtime.repository.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @metricyak/storage test -- monitor-runtime`
Expected: PASS (5 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm --filter @metricyak/storage check-types
git add packages/storage/src/repositories/monitor-runtime.repository.ts packages/storage/src/repositories/index.ts packages/storage/src/repositories/__tests__/monitor-runtime.repository.integration.test.ts
git commit -m "feat(storage): add MonitorRuntimeRepository"
```

> PR 2 complete: persistence layer proven by integration tests. Not yet wired to a live scheduler.

---

# PR 3 — Scheduler + tick (goes live)

Wire everything: a repeatable tick evaluates due monitors and records firings.

### Task 3.1: `monitor-tick` queue + worker/scheduler factories

**Files:**
- Modify: `packages/queue/src/queues.ts`
- Modify: `packages/queue/src/worker-factory.ts`
- Modify: `packages/queue/src/index.ts`

**Interfaces:**
- Produces (from `@metricyak/queue`):
  - `MONITOR_TICK_QUEUE = 'monitor-tick'`
  - `MONITOR_TICK_INTERVAL_MS = 60_000`
  - `type MonitorTickJob = { tickAt: string }`
  - `createMonitorTickWorker(connection, { concurrency, process }): Worker<MonitorTickJob>`
  - `registerMonitorTickScheduler(connection): Promise<void>` — upserts a repeatable job every `MONITOR_TICK_INTERVAL_MS`.

- [ ] **Step 1: Add the queue constants and job type**

```typescript
// packages/queue/src/queues.ts — append
export const MONITOR_TICK_QUEUE = 'monitor-tick' as const;
export const MONITOR_TICK_INTERVAL_MS = 60_000;

export type MonitorTickJob = {
  tickAt: string;
};
```

- [ ] **Step 2: Add the worker + scheduler factories**

```typescript
// packages/queue/src/worker-factory.ts — append
import { Queue } from 'bullmq';
import {
  MONITOR_TICK_INTERVAL_MS,
  MONITOR_TICK_QUEUE,
  type MonitorTickJob,
} from './queues.js';

export type MonitorTickWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorTickJob>) => Promise<void>;
};

export function createMonitorTickWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorTickWorkerOptions,
): Worker<MonitorTickJob> {
  return new Worker<MonitorTickJob>(MONITOR_TICK_QUEUE, process, { connection, concurrency });
}

export async function registerMonitorTickScheduler(connection: ConnectionOptions): Promise<void> {
  const queue = new Queue<MonitorTickJob>(MONITOR_TICK_QUEUE, { connection });
  try {
    await queue.upsertJobScheduler(
      'monitor-tick',
      { every: MONITOR_TICK_INTERVAL_MS },
      {
        name: MONITOR_TICK_QUEUE,
        data: { tickAt: 'scheduled' },
        opts: { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 7 * 24 * 3600 } },
      },
    );
  } finally {
    await queue.close();
  }
}
```

> The existing `worker-factory.ts` already imports `ConnectionOptions`, `Job`, `Worker` from `bullmq`; reuse those imports rather than re-declaring. Add `Queue` to that import line.

- [ ] **Step 3: Export from the queue barrel**

```typescript
// packages/queue/src/index.ts — extend the two existing re-export blocks
export {
  computeBatchId,
  EVENTS_QUEUE,
  type EventBatchJob,
  MONITOR_TICK_INTERVAL_MS,
  MONITOR_TICK_QUEUE,
  type MonitorTickJob,
  type StoredEvent,
} from './queues.js';
export {
  createEventsWorker,
  createMonitorTickWorker,
  type EventWorkerOptions,
  type MonitorTickWorkerOptions,
  registerMonitorTickScheduler,
} from './worker-factory.js';
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @metricyak/queue check-types
git add packages/queue/src/queues.ts packages/queue/src/worker-factory.ts packages/queue/src/index.ts
git commit -m "feat(queue): add monitor-tick queue, worker, and repeatable scheduler"
```

---

### Task 3.2: Wire `monitorRuntime` into the container

**Files:**
- Modify: `apps/metricyak/src/container/container.ts`

**Interfaces:**
- Produces: `container.repositories.monitorRuntime: MonitorRuntimeRepository`.

- [ ] **Step 1: Add the repository to the container type and factory**

```typescript
// container.ts — add MonitorRuntimeRepository to the storage import,
// add to the repositories type, and construct it in createContainer.
//   import { ..., MonitorRuntimeRepository, ... } from '@metricyak/storage';
//   repositories: { ...; readonly monitorRuntime: MonitorRuntimeRepository; ... }
//   repositories: { ...; monitorRuntime: new MonitorRuntimeRepository(db), ... }
```

Concretely, in the `repositories` type block add `readonly monitorRuntime: MonitorRuntimeRepository;` and in the returned `repositories` object add `monitorRuntime: new MonitorRuntimeRepository(db),`, and add `MonitorRuntimeRepository` to the existing `@metricyak/storage` import list.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @metricyak/app check-types`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/metricyak/src/container/container.ts
git commit -m "feat(monitors): expose MonitorRuntimeRepository on the container"
```

---

### Task 3.3: The tick handler `runMonitorTick`

**Files:**
- Create: `apps/metricyak/src/modules/monitors/monitors.tick.ts`
- Test: `apps/metricyak/src/modules/monitors/__tests__/monitors.tick.integration.test.ts`

**Interfaces:**
- Consumes: `container.db`, `container.repositories.metrics`, `container.repositories.monitorRuntime`, and a `MetricReads` built via `createMetricReads({ aggregates: container.aggregates })`; `evaluateMonitor`, `parseDuration`; `TOTAL_SENTINEL`, `MONITOR_TICK_INTERVAL_MS`.
- Produces:
  - `type MonitorTickDeps = { db: Database; metrics: MetricsRepository; metricReads: MetricReads; monitorRuntime: MonitorRuntimeRepository }`
  - `runMonitorTick(deps: MonitorTickDeps, now: Date): Promise<{ evaluated: number; fired: number }>`

**Behavior:** For each due monitor, open a transaction and `lockDueMonitor` (`FOR UPDATE SKIP LOCKED` + re-check due) — skip if unlockable. Advance `next_eval_at = now + MONITOR_TICK_INTERVAL_MS`. Load the metric definition (base-db read; if missing, stay on cadence and stop). Read the value with `metricReads.value(metric, projectId, { from: now - window, to: now })` and take `.value`. Load state (default `ok`), run `evaluateMonitor`, `upsertState`, and if fired `insertEvent`. The metric-definition and value reads hit the base DB (they don't take the tx executor) — that's fine, buckets are read-only and the monitor row stays locked throughout, so no other worker double-evaluates it.

- [ ] **Step 1: Write the failing integration test**

This test is a skeleton: replace every scaffolding `//` line with real, comment-free code. Copy the container / pool / migrate / `beforeEach` truncate-and-seed structure verbatim from `packages/storage/src/repositories/__tests__/monitor-runtime.repository.integration.test.ts`, then extend the seed with a metric version and buckets. Build deps as `{ db, metrics: new MetricsRepository(db), metricReads: createMetricReads({ aggregates: new AggregatesRepository(db) }), monitorRuntime: new MonitorRuntimeRepository(db) }`.

```typescript
// apps/metricyak/src/modules/monitors/__tests__/monitors.tick.integration.test.ts
import { AggregatesRepository, MetricsRepository, MonitorRuntimeRepository } from '@metricyak/storage';
import { describe, expect, it } from 'vitest';
import { createMetricReads } from '../../aggregates/aggregates.reads.js';
import { runMonitorTick } from '../monitors.tick.js';
// + container/pool/db/migrate/seed boilerplate copied from the storage integration test

describe('runMonitorTick (integration)', () => {
  // deps = { db, metrics: new MetricsRepository(db),
  //          metricReads: createMetricReads({ aggregates: new AggregatesRepository(db) }),
  //          monitorRuntime: new MonitorRuntimeRepository(db) }
  // Seed a project + a metric (single count event, one version) + metric_buckets so the
  // $total value over the window breaches (e.g. total 3000 against threshold lt 5000),
  // and a monitor (window '1d', holdFor '0m', missingData 'zero', enabled, due now).

  it('fires once on cross, records state and one event, advances next_eval_at', async () => {
    const now = new Date('2026-07-13T12:00:00.000Z');

    const first = await runMonitorTick(deps, now);
    expect(first.fired).toBe(1);

    const second = await runMonitorTick(deps, new Date(now.getTime() + 60_000));
    expect(second.fired).toBe(0);

    const events = await deps.monitorRuntime.findUnrelayedEvents(10);
    expect(events).toHaveLength(1);
    const state = await deps.monitorRuntime.getState(monitorId, '$total');
    expect(state?.status).toBe('firing');
  });

  it('re-arms after recovery so a later breach fires again', async () => {
    // tick 1 breaches and fires; delete/adjust buckets so the recovery tick reads a
    // non-breaching value; recovery tick returns state to ok; a third breaching tick
    // fires again — two events total.
  });
});
```

> Seed `metric_buckets` with a direct `db.insert(metricBuckets)` (columns per `packages/storage/src/schema/aggregates.ts`): `dimName`/`dimValue` = `$total`, `granularity` = `'minute'`, `seriesKey` matching the metric's event `key`, `count` set so the `count` aggregation yields the intended value, `bucketStart` inside `[now - 1d, now)`. Match the `metricVersion` to the seeded metric version.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app test -- monitors.tick`
Expected: FAIL — cannot find module `../monitors.tick.js`.

- [ ] **Step 3: Write the handler**

```typescript
// apps/metricyak/src/modules/monitors/monitors.tick.ts
import { MONITOR_TICK_INTERVAL_MS } from '@metricyak/queue';
import type { Database, MetricsRepository, MonitorRuntimeRepository } from '@metricyak/storage';
import { TOTAL_SENTINEL } from '@metricyak/storage';
import type { MetricReads } from '../aggregates/aggregates.reads.js';
import { parseDuration } from './engine/duration.js';
import { evaluateMonitor, type MonitorEvalState } from './engine/evaluate.js';

export type MonitorTickDeps = {
  db: Database;
  metrics: MetricsRepository;
  metricReads: MetricReads;
  monitorRuntime: MonitorRuntimeRepository;
};

type MonitorOutcome = 'skipped' | 'evaluated' | 'fired';

const TICK_BATCH_LIMIT = 500;

export async function runMonitorTick(
  deps: MonitorTickDeps,
  now: Date,
): Promise<{ evaluated: number; fired: number }> {
  const due = await deps.monitorRuntime.listDueMonitors(now, TICK_BATCH_LIMIT);
  const nextEvalAt = new Date(now.getTime() + MONITOR_TICK_INTERVAL_MS);
  let evaluated = 0;
  let fired = 0;

  for (const candidate of due) {
    const outcome = await deps.db.transaction<MonitorOutcome>(async (tx) => {
      const monitor = await deps.monitorRuntime.lockDueMonitor(candidate.id, now, tx);
      if (!monitor) return 'skipped';

      await deps.monitorRuntime.setNextEvalAt(monitor.id, nextEvalAt, tx);

      const metric = await deps.metrics.getDefinition(monitor.metricId, monitor.projectId);
      if (!metric) return 'evaluated';

      const window = { from: new Date(now.getTime() - parseDuration(monitor.window)), to: now };
      const { value } = await deps.metricReads.value(metric, monitor.projectId, window);

      const existing = await deps.monitorRuntime.getState(monitor.id, TOTAL_SENTINEL, tx);
      const state: MonitorEvalState = existing
        ? { status: existing.status, breachedSince: existing.breachedSince }
        : { status: 'ok', breachedSince: null };

      const result = evaluateMonitor(
        {
          condition: monitor.condition,
          holdForMs: parseDuration(monitor.holdFor),
          missingData: monitor.missingData,
        },
        state,
        value,
        now,
      );

      await deps.monitorRuntime.upsertState(
        {
          monitorId: monitor.id,
          series: TOTAL_SENTINEL,
          status: result.nextState.status,
          breachedSince: result.nextState.breachedSince,
          lastValue: value,
          lastEvaluatedAt: now,
        },
        tx,
      );

      if (!result.fired) return 'evaluated';

      await deps.monitorRuntime.insertEvent(
        {
          monitorId: monitor.id,
          series: TOTAL_SENTINEL,
          type: 'fired',
          value: result.fired.value,
          threshold: result.fired.threshold,
          occurredAt: result.fired.occurredAt,
        },
        tx,
      );
      return 'fired';
    });

    if (outcome !== 'skipped') evaluated += 1;
    if (outcome === 'fired') fired += 1;
  }

  return { evaluated, fired };
}
```

`metrics.getDefinition` and `metricReads.value` read the base DB (no tx executor); the monitor row is held under `FOR UPDATE SKIP LOCKED` for the whole callback, so a concurrent worker skips it rather than double-evaluating. `next_eval_at` is advanced first, so even the metric-deleted path stays on cadence.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app test -- monitors.tick`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @metricyak/app check-types
git add apps/metricyak/src/modules/monitors/monitors.tick.ts apps/metricyak/src/modules/monitors/__tests__/monitors.tick.integration.test.ts
git commit -m "feat(monitors): add runMonitorTick evaluation handler"
```

---

### Task 3.4: `schedulers` on `AppModule` + bootstrap start

**Files:**
- Modify: `apps/metricyak/src/modules/module.ts`
- Modify: `apps/metricyak/src/bootstrap/workers.ts`

**Interfaces:**
- Produces:
  - `type SchedulerFactory = (connection: ConnectionOptions) => Promise<void>`
  - `AppModule.schedulers?: readonly SchedulerFactory[]`
  - `startWorkers` also invokes every module scheduler after constructing workers.

- [ ] **Step 1: Extend the `AppModule` type**

```typescript
// module.ts — add SchedulerFactory and the optional field
export type SchedulerFactory = (connection: ConnectionOptions) => Promise<void>;

export type AppModule = {
  readonly routes?: OpenAPIHono<AppEnv>;
  readonly workers?: readonly WorkerFactory[];
  readonly schedulers?: readonly SchedulerFactory[];
};
```

- [ ] **Step 2: Start schedulers in `startWorkers`**

```typescript
// bootstrap/workers.ts — after constructing `workers`, before the return:
const schedulerFactories = modules.flatMap((mod) => mod.schedulers ?? []);
await Promise.all(schedulerFactories.map((register) => register(connection)));
```

(Uses the same `connection` already built from `config.redisUrl`.)

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @metricyak/app check-types
git add apps/metricyak/src/modules/module.ts apps/metricyak/src/bootstrap/workers.ts
git commit -m "feat(app): support module-registered repeatable schedulers"
```

---

### Task 3.5: Register the tick worker + scheduler in the monitors module

**Files:**
- Modify: `apps/metricyak/src/modules/monitors/monitors.module.ts`

**Interfaces:**
- Consumes: `createMonitorTickWorker`, `registerMonitorTickScheduler` from `@metricyak/queue`; `createMetricReads` from `../aggregates/aggregates.reads.js`; `runMonitorTick` from `./monitors.tick.js`.

- [ ] **Step 1: Wire the worker + scheduler**

```typescript
// monitors.module.ts
import { createMonitorTickWorker, registerMonitorTickScheduler } from '@metricyak/queue';
import { createMetricReads } from '../aggregates/aggregates.reads.js';
import type { AppModule, SchedulerFactory, WorkerFactory } from '../module.js';
import monitorsRouter from './monitors.routes.js';
import { runMonitorTick } from './monitors.tick.js';

const monitorTickWorkerFactory: WorkerFactory = (connection, container, concurrency) =>
  createMonitorTickWorker(connection, {
    concurrency,
    process: async () => {
      const result = await runMonitorTick(
        {
          db: container.db,
          metrics: container.repositories.metrics,
          metricReads: createMetricReads({ aggregates: container.aggregates }),
          monitorRuntime: container.repositories.monitorRuntime,
        },
        new Date(),
      );
      console.log(JSON.stringify({ level: 'info', msg: 'monitor tick', ...result }));
    },
  });

const monitorTickScheduler: SchedulerFactory = (connection) =>
  registerMonitorTickScheduler(connection);

export const monitorsModule: AppModule = {
  routes: monitorsRouter,
  workers: [monitorTickWorkerFactory],
  schedulers: [monitorTickScheduler],
};
```

> `new Date()` in the worker process is intentional — the tick runs on the wall clock. Only the pure `evaluateMonitor` avoids ambient time (it takes `now`).

- [ ] **Step 2: Typecheck + build the whole app**

Run: `pnpm --filter @metricyak/app check-types && pnpm --filter @metricyak/app build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/metricyak/src/modules/monitors/monitors.module.ts
git commit -m "feat(monitors): run the monitor tick worker and scheduler"
```

> PR 3 complete: enabled monitors are now evaluated every 60s and firings are recorded in `monitor_events`. Signals do not yet leave the system — that is PR 4.

---

# PR 4 — Signal relay + queue

Deliver `fired` rows to a `monitor-signals` queue with idempotent dedupe; a stub consumer stands in for the downstream flow.

### Task 4.1: `monitor-signals` queue, job type, producer, worker

**Files:**
- Modify: `packages/queue/src/queues.ts`
- Modify: `packages/queue/src/producer.ts`
- Modify: `packages/queue/src/worker-factory.ts`
- Modify: `packages/queue/src/index.ts`

**Interfaces:**
- Produces:
  - `MONITOR_SIGNALS_QUEUE = 'monitor-signals'`
  - `type MonitorSignalJob = { eventId: string; monitorId: string; series: string; value: number; threshold: { operator: string; value: number }; occurredAt: string }`
  - `interface MonitorSignalsProducer { enqueue(job: MonitorSignalJob): Promise<void> }`
  - `class BullMonitorSignalsProducer implements MonitorSignalsProducer` — enqueues with `jobId: job.eventId`.
  - `class InMemoryMonitorSignalsProducer implements MonitorSignalsProducer` — records jobs for tests.
  - `createMonitorSignalsWorker(connection, { concurrency, process }): Worker<MonitorSignalJob>`

- [ ] **Step 1: Add the queue constant + job type**

```typescript
// queues.ts — append
export const MONITOR_SIGNALS_QUEUE = 'monitor-signals' as const;

export type MonitorSignalJob = {
  eventId: string;
  monitorId: string;
  series: string;
  value: number;
  threshold: { operator: string; value: number };
  occurredAt: string;
};
```

- [ ] **Step 2: Add the producer**

```typescript
// producer.ts — append (Queue is already imported)
import { MONITOR_SIGNALS_QUEUE, type MonitorSignalJob } from './queues.js';

export interface MonitorSignalsProducer {
  enqueue(job: MonitorSignalJob): Promise<void>;
}

export class BullMonitorSignalsProducer implements MonitorSignalsProducer {
  private readonly queue: Queue<MonitorSignalJob>;

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue<MonitorSignalJob>(MONITOR_SIGNALS_QUEUE, { connection });
  }

  async enqueue(job: MonitorSignalJob): Promise<void> {
    await this.queue.add(MONITOR_SIGNALS_QUEUE, job, {
      jobId: job.eventId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 10_000 },
      removeOnFail: { age: 30 * 24 * 3600 },
    });
  }
}

export class InMemoryMonitorSignalsProducer implements MonitorSignalsProducer {
  readonly jobs: MonitorSignalJob[] = [];
  async enqueue(job: MonitorSignalJob): Promise<void> {
    this.jobs.push(job);
  }
}
```

- [ ] **Step 3: Add the worker factory**

```typescript
// worker-factory.ts — append
import { MONITOR_SIGNALS_QUEUE, type MonitorSignalJob } from './queues.js';

export type MonitorSignalsWorkerOptions = {
  concurrency: number;
  process: (job: Job<MonitorSignalJob>) => Promise<void>;
};

export function createMonitorSignalsWorker(
  connection: ConnectionOptions,
  { concurrency, process }: MonitorSignalsWorkerOptions,
): Worker<MonitorSignalJob> {
  return new Worker<MonitorSignalJob>(MONITOR_SIGNALS_QUEUE, process, { connection, concurrency });
}
```

- [ ] **Step 4: Export the new symbols from the barrel**

```typescript
// index.ts — extend the queues, producer, and worker-factory re-export blocks with:
//   MONITOR_SIGNALS_QUEUE, type MonitorSignalJob            (from './queues.js')
//   BullMonitorSignalsProducer, InMemoryMonitorSignalsProducer, type MonitorSignalsProducer  (from './producer.js')
//   createMonitorSignalsWorker, type MonitorSignalsWorkerOptions  (from './worker-factory.js')
```

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @metricyak/queue check-types
git add packages/queue/src/queues.ts packages/queue/src/producer.ts packages/queue/src/worker-factory.ts packages/queue/src/index.ts
git commit -m "feat(queue): add monitor-signals queue, producer, and worker"
```

---

### Task 4.2: The relay `relayMonitorSignals`

**Files:**
- Create: `apps/metricyak/src/modules/monitors/monitors.relay.ts`
- Test: `apps/metricyak/src/modules/monitors/__tests__/monitors.relay.integration.test.ts`

**Interfaces:**
- Consumes: `MonitorRuntimeRepository`, `MonitorSignalsProducer`.
- Produces:
  - `type MonitorRelayDeps = { monitorRuntime: MonitorRuntimeRepository; signals: MonitorSignalsProducer }`
  - `relayMonitorSignals(deps: MonitorRelayDeps, now: Date): Promise<{ relayed: number }>` — finds unrelayed events, enqueues each (jobId = event id → idempotent), marks them relayed. Enqueue happens before marking, so a crash re-enqueues (at-least-once); the constant jobId dedupes downstream.

- [ ] **Step 1: Write the failing integration test**

```typescript
// apps/metricyak/src/modules/monitors/__tests__/monitors.relay.integration.test.ts
// Boilerplate as in monitor-runtime integration test. Use InMemoryMonitorSignalsProducer.
// Seed a monitor, insert two events via monitorRuntime.insertEvent.
import { InMemoryMonitorSignalsProducer } from '@metricyak/queue';
import { relayMonitorSignals } from '../monitors.relay.js';

it('enqueues each unrelayed event once with jobId=eventId and marks them relayed', async () => {
  const signals = new InMemoryMonitorSignalsProducer();
  const result = await relayMonitorSignals({ monitorRuntime, signals }, new Date());
  expect(result.relayed).toBe(2);
  expect(signals.jobs.map((j) => j.eventId).sort()).toEqual([id1, id2].sort());
  // a second relay finds nothing new
  const again = await relayMonitorSignals({ monitorRuntime, signals }, new Date());
  expect(again.relayed).toBe(0);
  expect(signals.jobs.length).toBe(2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @metricyak/app test -- monitors.relay`
Expected: FAIL — cannot find module `../monitors.relay.js`.

- [ ] **Step 3: Write the relay**

```typescript
// apps/metricyak/src/modules/monitors/monitors.relay.ts
import type { MonitorSignalsProducer } from '@metricyak/queue';
import type { MonitorRuntimeRepository } from '@metricyak/storage';

export type MonitorRelayDeps = {
  monitorRuntime: MonitorRuntimeRepository;
  signals: MonitorSignalsProducer;
};

const RELAY_BATCH_LIMIT = 500;

export async function relayMonitorSignals(
  deps: MonitorRelayDeps,
  now: Date,
): Promise<{ relayed: number }> {
  const events = await deps.monitorRuntime.findUnrelayedEvents(RELAY_BATCH_LIMIT);
  if (events.length === 0) return { relayed: 0 };

  for (const event of events) {
    await deps.signals.enqueue({
      eventId: event.id,
      monitorId: event.monitorId,
      series: event.series,
      value: event.value,
      threshold: { operator: event.threshold.operator, value: event.threshold.value },
      occurredAt: event.occurredAt.toISOString(),
    });
  }

  await deps.monitorRuntime.markRelayed(
    events.map((e) => e.id),
    now,
  );
  return { relayed: events.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @metricyak/app test -- monitors.relay`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/metricyak/src/modules/monitors/monitors.relay.ts apps/metricyak/src/modules/monitors/__tests__/monitors.relay.integration.test.ts
git commit -m "feat(monitors): add signal relay for the outbox"
```

---

### Task 4.3: Run the relay at end of tick + add the stub consumer

**Files:**
- Modify: `apps/metricyak/src/modules/monitors/monitors.tick.ts`
- Create: `apps/metricyak/src/modules/monitors/monitors.signals.worker.ts`
- Modify: `apps/metricyak/src/modules/monitors/monitors.module.ts`
- Modify: `apps/metricyak/src/container/container.ts`

**Interfaces:**
- Consumes: `container.producer`-style wiring — add a `signals: MonitorSignalsProducer` onto the container; `relayMonitorSignals`; `createMonitorSignalsWorker`; `processMonitorSignal`.
- Produces: `processMonitorSignal(job: MonitorSignalJob): Promise<void>` — logs and returns (the downstream boundary).

- [ ] **Step 1: Add a signals producer to the container**

```typescript
// container.ts
// import { BullMonitorSignalsProducer, InMemoryMonitorSignalsProducer, type MonitorSignalsProducer } from '@metricyak/queue';
// Add `readonly signals: MonitorSignalsProducer;` to Container.
// createContainer currently takes (db, producer). Add a third param `signals: MonitorSignalsProducer`
// and set it on the returned object. Update both call sites (index.ts, worker.ts) to pass a signals producer:
//   - worker.ts / index.ts: construct BullMonitorSignalsProducer(createProducerConnectionOptions(config.redisUrl)) when redisUrl is set;
//     otherwise InMemoryMonitorSignalsProducer (mirrors how the events producer is chosen).
```

> Check how `producer` is constructed at each `createContainer` call site and mirror that exact pattern for `signals`. Keep the signature change minimal and update all callers in the same commit so the build stays green.

- [ ] **Step 2: Extend `MonitorTickDeps` and call the relay at end of tick**

```typescript
// monitors.tick.ts
// - import { relayMonitorSignals } from './monitors.relay.js';
// - import type { MonitorSignalsProducer } from '@metricyak/queue';
// - add `signals: MonitorSignalsProducer` to MonitorTickDeps
// - after the for-loop, before `return`:
//     const { relayed } = await relayMonitorSignals(
//       { monitorRuntime: deps.monitorRuntime, signals: deps.signals },
//       now,
//     );
//   and include `relayed` in the returned summary object (widen the return type to
//   { evaluated: number; fired: number; relayed: number }).
```

Update the existing `runMonitorTick` return type and the `monitors.tick` integration test's assertions to include `relayed` (a fresh fire → `relayed >= 1` on that tick).

- [ ] **Step 3: Write the stub consumer**

```typescript
// apps/metricyak/src/modules/monitors/monitors.signals.worker.ts
import type { MonitorSignalJob } from '@metricyak/queue';

export async function processMonitorSignal(job: MonitorSignalJob): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'monitor signal received',
      eventId: job.eventId,
      monitorId: job.monitorId,
      value: job.value,
    }),
  );
}
```

This stub is the downstream boundary: it records receipt and returns. A real consumer replaces the body without touching the relay or queue wiring.

- [ ] **Step 4: Register the signals worker + pass `signals` into the tick worker**

```typescript
// monitors.module.ts
// - import { createMonitorSignalsWorker } from '@metricyak/queue';
// - import { processMonitorSignal } from './monitors.signals.worker.js';
// - in monitorTickWorkerFactory, add `signals: container.signals` to the runMonitorTick deps
// - add a second WorkerFactory:
//     const monitorSignalsWorkerFactory: WorkerFactory = (connection, _container, concurrency) =>
//       createMonitorSignalsWorker(connection, { concurrency, process: (job) => processMonitorSignal(job.data) });
// - workers: [monitorTickWorkerFactory, monitorSignalsWorkerFactory]
```

- [ ] **Step 5: Update tick integration test deps + run app tests**

Add `signals: new InMemoryMonitorSignalsProducer()` to the `deps` in `monitors.tick.integration.test.ts`, and assert `relayed` on a firing tick.

Run: `pnpm --filter @metricyak/app test -- monitors`
Expected: PASS (tick + relay).

- [ ] **Step 6: Typecheck, build, commit**

```bash
pnpm --filter @metricyak/app check-types && pnpm --filter @metricyak/app build
git add apps/metricyak/src/modules/monitors/monitors.tick.ts apps/metricyak/src/modules/monitors/monitors.signals.worker.ts apps/metricyak/src/modules/monitors/monitors.module.ts apps/metricyak/src/container/container.ts apps/metricyak/src/modules/monitors/__tests__/monitors.tick.integration.test.ts
git commit -m "feat(monitors): relay fired signals to the monitor-signals queue"
```

---

### Task 4.4: Full-suite verification

- [ ] **Step 1: Run the whole workspace test + lint + build**

Run from the repo root (Turborepo fans these across packages):
```bash
pnpm check:fix     # auto-fix Biome lint + formatting
pnpm check-types   # turbo run check-types
pnpm test          # turbo run test (Testcontainers needs Docker)
pnpm build         # turbo run build
pnpm ci            # CI-mode lint + format check — must be clean
```
Expected: all PASS / clean. `pnpm check:fix` first so formatting settles before `pnpm ci` verifies it.

- [ ] **Step 2: Commit any lint fixes**

```bash
git add -A
git commit -m "chore(monitors): lint and typecheck fixes"
```

> PR 4 complete: a crossed threshold now produces a durable `fired` row that is relayed exactly-once (idempotent by event id) to the `monitor-signals` queue, where a stub consumer logs it — the seam for the downstream flow.

---

## Self-Review Notes (author checklist — done)

- **Spec coverage:** periodic scheduler (T3.1/3.4), single-tick evaluate-all (T3.3), edge-triggered fire-once + re-arm (T1.2), durable outbox in same tx (T3.3), relay + at-least-once + jobId dedupe (T4.1–4.3), no-op stub consumer (T4.3), `(monitor_id, series)` keying (T2.1), lazy `ok` default state (T3.3), fixed 60s cadence via `MONITOR_TICK_INTERVAL_MS` (T3.1/3.3), `missingData` skip/zero/fire (T1.2), definition surface untouched. All present.
- **Value read reuses `MetricReads`.** The tick consumes `createMetricReads({ aggregates }).value(...)` (PR #41), not a hand-rolled `getPartials` + `windowValues` composition. `MetricSummary` is passed through as-is (`metricId`, not `id`). No read helper ships in PR 1.
- **Type consistency:** `MonitorEvalState`/`MonitorFired` (T1.2) consumed unchanged in T3.3; `MonitorRuntimeRepository` method signatures identical across T2.2, T3.3, T4.2; `MetricReads`/`MetricSummary`/`Window` shapes match `aggregates.reads.ts`; `TOTAL_SENTINEL` used for `series` everywhere; `MONITOR_TICK_INTERVAL_MS` single source in the queue package.
- **Codebase re-verified at `1040f6c`** (after PRs #38–#41): `monitors` schema/repo, `container` signature `(db, producer)`, `AppModule`, `bootstrap/workers.ts`, and the queue package are all unchanged from the plan's baseline; only the metric read path moved, and the plan now tracks it.
- **Placeholder scan:** the spots left as prose (tick/relay test seed boilerplate, container call-site mirroring) point at an exact existing file to copy; every production code step contains complete code.
