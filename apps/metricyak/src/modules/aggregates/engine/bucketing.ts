import type { BucketGranularity } from '@metricyak/storage';

const GRANULARITY_MS = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
} as const satisfies Record<BucketGranularity, number>;

export function floorToGranularity(date: Date, granularity: BucketGranularity): Date {
  const size = GRANULARITY_MS[granularity];
  return new Date(Math.floor(date.getTime() / size) * size);
}

export function dayStart(date: Date): Date {
  return floorToGranularity(date, 'day');
}

export function addGranularity(date: Date, granularity: BucketGranularity, steps: number): Date {
  return new Date(date.getTime() + GRANULARITY_MS[granularity] * steps);
}
