import type { EventBatchJob } from '@metricyak/queue';
import {
  type AggregatesRepository,
  type Database,
  type EventsRepository,
  type InsertEventRow,
  OTHER_SENTINEL,
} from '@metricyak/storage';
import {
  buildIngestDeltas,
  collectDimensionCandidates,
  type DimResolver,
  dimensionKey,
  MAX_DECLARED_DIM_CARDINALITY,
} from '../aggregates/engine/ingest.js';
import type { MetricMatcher } from '../aggregates/engine/matcher.js';

export type EventAggregationDeps = {
  db: Database;
  events: EventsRepository;
  aggregates: AggregatesRepository;
  matcher: MetricMatcher;
};

export async function processEventBatch(
  job: EventBatchJob,
  deps: EventAggregationDeps,
): Promise<void> {
  const { db, events, aggregates, matcher } = deps;

  const rows: InsertEventRow[] = job.events.map((event) => ({
    id: event.id,
    projectId: job.projectId,
    insertId: event.insertId,
    name: event.name,
    timestamp: new Date(event.timestamp),
    properties: event.properties,
  }));

  const matcherMap = await matcher.resolve(job.projectId);

  await db.transaction(async (tx) => {
    const claimed = await aggregates.claimBatch(job.batchId, job.projectId, tx);
    if (!claimed) return;

    const insertedIds = new Set(await events.insertBatch(rows, tx));
    const insertedEvents = job.events.filter((event) => insertedIds.has(event.id));
    logDeduplicatedEvents(job.projectId, job.events.length, insertedEvents.length);

    const candidates = [...collectDimensionCandidates(insertedEvents, matcherMap).values()].sort(
      (a, b) => a.metricId.localeCompare(b.metricId) || a.dimName.localeCompare(b.dimName),
    );

    const accepted = new Map<string, Set<string>>();
    for (const candidate of candidates) {
      const values = await aggregates.admitDimensionValues(
        candidate.metricId,
        candidate.metricVersion,
        candidate.dimName,
        [...candidate.values],
        MAX_DECLARED_DIM_CARDINALITY,
        tx,
      );
      accepted.set(
        dimensionKey(candidate.metricId, candidate.metricVersion, candidate.dimName),
        values,
      );
    }

    const resolveDim: DimResolver = (metricId, metricVersion, dimName, rawValue) => {
      const values = accepted.get(dimensionKey(metricId, metricVersion, dimName));
      return values?.has(rawValue) ? rawValue : OTHER_SENTINEL;
    };

    const { deltas, dirty } = buildIngestDeltas(insertedEvents, matcherMap, resolveDim);

    await aggregates.upsertBaseBuckets(deltas, tx);
    await aggregates.recordDirty(dirty, tx);
  });
}

function logDeduplicatedEvents(
  projectId: string,
  receivedCount: number,
  insertedCount: number,
): void {
  const duplicateCount = receivedCount - insertedCount;
  if (duplicateCount === 0) return;

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'deduplicated events',
      projectId,
      received: receivedCount,
      inserted: insertedCount,
      duplicates: duplicateCount,
    }),
  );
}
