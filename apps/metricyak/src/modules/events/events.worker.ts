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

type NewDimensionValue = {
  metricId: string;
  metricVersion: number;
  dimName: string;
  dimValue: string;
};

export async function processEventBatch(
  job: EventBatchJob,
  deps: EventAggregationDeps,
): Promise<void> {
  const { db, events, aggregates, matcher } = deps;

  const rows: InsertEventRow[] = job.events.map((event) => ({
    id: event.id,
    projectId: job.projectId,
    name: event.name,
    timestamp: new Date(event.timestamp),
    properties: event.properties,
  }));

  const matcherMap = await matcher.resolve(job.projectId);

  const accepted = new Map<string, Set<string>>();
  const newDimensionValues: NewDimensionValue[] = [];

  for (const candidate of collectDimensionCandidates(job.events, matcherMap).values()) {
    const known = await aggregates.knownDimensionValues(
      candidate.metricId,
      candidate.metricVersion,
      candidate.dimName,
    );
    let count = known.size;
    for (const value of candidate.values) {
      if (known.has(value)) continue;
      if (count < MAX_DECLARED_DIM_CARDINALITY) {
        known.add(value);
        count += 1;
        newDimensionValues.push({
          metricId: candidate.metricId,
          metricVersion: candidate.metricVersion,
          dimName: candidate.dimName,
          dimValue: value,
        });
      }
    }
    accepted.set(
      dimensionKey(candidate.metricId, candidate.metricVersion, candidate.dimName),
      known,
    );
  }

  const resolveDim: DimResolver = (metricId, metricVersion, dimName, rawValue) => {
    const values = accepted.get(dimensionKey(metricId, metricVersion, dimName));
    return values?.has(rawValue) ? rawValue : OTHER_SENTINEL;
  };

  const { deltas, dirty } = buildIngestDeltas(job.events, matcherMap, resolveDim);

  await db.transaction(async (tx) => {
    const claimed = await aggregates.claimBatch(job.batchId, job.projectId, tx);
    if (!claimed) return;

    await events.insertBatch(rows, tx);
    await aggregates.registerDimensionValues(newDimensionValues, tx);
    await aggregates.upsertBaseBuckets(deltas, tx);
    await aggregates.recordDirty(dirty, tx);
  });
}
