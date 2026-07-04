import type {
  AggregatesRepository,
  BucketGranularity,
  Database,
  DirtyEntry,
  MetricsRepository,
} from '@metricyak/storage';
import { addGranularity } from './engine/bucketing.js';
import { materializeValues } from './engine/materialize.js';

export const DEFAULT_ROLLUP_INTERVAL_MS = 15_000;

const MATERIALIZED_GRANULARITIES: readonly BucketGranularity[] = ['minute', 'hour', 'day'];

export type RollupDeps = {
  db: Database;
  aggregates: AggregatesRepository;
  metrics: MetricsRepository;
};

export async function runRollupTick(deps: RollupDeps): Promise<void> {
  const { db, aggregates, metrics } = deps;

  const claim = await aggregates.claimDirty();
  if (claim.entries.length === 0) return;

  const uniqueIds = [...new Set(claim.entries.map((entry) => entry.metricId))];
  const definitions = new Map(
    (await metrics.listByIds(uniqueIds)).map((summary) => [summary.metricId, summary.definition]),
  );

  const failed: DirtyEntry[] = [];

  for (const entry of claim.entries) {
    const definition = definitions.get(entry.metricId);
    if (!definition) continue;

    const rangeStart = entry.dayStart;
    const rangeEnd = addGranularity(rangeStart, 'day', 1);

    try {
      await db.transaction(async (tx) => {
        await aggregates.acquireMetricLock(entry.metricId, tx);

        await aggregates.recomputeTier(
          {
            metricId: entry.metricId,
            metricVersion: entry.metricVersion,
            from: 'minute',
            to: 'hour',
            truncUnit: 'hour',
            rangeStart,
            rangeEnd,
          },
          tx,
        );
        await aggregates.recomputeTier(
          {
            metricId: entry.metricId,
            metricVersion: entry.metricVersion,
            from: 'hour',
            to: 'day',
            truncUnit: 'day',
            rangeStart,
            rangeEnd,
          },
          tx,
        );

        for (const granularity of MATERIALIZED_GRANULARITIES) {
          const partials = await aggregates.getPartials(
            {
              metricId: entry.metricId,
              metricVersion: entry.metricVersion,
              granularity,
              rangeStart,
              rangeEnd,
            },
            tx,
          );
          const rows = materializeValues(
            definition,
            granularity,
            entry.metricId,
            entry.metricVersion,
            partials,
          );
          await aggregates.upsertValueBuckets(rows, tx);
        }
      });
    } catch (error) {
      console.log(
        JSON.stringify({
          level: 'error',
          msg: 'rollup entry failed',
          metricId: entry.metricId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      failed.push(entry);
    }
  }

  await aggregates.deleteDirtyUpTo(claim.highWaterMark);
  if (failed.length > 0) {
    await aggregates.recordDirty(failed);
  }
}

export function startRollupScheduler(deps: RollupDeps, intervalMs: number): () => void {
  let running = false;

  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await runRollupTick(deps);
    } catch (error) {
      console.log(
        JSON.stringify({
          level: 'error',
          msg: 'rollup tick failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      running = false;
    }
  };

  const handle = setInterval(tick, intervalMs);
  handle.unref();

  return () => clearInterval(handle);
}
