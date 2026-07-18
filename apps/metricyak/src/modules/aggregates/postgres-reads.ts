import type { AggregatesRepository, MetricSummary } from '@metricyak/storage';
import type { ReadsAggregates, Window } from '@/modules/aggregates/aggregates.reads.js';

const GRANULARITY = 'minute' as const;

/** Serves the definition-aware reads seam from the existing Postgres bucket reads. */
export function createPostgresReadsAggregates(
  aggregates: Pick<AggregatesRepository, 'getPartials' | 'rawBreakdown'>,
): ReadsAggregates {
  return {
    windowPartials: ({ metric, window }: { metric: MetricSummary; projectId: string; window: Window }) =>
      aggregates.getPartials({
        metricId: metric.metricId,
        metricVersion: metric.version,
        granularity: GRANULARITY,
        rangeStart: window.from,
        rangeEnd: window.to,
      }),
    rawBreakdown: (params) => aggregates.rawBreakdown(params),
  };
}
