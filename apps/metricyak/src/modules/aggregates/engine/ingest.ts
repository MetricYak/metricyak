import type { StoredEvent } from '@metricyak/queue';
import { type BucketPartialDelta, TOTAL_SENTINEL } from '@metricyak/storage';
import { floorToGranularity } from '@/modules/aggregates/engine/bucketing.js';
import type { MatcherMap, MatchTarget } from '@/modules/aggregates/engine/matcher.js';

export type DimResolver = (
  metricId: string,
  metricVersion: number,
  dimName: string,
  rawValue: string,
) => string;

const FIELD_PREFIX = '$properties.';

const MAX_DIM_VALUE_LENGTH = 256;

function compositeKey(parts: ReadonlyArray<string | number>): string {
  return JSON.stringify(parts);
}

export function fieldPath(field: string): string[] {
  const path = field.startsWith(FIELD_PREFIX) ? field.slice(FIELD_PREFIX.length) : field;
  return path.split('.');
}

export function extractField(
  properties: Record<string, unknown>,
  field: string | null,
): number | null {
  if (field == null) return null;

  let current: unknown = properties;
  for (const segment of fieldPath(field)) {
    if (current == null || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[segment];
  }

  const value = Number(current);
  return Number.isFinite(value) ? value : null;
}

function dimValueOf(properties: Record<string, unknown>, dimName: string): string | null {
  const raw = properties[dimName];
  if (raw == null) return null;
  return String(raw).slice(0, MAX_DIM_VALUE_LENGTH);
}

function dimensionKey(metricId: string, metricVersion: number, dimName: string): string {
  return compositeKey([metricId, metricVersion, dimName]);
}

export type DimensionCandidate = {
  metricId: string;
  metricVersion: number;
  dimName: string;
  values: Set<string>;
};

export function collectDimensionCandidates(
  events: readonly StoredEvent[],
  matcher: MatcherMap,
): Map<string, DimensionCandidate> {
  const candidates = new Map<string, DimensionCandidate>();

  for (const event of events) {
    const targets = matcher.get(event.name);
    if (!targets) continue;

    for (const target of targets) {
      for (const dimName of target.dimensions) {
        const value = dimValueOf(event.properties, dimName);
        if (value === null) continue;
        const key = dimensionKey(target.metricId, target.metricVersion, dimName);
        const candidate = candidates.get(key);
        if (candidate) {
          candidate.values.add(value);
        } else {
          candidates.set(key, {
            metricId: target.metricId,
            metricVersion: target.metricVersion,
            dimName,
            values: new Set([value]),
          });
        }
      }
    }
  }

  return candidates;
}

function mergeMin(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function mergeMax(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

function contribute(
  accumulators: Map<string, BucketPartialDelta>,
  target: MatchTarget,
  bucketStart: Date,
  dimName: string,
  dimValue: string,
  value: number | null,
): void {
  const key = compositeKey([
    target.metricId,
    target.metricVersion,
    target.eventKey,
    bucketStart.getTime(),
    dimName,
    dimValue,
  ]);

  const delta: BucketPartialDelta = accumulators.get(key) ?? {
    metricId: target.metricId,
    metricVersion: target.metricVersion,
    granularity: 'minute',
    bucketStart,
    seriesKey: target.eventKey,
    dimName,
    dimValue,
    count: 0,
    sum: 0,
    min: null,
    max: null,
  };

  delta.count += 1;
  if (target.aggregation === 'sum' || target.aggregation === 'average') {
    if (value !== null) delta.sum += value;
  } else if (target.aggregation === 'min') {
    delta.min = mergeMin(delta.min, value);
  } else if (target.aggregation === 'max') {
    delta.max = mergeMax(delta.max, value);
  }

  accumulators.set(key, delta);
}

export function buildIngestDeltas(
  events: readonly StoredEvent[],
  matcher: MatcherMap,
  resolveDim: DimResolver,
): BucketPartialDelta[] {
  const accumulators = new Map<string, BucketPartialDelta>();

  for (const event of events) {
    const targets = matcher.get(event.name);
    if (!targets) continue;

    const bucketStart = floorToGranularity(new Date(event.timestamp), 'minute');

    for (const target of targets) {
      const value =
        target.aggregation === 'count' ? null : extractField(event.properties, target.field);
      if (target.aggregation !== 'count' && value === null) continue;

      contribute(accumulators, target, bucketStart, TOTAL_SENTINEL, TOTAL_SENTINEL, value);

      for (const dimName of target.dimensions) {
        const rawValue = dimValueOf(event.properties, dimName);
        if (rawValue === null) continue;
        const dimValue = resolveDim(target.metricId, target.metricVersion, dimName, rawValue);
        contribute(accumulators, target, bucketStart, dimName, dimValue, value);
      }
    }
  }

  return [...accumulators.values()];
}
