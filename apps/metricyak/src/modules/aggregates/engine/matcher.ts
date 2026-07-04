import type { MetricAggregation, MetricsRepository } from '@metricyak/storage';

export type MatchTarget = {
  metricId: string;
  metricVersion: number;
  eventKey: string;
  aggregation: MetricAggregation;
  field: string | null;
  dimensions: readonly string[];
};

export type MatcherMap = ReadonlyMap<string, readonly MatchTarget[]>;

type ProjectIndex = {
  epoch: string;
  byEventName: MatcherMap;
};

export class MetricMatcher {
  private readonly cache = new Map<string, ProjectIndex>();

  constructor(private readonly metrics: MetricsRepository) {}

  async resolve(projectId: string): Promise<MatcherMap> {
    const epoch = await this.metrics.matcherEpoch(projectId);
    const cached = this.cache.get(projectId);
    if (cached && cached.epoch === epoch) {
      return cached.byEventName;
    }

    const byEventName = await this.build(projectId);
    this.cache.set(projectId, { epoch, byEventName });
    return byEventName;
  }

  private async build(projectId: string): Promise<MatcherMap> {
    const summaries = await this.metrics.listByProject(projectId);
    const byEventName = new Map<string, MatchTarget[]>();

    for (const summary of summaries) {
      const dimensions = summary.definition.dimensions ?? [];

      for (const event of summary.definition.events) {
        const target: MatchTarget = {
          metricId: summary.metricId,
          metricVersion: summary.version,
          eventKey: event.key,
          aggregation: event.aggregation,
          field: event.field ?? null,
          dimensions,
        };
        const existing = byEventName.get(event.type);
        if (existing) {
          existing.push(target);
        } else {
          byEventName.set(event.type, [target]);
        }
      }
    }

    return byEventName;
  }
}
